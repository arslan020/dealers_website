import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';
import mongoose from 'mongoose';
import { pickSilentSalesmanDescriptionFromVehicle, advertDescriptionToPlainText } from '@/lib/silent-salesman/vehicle-fields';

import AutoTraderStockCache from '@/models/AutoTraderStockCache';

async function getVehicles(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const normalizedStatus = status === 'For Sale' ? 'In Stock' : status;
    const search = searchParams.get('search')?.toLowerCase();

    // 1. Fetch Local Vehicles (filtered for display)
    const query: any = { tenantId };
    if (normalizedStatus && normalizedStatus !== 'All') {
        query.status = normalizedStatus;
    }
    if (search) {
        query.$or = [
            { make: { $regex: search, $options: 'i' } },
            { vehicleModel: { $regex: search, $options: 'i' } },
            { vrm: { $regex: search, $options: 'i' } },
        ];
    }
    const localVehicles = await Vehicle.find(query).lean();

    // 1b. Also fetch ALL local vehicles (no status filter) for AT merge lookup.
    //     This lets us block AT-cache rows from appearing when the local record
    //     has been explicitly moved to a different status (e.g. Draft).
    const allLocalVehicles = (normalizedStatus && normalizedStatus !== 'All')
        ? await Vehicle.find({ tenantId }, { _id: 1, vrm: 1, stockId: 1, status: 1 }).lean()
        : localVehicles;

    // 2. Fetch AutoTrader Cache
    // Helper to normalise AT fields that may arrive as { name: "..." } objects
    const atStr = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object') return val.name || val.value || '';
        return String(val);
    };

    let atVehicles: any[] = [];
    try {
        const cache = await AutoTraderStockCache.findOne({ tenantId });
        if (cache?.stock) {
            atVehicles = cache.stock.map((v: any) => ({
                ...v,
                make: atStr(v.make),
                model: atStr(v.model),
                derivative: atStr(v.derivative),
                fuelType: atStr(v.fuelType),
                transmission: atStr(v.transmission),
                colour: atStr(v.colour),
                bodyType: atStr(v.bodyType),
                createdAt: v.createdAt || cache.fetchedAt?.toISOString() || null,
                updatedAt: v.updatedAt || cache.fetchedAt?.toISOString() || null,
            }));
        }
    } catch (err) {
        console.error('[Unified API] AT Cache Error:', err);
    }

    // 3. Merge Strategy
    // Build two lookup maps: VRM -> local vehicle, and stockId -> local vehicle
    // (from the FILTERED set â€” used to enrich mergedList items)
    const localByVrm = new Map();    // VRM (uppercase) -> local vehicle
    const localByStockId = new Map(); // stockId -> local vehicle
    localVehicles.forEach((v: any) => {
        if (v.vrm && v.vrm !== 'PENDING') localByVrm.set(v.vrm.toUpperCase(), v);
        if (v.stockId) localByStockId.set(v.stockId, v);
    });

    // Lookup maps from ALL local vehicles â€” used to block AT-only rows that have
    // a local record with a different status (e.g. vehicle moved to Draft).
    const allLocalByVrm = new Map();
    const allLocalByStockId = new Map();
    allLocalVehicles.forEach((v: any) => {
        if (v.vrm && v.vrm !== 'PENDING') allLocalByVrm.set(v.vrm.toUpperCase(), v);
        if (v.stockId) allLocalByStockId.set(v.stockId, v);
    });

    // Start merged list with local vehicles that are NOT just stale shadow copies
    // (shadow copy = has stockId but vrm is 'PENDING' or make is 'Unknown')
    const mergedList: any[] = localVehicles
        .filter((v: any) => {
            // Keep if has real VRM and real make (not a broken shadow copy)
            if (v.stockId && (v.vrm === 'PENDING' || v.make === 'Unknown')) return false;
            return true;
        })
        .map((v: any) => ({
            ...v,
            source: 'local',
            isLiveOnAT: false,
            websitePublished: v.websitePublished || false,
            atStatus: v.atAdvertStatus === 'PUBLISHED' ? 'Yes' : 'No'
        }));

    // Add AT vehicles, merging if local copy exists (by VRM first, then stockId)
    atVehicles.forEach(atv => {
        const vrm = atv.vrm?.toUpperCase();
        // Try match by VRM first, then fall back to stockId
        const existing = localByVrm.get(vrm) || localByStockId.get(atv.id);

        // Determine AT Status from AT data
        let atStatus = 'No';
        const isATPublished = atv.adverts?.retailAdverts?.autotraderAdvert?.status === 'PUBLISHED';
        const isProfilePublished = atv.adverts?.retailAdverts?.profileAdvert?.status === 'PUBLISHED';

        if (isATPublished) atStatus = 'Yes';
        else if (isProfilePublished) atStatus = 'Profile Only';

        // AT is source of truth for status — map lifecycleState → local status
        const AT_LIFECYCLE_MAP: Record<string, string> = {
            FORECOURT:        'In Stock',
            SALE_IN_PROGRESS: 'Reserved',
            SOLD:             'Sold',
            DUE_IN:           'Draft',
            WASTEBIN:         'Deleted',
            DELETED:          'Deleted',
        };
        const atLifecycle = atv.metadata?.lifecycleState;
        const statusFromAT = atLifecycle ? (AT_LIFECYCLE_MAP[atLifecycle] || atv.status || 'In Stock') : (atv.status || 'In Stock');

        if (existing) {
            // Merge: find by VRM or stockId in the list
            const index = mergedList.findIndex(m =>
                (vrm && m.vrm?.toUpperCase() === vrm) ||
                (m.stockId && m.stockId === atv.id)
            );
            if (index !== -1) {
                const local = mergedList[index];

                // If local DB status is stale vs AT, silently update it
                if (atLifecycle && local.status !== statusFromAT && local._id) {
                    Vehicle.findByIdAndUpdate(local._id, { $set: { status: statusFromAT } }).catch(() => {});
                }

                // Prefer local DB images over AT cache — AT cache may be stale/empty after an edit
                const hasSavedImages = local.primaryImage && local.primaryImage !== '';
                mergedList[index] = {
                    ...local,
                    status: statusFromAT,  // AT is source of truth
                    stockId: atv.id,
                    // Heal stale 'Unknown' make/model from AT data
                    make: local.make === 'Unknown' ? atv.make : local.make,
                    model: local.model === 'Unknown' ? atv.model : local.model,
                    vrm: local.vrm === 'PENDING' ? atv.vrm : local.vrm,
                    // Only use AT images if local DB has no saved images
                    primaryImage: hasSavedImages ? local.primaryImage : atv.primaryImage,
                    imagesCount: hasSavedImages ? (local.imagesCount || 0) : (atv.images?.length || 0),
                    isLiveOnAT: isATPublished,
                    atStatus,
                    atData: atv,
                    source: 'merged'
                };
            }
        } else {
            // This AT vehicle has no match in the FILTERED local set.
            // Check the FULL local set — if local record exists with stale status, update DB and include it.
            const localRecordAny = allLocalByVrm.get(vrm) || allLocalByStockId.get(atv.id);
            if (localRecordAny) {
                // Local record exists with different status — update it from AT and include if filter matches
                if (atLifecycle && localRecordAny.status !== statusFromAT && localRecordAny._id) {
                    Vehicle.findByIdAndUpdate(localRecordAny._id, { $set: { status: statusFromAT } }).catch(() => {});
                }
                // Include in results if AT status matches the active filter
                const filterMatches = !normalizedStatus || normalizedStatus === 'All' || normalizedStatus === statusFromAT;
                const matchesSearch = !search ||
                    atv.make?.toLowerCase().includes(search) ||
                    atv.model?.toLowerCase().includes(search) ||
                    atv.vrm?.toLowerCase().includes(search);
                if (filterMatches && matchesSearch) {
                    const hasSavedImages = localRecordAny.primaryImage && localRecordAny.primaryImage !== '';
                    mergedList.push({
                        ...localRecordAny,
                        status: statusFromAT,
                        stockId: atv.id,
                        primaryImage: hasSavedImages ? localRecordAny.primaryImage : atv.primaryImage,
                        imagesCount: hasSavedImages ? (localRecordAny.imagesCount || 0) : (atv.images?.length || 0),
                        isLiveOnAT: isATPublished,
                        atStatus,
                        atData: atv,
                        source: 'merged'
                    });
                }
            } else {
                // Pure AT-only vehicle (no local record at all) — use AT lifecycle status.
                const atVehicleStatus = statusFromAT;

                // Skip if a specific status filter is active and this vehicle doesn't match.
                if (normalizedStatus && normalizedStatus !== 'All' && normalizedStatus !== atVehicleStatus) {
                    // e.g. Sold filter: skip In Stock AT-only vehicles; Draft filter: skip In Stock, etc.
                } else {
                    const matchesSearch = !search ||
                        atv.make?.toLowerCase().includes(search) ||
                        atv.model?.toLowerCase().includes(search) ||
                        atv.vrm?.toLowerCase().includes(search);

                    if (matchesSearch) {
                        mergedList.push({
                            _id: `at-${atv.id}`,
                            make: atv.make,
                            model: atv.model,
                            derivative: atv.derivative,
                            vrm: atv.vrm,
                            price: atv.price,
                            status: atVehicleStatus,
                            primaryImage: atv.primaryImage,
                            imagesCount: atv.images?.length || 0,
                            videosCount: 0,
                            createdAt: atv.createdAt || null,
                            updatedAt: atv.updatedAt || null,
                            source: 'autotrader',
                            stockId: atv.id,
                            isLiveOnAT: isATPublished,
                            atStatus,
                            websitePublished: false,
                            atData: atv
                        });
                    }
                }
            }
        }
    });

    // Sort by createdAt ascending â€” stable sort that is not affected by edits (which change updatedAt)
    mergedList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // newest first (matches typical dealer expectation)
    });

    // Apply status filter one more time on merged output so AT-only rows
    // cannot leak into a filtered result (e.g. Sold filter showing In Stock rows).
    const statusFiltered = normalizedStatus && normalizedStatus !== 'All'
        ? mergedList.filter((v: any) => v.status === normalizedStatus)
        : mergedList;

    return NextResponse.json({ ok: true, vehicles: statusFiltered });
}


