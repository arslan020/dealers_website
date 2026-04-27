'use client';

import { useCallback, useEffect, useState } from 'react';
import { NewJobModal } from '@/components/jobs/NewJobModal';
import { JobsByTypeCards } from '@/components/jobs/JobsByTypeCards';
import { PreparationInsights } from '@/components/jobs/PreparationInsights';
import { JobListTab } from '@/components/jobs/JobListTab';

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'jobList', label: 'Job List' },
    { id: 'timeCards', label: 'Time Cards' },
    { id: 'leaderboard', label: 'Leaderboard' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type Insights = {
    totalIncomplete: number;
    totalComplete: number;
    overdueJobs: number;
    unassignedJobs: number;
    stockJobs: number;
    soldJobs: number;
    totalJobs: number;
};

export default function TasksPage() {
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [newJobOpen, setNewJobOpen] = useState(false);
    const [jobsStatsKey, setJobsStatsKey] = useState(0);
    const [insights, setInsights] = useState<Insights | null>(null);
    const [insightsLoading, setInsightsLoading] = useState(true);

    const loadInsights = useCallback(async () => {
        setInsightsLoading(true);
        try {
            const res = await fetch('/api/jobs/stats');
            const data = await res.json();
            if (data.ok && data.insights) {
                setInsights(data.insights);
            }
        } catch {
            // ignore
        } finally {
            setInsightsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInsights();
    }, [loadInsights, jobsStatsKey]);

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-2">
            {/* Page Header */}
            <header className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/80 px-4 py-4 sm:px-6 sm:py-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                            <div className="flex min-w-0 items-start gap-3 sm:items-center">
                                <span
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-md shadow-slate-900/15 ring-1 ring-white/10"
                                    aria-hidden
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
                                        />
                                    </svg>
                                </span>
                                <div className="min-w-0 pt-0.5">
                                    <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Jobs</h1>
                                    <p className="mt-0.5 max-w-md text-[13px] leading-snug text-slate-500">
                                        Workshop jobs by type — add a job or open a card to see the list.
                                    </p>
                                </div>
                            </div>

                            <nav
                                className="flex flex-wrap items-center gap-1 rounded-full bg-slate-100/90 p-1 ring-1 ring-slate-200/60"
                                aria-label="Jobs sections"
                            >
                                {TABS.map((tab) => {
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition-all sm:px-4 ${
                                                isActive
                                                    ? 'bg-white text-[#4D7CFF] shadow-sm ring-1 ring-slate-200/80'
                                                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-800'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        <button
                            type="button"
                            onClick={() => setNewJobOpen(true)}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-md shadow-emerald-900/20 ring-1 ring-emerald-400/30 transition hover:from-emerald-600 hover:to-emerald-700 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            Add job
                        </button>
                    </div>
                </div>
            </header>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-5">
                    <PreparationInsights insights={insights} loading={insightsLoading} />
                    <JobsByTypeCards refreshTrigger={jobsStatsKey} />
                </div>
            )}

            {/* Job List Tab */}
            {activeTab === 'jobList' && (
                <JobListTab refreshTrigger={jobsStatsKey} />
            )}

            {/* Time Cards Tab */}
            {activeTab === 'timeCards' && (
                <ComingSoonPanel
                    title="Time Cards"
                    body="Technician time tracking and clock-in views are not set up yet."
                    icon={
                        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2" />
                        </svg>
                    }
                />
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
                <ComingSoonPanel
                    title="Leaderboard"
                    body="Team performance rankings will show here when available."
                    icon={
                        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    }
                />
            )}

            <NewJobModal
                open={newJobOpen}
                onClose={() => setNewJobOpen(false)}
                onSaved={() => setJobsStatsKey((k) => k + 1)}
            />
        </div>
    );
}

function ComingSoonPanel({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) {
    return (
        <div className="flex min-h-[38vh] flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white px-6 py-16 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                {icon ?? (
                    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                    </svg>
                )}
            </div>
            <h2 className="text-base font-bold text-slate-800">{title}</h2>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">{body}</p>
        </div>
    );
}
