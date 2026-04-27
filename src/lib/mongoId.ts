/** True if `id` is a 24-char hex MongoDB ObjectId string (not e.g. `at-…` cache-only ids). */
export function isMongoObjectIdString(id: string | undefined | null): boolean {
    if (id == null || typeof id !== 'string') return false;
    if (id.startsWith('at-')) return false;
    return /^[a-fA-F0-9]{24}$/.test(id);
}
