'use client';
import React, { useEffect, useRef } from 'react';
import type { FaultPoint } from './ExteriorMap';
import { ExteriorFaultMarker } from './ExteriorMap';
import { openMediaInNewTab } from '@/lib/openMediaInNewTab';

function hasPlottableCoords(c?: { x: number; y: number }): boolean {
    if (!c) return false;
    return c.x !== 0 || c.y !== 0;
}

function faultPhotoUrl(f: FaultPoint): string {
    const raw = (f.photoUrl ?? (f as { photo?: string }).photo ?? '').toString().trim();
    return raw;
}

export default function InteriorInspectionReadonly({ faults }: { faults: FaultPoint[] }) {
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const center = () => {
            el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
        };
        center();
        window.addEventListener('resize', center);
        return () => window.removeEventListener('resize', center);
    }, [faults]);

    const sorted = [...faults].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
    const plottable = sorted.filter(f => hasPlottableCoords(f.coords));

    return (
        <div className="bg-white border border-[#E2E8F0] rounded-xl mt-5 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-[13px] font-semibold text-slate-800">Interior Inspection</p>
            </div>
            <div className="px-5 py-4 space-y-6">
                {sorted.length === 0 ? (
                    <p className="text-[12px] text-slate-400 italic">No interior faults recorded.</p>
                ) : (
                    <>
                        <div
                            ref={wrapRef}
                            className="relative w-full overflow-x-auto overflow-y-hidden rounded-lg border border-[#E2E8F0] bg-white"
                        >
                            <svg
                                viewBox="0 0 1153 718"
                                preserveAspectRatio="xMidYMid meet"
                                className="block h-auto w-full min-w-[min(100%,1153px)]"
                                aria-hidden
                            >
                                <image
                                    href="/condition-report-interior.png"
                                    x="0"
                                    y="0"
                                    width="1153"
                                    height="718"
                                />
                                {plottable.map((f, i) => (
                                    <ExteriorFaultMarker
                                        key={`pin-${f.idx}-${i}`}
                                        x={f.coords.x}
                                        y={f.coords.y}
                                        n={f.idx ?? i + 1}
                                        color={f.fromPrevious ? '#f97316' : '#dc2626'}
                                    />
                                ))}
                            </svg>
                        </div>

                        <div className="space-y-6">
                            {sorted.map((f, i) => {
                                const n = f.idx ?? i + 1;
                                const photo = faultPhotoUrl(f);
                                const subtitle = [f.damage, f.detail].filter(Boolean).join(' — ');
                                return (
                                    <div
                                        key={`row-${n}-${i}`}
                                        className="border-b border-slate-100 pb-6 last:border-0 last:pb-0"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                                                style={{ background: f.fromPrevious ? '#f97316' : '#dc2626' }}
                                            >
                                                {n}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[14px] font-semibold text-slate-800">
                                                    {f.part || '—'}
                                                </p>
                                                {subtitle ? (
                                                    <p className="mt-0.5 text-[13px] text-slate-600">{subtitle}</p>
                                                ) : null}
                                                {f.note ? (
                                                    <p className="mt-1 text-[12px] text-slate-400">{f.note}</p>
                                                ) : null}
                                            </div>
                                        </div>
                                        {photo ? (
                                            <div className="mt-3 flex flex-wrap gap-3">
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    className="max-w-[min(100%,280px)] cursor-zoom-in overflow-hidden rounded-lg border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]"
                                                    onClick={() => openMediaInNewTab(photo)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            openMediaInNewTab(photo);
                                                        }
                                                    }}
                                                >
                                                    <img
                                                        src={photo}
                                                        alt=""
                                                        className="pointer-events-none block max-h-52 w-full object-cover"
                                                    />
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