// Map local condition values â†’ AT-valid values (AT uses 'Average', not 'Fair')
const AT_CONDITION_MAP: Record<string, string> = {
    'Excellent': 'Excellent', 'Good': 'Good', 'Fair': 'Average', 'Poor': 'Poor',
};
// Map local origin values â†’ AT-valid values
const AT_ORIGIN_MAP: Record<string, string> = {
    'UK Vehicle': 'UK', 'Import': 'Non UK',
};

function buildAtStockPayload(vehicle: any, mongoId: string, isDraft: boolean = false) {
    // Combine standard features + custom (dealer-selected / factory-fitted optional) features
    const allFeatureNames = [
        ...(Array.isArray(vehicle.features) ? vehicle.features : []),
        ...(Array.isArray(vehicle.customFeatures) ? vehicle.customFeatures : []),
    ];
    const featuresPayload = allFeatureNames.length > 0
        ? allFeatureNames.map((f: any) => (typeof f === 'string' ? { name: f } : f))
        : undefined;

    // engineSize stored as CC string from lookup (e.g. "1998"). Treat values >100 as CC, <=100 as litres.
    const engineSizeNum = vehicle.engineSize ? Number(vehicle.engineSize) : undefined;

    // suppliedPrice from vehicle.price; forecourtPrice always sent — falls back to suppliedPrice
    const suppliedPrice = Number(vehicle.price) || 0;
    const forecourtPrice = Number(vehicle.forecourtPrice) || suppliedPrice;

    // emissionClass: use direct field first, then fall back to technicalSpecs (populated by AT lookup)
    const emissionClass = vehicle.emissionClass || vehicle.technicalSpecs?.emissionClass;

    // attentionGrabber: use stored value, fall back to longAttentionGrabber (truncated to 30 chars)
    const rawGrabber = (vehicle.attentionGrabber || '').trim()
        || (vehicle.longAttentionGrabber || '').trim().slice(0, 30);
    const advertAttentionGrabber = rawGrabber.slice(0, 30) || undefined;

    // description: use dealer-written text first, then auto-generate from vehicle specs as fallback
    const rawDescription = advertDescriptionToPlainText(
        vehicle.description ||
        vehicle.description2 ||
        pickSilentSalesmanDescriptionFromVehicle(vehicle)
    ).trim();
    const advertDescription = rawDescription.slice(0, 4000) || undefined;

    // description2: only send if it differs from description
    const rawDescription2 = advertDescriptionToPlainText(vehicle.description2 || '').trim();
    const advertDescription2 = (rawDescription2 && rawDescription2 !== rawDescription)
        ? rawDescription2.slice(0, 4000)
        : undefined;

    return {
        vehicle: {
            make: vehicle.make,
            model: vehicle.model,
            vehicleType: vehicle.vehicleType || 'Car',
            ...(vehicle.vrm                && { registration: vehicle.vrm.toUpperCase() }),
            ...(vehicle.vin                && { vin: vehicle.vin }),
            ...(vehicle.engineNumber       && { engineNumber: vehicle.engineNumber }),
            ...(vehicle.derivativeId       && { derivativeId: vehicle.derivativeId }),
            ...(vehicle.derivative         && { derivative: vehicle.derivative }),
            ...(vehicle.mileage !== undefined && { odometerReadingMiles: Number(vehicle.mileage) }),
            ...(vehicle.colour             && { colour: vehicle.colour }),
            ...(vehicle.fuelType           && { fuelType: vehicle.fuelType }),
            ...(vehicle.transmission       && { transmissionType: vehicle.transmission }),
            ...(vehicle.bodyType           && { bodyType: vehicle.bodyType }),
            ...(vehicle.year               && { yearOfManufacture: String(vehicle.year) }),
            ...(vehicle.generation         && { generation: vehicle.generation }),
            ...(vehicle.trim               && { trim: vehicle.trim }),
            ...(vehicle.doors              && { doors: Number(vehicle.doors) }),
            ...(vehicle.seats              && { seats: Number(vehicle.seats) }),
            ...(vehicle.drivetrain         && { drivetrain: vehicle.drivetrain }),
            ...(vehicle.driverPosition     && { steeringPosition: vehicle.driverPosition }),
            // AT requires full YYYY-MM-DD — skip if only a year or invalid format is stored
            ...(vehicle.dateOfRegistration && /^\d{4}-\d{2}-\d{2}/.test(String(vehicle.dateOfRegistration)) && { firstRegistrationDate: vehicle.dateOfRegistration }),
            ...(vehicle.plate              && { plate: String(vehicle.plate) }),
            ...(vehicle.serviceHistory     && { serviceHistory: vehicle.serviceHistory }),
            ...(vehicle.previousOwners !== undefined && { previousOwners: Number(vehicle.previousOwners) }),
            ...(vehicle.motExpiry          && { motExpiryDate: vehicle.motExpiry }),
            ...(vehicle.manufacturerWarrantyMonths !== undefined && { warrantyMonthsOnPurchase: Number(vehicle.manufacturerWarrantyMonths) }),
            ...(vehicle.exteriorFinish     && { exteriorFinish: vehicle.exteriorFinish }),
            ...(emissionClass              && { emissionClass }),
            ...(vehicle.co2EmissionGPKM !== undefined && { co2EmissionGPKM: Number(vehicle.co2EmissionGPKM) }),
            ...(vehicle.numberOfKeys !== undefined && { keys: Number(vehicle.numberOfKeys) }),
            ...(vehicle.v5Present !== undefined && { v5Certificate: vehicle.v5Present }),
            ...(vehicle.exDemo !== undefined && { exDemo: vehicle.exDemo }),
            ...(vehicle.wheelchairAccessible !== undefined && { wheelchairAccessible: vehicle.wheelchairAccessible }),
            ...(vehicle.origin && AT_ORIGIN_MAP[vehicle.origin] && { origin: AT_ORIGIN_MAP[vehicle.origin] }),
            ...(vehicle.interiorCondition && AT_CONDITION_MAP[vehicle.interiorCondition] && { interiorCondition: AT_CONDITION_MAP[vehicle.interiorCondition] }),
            ...(vehicle.tyreCondition     && AT_CONDITION_MAP[vehicle.tyreCondition]     && { tyreCondition: AT_CONDITION_MAP[vehicle.tyreCondition] }),
            ...(vehicle.exteriorCondition && AT_CONDITION_MAP[vehicle.exteriorCondition] && { bodyCondition: AT_CONDITION_MAP[vehicle.exteriorCondition] }),
            ...(engineSizeNum && engineSizeNum > 100
                ? { engineCapacityCC: engineSizeNum }
                : engineSizeNum
                ? { badgeEngineSizeLitres: engineSizeNum }
                : {}),
        },
        adverts: {
            // forecourtPrice is at adverts level (NOT inside retailAdverts) per AT docs — always required
            forecourtPrice: { amountGBP: forecourtPrice },
            ...(vehicle.dueInDate      && { dueDate: vehicle.dueInDate }),
            ...(vehicle.dateInStock    && { stockInDate: vehicle.dateInStock }),
            ...(vehicle.includes12MonthsMot !== undefined && { twelveMonthsMot: vehicle.includes12MonthsMot }),
            ...(vehicle.includesMotInsurance !== undefined && { motInsurance: vehicle.includesMotInsurance }),
            ...(vehicle.vatStatus && { vatScheme: vehicle.vatStatus === 'VAT Qualifying' ? 'Standard' : 'Marginal' }),
            retailAdverts: {
                suppliedPrice: { amountGBP: suppliedPrice },
                ...(vehicle.priceOnApplication !== undefined && { priceOnApplication: vehicle.priceOnApplication }),
                ...(advertAttentionGrabber && { attentionGrabber: advertAttentionGrabber }),
                ...(advertDescription      && { description: advertDescription }),
                ...(advertDescription2     && { description2: advertDescription2 }),
                ...(isDraft && {
                    autotraderAdvert:  { status: 'NOT_PUBLISHED' },
                    advertiserAdvert:  { status: 'NOT_PUBLISHED' },
                    locatorAdvert:     { status: 'NOT_PUBLISHED' },
                    exportAdvert:      { status: 'NOT_PUBLISHED' },
                    profileAdvert:     { status: 'NOT_PUBLISHED' },
                }),
            },
        },
        ...(featuresPayload && { features: featuresPayload }),
        metadata: {
            lifecycleState: 'FORECOURT',
            externalStockId: mongoId,
        },
    };
}

