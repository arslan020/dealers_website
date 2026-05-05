/**
 * Safely extracts a displayable string from a vehicle field that may arrive
 * from the API as a plain string, number, or a populated object like { name: "Toyota" }.
 */
export function textValue(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object' && value !== null && 'name' in value) {
        return String((value as { name: unknown }).name ?? '');
    }
    return '';
}
