import { toast } from 'react-hot-toast';

/**
 * Opens image/video URL in a new tab. Data URLs are turned into blob: URLs first
 * because browsers often show a blank page for very long data: URLs in the address bar.
 */
export function openMediaInNewTab(url: string): void {
    const trimmed = url.trim();
    if (!trimmed || typeof window === 'undefined') return;

    if (trimmed.startsWith('data:')) {
        openDataUrlInNewTab(trimmed);
        return;
    }

    if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('blob:')
    ) {
        window.open(trimmed, '_blank', 'noopener,noreferrer');
        return;
    }

    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    window.open(`${window.location.origin}${path}`, '_blank', 'noopener,noreferrer');
}

function openDataUrlInNewTab(dataUrl: string): void {
    try {
        const comma = dataUrl.indexOf(',');
        if (comma < 0) return;
        const header = dataUrl.slice(0, comma);
        const body = dataUrl.slice(comma + 1).replace(/\s/g, '');
        const mimeMatch = /^data:([^;,]+)/.exec(header);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

        if (!/;base64/i.test(header)) {
            const w = window.open('', '_blank', 'noopener,noreferrer');
            if (w) {
                w.document.write(
                    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Media</title></head><body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#111;">` +
                        `<img src="${dataUrl.replace(/"/g, '&quot;')}" style="max-width:100%;max-height:100vh;object-fit:contain"/>` +
                        `</body></html>`
                );
                w.document.close();
            }
            return;
        }

        const binary = atob(body);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
        if (!win) {
            URL.revokeObjectURL(blobUrl);
            toast.error('Popup blocked — allow popups for this site.');
            return;
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
    } catch {
        toast.error('Could not open media.');
    }
}
