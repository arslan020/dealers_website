/**
 * Compare local AT PATCH payloads against cached / live stock state.
 * Skipping no-op updates avoids Autotrader 202 responses (no change on record).
 */

export function atValEq(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    const norm = (v: any) => (typeof v === 'object' && !Array.isArray(v) && (v.name !== undefined || v.value !== undefined))
        ? (v.name ?? v.value ?? '') : v;
    const na = norm(a); const nb = norm(b);
    if (na !== a || nb !== b) return atValEq(na, nb);
    if (typeof a !== typeof b) {
        const n1 = Number(a); const n2 = Number(b);
        if (!isNaN(n1) && !isNaN(n2)) return n1 === n2;
        return String(a) === String(b);
    }
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        return a.every((item, i) => atValEq(item, b[i]));
    }
    const ak = Object.keys(a); const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every(k => atValEq(a[k], b[k]));
}

/** AT list cache uses `technicalSpecs`; full stock uses `vehicle`. */
export function getAtDiffSource(cached: any): any | null {
    if (!cached) return null;
    const vehicle = cached.vehicle || cached.technicalSpecs || {};
    const media = cached.media || (
        Array.isArray(cached.images) && cached.images.length > 0
            ? {
                images: cached.images.map((img: any) =>
                    typeof img === 'string'
                        ? { href: img }
                        : img
                ),
            }
            : undefined
    );
    return { ...cached, vehicle, ...(media ? { media } : {}) };
}

function imageIdsFromMedia(media: any): string {
    const images = media?.images;
    if (!Array.isArray(images)) return '';
    return images
        .map((img: any) => {
            if (img?.imageId) return String(img.imageId);
            const href = img?.href || (typeof img === 'string' ? img : '');
            const m = String(href).match(/\/([a-f0-9]{32})\.jpg/i);
            return m ? m[1] : '';
        })
        .filter(Boolean)
        .sort()
        .join('\0');
}

/** Deep-merge a PATCH payload into a stock snapshot (for last-sent memory). */
export function mergeAtPayload(base: any, patch: Record<string, any>): Record<string, any> {
    const out = { ...(base || {}) };
    if (patch.vehicle) {
        out.vehicle = { ...(out.vehicle || {}), ...patch.vehicle };
    }
    if (patch.adverts) {
        out.adverts = { ...(out.adverts || {}) };
        for (const [k, v] of Object.entries(patch.adverts)) {
            if (k === 'retailAdverts' && v && typeof v === 'object') {
                out.adverts.retailAdverts = { ...(out.adverts.retailAdverts || {}), ...(v as object) };
            } else {
                (out.adverts as any)[k] = v;
            }
        }
    }
    if (patch.features !== undefined) out.features = patch.features;
    if (patch.media !== undefined) out.media = patch.media;
    if (patch.metadata) {
        out.metadata = { ...(out.metadata || {}), ...patch.metadata };
    }
    return out;
}

/** Returns only fields in `batch` that differ from `cached` (normalized via getAtDiffSource). */
export function diffAtBatch(batch: Record<string, any>, cached: any): Record<string, any> {
    const source = getAtDiffSource(cached);
    if (!source) return batch;
    const diff: Record<string, any> = {};

    if (batch.vehicle) {
        const cv = source.vehicle || {};
        const vd: Record<string, any> = {};
        for (const [k, v] of Object.entries(batch.vehicle)) {
            if (!atValEq(v, cv[k])) vd[k] = v;
        }
        if (Object.keys(vd).length > 0) diff.vehicle = vd;
    }

    if (batch.adverts) {
        const ca = source.adverts || {};
        const ad: Record<string, any> = {};

        for (const [k, v] of Object.entries(batch.adverts)) {
            if (k === 'retailAdverts') continue;
            if (v && typeof v === 'object' && 'amountGBP' in (v as any)) {
                if ((v as any).amountGBP !== ca[k]?.amountGBP) ad[k] = v;
            } else if (!atValEq(v, ca[k])) {
                ad[k] = v;
            }
        }

        if (batch.adverts.retailAdverts) {
            const cr = ca.retailAdverts || {};
            const rd: Record<string, any> = {};
            for (const [k, v] of Object.entries(batch.adverts.retailAdverts)) {
                if (v && typeof v === 'object' && 'amountGBP' in (v as any)) {
                    if ((v as any).amountGBP !== cr[k]?.amountGBP) rd[k] = v;
                } else if (v && typeof v === 'object' && 'status' in (v as any)) {
                    if ((v as any).status !== cr[k]?.status) rd[k] = v;
                } else if (!atValEq(v, cr[k])) {
                    rd[k] = v;
                }
            }
            if (Object.keys(rd).length > 0) ad.retailAdverts = rd;
        }

        if (Object.keys(ad).length > 0) diff.adverts = ad;
    }

    if (batch.features !== undefined) {
        const bNames = batch.features.map((f: any) => (typeof f === 'string' ? f : f.name) || '').sort().join('\0');
        const cNames = (source.features || []).map((f: any) => (typeof f === 'string' ? f : f.name) || '').sort().join('\0');
        if (bNames !== cNames) diff.features = batch.features;
    }

    if (batch.media !== undefined) {
        if (batch.media.images) {
            const want = imageIdsFromMedia(batch.media);
            const have = imageIdsFromMedia(source.media);
            if (want !== have) diff.media = batch.media;
        } else if (!atValEq(batch.media, source.media)) {
            diff.media = batch.media;
        }
    }

    if (batch.metadata !== undefined) {
        const cm = source.metadata || {};
        const md: Record<string, any> = {};
        for (const [k, v] of Object.entries(batch.metadata)) {
            if (!atValEq(v, cm[k])) md[k] = v;
        }
        if (Object.keys(md).length > 0) diff.metadata = md;
    }

    return diff;
}
