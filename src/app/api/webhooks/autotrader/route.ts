import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';

// Validate the AT webhook signature.
// Header format: "t=<epoch>,v1=<hmac_sha256>"
// Hash input: "<t>.<raw_body>"
function validateSignature(rawBody: string, signatureHeader: string | null): boolean {
    const secret = process.env.AUTOTRADER_WEBHOOK_SECRET;
    if (!secret || !signatureHeader) return false;

    const parts = Object.fromEntries(
        signatureHeader.split(',').map(p => {
            const idx = p.indexOf('=');
            return [p.slice(0, idx), p.slice(idx + 1)];
        })
    );
    const t  = parts['t'];
    const v1 = parts['v1'];
    if (!t || !v1) return false;

    const expected = createHmac('sha256', secret)
        .update(`${t}.${rawBody}`)
        .digest('hex');

    return expected === v1;
}

const STATUS_MAP: Record<string, string> = {
    FORECOURT:        'In Stock',
    SALE_IN_PROGRESS: 'Reserved',
    SOLD:             'Sold',
    DUE_IN:           'Draft',
    WASTEBIN:         'Deleted',
    DELETED:          'Deleted',
};

const AT_CONDITION_REVERSE: Record<string, string> = {
    'Excellent': 'Excellent', 'Good': 'Good', 'Average': 'Fair', 'Poor': 'Poor',
};
const AT_ORIGIN_REVERSE: Record<string, string> = {
    'UK': 'UK Vehicle', 'Non UK': 'Import',
};
const AT_VAT_REVERSE: Record<string, string> = {
    'Standard': 'VAT Qualifying', 'Marginal': 'No VAT',
};

