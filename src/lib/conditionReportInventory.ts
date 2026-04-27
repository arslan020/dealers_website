/** MotorDesk-style inventory groups (Cabin / Boot / Exterior). */

export type InventorySectionDef = { id: string; title: string; items: string[] };

export const INVENTORY_SECTIONS: InventorySectionDef[] = [
    {
        id: 'cabin',
        title: 'Cabin',
        items: [
            'Boot Cover',
            'Floor Mats',
            'Child Seat',
            'Dog Guard',
            'Dog Harness',
            'Headrests',
            'Portable Sat-Nav',
            'Vehicle Handbook',
            'People Carrier Seats',
        ],
    },
    {
        id: 'boot',
        title: 'Boot',
        items: [
            'Locking Wheel Nut Key',
            'Parcel Shelf',
            'Boot Liner',
            'Spare Wheel & Tools',
            'Toolkit',
            'Tyre Repair Kit',
        ],
    },
    {
        id: 'exterior',
        title: 'Exterior',
        items: ['Aerial', 'Hubcaps'],
    },
];

const ALL_ITEM_KEYS: string[] = INVENTORY_SECTIONS.flatMap(s => s.items);

/** Map old toggle-list labels to new MotorDesk keys (best-effort). */
const LEGACY_INVENTORY_MAP: Record<string, string> = {
    'Locking Wheel Nut': 'Locking Wheel Nut Key',
    'Spare Wheel': 'Spare Wheel & Tools',
    'Jack & Tools': 'Toolkit',
    'Service Book': 'Vehicle Handbook',
    'Owner Manual': 'Vehicle Handbook',
    'V5 Document': 'Vehicle Handbook',
    'SD Card / Navigation Disc': 'Portable Sat-Nav',
    'Parcel Shelf': 'Parcel Shelf',
    'Floor Mats': 'Floor Mats',
};

export function emptyInventoryRecord(): Record<string, boolean> {
    const o: Record<string, boolean> = {};
    for (const k of ALL_ITEM_KEYS) o[k] = false;
    return o;
}

/** Merge API / legacy inventory into full MotorDesk key set. */
export function normalizeInventory(raw: unknown): Record<string, boolean> {
    const base = emptyInventoryRecord();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;

    const inv = raw as Record<string, boolean>;
    for (const [key, val] of Object.entries(inv)) {
        if (typeof val !== 'boolean') continue;
        if (ALL_ITEM_KEYS.includes(key)) {
            base[key] = val;
            continue;
        }
        const mapped = LEGACY_INVENTORY_MAP[key];
        if (mapped && ALL_ITEM_KEYS.includes(mapped)) {
            base[mapped] = base[mapped] || val;
        }
    }
    return base;
}

export function countInventoryChecked(inv: Record<string, boolean>): number {
    return ALL_ITEM_KEYS.filter(k => inv[k]).length;
}
