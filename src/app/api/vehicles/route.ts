import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';
import mongoose from 'mongoose';
import { pickSilentSalesmanDescriptionFromVehicle, advertDescriptionToPlainText } from '@/lib/silent-salesman/vehicle-fields';

import AutoTraderStockCache from '@/models/AutoTraderStockCache';
import { shouldSendToAt } from '@/lib/at-cache';

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
                    Vehicle.findByIdAndUpdate(local._id, { $set: { status: statusFromAT } }).catch((err: any) => console.error('[DB Silent Update Error]', err?.message || err));
                }

                // Prefer local DB images over AT cache — AT cache may be stale/empty after an edit
                const hasSavedImages = local.primaryImage && local.primaryImage !== '';
                // Persist stockId to local doc if missing — enables AT fetch on detail page
                if (!local.stockId && atv.id) {
                    Vehicle.findByIdAndUpdate(local._id, { $set: { stockId: atv.id } }).catch((err: any) => console.error('[DB Silent Update Error]', err?.message || err));
                }

                // Heal fields that are empty in local DB but present in AT cache
                const healSet: Record<string, any> = {};
                const atMileage = atv.vehicle?.odometerReadingMiles ?? atv.mileage;
                if (!local.mileage && atMileage) healSet.mileage = atMileage;
                if (!local.colour || local.colour === '') { const v = atStr(atv.vehicle?.colour || atv.colour); if (v) healSet.colour = v; }
                if (!local.fuelType || local.fuelType === '') { const v = atStr(atv.vehicle?.fuelType || atv.fuelType); if (v) healSet.fuelType = v; }
                if (!local.transmission || local.transmission === '') { const v = atStr(atv.vehicle?.transmissionType || atv.transmission); if (v) healSet.transmission = v; }
                if (!local.bodyType || local.bodyType === '') { const v = atStr(atv.vehicle?.bodyType || atv.bodyType); if (v) healSet.bodyType = v; }
                if (!local.year || local.year === '') { const v = atv.vehicle?.yearOfManufacture || atv.year; if (v) healSet.year = String(v); }
                if (!local.doors && atv.vehicle?.doors) healSet.doors = atv.vehicle.doors;
                if (!local.seats && atv.vehicle?.seats) healSet.seats = atv.vehicle.seats;
                if ((!local.price || local.price === 0) && (atv.adverts?.retailAdverts?.suppliedPrice?.amountGBP || atv.price)) {
                    healSet.price = atv.adverts?.retailAdverts?.suppliedPrice?.amountGBP || atv.price;
                }
                if (!local.make || local.make === 'Unknown') { if (atv.make) healSet.make = atv.make; }
                if (!local.model || local.model === 'Unknown') { if (atv.model) healSet.model = atv.model; }
                if (!local.vrm || local.vrm === 'PENDING') { if (atv.vrm) healSet.vrm = atv.vrm; }
                if (!local.derivative || local.derivative === '') { const v = atStr(atv.derivative || atv.vehicle?.derivative); if (v) healSet.derivative = v; }
                if (!local.vin || local.vin === '') { const v = atv.vehicle?.vin || ''; if (v) healSet.vin = v; }
                if (!local.dateOfRegistration || local.dateOfRegistration === '') { const v = atv.vehicle?.firstRegistrationDate || ''; if (v) healSet.dateOfRegistration = v; }

                if (Object.keys(healSet).length > 0 && local._id) {
                    Vehicle.findByIdAndUpdate(local._id, { $set: healSet }).catch((err: any) => console.error('[DB Silent Update Error]', err?.message || err));
                }

                mergedList[index] = {
                    ...local,
                    ...healSet,
                    status: statusFromAT,  // AT is source of truth
                    stockId: atv.id,
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
                if (localRecordAny._id) {
                    const heal: Record<string, any> = {};
                    if (atLifecycle && localRecordAny.status !== statusFromAT) heal.status = statusFromAT;
                    if (!localRecordAny.stockId && atv.id) heal.stockId = atv.id;
                    if (Object.keys(heal).length > 0) Vehicle.findByIdAndUpdate(localRecordAny._id, { $set: heal }).catch((err: any) => console.error('[DB Silent Update Error]', err?.message || err));
                }
                // Include in results if AT status matches the active filter
                const filterMatches = !normalizedStatus || normalizedStatus === 'All' || normalizedStatus === statusFromAT;
                const matchesSearch = !search ||
                    atv.make?.toLowerCase().includes(search) ||
                    atv.model?.toLowerCase().includes(search) ||
                    atv.vrm?.toLowerCase().includes(search);
                if (filterMatches && matchesSearch) {
                    const hasSavedImages = localRecordAny.primaryImage && localRecordAny.primaryImage !== '';
                    const healAny: Record<string, any> = {};
                    const atMileageAny = atv.vehicle?.odometerReadingMiles ?? atv.mileage;
                    if (!localRecordAny.mileage && atMileageAny) healAny.mileage = atMileageAny;
                    if (!localRecordAny.colour || localRecordAny.colour === '') { const v = atStr(atv.vehicle?.colour || atv.colour); if (v) healAny.colour = v; }
                    if (!localRecordAny.fuelType || localRecordAny.fuelType === '') { const v = atStr(atv.vehicle?.fuelType || atv.fuelType); if (v) healAny.fuelType = v; }
                    if (!localRecordAny.transmission || localRecordAny.transmission === '') { const v = atStr(atv.vehicle?.transmissionType || atv.transmission); if (v) healAny.transmission = v; }
                    if (!localRecordAny.bodyType || localRecordAny.bodyType === '') { const v = atStr(atv.vehicle?.bodyType || atv.bodyType); if (v) healAny.bodyType = v; }
                    if (!localRecordAny.year || localRecordAny.year === '') { const v = atv.vehicle?.yearOfManufacture || atv.year; if (v) healAny.year = String(v); }
                    if (Object.keys(healAny).length > 0 && localRecordAny._id) {
                        Vehicle.findByIdAndUpdate(localRecordAny._id, { $set: healAny }).catch((err: any) => console.error('[DB Silent Update Error]', err?.message || err));
                    }
                    mergedList.push({
                        ...localRecordAny,
                        ...healAny,
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
                            price: atv.price || atv.adverts?.retailAdverts?.suppliedPrice?.amountGBP || 0,
                            mileage: atv.vehicle?.odometerReadingMiles ?? atv.mileage ?? 0,
                            colour: atStr(atv.vehicle?.colour || atv.colour),
                            fuelType: atStr(atv.vehicle?.fuelType || atv.fuelType),
                            transmission: atStr(atv.vehicle?.transmissionType || atv.transmission),
                            bodyType: atStr(atv.vehicle?.bodyType || atv.bodyType),
                            year: atv.vehicle?.yearOfManufacture ? String(atv.vehicle.yearOfManufacture) : (atv.year || ''),
                            doors: atv.vehicle?.doors,
                            seats: atv.vehicle?.seats,
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
    // Build features with AT-required type field: Standard (derivative spec) vs Optional (extras)
    const stdNames  = Array.isArray(vehicle.standardFeatures) ? vehicle.standardFeatures : [];
    const optNames  = [
        ...(Array.isArray(vehicle.features)       ? vehicle.features       : []),
        ...(Array.isArray(vehicle.customFeatures)  ? vehicle.customFeatures  : []),
    ];
    const stdSet = new Set<string>(stdNames.map((f: any) => (typeof f === 'string' ? f : f.name || '')).filter(Boolean));
    const seen   = new Set<string>();
    const allFeatureNames = [...stdNames, ...optNames];
    const featuresPayload = allFeatureNames.length > 0
        ? allFeatureNames.reduce((acc: any[], f: any) => {
            const name = typeof f === 'string' ? f : (f.name || '');
            if (!name || seen.has(name)) return acc;
            seen.add(name);
            acc.push({ name, type: stdSet.has(name) ? 'Standard' : 'Optional' });
            return acc;
        }, [])
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
            // AT docs: DUE_IN = vehicle not yet ready for sale (our Draft state)
            // FORECOURT = vehicle ready for sale (our In Stock state)
            lifecycleState: isDraft ? 'DUE_IN' : 'FORECOURT',
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

    // All AT field changes are collected into a single batched PATCH — reduces 10+ calls to 1-2.
    // Exceptions: lifecycle (requires sequential unpublish→update) and images (separate handling).
    const atBatch: Record<string, any> = {};
    const atBatchAdverts: Record<string, any> = {};
    const atBatchRetailAdverts: Record<string, any> = {};
    const atBatchVehicle: Record<string, any> = {};

    // 1. Advert Channel Statuses — batch into retailAdverts (was up to 5 separate calls)
    const channelKeyMap: Record<string, string> = {
        autotrader: 'autotraderAdvert', advertiser: 'advertiserAdvert',
        locator: 'locatorAdvert', export: 'exportAdvert', profile: 'profileAdvert',
    };
    if (vehicle.stockId) {
        for (const [statusKey, channel] of [
            ['atAdvertStatus', 'autotrader'], ['advertiserAdvertStatus', 'advertiser'],
            ['locatorAdvertStatus', 'locator'], ['exportAdvertStatus', 'export'],
            ['profileAdvertStatus', 'profile'],
        ] as [string, string][]) {
            if (updateData[statusKey]) {
                atBatchRetailAdverts[channelKeyMap[channel]] = { status: updateData[statusKey] };
            }
        }
    }

    // 2. Price + 2b. Advert settings — all batched into atBatchAdverts/atBatchRetailAdverts
    if (vehicle.stockId) {
        if (updateData.price !== undefined) {
            if (Number(updateData.price) < 75) {
                console.warn('[AutoTrader] Supplied price too low (£75 min), skipping AT sync');
            } else {
                atBatchRetailAdverts.suppliedPrice = { amountGBP: Number(updateData.price) };
                // forecourtPrice always defaults to the new supplied price when not explicitly set.
                // Using vehicle.forecourtPrice (old DB value) was a bug — it prevented the price from
                // updating forecourtPrice when the user changed it.
                if (updateData.forecourtPrice === undefined) {
                    atBatchAdverts.forecourtPrice = { amountGBP: Number(updateData.price) };
                }
            }
        }
        if (updateData.forecourtPrice !== undefined && Number(updateData.forecourtPrice) > 0)
            atBatchAdverts.forecourtPrice = { amountGBP: Number(updateData.forecourtPrice) };
        if (updateData.includes12MonthsMot !== undefined)    atBatchAdverts.twelveMonthsMot        = updateData.includes12MonthsMot;
        if (updateData.includesMotInsurance !== undefined)   atBatchAdverts.motInsurance           = updateData.includesMotInsurance;
        if (updateData.dueInDate !== undefined)              atBatchAdverts.dueDate                = updateData.dueInDate || null;
        if (updateData.dateInStock !== undefined)            atBatchAdverts.stockInDate            = updateData.dateInStock || null;
        if (updateData.vatStatus !== undefined)              atBatchAdverts.vatScheme              = updateData.vatStatus === 'VAT Qualifying' ? 'Standard' : 'Marginal';
        if (updateData.purchasePrice !== undefined)          atBatchAdverts.purchasePrice          = { amountGBP: Number(updateData.purchasePrice) || null };
        if (updateData.preparationCosts !== undefined)       atBatchAdverts.preparationCosts       = { amountGBP: Number(updateData.preparationCosts) || null };
        if (updateData.soldDate !== undefined)               atBatchAdverts.soldDate               = updateData.soldDate || null;
        if (updateData.soldPrice !== undefined)              atBatchAdverts.soldPrice              = { amountGBP: Number(updateData.soldPrice) || null };
        if (updateData.manufacturerApproved !== undefined)   atBatchAdverts.manufacturerApproved   = Boolean(updateData.manufacturerApproved);
        if (updateData.forecourtPriceVatStatus !== undefined) atBatchAdverts.forecourtPriceVatStatus = updateData.forecourtPriceVatStatus || null;
        if (updateData.adminFee !== undefined)               atBatchRetailAdverts.adminFee         = { amountGBP: Number(updateData.adminFee) || null };
    }

    // 3. Sync Lifecycle State (with mandatory Unpublish for SOLD/WASTEBIN/DELETED/DRAFT)
    if (vehicle.stockId && updateData.status) {
        const lifecycleMap: Record<string, string> = {
            'Sold':             'SOLD',
            'In Stock':         'FORECOURT',
            'Due In':           'DUE_IN',
            'Draft':            'DUE_IN',           // AT docs: DUE_IN = not yet ready for sale
            'Sale In Progress': 'SALE_IN_PROGRESS',
            'Reserved':         'SALE_IN_PROGRESS',
            'Wastebin':         'WASTEBIN',
            'Deleted':          'DELETED',
        };
        const lifecycleState = lifecycleMap[updateData.status];
        if (lifecycleState) {
            try {
                // SOLD, WASTEBIN, DELETED require all channels unpublished first (AT docs requirement)
                // DUE_IN (Draft) also requires unpublish — vehicle should not be visible
                if (['SOLD', 'WASTEBIN', 'DELETED', 'DUE_IN'].includes(lifecycleState)) {
                    await client.unpublishAll(vehicle.stockId);
                    console.log(`[AutoTrader] All channels unpublished for stock ${vehicle.stockId}`);
                }

                await client.updateStock(vehicle.stockId, {
                    metadata: { lifecycleState }
                });
                console.log(`[AutoTrader] Lifecycle updated to ${lifecycleState}`);

                // Immediately update the AT cache so the vehicle list shows the correct
                // status without waiting for the 60-second cache TTL to expire.
                // Without this, the stale FORECOURT state in cache overwrites local DB status.
                try {
                    const cacheDoc = await AutoTraderStockCache.findOne({ tenantId });
                    if (cacheDoc?.stock) {
                        const cacheIdx = cacheDoc.stock.findIndex((s: any) => s.id === vehicle.stockId);
                        if (cacheIdx !== -1) {
                            cacheDoc.stock[cacheIdx].metadata = {
                                ...(cacheDoc.stock[cacheIdx].metadata || {}),
                                lifecycleState,
                            };
                            cacheDoc.stock[cacheIdx].status = updateData.status;
                            await AutoTraderStockCache.updateOne(
                                { tenantId },
                                { $set: { stock: cacheDoc.stock } }
                            );
                        }
                    }
                } catch (cacheErr) {
                    console.error('[AT Cache] Failed to update lifecycle in cache:', cacheErr);
                }

                // When moved to In Stock (FORECOURT), publish the AT advert
                if (lifecycleState === 'FORECOURT') {
                    await client.updateStockAdvertiseStatus(vehicle.stockId, 'autotrader', 'PUBLISHED');
                    await Vehicle.updateOne(
                        { _id: vehicle._id, tenantId },
                        { $set: { atAdvertStatus: 'PUBLISHED' } }
                    );
                    console.log(`[AutoTrader] Autotrader advert published for stock ${vehicle.stockId}`);
                }
            } catch (atError: any) {
                const atMsg = atError?.data?.message || atError?.data?.errors?.[0]?.message || atError?.message || 'Unknown error';
                console.error(`[AutoTrader Lifecycle Sync Error] ${lifecycleState} → ${vehicle.stockId}: ${atMsg}`);
            }
        }
    }

    // 4. Create missing AT stock if vehicle is being moved to In Stock (no stockId yet)
    // AT docs: min £75 required for Car/Bike/Van to be advertised
    const inStockStatuses = ['In Stock', 'For Sale'];
    if (!vehicle.stockId && updateData.status && inStockStatuses.includes(updateData.status)) {
        console.log(`[AutoTrader] Vehicle ${vehicle._id} changing to '${updateData.status}' but has no AT stockId. Pushing to AT now.`);
        if (!vehicle.derivativeId) {
            console.warn('[AutoTrader] Missing derivativeId — skipping AT stock creation. Set derivativeId first.');
        } else if (!vehicle.price || Number(vehicle.price) < 75) {
            console.warn(`[AutoTrader] Price £${vehicle.price || 0} is below AT minimum £75 — skipping AT stock creation. Add a price ≥ £75 and save again.`);
            // Save atSyncError so the UI can show a helpful message
            await Vehicle.findByIdAndUpdate(vehicle._id, {
                $set: { atSyncError: 'Price must be at least £75 to sync with AutoTrader. Update the price and save again.' }
            }).catch((err: any) => console.error('[DB Silent Update Error]', err?.message || err));
        } else {
            try {
                // Clear any previous sync error
                await Vehicle.findByIdAndUpdate(vehicle._id, { $unset: { atSyncError: '' } }).catch((err: any) => console.error('[DB Silent Update Error]', err?.message || err));
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
                    const atMsg = atError?.data?.message || atError?.data?.errors?.[0]?.message || atError?.message || 'Unknown AT error';
                    console.error(`[AutoTrader createStock Error] ${atMsg}`);
                    await Vehicle.findByIdAndUpdate(vehicle._id, {
                        $set: { atSyncError: `AutoTrader sync failed: ${atMsg}` }
                    }).catch((err: any) => console.error('[DB Silent Update Error]', err?.message || err));
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
            // Note: make, model, derivative, generation are read-only on AT - derived from derivativeId
            year:                 'yearOfManufacture',
            vin:                  'vin',
            doors:                'doors',
            seats:                'seats',
            engineNumber:         'engineNumber',
            plate:                'plate',
            emissionClass:        'emissionClass',
            co2EmissionGPKM:      'co2EmissionGPKM',
            exteriorFinish:       'exteriorFinish',
            wheelchairAccessible: 'wheelchairAccessible',
            // Engine / Performance
            enginePowerBHP:               'enginePowerBHP',
            enginePowerPS:                'enginePowerPS',
            engineTorqueNM:               'engineTorqueNM',
            engineTorqueLBFT:             'engineTorqueLBFT',
            cylinders:                    'cylinders',
            valves:                       'valves',
            boreMM:                       'boreMM',
            strokeMM:                     'strokeMM',
            fuelCapacityLitres:           'fuelCapacityLitres',
            fuelDelivery:                 'fuelDelivery',
            gears:                        'gears',
            startStop:                    'startStop',
            topSpeedMPH:                  'topSpeedMPH',
            zeroToSixtyMPHSeconds:        'zeroToSixtyMPHSeconds',
            zeroToOneHundredKMPHSeconds:  'zeroToOneHundredKMPHSeconds',
            // EV
            batteryRangeMiles:            'batteryRangeMiles',
            batteryCapacityKWH:           'batteryCapacityKWH',
            batteryUsableCapacityKWH:     'batteryUsableCapacityKWH',
            batteryChargeTime:            'batteryChargeTime',
            batteryHealth:                'batteryHealth',
            // Fuel Economy
            fuelEconomyNEDCExtraUrbanMPG: 'fuelEconomyNEDCExtraUrbanMPG',
            fuelEconomyNEDCUrbanMPG:      'fuelEconomyNEDCUrbanMPG',
            fuelEconomyNEDCCombinedMPG:   'fuelEconomyNEDCCombinedMPG',
            fuelEconomyWLTPLowMPG:        'fuelEconomyWLTPLowMPG',
            fuelEconomyWLTPMediumMPG:     'fuelEconomyWLTPMediumMPG',
            fuelEconomyWLTPHighMPG:       'fuelEconomyWLTPHighMPG',
            fuelEconomyWLTPExtraHighMPG:  'fuelEconomyWLTPExtraHighMPG',
            fuelEconomyWLTPCombinedMPG:   'fuelEconomyWLTPCombinedMPG',
            // Dimensions / Weight
            lengthMM:                     'lengthMM',
            heightMM:                     'heightMM',
            widthMM:                      'widthMM',
            wheelbaseMM:                  'wheelbaseMM',
            minimumKerbWeightKG:          'minimumKerbWeightKG',
            grossVehicleWeightKG:         'grossVehicleWeightKG',
            bootSpaceSeatsUpLitres:       'bootSpaceSeatsUpLitres',
            bootSpaceSeatsDownLitres:     'bootSpaceSeatsDownLitres',
            // Insurance
            insuranceGroup:               'insuranceGroup',
            insuranceSecurityCode:        'insuranceSecurityCode',
            // Interior
            interiorUpholstery:           'upholstery',
            interiorColour:               'interiorColour',
            // Compliance
            ulezCompliant:                'ulezCompliant',
            rde2:                         'rde2',
            countryOfOrigin:              'countryOfOrigin',
            // Van / Truck
            cabType:                      'cabType',
            wheelbaseType:                'wheelbaseType',
            roofHeightType:               'roofHeightType',
            payloadLengthMM:              'payloadLengthMM',
            payloadHeightMM:              'payloadHeightMM',
            payloadWidthMM:               'payloadWidthMM',
            payloadWeightKG:              'payloadWeightKG',
        };

        // Type-coercion sets
        const numericVehicleFields = new Set([
            'mileage','doors','seats','enginePowerBHP','enginePowerPS','engineTorqueNM','engineTorqueLBFT',
            'cylinders','valves','boreMM','strokeMM','fuelCapacityLitres','gears','topSpeedMPH',
            'zeroToSixtyMPHSeconds','zeroToOneHundredKMPHSeconds','batteryRangeMiles','batteryCapacityKWH',
            'batteryUsableCapacityKWH','batteryHealth','co2EmissionGPKM',
            'fuelEconomyNEDCExtraUrbanMPG','fuelEconomyNEDCUrbanMPG','fuelEconomyNEDCCombinedMPG',
            'fuelEconomyWLTPLowMPG','fuelEconomyWLTPMediumMPG','fuelEconomyWLTPHighMPG',
            'fuelEconomyWLTPExtraHighMPG','fuelEconomyWLTPCombinedMPG',
            'lengthMM','heightMM','widthMM','wheelbaseMM','minimumKerbWeightKG','grossVehicleWeightKG',
            'bootSpaceSeatsUpLitres','bootSpaceSeatsDownLitres',
            'payloadLengthMM','payloadHeightMM','payloadWidthMM','payloadWeightKG',
        ]);
        const booleanVehicleFields = new Set(['startStop','wheelchairAccessible','ulezCompliant','rde2']);
        const stringVehicleFields  = new Set(['year','plate']);

        const vehicleUpdate: Record<string, any> = {};
        for (const [localKey, atKey] of Object.entries(vehicleFieldMap)) {
            const val = updateData[localKey];
            if (val === undefined) continue;
            if (val === '')                           { vehicleUpdate[atKey] = null; continue; }
            if (numericVehicleFields.has(localKey))  { vehicleUpdate[atKey] = Number(val); continue; }
            if (booleanVehicleFields.has(localKey))  { vehicleUpdate[atKey] = Boolean(val); continue; }
            if (stringVehicleFields.has(localKey))   { vehicleUpdate[atKey] = String(val); continue; }
            vehicleUpdate[atKey] = val;
        }

        // Fields that require value transformation before sending to AT
        if (updateData.serviceHistory !== undefined)         vehicleUpdate.serviceHistory          = updateData.serviceHistory || null;
        if (updateData.previousOwners !== undefined)         vehicleUpdate.previousOwners          = Number(updateData.previousOwners);
        if (updateData.motExpiry !== undefined)              vehicleUpdate.motExpiryDate           = updateData.motExpiry || null;
        if (updateData.numberOfKeys !== undefined)           vehicleUpdate.keys                    = Number(updateData.numberOfKeys);
        if (updateData.v5Present !== undefined)              vehicleUpdate.v5Certificate           = updateData.v5Present;
        if (updateData.exDemo !== undefined)                 vehicleUpdate.exDemo                  = updateData.exDemo;
        if (updateData.manufacturerWarrantyMonths !== undefined) vehicleUpdate.warrantyMonthsOnPurchase        = Number(updateData.manufacturerWarrantyMonths);
        // Service history detail (update sync - was missing before)
        if (updateData.mileageAtLastService !== undefined)       vehicleUpdate.lastServiceOdometerReadingMiles = Number(updateData.mileageAtLastService) || null;
        if (updateData.dateOfLastService !== undefined)          vehicleUpdate.lastServiceDate                = updateData.dateOfLastService || null;
        // Registration date - AT requires full YYYY-MM-DD
        if (updateData.dateOfRegistration !== undefined && /^\d{4}-\d{2}-\d{2}/.test(String(updateData.dateOfRegistration || ''))) {
            vehicleUpdate.firstRegistrationDate = updateData.dateOfRegistration;
        }
        // Driver position - only send LHD; RHD is AT default (blank)
        if (updateData.driverPosition !== undefined) {
            vehicleUpdate.driverPosition = String(updateData.driverPosition || '').toLowerCase().includes('left') ? 'Left Hand Drive' : null;
        }
        // Origin: 'UK Vehicle' â†’ 'UK', 'Import' â†’ 'Non UK'
        if (updateData.origin !== undefined)                 vehicleUpdate.origin                  = AT_ORIGIN_MAP[updateData.origin] ?? updateData.origin;
        // Conditions: 'Fair' â†’ 'Average' (AT doesn't accept 'Fair')
        if (updateData.interiorCondition !== undefined)      vehicleUpdate.interiorCondition       = AT_CONDITION_MAP[updateData.interiorCondition] ?? updateData.interiorCondition;
        if (updateData.tyreCondition !== undefined)          vehicleUpdate.tyreCondition           = AT_CONDITION_MAP[updateData.tyreCondition]     ?? updateData.tyreCondition;
        if (updateData.exteriorCondition !== undefined)      vehicleUpdate.bodyCondition           = AT_CONDITION_MAP[updateData.exteriorCondition] ?? updateData.exteriorCondition;

        // Vehicle fields → batched
        Object.assign(atBatchVehicle, vehicleUpdate);
        if (Object.keys(vehicleUpdate).length > 0) console.log('[AutoTrader] Vehicle fields queued:', Object.keys(vehicleUpdate));
    }

    // 5. Advert content — batch into atBatchRetailAdverts
    if (vehicle.stockId) {
        if (updateData.description !== undefined) {
            const v = advertDescriptionToPlainText(updateData.description).trim().slice(0, 4000);
            if (v) atBatchRetailAdverts.description = v;
        }
        if (updateData.description2 !== undefined) {
            const v = advertDescriptionToPlainText(updateData.description2).trim().slice(0, 4000);
            if (v) atBatchRetailAdverts.description2 = v;
        }
        if (updateData.attentionGrabber !== undefined) {
            const v = String(updateData.attentionGrabber).trim().slice(0, 30);
            if (v) atBatchRetailAdverts.attentionGrabber = v;
        }
        if (updateData.priceOnApplication !== undefined) atBatchRetailAdverts.priceOnApplication = updateData.priceOnApplication;
        if (updateData.longAttentionGrabber !== undefined && !updateData.description2) {
            const v = String(updateData.longAttentionGrabber || '').trim().slice(0, 70);
            if (v) atBatchRetailAdverts.description2 = v;
        }
    }

    // 6. Features — batch into atBatch.features
    if (vehicle.stockId && updateData.features !== undefined) {
        const stdNames   = Array.isArray(updateData.standardFeatures ?? vehicle.standardFeatures)
            ? (updateData.standardFeatures ?? vehicle.standardFeatures) : [];
        const optNames   = [
            ...(Array.isArray(updateData.features) ? updateData.features : []),
            ...(Array.isArray(updateData.customFeatures ?? vehicle.customFeatures) ? (updateData.customFeatures ?? vehicle.customFeatures) : []),
        ];
        const stdSetU = new Set<string>(stdNames.map((f: any) => (typeof f === 'string' ? f : f.name || '')).filter(Boolean));

        // Build type map from AT cache — the cache stores { name, type } from AT's own response,
        // so names match exactly. This prevents naming-mismatch between the optional-extras API
        // (used for stdSetU) and the actual stock item features, which caused all Standard features
        // to be sent as Optional.
        const cacheTypeMap: Record<string, string> = {};
        try {
            const atCacheDoc = await AutoTraderStockCache.findOne({ tenantId });
            const cachedItem = atCacheDoc?.stock?.find((s: any) => s.id === vehicle.stockId);
            (cachedItem?.features || []).forEach((f: any) => {
                const n = typeof f === 'string' ? f : (f.name || '');
                const t = typeof f === 'object' && f.type ? f.type : null;
                if (n && t) cacheTypeMap[n] = t;
            });
        } catch {}

        const seenUpdate = new Set<string>();
        atBatch.features = [...stdNames, ...optNames].reduce((acc: any[], f: any) => {
            const name = typeof f === 'string' ? f : (f.name || '');
            if (!name || seenUpdate.has(name)) return acc;
            seenUpdate.add(name);
            // Priority: AT cache type (exact name match) → stdSet lookup → Optional
            const type = cacheTypeMap[name] || (stdSetU.has(name) ? 'Standard' : 'Optional');
            acc.push({ name, type });
            return acc;
        }, []);
        console.log(`[AutoTrader] Features queued: ${atBatch.features.length} items`);
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

    // 7b. Media video/spin — batch into atBatch.media
    if (vehicle.stockId) {
        if (updateData.youtubeVideoIds !== undefined) {
            const firstVideoId = Array.isArray(updateData.youtubeVideoIds) ? updateData.youtubeVideoIds[0] : null;
            atBatch.media = { ...(atBatch.media || {}), video: firstVideoId ? { href: 'https://www.youtube.com/watch?v=' + firstVideoId } : { href: null } };
        }
        if (updateData.spinUrl !== undefined) {
            atBatch.media = { ...(atBatch.media || {}), spin: updateData.spinUrl ? { href: updateData.spinUrl } : { href: null } };
        }
    }

    // 7c. displayOptions — batch into atBatchRetailAdverts
    if (vehicle.stockId && updateData.excludeFromAdvert !== undefined) {
        const exFromAdvert = updateData.excludeFromAdvert || {};
        atBatchRetailAdverts.displayOptions = {
            excludePreviousOwners:  Boolean(exFromAdvert.previousOwners),
            excludeStrapline:       Boolean(exFromAdvert.attentionGrabber),
            excludeMot:             Boolean(exFromAdvert.mot),
            excludeWarranty:        Boolean(exFromAdvert.warranty),
            excludeInteriorDetails: Boolean(exFromAdvert.interiorCondition),
            excludeTyreCondition:   Boolean(exFromAdvert.tyreCondition),
            excludeBodyCondition:   Boolean(exFromAdvert.exteriorCondition),
        };
    }

    // ─── Send ONE combined PATCH to AT (all queued field changes) ────────────────
    // Content fields (attentionGrabber, description, description2) bypass the cooldown —
    // they must always reach AT so the advert text stays in sync.
    const hasContentChanges = !!(
        updateData.attentionGrabber !== undefined ||
        updateData.description      !== undefined ||
        updateData.description2     !== undefined
    );
    // AT docs: advert channel status changes (publish/unpublish) must also bypass the cooldown.
    // Selecting a channel in the UI must fire a PATCH immediately — no silent drops.
    const ADVERT_CHANNEL_KEYS = ['autotraderAdvert', 'advertiserAdvert', 'locatorAdvert', 'exportAdvert', 'profileAdvert'];
    const hasAdvertChanges = ADVERT_CHANNEL_KEYS.some(k => atBatchRetailAdverts[k] !== undefined);

    if (vehicle.stockId) {
        if (Object.keys(atBatchRetailAdverts).length > 0) atBatchAdverts.retailAdverts = atBatchRetailAdverts;
        if (Object.keys(atBatchAdverts).length > 0)      atBatch.adverts = atBatchAdverts;
        if (Object.keys(atBatchVehicle).length > 0)      atBatch.vehicle = atBatchVehicle;
        if (Object.keys(atBatch).length > 0 && shouldSendToAt(String(vehicle.stockId), hasContentChanges || hasAdvertChanges)) {
            try {
                await client.updateStock(vehicle.stockId, atBatch);
                console.log('[AutoTrader] Batched PATCH synced:', Object.keys(atBatch));
            } catch (atError: any) {
                const atMsg = atError?.data?.message || atError?.data?.errors?.[0]?.message || atError?.message || 'Unknown error';
                console.error(`[AutoTrader Batch Sync Error] ${vehicle.stockId}: ${atMsg}`, JSON.stringify(atError?.data));
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

