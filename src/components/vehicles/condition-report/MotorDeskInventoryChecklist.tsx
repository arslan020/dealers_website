'use client';
import React from 'react';
import { INVENTORY_SECTIONS } from '@/lib/conditionReportInventory';

type Props = {
    value: Record<string, boolean>;
    onChange: (next: Record<string, boolean>) => void;
};

export function MotorDeskInventoryEditor({ value, onChange }: Props) {
    const setItem = (label: string, checked: boolean) => {
        onChange({ ...value, [label]: checked });
    };

    const setSection = (items: string[], checked: boolean) => {
        const next = { ...value };
        for (const label of items) next[label] = checked;
        onChange(next);
    };

    return (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-white">
                <p className="text-[13px] font-bold text-slate-800">Inventory</p>
                <span
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#4D7CFF] px-3 py-1.5 text-[12px] font-semibold text-[#4D7CFF] bg-white"
                    title="Tick items below (MotorDesk layout)"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                </span>
            </div>

            {INVENTORY_SECTIONS.map((section, si) => (
                <div key={section.id} className={si > 0 ? 'border-t border-[#E2E8F0]' : ''}>
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <span className="text-[14px] font-bold text-slate-800">{section.title}</span>
                        <div className="flex items-center gap-1 text-[12px] font-semibold">
                            <button
                                type="button"
                                className="text-[#4D7CFF] hover:underline"
                                onClick={() => setSection(section.items, true)}
                            >
                                Select All
                            </button>
                            <span className="text-slate-300 font-normal">/</span>
                            <button
                                type="button"
                                className="text-[#4D7CFF] hover:underline"
                                onClick={() => setSection(section.items, false)}
                            >
                                None
                            </button>
                        </div>
                    </div>
                    <div className="px-4 pb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2.5">
                            {section.items.map(item => (
                                <label
                                    key={item}
                                    className="flex items-center gap-2.5 cursor-pointer select-none group"
                                >
                                    <input
                                        type="checkbox"
                                        checked={!!value[item]}
                                        onChange={e => setItem(item, e.target.checked)}
                                        className="h-4 w-4 shrink-0 rounded border-[#CBD5E1] text-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/30 focus:ring-offset-0"
                                    />
                                    <span className="text-[13px] text-slate-700 group-hover:text-slate-900">{item}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function ReadonlyTick({ checked }: { checked: boolean }) {
    return (
        <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-[#4D7CFF] bg-[#4D7CFF]' : 'border-[#CBD5E1] bg-white'}`}
            aria-hidden
        >
            {checked ? (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            ) : null}
        </span>
    );
}

/** Full Cabin / Boot / Exterior list: tick = present, empty box = not ticked. */
export function MotorDeskInventoryReadonly({ value }: { value: Record<string, boolean> }) {
    return (
        <div className="bg-white border border-[#E2E8F0] rounded-xl mt-5 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-[13px] font-semibold text-slate-800">Inventory</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Items present with the vehicle (ticked = yes)</p>
            </div>
            <div className="px-5 py-4">
                {INVENTORY_SECTIONS.map((section, si) => (
                    <div key={section.id} className={si > 0 ? 'mt-6 pt-6 border-t border-slate-100' : ''}>
                        <p className="text-[12px] font-bold text-slate-800 mb-3">{section.title}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2.5">
                            {section.items.map(item => {
                                const ticked = !!value[item];
                                return (
                                    <div
                                        key={item}
                                        className="flex items-center gap-2.5 text-[13px]"
                                        role="group"
                                        aria-label={`${item}: ${ticked ? 'present' : 'not present'}`}
                                    >
                                        <ReadonlyTick checked={ticked} />
                                        <span className={ticked ? 'text-slate-800' : 'text-slate-500'}>{item}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
