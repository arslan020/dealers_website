import { AutoTraderClient } from '@/lib/autotrader';

/** Normalise AutoTrader GET /stock?stockId= response shapes. */
export function extractLiveStockPayload(raw: any): any | null {
    if (!raw || typeof raw !== 'object') return null;
    if (Array.isArray(raw.results) && raw.results.length > 0) return raw.results[0];
    if (raw.results && typeof raw.results === 'object' && !Array.isArray(raw.results) && (raw.results as any).id)
        return raw.results;
    if (raw.id || raw.stockId) return raw;
    return null;
}

/** Merge a live stock row over a cached list row (full advert text + media). */
export function mergeCachedAtRowWithLive(cached: any, live: any): any {
    if (!live || !cached) return cached;
    const liveVehicle = live.vehicle && typeof live.vehicle === 'object' ? live.vehicle : {};
    return {
        ...cached,
        adverts: live.adverts ?? cached.adverts,
        media: live.media ?? cached.media,
        features: Array.isArray(live.features) && live.features.length > 0 ? live.features : cached.features,
        technicalSpecs: { ...(cached.technicalSpecs || {}), ...liveVehicle },
    };
}

/** Fetch one stock from AT and merge onto the cached row (MotorDesk-style full description). */
export async function enrichAtCacheStockRow(tenantId: string, cached: any): Promise<any> {
    if (!cached?.id) return cached;
    try {
        const client = new AutoTraderClient(tenantId);
        await client.init();
        const raw = await client.getStockItem(String(cached.id));
        const live = extractLiveStockPayload(raw);
        return mergeCachedAtRowWithLive(cached, live);
    } catch {
        return cached;
    }
}

/** Attach live `adverts` (+ features + vehicle fields when present) to a local Mongo vehicle that has `stockId`.
 *  Also fills in any top-level fields that are empty/missing in the local doc from AT live data.
 */
export async function mergeLiveAdvertsOntoVehicleDoc(tenantId: string, stockId: string, doc: any): Promise<any> {
    if (!stockId || !doc) return doc;
    try {
        const client = new AutoTraderClient(tenantId);
        await client.init();
        const raw = await client.getStockItem(String(stockId));
        const live = extractLiveStockPayload(raw);
        if (!live) return doc;
        const liveV = live.vehicle && typeof live.vehicle === 'object' ? live.vehicle : {};

        const toStr = (val: any): string => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            if (typeof val === 'object') return val.name || val.value || '';
            return String(val);
        };
        const fill = (localVal: any, atVal: any) => (localVal !== undefined && localVal !== null && localVal !== '' ? localVal : atVal);

        // longAttentionGrabber is stored in AT as description2 (when ≤70 chars and no newlines)
        const atDesc2 = live.adverts?.retailAdverts?.description2 || '';
        const atLongGrabber = atDesc2 && atDesc2.length <= 70 && !atDesc2.includes('\n') ? atDesc2 : '';

        return {
            ...doc,
            longAttentionGrabber: fill(doc.longAttentionGrabber, atLongGrabber),
            // Fill top-level vehicle fields from AT when local record is empty
            vrm:          fill(doc.vrm,          toStr(liveV.registration || liveV.vrm || liveV.registrationNumber)),
            make:         fill(doc.make === 'Unknown' ? '' : doc.make, toStr(liveV.make)),
            model:        fill(doc.model === 'Unknown' ? '' : doc.model, toStr(liveV.model)),
            derivative:   fill(doc.derivative,   toStr(liveV.derivative)),
            generation:   fill(doc.generation,   toStr(liveV.generation)),
            trim:         fill(doc.trim,         toStr(liveV.trim)),
            bodyType:     fill(doc.bodyType,     toStr(liveV.bodyType)),
            fuelType:     fill(doc.fuelType,     toStr(liveV.fuelType)),
            transmission: fill(doc.transmission, toStr(liveV.transmissionType)),
            colour:       fill(doc.colour,       toStr(liveV.colour)),
            exteriorFinish: fill(doc.exteriorFinish, toStr(liveV.exteriorFinish)),
            drivetrain:   fill(doc.drivetrain,   toStr(liveV.drivetrain)),
            year:         fill(doc.year,         liveV.yearOfManufacture ? String(liveV.yearOfManufacture) : ''),
            doors:        fill(doc.doors,        liveV.doors ?? undefined),
            seats:        fill(doc.seats,        liveV.seats ?? undefined),
            mileage:      fill(doc.mileage,      liveV.odometerReadingMiles ?? undefined),
            engineSize:   fill(doc.engineSize,   liveV.engineSizeCc ? String(liveV.engineSizeCc) : (liveV.badgeEngineSizeLitres ? String(liveV.badgeEngineSizeLitres) : '')),
            vin:          fill(doc.vin,          liveV.vin || ''),
            dateOfRegistration: fill(doc.dateOfRegistration, liveV.firstRegistrationDate || ''),
            previousOwners: fill(doc.previousOwners, liveV.previousOwners ?? undefined),
            serviceHistory: fill(doc.serviceHistory, liveV.serviceHistory || ''),
            // Always use AT as source of truth for adverts, features, media and full technicalSpecs
            adverts:      live.adverts ?? doc.adverts,
            features:     Array.isArray(live.features) && live.features.length > 0 ? live.features : doc.features,
            technicalSpecs: { ...(doc.technicalSpecs || {}), ...liveV, ...(doc.manualSpecs || {}) },
            // AT media is source of truth — exposes full href with correct CDN host for the Images tab
            media:    live.media ?? doc.media,
            // Fill imageIds from AT media when local doc has none
            imageIds: (doc.imageIds && doc.imageIds.length > 0)
                ? doc.imageIds
                : (live.media?.images || []).map((img: any) => img.imageId).filter(Boolean),
        };
    } catch {
        return doc;
    }
}