// AT sends PUT requests to this endpoint.
export async function PUT(req: NextRequest) {
    // 1. Read raw body for HMAC validation (must happen before any parsing)
    const rawBody = await req.text();
    const sig     = req.headers.get('autotrader-signature');

    if (!validateSignature(rawBody, sig)) {
        console.warn('[AT Webhook] Invalid signature — rejected');
        return NextResponse.json({ ok: false }, { status: 401 });
    }

    let payload: any;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const { id, type, stockEventSource, integrationId, data } = payload;

    // Only handle stock updates
    if (type !== 'STOCK_UPDATE') {
        return NextResponse.json({ ok: true, skipped: true });
    }

    // Ignore changes that originated from our own AT_CONNECT integration
    // to avoid infinite update loops (we changed it → AT notifies us → we update again...)
    if (stockEventSource === 'AT_CONNECT') {
        return NextResponse.json({ ok: true, skipped: 'own_update' });
    }

    const stockId = id || data?.metadata?.stockId;
    if (!stockId) {
        return NextResponse.json({ ok: true, skipped: 'no_stock_id' });
    }

    await connectToDatabase();

    // Find the local vehicle by stockId across any tenant
    const localVehicle = await Vehicle.findOne({ stockId });
    if (!localVehicle) {
        // Unknown vehicle — nothing to sync locally
        return NextResponse.json({ ok: true, skipped: 'unknown_stock' });
    }

    const tenantId  = localVehicle.tenantId;
    const veh       = data?.vehicle  || {};
    const adverts   = data?.adverts  || {};
    const retail    = adverts.retailAdverts || {};
    const meta      = data?.metadata || {};
    const features  = data?.features || null;
    const media     = data?.media    || {};

    const $set: Record<string, any> = {};

    // ── Lifecycle / status ────────────────────────────────────────────────────
    if (meta.lifecycleState) {
        const newStatus = STATUS_MAP[meta.lifecycleState];
        if (newStatus) $set.status = newStatus;
    }

    // ── Vehicle fields ────────────────────────────────────────────────────────
    if (veh.odometerReadingMiles !== undefined) $set.mileage          = Number(veh.odometerReadingMiles);
    if (veh.colour               !== undefined) $set.colour           = veh.colour;
    if (veh.fuelType             !== undefined) $set.fuelType         = veh.fuelType;
    if (veh.transmissionType     !== undefined) $set.transmission     = veh.transmissionType;
    if (veh.bodyType             !== undefined) $set.bodyType         = veh.bodyType;
    if (veh.yearOfManufacture    !== undefined) $set.year             = veh.yearOfManufacture;
    if (veh.vin                  !== undefined) $set.vin              = veh.vin;
    if (veh.engineNumber         !== undefined) $set.engineNumber     = veh.engineNumber;
    if (veh.plate                !== undefined) $set.plate            = veh.plate;
    if (veh.doors                !== undefined) $set.doors            = veh.doors;
    if (veh.seats                !== undefined) $set.seats            = veh.seats;
    if (veh.drivetrain           !== undefined) $set.drivetrain       = veh.drivetrain;
    if (veh.steeringPosition     !== undefined) $set.driverPosition   = veh.steeringPosition;
    if (veh.emissionClass        !== undefined) $set.emissionClass    = veh.emissionClass;
    if (veh.co2EmissionGPKM      !== undefined) $set.co2EmissionGPKM  = veh.co2EmissionGPKM;
    if (veh.exteriorFinish       !== undefined) $set.exteriorFinish   = veh.exteriorFinish;
    if (veh.firstRegistrationDate !== undefined) $set.dateOfRegistration = veh.firstRegistrationDate;
    if (veh.serviceHistory       !== undefined) $set.serviceHistory   = veh.serviceHistory;
    if (veh.previousOwners       !== undefined) $set.previousOwners   = Number(veh.previousOwners);
    if (veh.motExpiryDate        !== undefined) $set.motExpiry        = veh.motExpiryDate;
    if (veh.warrantyMonthsOnPurchase !== undefined) $set.manufacturerWarrantyMonths = Number(veh.warrantyMonthsOnPurchase);
    if (veh.keys                 !== undefined) $set.numberOfKeys     = Number(veh.keys);
    if (veh.v5Certificate        !== undefined) $set.v5Present        = veh.v5Certificate;
    if (veh.exDemo               !== undefined) $set.exDemo           = veh.exDemo;
    if (veh.wheelchairAccessible !== undefined) $set.wheelchairAccessible = veh.wheelchairAccessible;
    if (veh.origin               !== undefined) $set.origin           = AT_ORIGIN_REVERSE[veh.origin] || veh.origin;
    if (veh.interiorCondition    !== undefined) $set.interiorCondition = AT_CONDITION_REVERSE[veh.interiorCondition] || veh.interiorCondition;
    if (veh.tyreCondition        !== undefined) $set.tyreCondition    = AT_CONDITION_REVERSE[veh.tyreCondition]     || veh.tyreCondition;
    if (veh.bodyCondition        !== undefined) $set.exteriorCondition = AT_CONDITION_REVERSE[veh.bodyCondition]    || veh.bodyCondition;
    if (veh.engineCapacityCC     !== undefined) $set.engineSize       = String(veh.engineCapacityCC);

    // ── Pricing ───────────────────────────────────────────────────────────────
    if (retail.suppliedPrice?.amountGBP !== undefined) $set.price         = retail.suppliedPrice.amountGBP;
    if (adverts.forecourtPrice?.amountGBP !== undefined) $set.forecourtPrice = adverts.forecourtPrice.amountGBP;
    if (retail.priceOnApplication !== undefined) $set.priceOnApplication  = retail.priceOnApplication;
    if (adverts.vatScheme !== undefined) $set.vatStatus = AT_VAT_REVERSE[adverts.vatScheme] || adverts.vatScheme;

    // ── Advert content ────────────────────────────────────────────────────────
    if (retail.description      !== undefined) $set.description      = retail.description;
    if (retail.description2     !== undefined) $set.description2     = retail.description2;
    if (retail.attentionGrabber !== undefined) $set.attentionGrabber = retail.attentionGrabber;

    // ── Advert settings ───────────────────────────────────────────────────────
    if (adverts.dueDate      !== undefined) $set.dueInDate           = adverts.dueDate;
    if (adverts.stockInDate  !== undefined) $set.dateInStock         = adverts.stockInDate;
    if (adverts.twelveMonthsMot !== undefined) $set.includes12MonthsMot = adverts.twelveMonthsMot;
    if (adverts.motInsurance !== undefined) $set.includesMotInsurance = adverts.motInsurance;

    // ── Advert channel statuses ───────────────────────────────────────────────
    const autotraderAdvert   = retail.autotraderAdvert?.status;
    const advertiserAdvert   = retail.advertiserAdvert?.status;
    const locatorAdvert      = retail.locatorAdvert?.status;
    const exportAdvert       = retail.exportAdvert?.status;
    const profileAdvert      = retail.profileAdvert?.status;
    if (autotraderAdvert)  $set.atAdvertStatus          = autotraderAdvert;
    if (advertiserAdvert)  $set.advertiserAdvertStatus  = advertiserAdvert;
    if (locatorAdvert)     $set.locatorAdvertStatus     = locatorAdvert;
    if (exportAdvert)      $set.exportAdvertStatus      = exportAdvert;
    if (profileAdvert)     $set.profileAdvertStatus     = profileAdvert;

    // ── Features ─────────────────────────────────────────────────────────────
    if (features !== null && Array.isArray(features)) {
        const standardFeatures: string[]      = [];
        const optionalFeatures: string[]      = [];
        const factoryFittedFeatures: string[] = [];
        for (const f of features) {
            const name = typeof f === 'string' ? f : (f.name || '');
            if (!name) continue;
            if (f.factoryFitted) factoryFittedFeatures.push(name);
            if (f.type === 'Optional') optionalFeatures.push(name); else standardFeatures.push(name);
        }
        $set.standardFeatures      = standardFeatures;
        $set.features              = optionalFeatures;
        $set.factoryFittedFeatures = factoryFittedFeatures;
    }

    // ── Media images (only if real AT imageIds present) ───────────────────────
    if (media.images && Array.isArray(media.images)) {
        const atApiUrl = process.env.AUTOTRADER_API_URL || 'https://api.autotrader.co.uk';
        const cdnHost  = atApiUrl.includes('sandbox') ? 'm-qa.atcdn.co.uk' : 'm.atcdn.co.uk';
        const imageIds = media.images.map((img: any) => img.imageId || '').filter(Boolean);
        if (imageIds.length > 0) {
            const images = media.images.map((img: any) =>
                img.href || `https://${cdnHost}/a/media/{resize}/${img.imageId}.jpg`
            ).filter(Boolean);
            $set.imageIds     = imageIds;
            $set.images       = images;
            $set.primaryImage = images[0] || '';
            $set.imagesCount  = imageIds.length;
        }
    }

    // ── Apply to local DB ─────────────────────────────────────────────────────
    if (Object.keys($set).length > 0) {
        await Vehicle.updateOne({ stockId, tenantId }, { $set });
        console.log(`[AT Webhook] Stock ${stockId} synced from ${stockEventSource || 'AT portal'}:`, Object.keys($set));
    }

    // ── Update AT cache so list page shows fresh data instantly ───────────────
    try {
        const cacheDoc = await AutoTraderStockCache.findOne({ tenantId });
        if (cacheDoc?.stock) {
            const idx = cacheDoc.stock.findIndex((s: any) => s.id === stockId);
            if (idx !== -1) {
                // Merge the webhook data.vehicle into cache.vehicle sub-object
                const item = cacheDoc.stock[idx];
                if (Object.keys(veh).length > 0) {
                    item.vehicle = { ...(item.vehicle || {}), ...veh };
                }
                if ($set.price !== undefined) {
                    item.price = $set.price;
                    item.adverts = item.adverts || {};
                    item.adverts.retailAdverts = item.adverts.retailAdverts || {};
                    item.adverts.retailAdverts.suppliedPrice = { amountGBP: $set.price };
                }
                if ($set.status !== undefined) item.status = $set.status;
                await AutoTraderStockCache.updateOne({ tenantId }, { $set: { stock: cacheDoc.stock } });
            }
        }
    } catch (err) {
        console.error('[AT Webhook] Cache update error:', err);
    }

    return NextResponse.json({ ok: true });
}