async function createVehicle(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    await connectToDatabase();

    // Normalise serviceHistory â€” AutoTrader may return short values like 'Full', 'Part', 'None'
    if (body.serviceHistory) {
        const sh = String(body.serviceHistory).toLowerCase().trim();
        const serviceHistoryMap: Record<string, string> = {
            'full service history':       'Full service history',
            'full dealership history':    'Full dealership history',
            'full dealer history':        'Full dealership history',
            'dealer history':             'Full dealership history',
            'full':                       'Full service history',
            'part service history':       'Part service history',
            'partial service history':    'Part service history',
            'part':                       'Part service history',
            'no service history':         'No service history',
            'no history':                 'No service history',
            'none':                       'No service history',
        };
        body.serviceHistory = serviceHistoryMap[sh] ?? undefined;
    }

    const vehicle = await Vehicle.create({
        ...body,
        status: body.status || 'Draft', // Always default to Draft â€” user must explicitly publish
        tenantId,
    });

    // â”€â”€â”€ Push to AutoTrader (Draft = FORECOURT + NOT_PUBLISHED, In Stock = FORECOURT + PUBLISHED) â”€â”€
    const isDraft = vehicle.status === 'Draft';
    try {
        if (!vehicle.derivativeId) {
            console.warn('[AutoTrader] Missing derivativeId, skipping stock creation.');
            return NextResponse.json({ ok: true, vehicle, warning: 'Vehicle created locally but AutoTrader sync requires a derivativeId.' });
        }

        const client = new AutoTraderClient(tenantId);
        await client.init();

        const atPayload = buildAtStockPayload(vehicle, vehicle._id.toString(), isDraft);
        const atResult = await client.createStock(atPayload);
        if (atResult?.metadata?.stockId) {
            const stockId = atResult.metadata.stockId;
            vehicle.stockId = stockId;
            vehicle.externalStockId = vehicle._id.toString();
            await vehicle.save();
            console.log(`[AutoTrader] Created stock ${stockId} for vehicle ${vehicle._id} (draft: ${isDraft})`);
        }
    } catch (atError: any) {
        if (atError.status === 409 || atError.data?.message?.includes('stock item already exists')) {
            console.log('[AutoTrader] Conflict detected, sync will link stockId.');
        } else {
            console.error('[AutoTrader createStock Error]', atError);
        }
    }

    return NextResponse.json({ ok: true, vehicle });
}

