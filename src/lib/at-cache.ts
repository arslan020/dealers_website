/**
 * Server-side in-memory cache for AutoTrader API responses.
 * Shared across all requests in the same Node.js process.
 * Reduces redundant AT API calls for static/slow-changing data.
 */

interface CacheEntry {
    data: any;
    expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export const ATCache = {
    get(key: string): any | null {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            store.delete(key);
            return null;
        }
        return entry.data;
    },

    set(key: string, data: any, ttlSeconds: number): void {
        store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
    },

    delete(key: string): void {
        store.delete(key);
    },

    /** Remove all entries whose key starts with prefix */
    invalidatePrefix(prefix: string): void {
        for (const key of store.keys()) {
            if (key.startsWith(prefix)) store.delete(key);
        }
    },
};

// TTLs in seconds
export const TTL = {
    TAXONOMY:   86400, // 24 hr — makes/models/generations almost never change
    DERIVATIVE: 86400, // 24 hr — derivative specs are static
    VRM_LOOKUP:  3600, // 1 hr  — registration data is stable
    VRM_CHECK:  86400, // 24 hr — vehicle history rarely changes in a day
    STOCK_ITEM:   300, // 5 min — prevents repeat AT calls on refresh; invalidated on save
};

/**
 * Per-stockId AT PATCH cooldown.
 * First save per stockId goes to AT immediately.
 * Subsequent saves within AT_COOLDOWN_MS are skipped for AT (MongoDB still updates).
 * Prevents 30+ AT calls per editing session for one vehicle.
 */
const AT_COOLDOWN_MS = 120000;
const atLastSent = new Map<string, number>();

/**
 * forceThrough: true when content fields (attentionGrabber, description, description2)
 * are being saved — these must always reach AT regardless of cooldown.
 */
export function shouldSendToAt(stockId: string, forceThrough = false): boolean {
    if (forceThrough) {
        atLastSent.set(stockId, Date.now());
        return true;
    }
    const last = atLastSent.get(stockId);
    if (!last || Date.now() - last >= AT_COOLDOWN_MS) {
        atLastSent.set(stockId, Date.now());
        return true;
    }
    return false;
}

/**
 * Per-stockId: the last full payload successfully sent to AT.
 * Used as the diff source to prevent 202 no-change PATCHes.
 * Stored as JSON string to avoid accidental mutation.
 */
const atLastPayload = new Map<string, string>();

export function getLastAtPayload(stockId: string): any | null {
    const s = atLastPayload.get(stockId);
    return s ? JSON.parse(s) : null;
}

export function setLastAtPayload(stockId: string, payload: any): void {
    atLastPayload.set(stockId, JSON.stringify(payload));
}
