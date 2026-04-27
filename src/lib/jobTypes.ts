/** All selectable job types — shared by New Job modal and Jobs by Type cards */
export const JOB_TYPES = [
    'Brake Pads',
    'Delivery',
    'Dent Removal',
    'Diagnosis',
    'Fit Accessory',
    'Interior / Trim Repair',
    'MOT',
    'Panel Re-spray',
    'Re-Clean',
    'Re-Fuel',
    'Service',
    'SMART Repair',
    'Source & Fit Part',
    'Specialist Wheel Refurbishment',
    'Tyre Replacement',
    'Valet',
    'Wheel Refurbishment',
    'Windscreen Repair',
    'Windscreen Replacement',
    'Other',
] as const;

export type JobTypeName = (typeof JOB_TYPES)[number];

/** Rotating top-border accents for cards (Tailwind classes, 4px top) */
export const JOB_TYPE_CARD_BORDER_ACCENTS = [
    'border-t-indigo-500',
    'border-t-purple-500',
    'border-t-lime-500',
    'border-t-teal-600',
    'border-t-[#6b7c4a]',
    'border-t-rose-500',
    'border-t-sky-500',
    'border-t-amber-500',
    'border-t-cyan-600',
    'border-t-fuchsia-500',
    'border-t-orange-500',
    'border-t-emerald-600',
    'border-t-violet-500',
    'border-t-pink-500',
    'border-t-blue-600',
    'border-t-slate-600',
    'border-t-red-500',
    'border-t-yellow-600',
    'border-t-stone-500',
    'border-t-neutral-600',
] as const;

export function jobTypeCardBorderClass(index: number): string {
    return JOB_TYPE_CARD_BORDER_ACCENTS[index % JOB_TYPE_CARD_BORDER_ACCENTS.length];
}
