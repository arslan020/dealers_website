'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { JOB_TYPES, jobTypeCardBorderClass } from '@/lib/jobTypes';
import { JobTypeJobsModal } from '@/components/jobs/JobTypeJobsModal';

type ByType = Record<string, { total?: number; stock: number; sold: number }>;

export function JobsByTypeCards({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
    const [byType, setByType] = useState<ByType>({});
    const [loading, setLoading] = useState(true);
    const [drillType, setDrillType] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/jobs/stats');
            const data = await res.json();
            if (data.ok && data.byType && typeof data.byType === 'object') {
                setByType(data.byType);
            } else {
                setByType({});
            }
        } catch {
            setByType({});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load, refreshTrigger]);

    const visibleTypes = useMemo(() => {
        const jobCount = (k: string) => {
            const b = byType[k];
            if (!b) return 0;
            return b.total ?? b.stock + b.sold;
        };
        const fromCatalog = JOB_TYPES.filter((t) => jobCount(t) > 0);
        const extras = Object.keys(byType).filter(
            (k) => !(JOB_TYPES as readonly string[]).includes(k) && jobCount(k) > 0
        );
        return [...fromCatalog, ...extras];
    }, [byType]);

    return (
        <>
            <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-1 border-b border-slate-100/80 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
                    <div>
                        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Jobs by type</h2>
                        <p className="mt-1 text-[13px] text-slate-600">
                            Only job types you have added appear here. Click a card to open the list.
                        </p>
                    </div>
                </div>
                <div className="p-4 sm:p-6 sm:pt-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {loading && (
                            <div className="col-span-full py-16 text-center text-[13px] text-slate-500">Loading…</div>
                        )}
                        {!loading && visibleTypes.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
                                <p className="text-[14px] font-semibold text-slate-700">No jobs yet</p>
                                <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-500">
                                    Use <span className="font-semibold text-slate-600">Add job</span> to create one. Cards for each job type will show up here after you save.
                                </p>
                            </div>
                        )}
                        {!loading &&
                            visibleTypes.map((jobType, index) => {
                                const stock = byType[jobType]?.stock ?? 0;
                                const sold = byType[jobType]?.sold ?? 0;
                                const totalJobs = byType[jobType]?.total ?? stock + sold;
                                const borderClass = jobTypeCardBorderClass(index);
                                return (
                                    <button
                                        key={jobType}
                                        type="button"
                                        onClick={() => setDrillType(jobType)}
                                        className={`group relative rounded-xl border border-slate-200/90 bg-white px-4 pb-4 pt-4 text-left shadow-sm ring-0 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4D7CFF] focus-visible:ring-offset-2 ${borderClass} border-t-[4px]`}
                                    >
                                        <div className="mb-3 flex min-h-[2.75rem] items-start justify-between gap-2">
                                            <span className="text-[13px] font-semibold leading-snug text-slate-800 transition-colors group-hover:text-slate-900 sm:text-[14px]">
                                                {jobType}
                                            </span>
                                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600 ring-1 ring-slate-200/80">
                                                {totalJobs}
                                            </span>
                                        </div>
                                        <div className="flex gap-8">
                                            <div>
                                                <div className="text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums sm:text-[28px]">
                                                    {stock}
                                                </div>
                                                <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                                    Stock
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums sm:text-[28px]">
                                                    {sold}
                                                </div>
                                                <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                                    Sold
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                </div>
            </section>

            <JobTypeJobsModal
                open={!!drillType}
                jobType={drillType}
                onClose={() => setDrillType(null)}
                refreshTrigger={refreshTrigger}
            />
        </>
    );
}
