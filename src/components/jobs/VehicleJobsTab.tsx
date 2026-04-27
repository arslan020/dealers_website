'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { JobDetailModal } from './JobDetailModal';
import { NewJobModal } from './NewJobModal';
import type { JobRow } from './JobTypeJobsModal';

type VehiclePick = {
    _id: string;
    make: string;
    model: string;
    derivative?: string;
    vrm: string;
    primaryImage?: string;
};

const STATUS_COLORS: Record<string, string> = {
    Complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Incomplete: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function VehicleJobsTab({ vehicle }: { vehicle: VehiclePick }) {
    const [jobs, setJobs] = useState<JobRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [showNewJob, setShowNewJob] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'All' | 'Incomplete' | 'Complete'>('All');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ vehicleId: vehicle._id });
            const res = await fetch(`/api/jobs?${params.toString()}`);
            const data = await res.json();
            setJobs(data.ok && Array.isArray(data.jobs) ? data.jobs : []);
        } catch {
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, [vehicle._id]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        if (statusFilter === 'All') return jobs;
        return jobs.filter(j => j.status === statusFilter);
    }, [jobs, statusFilter]);

    const incomplete = jobs.filter(j => j.status === 'Incomplete').length;
    const complete = jobs.filter(j => j.status === 'Complete').length;

    return (
        <div className="space-y-4 w-full">
            {/* Header */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-4">
                        <h2 className="text-[15px] font-bold text-slate-800">Job Boards</h2>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700">
                                {incomplete} Incomplete
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
                                {complete} Complete
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowNewJob(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1e1b72] text-white rounded-lg text-[13px] font-bold hover:bg-[#16136a] transition-colors shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Job
                    </button>
                </div>

                {/* Filter */}
                <div className="flex items-center gap-1 px-5 py-2.5 bg-slate-50/60 border-b border-[#E2E8F0]">
                    {(['All', 'Incomplete', 'Complete'] as const).map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                                statusFilter === s
                                    ? 'bg-[#1e1b72] text-white'
                                    : 'text-slate-500 hover:bg-slate-200'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 border-b border-slate-100">
                                <th className="px-5 py-3">Job Type</th>
                                <th className="px-3 py-3">Details</th>
                                <th className="px-3 py-3">Status</th>
                                <th className="px-3 py-3">Assigned To</th>
                                <th className="px-3 py-3">Due Date</th>
                                <th className="px-3 py-3">Location</th>
                                <th className="px-3 py-3">Age</th>
                                <th className="px-3 py-3">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center text-[13px] text-slate-400">
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center">
                                        <p className="text-[14px] font-semibold text-slate-700 mb-1">No jobs yet</p>
                                        <p className="text-[12px] text-slate-400">Click &quot;Add Job&quot; to create the first job for this vehicle.</p>
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.map(j => {
                                const created = j.createdAt ? new Date(j.createdAt) : null;
                                const due = j.dueAt ? new Date(j.dueAt) : null;
                                const ageDays = created && !Number.isNaN(created.getTime())
                                    ? differenceInDays(new Date(), created)
                                    : null;
                                const isOverdue = due && !Number.isNaN(due.getTime()) && due < new Date() && j.status !== 'Complete';

                                return (
                                    <tr key={j._id} className="hover:bg-slate-50/70 transition-colors align-middle">
                                        <td className="px-5 py-3">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedJobId(j._id)}
                                                className="text-[13px] font-semibold text-[#1e1b72] hover:underline text-left"
                                            >
                                                {j.jobType}
                                            </button>
                                        </td>
                                        <td className="px-3 py-3 max-w-[200px]">
                                            <span className="text-[12px] text-slate-600 line-clamp-2">{j.details || '—'}</span>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[j.status] || STATUS_COLORS.Incomplete}`}>
                                                {j.status || 'Incomplete'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-[12px] text-slate-600">
                                            {j.assigneeName || <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className={`px-3 py-3 whitespace-nowrap text-[12px] ${isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>
                                            {due && !Number.isNaN(due.getTime()) ? format(due, 'dd/MM/yyyy') : <span className="text-slate-300">—</span>}
                                            {isOverdue && <span className="ml-1 text-[10px] font-bold text-rose-500">OVERDUE</span>}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-[12px] text-slate-600">
                                            {j.location || <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-[12px] text-slate-600 tabular-nums">
                                            {ageDays !== null ? `${ageDays}d` : '—'}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-[12px] text-slate-500">
                                            {created && !Number.isNaN(created.getTime()) ? format(created, 'dd/MM/yy') : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <JobDetailModal
                jobId={selectedJobId}
                onClose={() => setSelectedJobId(null)}
                onUpdated={load}
            />

            <NewJobModal
                open={showNewJob}
                onClose={() => setShowNewJob(false)}
                onSaved={() => { setShowNewJob(false); load(); }}
                initialVehicle={vehicle}
            />
        </div>
    );
}