async function updateVehicle(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
        return NextResponse.json({ ok: false, error: 'Vehicle ID required' }, { status: 400 });
    }

    await connectToDatabase();

    let vehicle;
    if (id.startsWith('at-')) {
        const atId = id.replace('at-', '');

        // Pull real vehicle data from AT stock cache so we never store 'Unknown'/'PENDING'
        let cachedStock: any = null;
        try {
            const cacheDoc = await AutoTraderStockCache.findOne({ tenantId });
            if (cacheDoc?.stock) {
                cachedStock = cacheDoc.stock.find((s: any) => s.id === atId);
            }
        } catch {}

        // Use findOneAndUpdate with upsert â€” atomically find or create.
        // This prevents race conditions where two concurrent requests both
        // see no existing record and both try to create one (duplicate bug).
        vehicle = await Vehicle.findOneAndUpdate(
            { stockId: atId, tenantId },       // filter
            { $setOnInsert: {                  // only set these on INSERT, not update
                stockId: atId,
                tenantId,
                websitePublished: false,
                make: cachedStock?.make || cachedStock?.vehicle?.make || 'Unknown',
                model: cachedStock?.model || cachedStock?.vehicle?.model || 'Unknown',
                vrm: cachedStock?.vrm || cachedStock?.vehicle?.registration || 'PENDING',
                price: cachedStock?.price || cachedStock?.adverts?.retailAdverts?.suppliedPrice?.amountGBP || 0,
                colour: cachedStock?.vehicle?.colour || '',
                fuelType: cachedStock?.vehicle?.fuelType || '',
                transmission: cachedStock?.vehicle?.transmissionType || '',
                bodyType: cachedStock?.vehicle?.bodyType || '',
                derivative: cachedStock?.derivative || '',
                year: cachedStock?.vehicle?.yearOfManufacture || '',
                mileage: cachedStock?.vehicle?.odometerReadingMiles || 0,
            }},
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        // â”€â”€ Build a safe $set â€” only update image fields if explicitly saving images â”€â”€
        // Strip image-related fields unless this is explicitly an image save (imageIds in payload).
        // This prevents ANY non-image tab save from ever wiping uploaded images or videos.
        const IMAGE_FIELDS = ['images', 'imageIds', 'primaryImage', 'imagesCount', 'imageMetadata'];
        const VIDEO_FIELDS = ['youtubeVideoIds'];

        const safeSet: Record<string, any> = {};
        for (const [k, v] of Object.entries(updateData)) {
            // Block image fields unless imageIds is explicitly provided
            if (IMAGE_FIELDS.includes(k) && updateData.imageIds === undefined) continue;
            // Block video fields unless youtubeVideoIds is explicitly provided
            if (VIDEO_FIELDS.includes(k) && updateData.youtubeVideoIds === undefined) continue;
            safeSet[k] = v;
        }

        // Use $set so MongoDB only touches the keys in safeSet â€” everything else is preserved
        vehicle = await Vehicle.findOneAndUpdate(
            { stockId: atId, tenantId },
            { $set: safeSet },
            { returnDocument: 'after' }
        );

        if (!vehicle) {
            // Vehicle not yet in local DB â€” create it from AT cache data
            vehicle = await Vehicle.findOneAndUpdate(
                { stockId: atId, tenantId },
                { $setOnInsert: {
                    stockId: atId,
                    tenantId,
                    websitePublished: false,
                    make: cachedStock?.make || cachedStock?.vehicle?.make || 'Unknown',
                    model: cachedStock?.model || cachedStock?.vehicle?.model || 'Unknown',
                    vrm: cachedStock?.vrm || cachedStock?.vehicle?.registration || 'PENDING',
                    price: cachedStock?.price || cachedStock?.adverts?.retailAdverts?.suppliedPrice?.amountGBP || 0,
                    colour: cachedStock?.vehicle?.colour || '',
                    fuelType: cachedStock?.vehicle?.fuelType || '',
                    transmission: cachedStock?.vehicle?.transmissionType || '',
                    bodyType: cachedStock?.vehicle?.bodyType || '',
                    derivative: cachedStock?.derivative || '',
                    year: cachedStock?.vehicle?.yearOfManufacture || '',
                    mileage: cachedStock?.vehicle?.odometerReadingMiles || 0,
                    ...safeSet,
                }},
                { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );
        }
    } else {
        // Standard local vehicle update â€” use $set so ONLY specified fields change
        const IMAGE_FIELDS = ['images', 'imageIds', 'primaryImage', 'imagesCount', 'imageMetadata'];
        const VIDEO_FIELDS = ['youtubeVideoIds'];

        const safeSet: Record<string, any> = {};
        for (const [k, v] of Object.entries(updateData)) {
            if (IMAGE_FIELDS.includes(k) && updateData.imageIds === undefined) continue;
            if (VIDEO_FIELDS.includes(k) && updateData.youtubeVideoIds === undefined) continue;
            safeSet[k] = v;
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            vehicle = await Vehicle.findOneAndUpdate(
                { stockId: id, tenantId },
                { $set: safeSet },
                { returnDocument: 'after' }
            );
        } else {
            vehicle = await Vehicle.findOneAndUpdate(
                { _id: id, tenantId },
                { $set: safeSet },
                { returnDocument: 'after' }
            );
        }
    }


    if (!vehicle) {
        return NextResponse.json({ ok: false, error: 'Vehicle not found' }, { status: 404 });
    }

    // â”€â”€â”€ Sync with AutoTrader / Updates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const client = new AutoTraderClient(tenantId);
    await client.init();
    
    // 1. Advert Channel Statuses
    const advertFields = [
        { key: 'atAdvertStatus', channel: 'autotrader' },
        { key: 'advertiserAdvertStatus', channel: 'advertiser' },
        { key: 'locatorAdvertStatus', channel: 'locator' },
        { key: 'exportAdvertStatus', channel: 'export' },
        { key: 'profileAdvertStatus', channel: 'profile' },
    ] as const;

    for (const field of advertFields) {
        if (updateData[field.key] && vehicle.stockId) {
            try {
                await client.updateStockAdvertiseStatus(vehicle.stockId, field.channel, updateData[field.key]);
                console.log(`[AutoTrader] ${field.channel} status updated to ${updateData[field.key]}`);
            } catch (e) {
                console.error(`[AutoTrader] Failed to update ${field.channel} status:`, e);
            }
        }
    }

    // 2. Sync Price (Â£75 minimum enforced)
    if (vehicle.stockId && (updateData.price !== undefined || updateData.forecourtPrice !== undefined)) {
        const retailAdverts: Record<string, any> = {};
        const advertsTopLevel: Record<string, any> = {};

        if (updateData.price !== undefined) {
            if (Number(updateData.price) < 75) {
                console.warn('[AutoTrader] Supplied price too low (Â£75 min), skipping AT sync');
            } else {
                retailAdverts.suppliedPrice = { amountGBP: Number(updateData.price) };
            }
        }

        // forecourtPrice is at adverts level (NOT inside retailAdverts) per AT docs
        if (updateData.forecourtPrice !== undefined && Number(updateData.forecourtPrice) > 0) {
            advertsTopLevel.forecourtPrice = { amountGBP: Number(updateData.forecourtPrice) };
        }

        if (Object.keys(retailAdverts).length > 0) advertsTopLevel.retailAdverts = retailAdverts;
        if (Object.keys(advertsTopLevel).length > 0) {
            try {
                await client.updateStock(vehicle.stockId, { adverts: advertsTopLevel });
                console.log('[AutoTrader] Price synced:', advertsTopLevel);
            } catch (atError) {
                console.error('[AutoTrader Price Sync Error]', atError);
            }
        }
    }

    // 2b. Sync advert-level availability/settings fields
    if (vehicle.stockId) {
        const atAdverts: Record<string, any> = {};
        if (updateData.includes12MonthsMot !== undefined) atAdverts.twelveMonthsMot = updateData.includes12MonthsMot;
        if (updateData.includesMotInsurance !== undefined) atAdverts.motInsurance = updateData.includesMotInsurance;
        if (updateData.dueInDate !== undefined) atAdverts.dueDate = updateData.dueInDate || null;
        if (updateData.dateInStock !== undefined) atAdverts.stockInDate = updateData.dateInStock || null;
        if (updateData.vatStatus !== undefined) {
            atAdverts.vatScheme = updateData.vatStatus === 'VAT Qualifying' ? 'Standard' : 'Marginal';
        }
        if (Object.keys(atAdverts).length > 0) {
            try {
                await client.updateStock(vehicle.stockId, { adverts: atAdverts });
                console.log('[AutoTrader] Advert settings synced:', Object.keys(atAdverts));
            } catch (atError) {
                console.error('[AutoTrader Advert Settings Sync Error]', atError);
            }
        }
    }

    // 3. Sync Lifecycle State (with mandatory Unpublish for SOLD/WASTEBIN/DELETED/DRAFT)
    if (vehicle.stockId && updateData.status) {
        const lifecycleMap: Record<string, string> = {
            'Sold':             'SOLD',
            'In Stock':         'FORECOURT',
            'Due In':           'DUE_IN',
            'Sale In Progress': 'SALE_IN_PROGRESS',
            'Reserved':         'SALE_IN_PROGRESS', // Reserved on AutoDesk = Sale In Progress on AT
            'Wastebin':         'WASTEBIN',
            'Deleted':          'DELETED',
            'Draft':            'LOCAL_DRAFT',      // Special case: just unpublish
        };
        const lifecycleState = lifecycleMap[updateData.status];
        if (lifecycleState) {
            try {
                if (lifecycleState === 'LOCAL_DRAFT') {
                    // For Draft, we don't send a fake lifecycleState to AT, we just take down the adverts
                    await client.unpublishAll(vehicle.stockId);
                    console.log(`[AutoTrader] Vehicle moved to Draft. Unpublished all channels for stock ${vehicle.stockId}`);
                } else {
                    // SOLD, WASTEBIN, DELETED all require channels unpublished first
                    if (['SOLD', 'WASTEBIN', 'DELETED'].includes(lifecycleState)) {
                        await client.unpublishAll(vehicle.stockId);
                        console.log(`[AutoTrader] Prerequisite: All channels unpublished for stock ${vehicle.stockId}`);
                    }

                    await client.updateStock(vehicle.stockId, {
                        metadata: { lifecycleState }
                    });
                    console.log(`[AutoTrader] Lifecycle updated to ${lifecycleState}`);

                    // Ensure "In Stock" vehicles become live again on AutoTrader
                    // after being moved from Draft/Sold/Reserved states.
                    if (lifecycleState === 'FORECOURT') {
                        await client.updateStockAdvertiseStatus(vehicle.stockId, 'autotrader', 'PUBLISHED');
                        await Vehicle.updateOne(
                            { _id: vehicle._id, tenantId },
                            { $set: { atAdvertStatus: 'PUBLISHED' } }
                        );
                        console.log(`[AutoTrader] Autotrader advert published for stock ${vehicle.stockId}`);
                    }
                }
            } catch (atError: any) {
                const atMsg = atError?.data?.message || atError?.data?.errors?.[0]?.message || atError?.message || 'Unknown error';
                console.error(`[AutoTrader Lifecycle Sync Error] ${lifecycleState} → ${vehicle.stockId}: ${atMsg}`);
            }
        }
    }

    // 4. Create missing AT stock if vehicle was explicitly changed to 'In Stock'
    if (!vehicle.stockId && updateData.status === 'In Stock') {
        console.log(`[AutoTrader] Vehicle ${vehicle._id} changing to 'In Stock' but has no AT stockId. Pushing to AT now.`);
        if (!vehicle.derivativeId) {
            console.warn('[AutoTrader] Missing derivativeId, skipping stock creation.');
        } else {
            try {
                const atPayload = buildAtStockPayload(vehicle, vehicle._id.toString());
                const atResult = await client.createStock(atPayload);
                if (atResult?.metadata?.stockId) {
                    const stockId = atResult.metadata.stockId;
                    vehicle.stockId = stockId;
                    vehicle.externalStockId = vehicle._id.toString();
                    await vehicle.save();
                    console.log(`[AutoTrader] Created stock ${stockId} for vehicle ${vehicle._id}`);
                }
            } catch (atError: any) {
                if (atError.status === 409 || atError.data?.message?.includes('stock item already exists')) {
                    console.log('[AutoTrader] Conflict detected during Draft->In Stock sync, AT stock already exists.');
                } else {
                    console.error('[AutoTrader createStock Error]', atError);
                }
            }
        }
    }

    // 4. Sync vehicle fields
    if (vehicle.stockId) {
        const vehicleFieldMap: Record<string, string> = {
            colour:               'colour',
            mileage:              'odometerReadingMiles',
            fuelType:             'fuelType',
            transmission:         'transmissionType',
            bodyType:             'bodyType',
            // Note: make, model, derivative, generation are read-only on AT â€” derived from derivativeId
            // Only these direct vehicle fields are safely patchable per AT docs
            year:                 'yearOfManufacture',
            vin:                  'vin',
            doors:                'doors',
            seats:                'seats',
            // â”€â”€ Newly synced fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            engineNumber:         'engineNumber',
            plate:                'plate',
            emissionClass:        'emissionClass',
            co2EmissionGPKM:      'co2EmissionGPKM',
            exteriorFinish:       'exteriorFinish',
            wheelchairAccessible: 'wheelchairAccessible',
        };

        const vehicleUpdate: Record<string, any> = {};
        for (const [localKey, atKey] of Object.entries(vehicleFieldMap)) {
            const val = updateData[localKey];
            if (val === undefined) continue;
            // AT rejects empty strings — send null to clear, skip if no meaningful value
            if (val === '') continue;
            vehicleUpdate[atKey] = localKey === 'mileage'
                ? Number(val)
                : localKey === 'year' || localKey === 'plate'
                ? String(val)
                : val;
        }

        // Fields that require value transformation before sending to AT
        if (updateData.serviceHistory !== undefined)         vehicleUpdate.serviceHistory          = updateData.serviceHistory || null;
        if (updateData.previousOwners !== undefined)         vehicleUpdate.previousOwners          = Number(updateData.previousOwners);
        if (updateData.motExpiry !== undefined)              vehicleUpdate.motExpiryDate           = updateData.motExpiry || null;
        if (updateData.numberOfKeys !== undefined)           vehicleUpdate.keys                    = Number(updateData.numberOfKeys);
        if (updateData.v5Present !== undefined)              vehicleUpdate.v5Certificate           = updateData.v5Present;
        if (updateData.exDemo !== undefined)                 vehicleUpdate.exDemo                  = updateData.exDemo;
        if (updateData.manufacturerWarrantyMonths !== undefined) vehicleUpdate.warrantyMonthsOnPurchase = Number(updateData.manufacturerWarrantyMonths);
        // Origin: 'UK Vehicle' â†’ 'UK', 'Import' â†’ 'Non UK'
        if (updateData.origin !== undefined)                 vehicleUpdate.origin                  = AT_ORIGIN_MAP[updateData.origin] ?? updateData.origin;
        // Conditions: 'Fair' â†’ 'Average' (AT doesn't accept 'Fair')
        if (updateData.interiorCondition !== undefined)      vehicleUpdate.interiorCondition       = AT_CONDITION_MAP[updateData.interiorCondition] ?? updateData.interiorCondition;
        if (updateData.tyreCondition !== undefined)          vehicleUpdate.tyreCondition           = AT_CONDITION_MAP[updateData.tyreCondition]     ?? updateData.tyreCondition;
        if (updateData.exteriorCondition !== undefined)      vehicleUpdate.bodyCondition           = AT_CONDITION_MAP[updateData.exteriorCondition] ?? updateData.exteriorCondition;

        if (Object.keys(vehicleUpdate).length > 0) {
            try {
                await client.updateStock(vehicle.stockId, { vehicle: vehicleUpdate });
                console.log('[AutoTrader] Vehicle fields synced:', Object.keys(vehicleUpdate));
            } catch (atError) {
                console.error('[AutoTrader Vehicle Field Sync Error]', atError);
            }
        }
    }

    // 5. Sync advert content (description, description2, attentionGrabber, priceOnApplication)
    if (vehicle.stockId) {
        const advertUpdate: Record<string, any> = {};
        if (updateData.description !== undefined)        advertUpdate.description        = updateData.description;
        if (updateData.description2 !== undefined)       advertUpdate.description2       = updateData.description2;
        if (updateData.attentionGrabber !== undefined)   advertUpdate.attentionGrabber   = updateData.attentionGrabber;
        if (updateData.priceOnApplication !== undefined) advertUpdate.priceOnApplication = updateData.priceOnApplication;

        if (Object.keys(advertUpdate).length > 0) {
            // Strip HTML, enforce AT character limits, and omit empty fields (AT rejects empty strings)
            if (advertUpdate.description !== undefined) {
                const v = advertDescriptionToPlainText(advertUpdate.description).trim().slice(0, 4000);
                if (v) advertUpdate.description = v; else delete advertUpdate.description;
            }
            if (advertUpdate.description2 !== undefined) {
                const v = advertDescriptionToPlainText(advertUpdate.description2).trim().slice(0, 4000);
                if (v) advertUpdate.description2 = v; else delete advertUpdate.description2;
            }
            if (advertUpdate.attentionGrabber !== undefined) {
                const v = String(advertUpdate.attentionGrabber).trim().slice(0, 30);
                if (v) advertUpdate.attentionGrabber = v; else delete advertUpdate.attentionGrabber;
            }

            try {
                await client.updateStock(vehicle.stockId, { adverts: { retailAdverts: advertUpdate } });
                console.log('[AutoTrader] Advert content synced');
            } catch (atError: any) {
                const atMsg = atError?.data?.message || atError?.data?.errors?.[0]?.message || atError?.message || 'Unknown error';
                console.error(`[AutoTrader Advert Sync Error] ${vehicle.stockId}: ${atMsg}`, JSON.stringify(atError?.data));
            }
        }
    }

    // 6. Sync features list (full replacement as per AT docs)
    if (vehicle.stockId && updateData.features !== undefined) {
        try {
            const featuresPayload = Array.isArray(updateData.features)
                ? updateData.features.map((f: any) => (typeof f === 'string' ? { name: f } : f))
                : [];
            await client.updateStock(vehicle.stockId, { features: featuresPayload });
            console.log(`[AutoTrader] Features synced: ${featuresPayload.length} items`);
        } catch (atError) {
            console.error('[AutoTrader Features Sync Error]', atError);
        }
    }

    // 7. Sync media images (full imageId list replacement)
    // Only sync real AT imageIds â€” filter out fallback 'img-N' placeholder IDs
    const realImageIds = (updateData.imageIds as string[] || []).filter(
        (id: string) => id && !id.startsWith('img-')
    );
    if (updateData.imageIds !== undefined && realImageIds.length > 0) {
        const atApiUrl = process.env.AUTOTRADER_API_URL || 'https://api.autotrader.co.uk';
        const cdnHost = atApiUrl.includes('sandbox') ? 'm-qa.atcdn.co.uk' : 'm.atcdn.co.uk';
        const cdnUrls = realImageIds.map((imageId: string) => `https://${cdnHost}/a/media/{resize}/${imageId}.jpg`);

        // â”€â”€ Always persist imageIds/images/primaryImage locally â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // This ensures images survive page refresh even for vehicles without stockId
        try {
            await Vehicle.findOneAndUpdate(
                { _id: vehicle._id, tenantId },
                { $set: {
                    imageIds: realImageIds,
                    images: cdnUrls,
                    primaryImage: cdnUrls[0] || (vehicle.primaryImage as string) || '',
                    imagesCount: realImageIds.length,
                }},
                { new: false }
            );
            console.log(`[Local DB] imageIds/images persisted: ${realImageIds.length} images`);
        } catch (dbErr) {
            console.error('[Local DB Images Persist Error]', dbErr);
        }

        // â”€â”€ Also sync to AutoTrader if this vehicle is linked â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (vehicle.stockId) {
            try {
                const imagesPayload = realImageIds.map((imageId: string) => ({ imageId }));
                await client.updateStock(vehicle.stockId, { media: { images: imagesPayload } });
                console.log(`[AutoTrader] Images synced: ${imagesPayload.length} images`);
            } catch (atError) {
                console.error('[AutoTrader Images Sync Error]', atError);
            }
        }
    }

    // 8. Update local AutoTraderStockCache immediately to prevent stale data on refresh
    if (vehicle.stockId) {
        try {
            const cacheDoc = await AutoTraderStockCache.findOne({ tenantId });
            if (cacheDoc && cacheDoc.stock) {
                const stockIndex = cacheDoc.stock.findIndex((s: any) => s.id === vehicle.stockId);
                if (stockIndex !== -1) {
                    const stockItem = cacheDoc.stock[stockIndex];
                    
                    if (updateData.price !== undefined) stockItem.price = Number(updateData.price);
                    if (updateData.vrm !== undefined) stockItem.vrm = updateData.vrm;
                    if (updateData.make !== undefined) stockItem.make = updateData.make;
                    if (updateData.model !== undefined) stockItem.model = updateData.model;
                    if (updateData.derivative !== undefined) stockItem.derivative = updateData.derivative;
                    if (updateData.mileage !== undefined) stockItem.mileage = Number(updateData.mileage);
                    if (updateData.colour !== undefined) stockItem.colour = updateData.colour;
                    if (updateData.fuelType !== undefined) stockItem.fuelType = updateData.fuelType;
                    if (updateData.transmission !== undefined) stockItem.transmission = updateData.transmission;
                    if (updateData.bodyType !== undefined) stockItem.bodyType = updateData.bodyType;

                    stockItem.vehicle = stockItem.vehicle || {};
                    if (updateData.colour !== undefined) stockItem.vehicle.colour = updateData.colour;
                    if (updateData.mileage !== undefined) stockItem.vehicle.odometerReadingMiles = Number(updateData.mileage);
                    if (updateData.fuelType !== undefined) stockItem.vehicle.fuelType = updateData.fuelType;
                    if (updateData.transmission !== undefined) stockItem.vehicle.transmissionType = updateData.transmission;
                    if (updateData.bodyType !== undefined) stockItem.vehicle.bodyType = updateData.bodyType;
                    if (updateData.year !== undefined) stockItem.vehicle.yearOfManufacture = String(updateData.year);

                    stockItem.adverts = stockItem.adverts || {};
                    stockItem.adverts.retailAdverts = stockItem.adverts.retailAdverts || {};
                    if (updateData.price !== undefined) {
                        stockItem.adverts.retailAdverts.suppliedPrice = { amountGBP: Number(updateData.price) };
                    }
                    if (updateData.description !== undefined) stockItem.adverts.retailAdverts.description = updateData.description;
                    if (updateData.description2 !== undefined) stockItem.adverts.retailAdverts.description2 = updateData.description2;
                    if (updateData.attentionGrabber !== undefined) stockItem.adverts.retailAdverts.attentionGrabber = updateData.attentionGrabber;

                    // â”€â”€ Sync media images so reload shows updated images â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                    // Only update cache with real AT imageIds â€” skip fallback img-N IDs
                    const cacheImageIds = (updateData.imageIds as string[] || []).filter(
                        (id: string) => id && !id.startsWith('img-')
                    );
                    if (updateData.imageIds !== undefined && cacheImageIds.length > 0) {
                        // Build a lookup of existing imageId â†’ href from current cache
                        // This preserves the original CDN hostname (sandbox m-qa vs production m)
                        const existingHrefs: Record<string, string> = {};
                        const existingImages = stockItem.media?.images || stockItem.images || [];
                        for (const img of existingImages) {
                            if (typeof img === 'string') {
                                // Plain URL â€” extract imageId from filename
                                const match = img.match(/\/([a-f0-9]{32})(?:\.jpg)?/i);
                                if (match) existingHrefs[match[1]] = img.includes('{resize}') ? img : img.replace(/\/w\d+h\d+\//, '/{resize}/');
                            } else if (img?.imageId && img?.href) {
                                existingHrefs[img.imageId] = img.href;
                            }
                        }

                        // For new images not in the existing map, construct URL with correct CDN
                        const atApiUrl = process.env.AUTOTRADER_API_URL || 'https://api.autotrader.co.uk';
                        const cdnHost = atApiUrl.includes('sandbox') ? 'm-qa.atcdn.co.uk' : 'm.atcdn.co.uk';

                        stockItem.media = stockItem.media || {};
                        stockItem.media.images = cacheImageIds.map((imageId: string) => ({
                            imageId,
                            href: existingHrefs[imageId] || `https://${cdnHost}/a/media/{resize}/${imageId}.jpg`,
                        }));
                        console.log(`[AutoTrader Cache] Updated media.images: ${cacheImageIds.length} real images`);
                    }

                    // Use updateOne + $set instead of .save() to avoid VersionError
                    // when concurrent PATCH requests both try to save the same cache doc
                    await AutoTraderStockCache.updateOne(
                        { tenantId },
                        { $set: { stock: cacheDoc.stock } }
                    );
                    console.log(`[AutoTrader Cache] Instantly updated cache for stock ${vehicle.stockId}`);
                }
            }
        } catch (cacheErr) {
            console.error('[AutoTrader Cache Instant Update Error]', cacheErr);
        }
    }

    return NextResponse.json({ ok: true, vehicle });
}

async function deleteVehicle(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ ok: false, error: 'Vehicle ID required' }, { status: 400 });
    }

    await connectToDatabase();

    let stockIdToDelete = null;
    let localIdToDelete = null;

    if (id.startsWith('at-')) {
        stockIdToDelete = id.replace('at-', '');
        // Also check if we have a local record for this stockId
        const localRec = await Vehicle.findOne({ stockId: stockIdToDelete, tenantId });
        if (localRec) localIdToDelete = localRec._id;
    } else {
        const vehicle = await Vehicle.findOne({ _id: id, tenantId });
        if (vehicle) {
            localIdToDelete = vehicle._id;
            stockIdToDelete = vehicle.stockId;
        }
    }

    // â”€â”€â”€ Sync Delete with AutoTrader if linked â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // AT Connect API docs: You MUST unpublish all channels FIRST, then set
    // lifecycleState to 'DELETED' via PATCH. There is no HTTP DELETE on /stock/.
    if (stockIdToDelete) {
        try {
            const client = new AutoTraderClient(tenantId);
            await client.init();

            // Step 1: Unpublish all advert channels (mandatory prerequisite per AT docs)
            try {
                await client.unpublishAll(stockIdToDelete);
                console.log(`[AutoTrader Sync] Unpublished all channels for stock ${stockIdToDelete}`);
            } catch (unpublishError: any) {
                // 404 means stock doesn't exist on AT â€” safe to continue with local delete
                if (unpublishError?.status === 404 || unpublishError?.message?.includes('404')) {
                    console.log(`[AutoTrader Sync] Stock ${stockIdToDelete} not found on AT â€” skipping unpublish`);
                } else {
                    throw unpublishError;
                }
            }

            // Step 2: Set lifecycleState to DELETED via PATCH (correct AT API method)
            try {
                await client.updateLifecycleState(stockIdToDelete, 'DELETED');
                console.log(`[AutoTrader Sync] lifecycleState set to DELETED for stock ${stockIdToDelete}`);
            } catch (deleteError: any) {
                if (deleteError?.status === 404 || deleteError?.message?.includes('404')) {
                    console.log(`[AutoTrader Sync] Stock ${stockIdToDelete} not found on AT â€” already deleted`);
                } else {
                    throw deleteError;
                }
            }

        } catch (atError: any) {
            // Non-fatal: log and continue â€” local delete should always succeed
            console.error('[AutoTrader Sync Delete Error]', atError.message || atError);
        }
    }

    if (localIdToDelete) {
        await Vehicle.deleteOne({ _id: localIdToDelete, tenantId });
    }

    // â”€â”€â”€ Remove from AT Cache so it won't reappear on page refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // The cache is the source for the vehicles list page merge. If we don't
    // remove it here, the deleted vehicle will reappear until the next SYNC.
    if (stockIdToDelete) {
        try {
            await AutoTraderStockCache.updateOne(
                { tenantId },
                { $pull: { stock: { id: stockIdToDelete } } }
            );
            console.log(`[Cache] Removed stock ${stockIdToDelete} from AT cache`);
        } catch (cacheErr: any) {
            console.warn('[Cache] Failed to remove from AT cache:', cacheErr.message);
        }
    }

    return NextResponse.json({ ok: true });
}

export const GET = withErrorHandler(getVehicles);
export const POST = withErrorHandler(createVehicle);
export const PATCH = withErrorHandler(updateVehicle);
export const DELETE = withErrorHandler(deleteVehicle);

