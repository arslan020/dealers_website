'use client';

type Insights = {
    totalIncomplete: number;
    totalComplete: number;
    overdueJobs: number;
    unassignedJobs: number;
    stockJobs: number;
    soldJobs: number;
    totalJobs: number;
};

type InsightCard = {
    label: string;
    value: number;
    accent?: 'blue' | 'red' | 'amber' | 'green' | 'slate' | 'purple';
    tooltip?: string;
};

function getCards(ins: Insights): InsightCard[] {
    return [
        {
            label: 'Incomplete Jobs',
            value: ins.totalIncomplete,
            accent: 'blue',
            tooltip: 'Jobs with status set to Incomplete',
        },
        {
            label: 'Overdue Jobs',
            value: ins.overdueJobs,
            accent: 'red',
            tooltip: 'Incomplete jobs whose due date has passed',
        },
        {
            label: 'Unassigned Jobs',
            value: ins.unassignedJobs,
            accent: 'amber',
            tooltip: 'Incomplete jobs with no assignee',
        },
        {
            label: 'In-Stock Vehicle Jobs',
            value: ins.stockJobs,
            accent: 'slate',
            tooltip: 'Incomplete jobs on vehicles currently in stock',
        },
        {
            label: 'Sold Vehicle Jobs',
            value: ins.soldJobs,
            accent: 'purple',
            tooltip: 'Incomplete jobs on sold vehicles',
        },
        {
            label: 'Completed Jobs',
            value: ins.totalComplete,
            accent: 'green',
            tooltip: 'Jobs marked as Complete',
        },
    ];
}

const ACCENT_CLASSES: Record<string, { value: string; badge: string }> = {
    blue: { value: 'text-[#4D7CFF]', badge: 'bg-blue-50 text-blue-700 ring-blue-200/60' },
    red: { value: 'text-red-600', badge: 'bg-red-50 text-red-700 ring-red-200/60' },
    amber: { value: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 ring-amber-200/60' },
    green: { value: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60' },
    slate: { value: 'text-slate-700', badge: 'bg-slate-100 text-slate-600 ring-slate-200/60' },
    purple: { value: 'text-purple-600', badge: 'bg-purple-50 text-purple-700 ring-purple-200/60' },
};

function InfoIcon() {
    return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
        </svg>
    );
}

export function PreparationInsights({
    insights,
    loading,
}: {
    insights: Insights | null;
    loading: boolean;
}) {
    const cards = insights ? getCards(insights) : [];

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/40 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-100/80 px-5 py-4 sm:px-6 sm:py-5">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Preparation Insights
                </h2>
            </div>
            <div className="p-4 sm:p-6 sm:pt-5">
                {loading && (
                    <div className="py-10 text-center text-[13px] text-slate-400">Loading…</div>
                )}
                {!loading && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        {cards.map((card) => {
                            const ac = ACCENT_CLASSES[card.accent ?? 'slate'];
                            return (
                                <div
                                    key={card.label}
                                    className="group relative flex flex-col rounded-xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm transition-shadow hover:shadow-md"
                                >
                                    <div className="mb-3 flex items-center justify-between gap-1">
                                        <span className="text-[12px] font-medium leading-snug text-slate-600">
                                            {card.label}
                                        </span>
                                        {card.tooltip && (
                                            <span
                                                className="shrink-0 cursor-default text-slate-400 transition-colors hover:text-slate-600"
                                                title={card.tooltip}
                                            >
                                                <InfoIcon />
                                            </span>
                                        )}
                                    </div>
                                    <div className={`text-[32px] font-bold leading-none tabular-nums ${ac.value}`}>
                                        {card.value}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
