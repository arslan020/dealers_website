import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';
import connectToDatabase from '@/lib/db';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';
import Vehicle from '@/models/Vehicle';
import { pickSilentSalesmanDescriptionFromVehicle, advertDescriptionToPlainText } from '@/lib/silent-salesman/vehicle-fields';

// Rate limit removed — sync always fetches fresh from AutoTrader

async function getAutoTraderStock(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session || !session.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    if (session.role === 'SUPER_ADMIN') {
        return NextResponse.json({ ok: false, error: { message: 'Super Admins do not have dealer access.', code: 'FORBIDDEN' } }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = 25;
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const tenantObjectId = session.tenantId;
    const now = new Date();

    // ─── Fetch fresh from AutoTrader with 60-second TTL ─────────────────────────
    let cache = await AutoTraderStockCache.findOne({ tenantId: tenantObjectId });
    const CACHE_TTL_MS = 60 * 1000;
    const cacheFetchedAgeMs = cache?.fetchedAt ? now.getTime() - new Date(cache.fetchedAt).getTime() : Infinity;
    const shouldFetch = cacheFetchedAgeMs > CACHE_TTL_MS;

    if (shouldFetch) {

        try {
            // ─── Fetch fresh stock from AutoTrader ──────────────────────────────
            const client = new AutoTraderClient(session.tenantId);
            await client.init();

            const queryParams: Record<string, string> = {
                advertiserId: client.dealerId || '',
                page: '1',
                pageSize: '200', // AutoTrader maximum page size
                features: 'true',
            };

            const responseData = await client.get('/stock', queryParams);

            const rawStock = responseData.results || responseData.vehicles || responseData.stock || responseData.data || (Array.isArray(responseData) ? responseData : []);
            
            // AT API sometimes returns vehicle fields as objects like { name: "BMW" } instead of strings
            const toStr = (val: any): string => {
                if (!val) return '';
                if (typeof val === 'string') return val;
                if (typeof val === 'object') return val.name || val.value || '';
                return String(val);
            };

            const allStock = rawStock
                .map((v: any, index: number) => {
                    // AutoTrader often hides the real ID in metadata or adverts
                    const realId = v.id || v.stockId || v.advertId || v.vehicle?.id || v.metadata?.stockId || v.metadata?.advertId || v.adverts?.[0]?.advertId;
                    const id = realId || v.vehicle?.vrm || v.vrm || v.vehicle?.registrationNumber || v.registrationNumber || `at-${index}`;

                    // ── Map AT lifecycleState → local status ──────────────────
                    const lifecycleState: string = v.metadata?.lifecycleState || 'FORECOURT';
                    const statusMap: Record<string, string> = {
                        FORECOURT:        'In Stock',
                        SALE_IN_PROGRESS: 'Reserved',
                        SOLD:             'Sold',
                        DUE_IN:           'Draft',
                    };
                    const status = statusMap[lifecycleState] || 'In Stock';
                    
                    return {
                        id,
                        isRealAtId: !!realId,
                        vrm: toStr(v.vehicle?.vrm || v.vrm || v.vehicle?.registration || v.registration || v.vehicle?.registrationNumber || v.registrationNumber),
                        make: toStr(v.vehicle?.make || v.make),
                        model: toStr(v.vehicle?.model || v.model),
                        derivative: toStr(v.vehicle?.derivative || v.derivative),
                        year: toStr(v.vehicle?.yearOfManufacture || v.year || v.vehicle?.registrationYear),
                        mileage: v.vehicle?.odometerReadingMiles || v.mileage || v.vehicle?.odometer?.value || 0,
                        price: v.adverts?.forecourtPrice?.amountGBP || v.adverts?.retailAdverts?.suppliedPrice?.amountGBP || v.price?.advertisedPrice || v.retailPrice || 0,
                        status,
                        primaryImage: (v.media?.images?.[0]?.href) || (v.images?.[0]?.href) || (v.images?.[0]) || '',
                        images: (v.media?.images || []).map((img: any) => img.href || img),
                        fuelType: toStr(v.vehicle?.fuelType),
                        transmission: toStr(v.vehicle?.transmissionType),
                        colour: toStr(v.vehicle?.colour),
                        engineSize: toStr(v.vehicle?.engineSizeCc),
                        bodyType: toStr(v.vehicle?.bodyType),
                        features: v.features || [],
                        technicalSpecs: v.vehicle || {},
                        adverts: v.adverts,
                        // Keep full metadata so dashboard can read lifecycleState & dateOnForecourt from cache
                        metadata: v.metadata || {},
                    };
                })
                .filter((v: any) => v.make && (v.isRealAtId || (v.id && !v.id.startsWith('at-')))); 

            // ─── Save to cache ──────────────────────────────────────────────────
            if (cache) {
                cache.stock = allStock;
                cache.total = allStock.length;
                cache.fetchedAt = now;
                await cache.save();
            } else {
                cache = await AutoTraderStockCache.create({
                    tenantId: tenantObjectId,
                    stock: allStock,
                    total: allStock.length,
                    fetchedAt: now,
                });
            }

            console.log(`[AutoTrader] Fresh stock fetched for tenant ${tenantObjectId}. ${allStock.length} vehicles.`);

            // Remove local DB vehicles whose stockId is no longer on AT (deleted from AT)
            const activeAtStockIds = Array.from(new Set(allStock.map((v: any) => v.id).filter(Boolean)));
            if (activeAtStockIds.length > 0) {
                Vehicle.deleteMany({
                    tenantId: tenantObjectId,
                    stockId: { $exists: true, $ne: null, $nin: activeAtStockIds },
                }).catch(() => {});
            }
        } catch (error: any) {
            // If fresh fetch fails but we have stale cache, serve it anyway
            if (cache?.stock?.length) {
                console.warn(`[AutoTrader] Fresh fetch failed, serving stale cache. Error: ${error.message}`);
            } else {
                const isConfigError = error.message?.includes('not configured');
                const isRateLimitError = error.message?.includes('429');
                
                return NextResponse.json({
                    ok: false,
                    error: {
                        message: isConfigError
                            ? 'AutoTrader is not connected for this dealership. Please ask your admin to configure it.'
                            : isRateLimitError
                                ? 'AutoTrader is currently busy. Please wait 5 minutes before trying again.'
                                : 'Failed to fetch stock from AutoTrader.',
                        code: isConfigError ? 'NOT_CONFIGURED' : (isRateLimitError ? 'AT_RATE_LIMITED' : 'API_ERROR'),
                    }
                }, { status: isConfigError ? 400 : (isRateLimitError ? 429 : 500) });
            }
        }
    }

    // ─── Serve from cache (with local search filter + pagination) ────────────
    let stockItems = (cache?.stock || [])
        .filter((v: any) => v.make && (v.isRealAtId || (v.id && !v.id.startsWith('at-'))));

    if (search) {
        stockItems = stockItems.filter((v: any) =>
            v.make?.toLowerCase().includes(search) ||
            v.model?.toLowerCase().includes(search) ||
            v.vrm?.toLowerCase().includes(search) ||
            v.derivative?.toLowerCase().includes(search)
        );
    }

    const total = stockItems.length;
    const startIdx = (page - 1) * pageSize;
    const pagedStock = stockItems.slice(startIdx, startIdx + pageSize);

    const cacheAge = cache?.fetchedAt
        ? Math.round((now.getTime() - cache.fetchedAt.getTime()) / 60000)
        : null;

    return NextResponse.json({
        ok: true,
        stock: pagedStock,
        total,
        cachedAt: cache?.fetchedAt || null,
        nextRefreshAt: cache?.nextAllowedFetchAt || null,
        cacheAgeMinutes: cacheAge,
        fromCache: !shouldFetch,
    });
}


/**
 * POST /api/vehicles/autotrader-stock
 * Creates a new stock record on AutoTrader.
 * Body: { vehicle: localVehicleObject }
 * Capability: Stock Updates
 */
export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;

        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' } }, { status: 401 });
        }

        const body = await req.json();
        const { vehicleId } = body;

        if (!vehicleId) {
            return NextResponse.json({ ok: false, error: { message: 'vehicleId is required.', code: 'VALIDATION_ERROR' } }, { status: 400 });
        }

        await connectToDatabase();

        const vehicle = await Vehicle.findOne({ _id: vehicleId, tenantId: session.tenantId }).lean() as any;
        if (!vehicle) {
            return NextResponse.json({ ok: false, error: { message: 'Vehicle not found.', code: 'NOT_FOUND' } }, { status: 404 });
        }

        // AT requires min £75 for Car/Bike/Van to be advertised
        const suppliedPrice = Number(vehicle.price) || 0;
        if (suppliedPrice < 75) {
            return NextResponse.json({ ok: false, error: { message: 'Price must be at least £75 to advertise on AutoTrader.', code: 'VALIDATION_ERROR' } }, { status: 400 });
        }
        // forecourtPrice = total display price (may include admin fee). Must always be sent.
        // If not explicitly set, default to suppliedPrice.
        const forecourtPrice = Number(vehicle.forecourtPrice) || suppliedPrice;

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // ─── Map local vehicle to AT schema ──────────────────────────────
        // Priority: explicit model field → technicalSpecs (from AT lookup) → manualSpecs
        const ms = vehicle.manualSpecs || {};
        const ts = vehicle.technicalSpecs || {};
        const sp = (val: any, key: string) => {
            if (val !== undefined && val !== null) return val;
            if (ts[key] !== undefined && ts[key] !== null) return ts[key];
            return ms[key];
        };

        const vrm = (vehicle.vrm || vehicle.registration || '').toString().toUpperCase().replace(/\s/g, '');
        const engineCC = vehicle.engineSize ? parseInt(String(vehicle.engineSize).replace(/\D/g, ''), 10) || undefined : undefined;

        // Attention grabber: use stored value, fall back to longAttentionGrabber (truncated), or skip
        const rawGrabber = (vehicle.attentionGrabber || '').trim()
            || (vehicle.longAttentionGrabber || '').trim().slice(0, 30);
        const advertAttentionGrabber = rawGrabber.slice(0, 30) || undefined;

        // Description: use best available text via the same selection logic as the advert preview
        const rawDescription = advertDescriptionToPlainText(
            vehicle.description ||
            vehicle.description2 ||
            pickSilentSalesmanDescriptionFromVehicle(vehicle)
        ).trim();
        const advertDescription = rawDescription.slice(0, 4000) || undefined;

        // description2: secondary paragraph sent only when it differs from description
        const rawDescription2 = advertDescriptionToPlainText(vehicle.description2 || '').trim();
        const advertDescription2 = (rawDescription2 && rawDescription2 !== rawDescription)
            ? rawDescription2.slice(0, 4000)
            : undefined;

        // AT condition values: Poor | Average | Good | Clean | Excellent | New
        // Our model uses: Poor | Fair | Good | Excellent → map Fair → Average
        const mapCondition = (v?: string) => v === 'Fair' ? 'Average' : v;

        // AT vatScheme: 'Marginal' for margin scheme vehicles
        const vatScheme = vehicle.vatType === 'Margin' ? 'Marginal' : undefined;

        // AT retailAdverts.vatStatus: 'Inc VAT' | 'No VAT' | 'Ex VAT'
        // Only relevant for non-Margin vehicles. Blank for Used cars (AT default).
        const retailVatStatus = vehicle.vatType === 'Standard' ? 'Inc VAT'
            : vehicle.vatType === 'Zero Rated' ? 'No VAT'
            : undefined;

        // AT displayOptions: map from vehicle.excludeFromAdvert
        const exFromAdvert = vehicle.excludeFromAdvert || {};
        const hasDisplayOptions = Object.values(exFromAdvert).some(Boolean);
        const displayOptions = hasDisplayOptions ? {
            excludePreviousOwners: Boolean(exFromAdvert.previousOwners),
            excludeStrapline:      Boolean(exFromAdvert.attentionGrabber),
            excludeMot:            Boolean(exFromAdvert.mot),
            excludeWarranty:       Boolean(exFromAdvert.warranty),
            excludeInteriorDetails:Boolean(exFromAdvert.interiorCondition),
            excludeTyreCondition:  Boolean(exFromAdvert.tyreCondition),
            excludeBodyCondition:  Boolean(exFromAdvert.exteriorCondition),
        } : undefined;

        // lifecycleState: Draft / To Order → DUE_IN (not yet on forecourt), everything else → FORECOURT
        const lifecycleState = (vehicle.status === 'Draft' || vehicle.status === 'To Order')
            ? 'DUE_IN'
            : 'FORECOURT';

        // features: combine standard + custom, send as [{name}] objects (AT docs requirement)
        const allFeatures = [
            ...(vehicle.features || []),
            ...(vehicle.customFeatures || []),
        ].map((name: string) => ({ name }));

        // media.images: AT requires [{imageId}] — use locally stored AT imageIds
        const mediaImages = (vehicle.imageIds || []).map((imageId: string) => ({ imageId }));

        // media.video: AT expects a YouTube href — use first youtubeVideoId if present
        const firstVideoId = vehicle.youtubeVideoIds?.[0];
        const mediaVideo = firstVideoId
            ? { href: `https://www.youtube.com/watch?v=${firstVideoId}` }
            : undefined;

        const stockPayload: any = {
            vehicle: {
                ...(vehicle.make               && { make: vehicle.make }),
                ...(vehicle.model              && { model: vehicle.model }),
                ...(vrm                        && { registration: vrm }),
                ...(vehicle.vin                && { vin: vehicle.vin }),
                ...(vehicle.derivativeId       && { derivativeId: vehicle.derivativeId }),
                ...(vehicle.vehicleType        && { vehicleType: vehicle.vehicleType }),
                ...(vehicle.derivative         && { derivative: vehicle.derivative }),
                ...(vehicle.generation         && { generation: vehicle.generation }),
                ...(vehicle.trim               && { trim: vehicle.trim }),
                ...(vehicle.bodyType           && { bodyType: vehicle.bodyType }),
                ...(vehicle.fuelType           && { fuelType: vehicle.fuelType }),
                ...(vehicle.transmission       && { transmissionType: vehicle.transmission }),
                ...(vehicle.cabType            && { cabType: vehicle.cabType }),
                ...(vehicle.wheelbaseType      && { wheelbaseType: vehicle.wheelbaseType }),
                ...(vehicle.roofHeightType     && { roofHeightType: vehicle.roofHeightType }),
                ...(vehicle.drivetrain         && { drivetrain: vehicle.drivetrain }),
                ...(vehicle.colour             && { colour: vehicle.colour }),
                ...(vehicle.exteriorFinish     && { exteriorFinish: vehicle.exteriorFinish }),
                ...(vehicle.interiorUpholstery && { upholstery: vehicle.interiorUpholstery }),
                ...(vehicle.plate              && { plate: vehicle.plate }),
                ...(vehicle.doors              != null && { doors: Number(vehicle.doors) }),
                ...(vehicle.seats              != null && { seats: Number(vehicle.seats) }),
                ...(vehicle.mileage            != null && { odometerReadingMiles: Number(vehicle.mileage) }),
                ...(vehicle.year               && { yearOfManufacture: String(vehicle.year) }),
                // AT requires full YYYY-MM-DD — skip if only a year or invalid format is stored
                ...(vehicle.dateOfRegistration && /^\d{4}-\d{2}-\d{2}/.test(String(vehicle.dateOfRegistration)) && { firstRegistrationDate: vehicle.dateOfRegistration }),
                ...(sp(vehicle.wheelchairAccessible, 'wheelchairAccessible') != null && { wheelchairAccessible: Boolean(sp(vehicle.wheelchairAccessible, 'wheelchairAccessible')) }),
                // Engine — model field wins; technicalSpecs (AT lookup) fills gaps; manualSpecs last resort
                ...(engineCC                                                         && { engineCapacityCC: engineCC }),
                ...(sp(vehicle.badgeEngineSizeLitres, 'badgeEngineSizeLitres') != null && { badgeEngineSizeLitres: Number(sp(vehicle.badgeEngineSizeLitres, 'badgeEngineSizeLitres')) }),
                ...(sp(vehicle.enginePowerBHP,  'enginePowerBHP')  != null && { enginePowerBHP:  Number(sp(vehicle.enginePowerBHP,  'enginePowerBHP')) }),
                ...(sp(vehicle.enginePowerPS,   'enginePowerPS')   != null && { enginePowerPS:   Number(sp(vehicle.enginePowerPS,   'enginePowerPS')) }),
                ...(sp(vehicle.engineTorqueNM,  'engineTorqueNM')  != null && { engineTorqueNM:  Number(sp(vehicle.engineTorqueNM,  'engineTorqueNM')) }),
                ...(sp(vehicle.engineTorqueLBFT,'engineTorqueLBFT')!= null && { engineTorqueLBFT:Number(sp(vehicle.engineTorqueLBFT,'engineTorqueLBFT')) }),
                ...(sp(vehicle.cylinders,       'cylinders')       != null && { cylinders:       Number(sp(vehicle.cylinders,       'cylinders')) }),
                ...(sp(vehicle.cylinderArrangement,'cylinderArrangement') && { cylinderArrangement: sp(vehicle.cylinderArrangement,'cylinderArrangement') }),
                ...(sp(vehicle.valves,          'valves')          != null && { valves:          Number(sp(vehicle.valves,          'valves')) }),
                ...(sp(vehicle.boreMM,          'boreMM')          != null && { boreMM:          Number(sp(vehicle.boreMM,          'boreMM')) }),
                ...(sp(vehicle.strokeMM,        'strokeMM')        != null && { strokeMM:        Number(sp(vehicle.strokeMM,        'strokeMM')) }),
                ...(sp(vehicle.fuelCapacityLitres, 'fuelCapacityLitres') != null && { fuelCapacityLitres: Number(sp(vehicle.fuelCapacityLitres, 'fuelCapacityLitres')) }),
                ...(sp(vehicle.fuelDelivery,    'fuelDelivery')    && { fuelDelivery:    sp(vehicle.fuelDelivery,    'fuelDelivery') }),
                ...(sp(vehicle.gears,           'gears')           != null && { gears:           Number(sp(vehicle.gears,           'gears')) }),
                ...(sp(vehicle.startStop,       'startStop')       != null && { startStop:       Boolean(sp(vehicle.startStop,      'startStop')) }),
                // Performance
                ...(sp(vehicle.topSpeedMPH,               'topSpeedMPH')               != null && { topSpeedMPH:               Number(sp(vehicle.topSpeedMPH,               'topSpeedMPH')) }),
                ...(sp(vehicle.zeroToSixtyMPHSeconds,      'zeroToSixtyMPHSeconds')      != null && { zeroToSixtyMPHSeconds:      Number(sp(vehicle.zeroToSixtyMPHSeconds,      'zeroToSixtyMPHSeconds')) }),
                ...(sp(vehicle.zeroToOneHundredKMPHSeconds,'zeroToOneHundredKMPHSeconds') != null && { zeroToOneHundredKMPHSeconds: Number(sp(vehicle.zeroToOneHundredKMPHSeconds,'zeroToOneHundredKMPHSeconds')) }),
                // EV
                ...(sp(vehicle.batteryRangeMiles,        'batteryRangeMiles')        != null && { batteryRangeMiles:        Number(sp(vehicle.batteryRangeMiles,        'batteryRangeMiles')) }),
                ...(sp(vehicle.batteryCapacityKWH,       'batteryCapacityKWH')       != null && { batteryCapacityKWH:       Number(sp(vehicle.batteryCapacityKWH,       'batteryCapacityKWH')) }),
                ...(sp(vehicle.batteryUsableCapacityKWH, 'batteryUsableCapacityKWH') != null && { batteryUsableCapacityKWH: Number(sp(vehicle.batteryUsableCapacityKWH, 'batteryUsableCapacityKWH')) }),
                // Emissions & economy
                ...(sp(vehicle.co2EmissionGPKM, 'co2EmissionGPKM') != null && { co2EmissionGPKM: Number(sp(vehicle.co2EmissionGPKM, 'co2EmissionGPKM')) }),
                ...(sp(vehicle.emissionClass,   'emissionClass')   && { emissionClass: sp(vehicle.emissionClass, 'emissionClass') }),
                ...(sp(vehicle.fuelEconomyNEDCExtraUrbanMPG,  'fuelEconomyNEDCExtraUrbanMPG')  != null && { fuelEconomyNEDCExtraUrbanMPG:  Number(sp(vehicle.fuelEconomyNEDCExtraUrbanMPG,  'fuelEconomyNEDCExtraUrbanMPG')) }),
                ...(sp(vehicle.fuelEconomyNEDCUrbanMPG,       'fuelEconomyNEDCUrbanMPG')       != null && { fuelEconomyNEDCUrbanMPG:       Number(sp(vehicle.fuelEconomyNEDCUrbanMPG,       'fuelEconomyNEDCUrbanMPG')) }),
                ...(sp(vehicle.fuelEconomyNEDCCombinedMPG,    'fuelEconomyNEDCCombinedMPG')    != null && { fuelEconomyNEDCCombinedMPG:    Number(sp(vehicle.fuelEconomyNEDCCombinedMPG,    'fuelEconomyNEDCCombinedMPG')) }),
                ...(sp(vehicle.fuelEconomyWLTPLowMPG,         'fuelEconomyWLTPLowMPG')         != null && { fuelEconomyWLTPLowMPG:         Number(sp(vehicle.fuelEconomyWLTPLowMPG,         'fuelEconomyWLTPLowMPG')) }),
                ...(sp(vehicle.fuelEconomyWLTPMediumMPG,      'fuelEconomyWLTPMediumMPG')      != null && { fuelEconomyWLTPMediumMPG:      Number(sp(vehicle.fuelEconomyWLTPMediumMPG,      'fuelEconomyWLTPMediumMPG')) }),
                ...(sp(vehicle.fuelEconomyWLTPHighMPG,        'fuelEconomyWLTPHighMPG')        != null && { fuelEconomyWLTPHighMPG:        Number(sp(vehicle.fuelEconomyWLTPHighMPG,        'fuelEconomyWLTPHighMPG')) }),
                ...(sp(vehicle.fuelEconomyWLTPExtraHighMPG,   'fuelEconomyWLTPExtraHighMPG')   != null && { fuelEconomyWLTPExtraHighMPG:   Number(sp(vehicle.fuelEconomyWLTPExtraHighMPG,   'fuelEconomyWLTPExtraHighMPG')) }),
                ...(sp(vehicle.fuelEconomyWLTPCombinedMPG,    'fuelEconomyWLTPCombinedMPG')    != null && { fuelEconomyWLTPCombinedMPG:    Number(sp(vehicle.fuelEconomyWLTPCombinedMPG,    'fuelEconomyWLTPCombinedMPG')) }),
                // Insurance
                ...(sp(vehicle.insuranceGroup,        'insuranceGroup')        && { insuranceGroup:        sp(vehicle.insuranceGroup,        'insuranceGroup') }),
                ...(sp(vehicle.insuranceSecurityCode, 'insuranceSecurityCode') && { insuranceSecurityCode: sp(vehicle.insuranceSecurityCode, 'insuranceSecurityCode') }),
                // Dimensions
                ...(sp(vehicle.lengthMM,  'lengthMM')  != null && { lengthMM:  Number(sp(vehicle.lengthMM,  'lengthMM')) }),
                ...(sp(vehicle.heightMM,  'heightMM')  != null && { heightMM:  Number(sp(vehicle.heightMM,  'heightMM')) }),
                ...(sp(vehicle.widthMM,   'widthMM')   != null && { widthMM:   Number(sp(vehicle.widthMM,   'widthMM')) }),
                ...(sp(vehicle.wheelbaseMM,'wheelbaseMM') != null && { wheelbaseMM: Number(sp(vehicle.wheelbaseMM,'wheelbaseMM')) }),
                // Weight
                ...(sp(vehicle.minimumKerbWeightKG, 'minimumKerbWeightKG') != null && { minimumKerbWeightKG: Number(sp(vehicle.minimumKerbWeightKG, 'minimumKerbWeightKG')) }),
                ...(sp(vehicle.grossVehicleWeightKG,'grossVehicleWeightKG') != null && { grossVehicleWeightKG: Number(sp(vehicle.grossVehicleWeightKG,'grossVehicleWeightKG')) }),
                // Van/Truck payload
                ...(sp(vehicle.payloadLengthMM, 'payloadLengthMM') != null && { payloadLengthMM: Number(sp(vehicle.payloadLengthMM, 'payloadLengthMM')) }),
                ...(sp(vehicle.payloadHeightMM, 'payloadHeightMM') != null && { payloadHeightMM: Number(sp(vehicle.payloadHeightMM, 'payloadHeightMM')) }),
                ...(sp(vehicle.payloadWidthMM,  'payloadWidthMM')  != null && { payloadWidthMM:  Number(sp(vehicle.payloadWidthMM,  'payloadWidthMM')) }),
                ...(sp(vehicle.payloadWeightKG, 'payloadWeightKG') != null && { payloadWeightKG: Number(sp(vehicle.payloadWeightKG, 'payloadWeightKG')) }),
                // Boot space
                ...(sp(vehicle.bootSpaceSeatsUpLitres,   'bootSpaceSeatsUpLitres')   != null && { bootSpaceSeatsUpLitres:   Number(sp(vehicle.bootSpaceSeatsUpLitres,   'bootSpaceSeatsUpLitres')) }),
                ...(sp(vehicle.bootSpaceSeatsDownLitres, 'bootSpaceSeatsDownLitres') != null && { bootSpaceSeatsDownLitres: Number(sp(vehicle.bootSpaceSeatsDownLitres, 'bootSpaceSeatsDownLitres')) }),
                // Van/HGV specifics
                ...(sp(vehicle.axles,          'axles')          != null && { axles:          Number(sp(vehicle.axles,          'axles')) }),
                ...(sp(vehicle.unladenWeightKG,'unladenWeightKG')!= null && { unladenWeightKG:Number(sp(vehicle.unladenWeightKG,'unladenWeightKG')) }),
                ...(sp(vehicle.noseWeightKG,   'noseWeightKG')   != null && { noseWeightKG:   Number(sp(vehicle.noseWeightKG,   'noseWeightKG')) }),
                ...(sp(vehicle.mtplmKG,        'mtplmKG')        != null && { mtplmKG:        Number(sp(vehicle.mtplmKG,        'mtplmKG')) }),
                // EV charging
                ...(sp(vehicle.batteryChargeTime,      'batteryChargeTime')      && { batteryChargeTime:      sp(vehicle.batteryChargeTime,      'batteryChargeTime') }),
                ...(sp(vehicle.batteryQuickChargeTime, 'batteryQuickChargeTime') && { batteryQuickChargeTime: sp(vehicle.batteryQuickChargeTime, 'batteryQuickChargeTime') }),
                ...(sp(vehicle.batteryHealth,          'batteryHealth')          != null && { batteryHealth: Number(sp(vehicle.batteryHealth, 'batteryHealth')) }),
                // Compliance
                ...(sp(vehicle.ulezCompliant, 'ulezCompliant') != null && { ulezCompliant: Boolean(sp(vehicle.ulezCompliant, 'ulezCompliant')) }),
                ...(sp(vehicle.rde2,          'rde2')          != null && { rde2:          Boolean(sp(vehicle.rde2,          'rde2')) }),
                ...(sp(vehicle.countryOfOrigin,'countryOfOrigin') && { countryOfOrigin: sp(vehicle.countryOfOrigin,'countryOfOrigin') }),
                // Owners & history
                ...(vehicle.previousOwners     != null && { owners: Number(vehicle.previousOwners) }),
                ...(vehicle.engineNumber       && { engineNumber: vehicle.engineNumber }),
                ...(vehicle.serviceHistory     && { serviceHistory: vehicle.serviceHistory }),
                ...(vehicle.motExpiry          && { motExpiryDate: vehicle.motExpiry }),
                ...(vehicle.manufacturerWarrantyMonths != null && { warrantyMonthsOnPurchase: Number(vehicle.manufacturerWarrantyMonths) }),
                ...(vehicle.mileageAtLastService != null && { lastServiceOdometerReadingMiles: Number(vehicle.mileageAtLastService) }),
                ...(vehicle.dateOfLastService  && { lastServiceDate: vehicle.dateOfLastService }),
                ...(vehicle.numberOfKeys       != null && { keys: Number(vehicle.numberOfKeys) }),
                ...(vehicle.exDemo             != null && { exDemo: Boolean(vehicle.exDemo) }),
                ...(vehicle.v5Present          != null && { v5Certificate: Boolean(vehicle.v5Present) }),
                ...(vehicle.interiorCondition  && { interiorCondition: mapCondition(vehicle.interiorCondition) }),
                ...(vehicle.tyreCondition      && { tyreCondition: mapCondition(vehicle.tyreCondition) }),
                ...(vehicle.exteriorCondition  && { bodyCondition: mapCondition(vehicle.exteriorCondition) }),
                // driverPosition: only send if Left Hand Drive — RHD is the default and should be blank
                ...(vehicle.driverPosition && vehicle.driverPosition.toLowerCase().includes('left') && { driverPosition: 'Left Hand Drive' }),
                ...(vehicle.origin === 'Import'     && { origin: 'Non UK' }),
                ...(vehicle.origin === 'UK Vehicle' && { origin: 'UK' }),
            },
            adverts: {
                // forecourtPrice is at adverts level (NOT inside retailAdverts). Always required.
                forecourtPrice: { amountGBP: forecourtPrice },
                ...(retailVatStatus && { forecourtPriceVatStatus: retailVatStatus }),
                ...(vatScheme       && { vatScheme }),
                ...(vehicle.dueInDate              && { dueDate: vehicle.dueInDate }),
                ...(vehicle.dateInStock            && { stockInDate: vehicle.dateInStock }),
                ...(vehicle.includes12MonthsMot    != null && { twelveMonthsMot: Boolean(vehicle.includes12MonthsMot) }),
                ...(vehicle.includesMotInsurance   != null && { motInsurance: Boolean(vehicle.includesMotInsurance) }),
                retailAdverts: {
                    suppliedPrice: { amountGBP: suppliedPrice },
                    ...(advertAttentionGrabber && { attentionGrabber: advertAttentionGrabber }),
                    ...(advertDescription      && { description: advertDescription }),
                    ...(advertDescription2     && { description2: advertDescription2 }),
                    ...(vehicle.priceOnApplication != null && { priceOnApplication: Boolean(vehicle.priceOnApplication || vehicle.atPriceOnApplication) }),
                    ...(retailVatStatus && { vatStatus: retailVatStatus }),
                    ...(displayOptions  && { displayOptions }),
                }
            },
            metadata: {
                lifecycleState,
                externalStockId: vehicle.externalStockId || String(vehicle._id) || undefined,
                ...(vehicle.referenceId && { externalStockReference: String(vehicle.referenceId).substring(0, 25) }),
            },
            ...(allFeatures.length > 0 && { features: allFeatures }),
            ...(mediaImages.length > 0 || mediaVideo ? {
                media: {
                    ...(mediaImages.length > 0 && { images: mediaImages }),
                    ...(mediaVideo             && { video: mediaVideo }),
                }
            } : {}),
        };

        const result = await client.createStock(stockPayload);

        // Extract stockId from AT response and persist to Vehicle document
        const stockId = result?.stockId || result?.id || result?.metadata?.stockId || result?.adverts?.[0]?.advertId;
        if (stockId) {
            await Vehicle.findOneAndUpdate(
                { _id: vehicleId, tenantId: session.tenantId },
                { $set: { stockId } }
            );
        }

        return NextResponse.json({ ok: true, stockId, result });
    } catch (error: any) {
        console.error('[AutoTrader Stock Create] Error:', error.message);
        if (error.data) {
            console.error('[AutoTrader Stock Create] AT Response:', JSON.stringify(error.data, null, 2));
        }
        const atMessage = error.data?.message || error.data?.errors?.[0]?.message || error.data?.error || error.message || 'Failed to create stock on AutoTrader.';
        return NextResponse.json({ 
            ok: false, 
            error: { message: atMessage } 
        }, { status: 500 });
    }
}

export const GET = withErrorHandler(getAutoTraderStock);
