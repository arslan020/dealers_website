/** Display-friendly UK-style spacing for a VRM (alphanumeric only, uppercased). */
export function formatUkVrmDisplay(vrm: string): string {
    const s = vrm.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (s.length <= 4) return s;
    if (s.length === 7) return `${s.slice(0, 4)} ${s.slice(4)}`;
    return s.replace(/(.{4})(?=.)/g, '$1 ').trim();
}
