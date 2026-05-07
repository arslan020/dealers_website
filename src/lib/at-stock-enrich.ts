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
        // AT wins: use AT value when available, fall back to local (for factual AT-owned fields)
        const atWins = (atVal: any, localVal: any) => (atVal !== undefined && atVal !== null && atVal !== '' ? atVal : localVal);

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
            // AT taxonomy/factual fields — AT always wins (authoritative source)
            derivative:   atWins(toStr(liveV.derivative),   doc.derivative),
            generation:   atWins(toStr(liveV.generation),   doc.generation),
            trim:         atWins(toStr(liveV.trim),         doc.trim),
            bodyType:     atWins(toStr(liveV.bodyType),     doc.bodyType),
            fuelType:     atWins(toStr(liveV.fuelType),     doc.fuelType),
            transmission: atWins(toStr(liveV.transmissionType), doc.transmission),
            colour:       atWins(toStr(liveV.colour),       doc.colour),
            exteriorFinish: atWins(toStr(liveV.exteriorFinish), doc.exteriorFinish),
            drivetrain:   atWins(toStr(liveV.drivetrain),   doc.drivetrain),
            year:         atWins(liveV.yearOfManufacture ? String(liveV.yearOfManufacture) : '', doc.year),
            doors:        liveV.doors ?? doc.doors,
            seats:        liveV.seats ?? doc.seats,
            mileage:      liveV.odometerReadingMiles ?? doc.mileage,
            price:        live.adverts?.forecourtPrice?.amountGBP ?? live.adverts?.retailAdverts?.suppliedPrice?.amountGBP ?? doc.price,
            engineSize:   atWins(liveV.engineCapacityCC ? String(Math.round(liveV.engineCapacityCC / 1000 * 10) / 10) : (liveV.engineSizeCc ? String(liveV.engineSizeCc) : (liveV.badgeEngineSizeLitres ? String(liveV.badgeEngineSizeLitres) : '')), doc.engineSize),
            vin:          atWins(liveV.vin || '',           doc.vin),
            dateOfRegistration: atWins(liveV.firstRegistrationDate || '', doc.dateOfRegistration),
            previousOwners: liveV.owners ?? liveV.previousOwners ?? doc.previousOwners,
            serviceHistory: atWins(liveV.serviceHistory || '', doc.serviceHistory),
            // Always use AT as source of truth for adverts, media and full technicalSpecs
            adverts:      live.adverts ?? doc.adverts,
            // Local doc features preserve exact names used for checkbox matching.
            // AT may return normalized/different names — use local as ground truth, fall back to AT.
            features: (doc.features && doc.features.length > 0)
                ? doc.features
                : (Array.isArray(live.features) ? live.features.map((f: any) => typeof f === 'string' ? f : (f.name || '')).filter(Boolean) : []),
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
