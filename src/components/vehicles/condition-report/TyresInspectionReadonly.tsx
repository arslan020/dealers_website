'use client';
import React from 'react';
import { openMediaInNewTab } from '@/lib/openMediaInNewTab';

type TyreCanonPos = 'front-left' | 'front-right' | 'rear-left' | 'rear-right' | 'spare';

const TYRE_VIEW_ROWS: { position: TyreCanonPos; label: string }[] = [
    { position: 'front-left', label: 'N/S/F' },
    { position: 'front-right', label: 'O/S/F' },
    { position: 'rear-left', label: 'N/S/R' },
    { position: 'rear-right', label: 'O/S/R' },
    { position: 'spare', label: 'Spare' },
];

export type TyreRowInput = {
    position?: string;
    treadDepth?: string;
    psi?: string;
    condition?: string;
    photo?: string;
};

/** Map legacy UI labels to canonical position keys */
function resolvePosition(p: string | undefined): TyreCanonPos | null {
    if (!p) return null;
    const canon = ['front-left', 'front-right', 'rear-left', 'rear-right', 'spare'] as const;
    if ((canon as readonly string[]).includes(p)) return p as TyreCanonPos;
    const aliases: Record<string, TyreCanonPos> = {
        'Front Left': 'front-left',
        'Front Right': 'front-right',
        'Rear Left': 'rear-left',
        'Rear Right': 'rear-right',
        Spare: 'spare',
    };
    return aliases[p] ?? null;
}

function noDataEl() {
    return <span className="text-[13px] text-slate-400 italic">No data.</span>;
}

function formatMm(treadDepth: string | undefined) {
    const s = (treadDepth ?? '').trim();
    if (!s) return null;
    return `${s} mm`;
}

function formatPsi(psi: string | undefined) {
    const s = (psi ?? '').trim();
    if (!s) return null;
    return /psi/i.test(s) ? s : `${s} PSI`;
}

function formatCondition(condition: string | undefined) {
    const s = (condition ?? '').trim();
    if (!s) return null;
    return s;
}

export default function TyresInspectionReadonly({ tyres }: { tyres: TyreRowInput[] }) {
    const map = new Map<TyreCanonPos, TyreRowInput>();
    for (const t of tyres) {
        const key = resolvePosition(t.position);
        if (key) map.set(key, t);
    }

    return (
        <div className="bg-white border border-[#E2E8F0] rounded-xl mt-5 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-[13px] font-bold text-slate-800 tracking-wide">TYRES</p>
            </div>

            <div className="overflow-x-auto border-b border-[#E2E8F0]">
                <table className="w-full text-left text-[13px]">
                    <thead>
                        <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                            <th className="px-5 py-2.5 font-semibold text-slate-600 w-[22%]" />
                            <th className="px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wider text-slate-600 text-center">MM</th>
                            <th className="px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wider text-slate-600 text-center">PSI</th>
                            <th className="px-5 py-2.5 font-semibold text-[11px] uppercase tracking-wider text-slate-600 text-center">Condition</th>
                        </tr>
                    </thead>
                    <tbody>
                        {TYRE_VIEW_ROWS.map((row, i) => {
                            const t = map.get(row.position);
                            const mm = formatMm(t?.treadDepth);
                            const psi = formatPsi(t?.psi);
                            const cond = formatCondition(t?.condition);
                            return (
                                <tr key={row.position} className={i < TYRE_VIEW_ROWS.length - 1 ? 'border-b border-[#E2E8F0]' : ''}>
                                    <td className="px-5 py-3 font-medium text-slate-800">{row.label}</td>
                                    <td className="px-3 py-3 text-center text-slate-700">{mm ?? noDataEl()}</td>
                                    <td className="px-3 py-3 text-center text-slate-700">{psi ?? noDataEl()}</td>
                                    <td className="px-5 py-3 text-center text-slate-700">{cond ?? noDataEl()}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {(() => {
                const withPhotos = TYRE_VIEW_ROWS.map(row => ({
                    ...row,
                    photo: (map.get(row.position)?.photo ?? '').toString().trim(),
                })).filter(r => r.photo);
                if (withPhotos.length === 0) return null;
                return (
                    <div className="px-5 py-4 bg-[#FAFBFC]">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Tyre photos</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {withPhotos.map(({ label, photo }) => (
                                <div key={label} className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-600 mb-1.5">{label}</p>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        className="cursor-zoom-in rounded-lg border border-[#E2E8F0] overflow-hidden bg-white focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]"
                                        onClick={() => openMediaInNewTab(photo)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                openMediaInNewTab(photo);
                                            }
                                        }}
                                    >
                                        <img src={photo} alt="" className="h-24 w-full object-cover pointer-events-none" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
