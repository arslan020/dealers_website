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

/** Attach live `adverts` (+ features when present) to a local Mongo vehicle that has `stockId`. */
export async function mergeLiveAdvertsOntoVehicleDoc(tenantId: string, stockId: string, doc: any): Promise<any> {
    if (!stockId || !doc) return doc;
    try {
        const client = new AutoTraderClient(tenantId);
        await client.init();
        const raw = await client.getStockItem(String(stockId));
        const live = extractLiveStockPayload(raw);
        if (!live) return doc;
        const liveV = live.vehicle && typeof live.vehicle === 'object' ? live.vehicle : {};
        return {
            ...doc,
            adverts: live.adverts ?? doc.adverts,
            features: Array.isArray(live.features) && live.features.length > 0 ? live.features : doc.features,
            technicalSpecs: { ...(doc.technicalSpecs || {}), ...liveV, ...(doc.manualSpecs || {}) },
        };
    } catch {
        return doc;
    }
}
