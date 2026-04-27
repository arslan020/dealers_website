'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInDays, format, isPast } from 'date-fns';
import { formatUkVrmDisplay } from '@/lib/formatUkVrm';
import { useRouter } from 'next/navigation';
import { JobDetailModal } from './JobDetailModal';
import type { JobRow } from './JobTypeJobsModal';

type StatusFilter = 'Incomplete' | 'Complete' | 'All';
type SortKey = 'dueAt' | 'jobType' | 'vehicle' | 'assignee' | null;
type SortDir = 'asc' | 'desc';

export function JobListTab({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
    const router = useRouter();
    const [jobs, setJobs] = useState<JobRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('Incomplete');
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('dueAt');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'All') params.set('status', statusFilter);
            const res = await fetch(`/api/jobs?${params.toString()}`);
            const data = await res.json();
            if (data.ok && Array.isArray(data.jobs)) {
                setJobs(data.jobs);
            } else {
                setJobs([]);
            }
        } catch {
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { load(); }, [load, refreshTrigger]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let rows = jobs;
        if (q) {
            rows = rows.filter((j) => {
                const blob = [
                    j.jobType,
                    j.details,
                    j.vehicle?.vrm,
                    j.vehicle?.make,
                    j.vehicle?.model,
                    j.assigneeName || '',
                    j.location,
                    j.status,
                ]
                    .join(' ')
                    .toLowerCase();
                return blob.includes(q);
            });
        }
        if (sortKey) {
            rows = [...rows].sort((a, b) => {
                let valA: string | number = '';
                let valB: string | number = '';
                if (sortKey === 'dueAt') {
                    valA = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
                    valB = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
                } else if (sortKey === 'jobType') {
                    valA = a.jobType.toLowerCase();
                    valB = b.jobType.toLowerCase();
                } else if (sortKey === 'vehicle') {
                    valA = `${a.vehicle?.make ?? ''} ${a.vehicle?.model ?? ''}`.toLowerCase();
                    valB = `${b.vehicle?.make ?? ''} ${b.vehicle?.model ?? ''}`.toLowerCase();
                } else if (sortKey === 'assignee') {
                    valA = (a.assigneeName ?? '').toLowerCase();
                    valB = (b.assigneeName ?? '').toLowerCase();
                }
                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return rows;
    }, [jobs, search, sortKey, sortDir]);

    function SortIcon({ colKey }: { colKey: SortKey }) {
        const active = sortKey === colKey;
        return (
            <span className={`ml-1 inline-flex flex-col leading-[0] ${active ? 'text-slate-700' : 'text-slate-300'}`}>
                <svg className="h-2.5 w-2.5" viewBox="0 0 10 6" fill="currentColor">
                    <path d={sortDir === 'asc' && active ? 'M5 0L10 6H0L5 0Z' : 'M5 6L0 0H10L5 6Z'} />
                </svg>
            </span>
        );
    }

    return (
        <>
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    {/* Status tabs */}
                    <div className="flex items-center gap-1 rounded-full bg-slate-100/90 p-1 ring-1 ring-slate-200/60 self-start">
                        {(['Incomplete', 'Complete', 'All'] as StatusFilter[]).map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setStatusFilter(s)}
                                className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
                                    statusFilter === s
                                        ? 'bg-white text-[#4D7CFF] shadow-sm ring-1 ring-slate-200/80'
                                        : 'text-slate-600 hover:bg-white/60 hover:text-slate-800'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Search + count */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <svg
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="search"
                                placeholder="Search jobs…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-52 rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/15"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            title="Print"
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Report
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                <th className="px-5 py-3">Description</th>
                                <th
                                    className="cursor-pointer select-none whitespace-nowrap px-3 py-3 hover:text-slate-700"
                                    onClick={() => handleSort('vehicle')}
                                >
                                    <span className="inline-flex items-center">
                                        Vehicle
                                        <SortIcon colKey="vehicle" />
                                    </span>
                                </th>
                                <th className="whitespace-nowrap px-3 py-3">Status</th>
                                <th className="whitespace-nowrap px-3 py-3">Registration</th>
                                <th
                                    className="cursor-pointer select-none whitespace-nowrap px-3 py-3 hover:text-slate-700"
                                    onClick={() => handleSort('assignee')}
                                >
                                    <span className="inline-flex items-center">
                                        Assignee
                                        <SortIcon colKey="assignee" />
                                    </span>
                                </th>
                                <th
                                    className="cursor-pointer select-none whitespace-nowrap px-3 py-3 pr-5 hover:text-slate-700"
                                    onClick={() => handleSort('dueAt')}
                                >
                                    <span className="inline-flex items-center">
                                        Due At
                                        <SortIcon colKey="dueAt" />
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-16 text-center text-[13px] text-slate-400">
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-16 text-center text-[13px] text-slate-500">
                                        {search ? 'No jobs match your search.' : `No ${statusFilter === 'All' ? '' : statusFilter.toLowerCase() + ' '}jobs found.`}
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                filtered.map((j) => {
                                    const due = j.dueAt ? new Date(j.dueAt) : null;
                                    const isOverdue = due && !Number.isNaN(due.getTime()) && isPast(due) && j.status === 'Incomplete';
                                    const vm = j.vehicle;
                                    const vrmShown = vm?.vrm ? formatUkVrmDisplay(vm.vrm) : '';
                                    const created = j.createdAt ? new Date(j.createdAt) : null;
                                    const ageDays = created && !Number.isNaN(created.getTime())
                                        ? differenceInDays(new Date(), created)
                                        : null;

                                    return (
                                        <tr
                                            key={j._id}
                                            className="group align-middle transition-colors hover:bg-slate-50/70"
                                        >
                                            {/* Description / Job Type */}
                                            <td className="px-5 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedJobId(j._id)}
                                                    className="text-left"
                                                >
                                                    <div className="text-[13px] font-semibold text-[#4D7CFF] hover:underline">
                                                        {j.jobType}
                                                    </div>
                                                    {j.details && (
                                                        <div className="mt-0.5 text-[12px] text-slate-500">
                                                            {j.details}
                                                        </div>
                                                    )}
                                                    {ageDays !== null && (
                                                        <div className="mt-0.5 text-[11px] text-slate-400">
                                                            {ageDays === 0 ? 'Today' : `${ageDays}d ago`}
                                                        </div>
                                                    )}
                                                </button>
                                            </td>

                                            {/* Vehicle */}
                                            <td className="px-3 py-3">
                                                {vm ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/app/vehicles/${vm._id}`)}
                                                        className="text-left text-[12px] font-bold uppercase leading-snug tracking-tight text-[#1e40af] hover:underline"
                                                    >
                                                        {`${vm.make} ${vm.model}`.trim().toUpperCase()}
                                                    </button>
                                                ) : (
                                                    <span className="text-[12px] text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Status badge */}
                                            <td className="whitespace-nowrap px-3 py-3">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                                        j.status === 'Complete'
                                                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60'
                                                            : 'bg-orange-50 text-orange-700 ring-1 ring-orange-200/60'
                                                    }`}
                                                >
                                                    {j.status || 'Incomplete'}
                                                </span>
                                            </td>

                                            {/* Registration plate */}
                                            <td className="whitespace-nowrap px-3 py-3">
                                                {vrmShown ? (
                                                    <span
                                                        className="inline-block min-w-[6rem] rounded border-2 border-amber-400 bg-[#FFD200] px-2 py-0.5 text-center font-mono text-[11px] font-black uppercase leading-tight tracking-wide text-black shadow-sm"
                                                        style={{ fontFamily: 'ui-monospace, monospace' }}
                                                    >
                                                        {vrmShown}
                                                    </span>
                                                ) : (
                                                    <span className="text-[12px] text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Assignee */}
                                            <td className="whitespace-nowrap px-3 py-3 text-[12px] text-slate-700">
                                                {j.assigneeName ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold uppercase text-slate-600">
                                                            {j.assigneeName.charAt(0)}
                                                        </span>
                                                        <span>{j.assigneeName}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Due At */}
                                            <td className="whitespace-nowrap px-3 py-3 pr-5">
                                                {due && !Number.isNaN(due.getTime()) ? (
                                                    <span
                                                        className={`text-[12px] font-semibold ${
                                                            isOverdue ? 'text-red-600' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        {format(due, 'd MMM')}
                                                    </span>
                                                ) : (
                                                    <span className="text-[12px] text-slate-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>

                {/* Footer count */}
                {!loading && filtered.length > 0 && (
                    <div className="border-t border-slate-100 px-5 py-2.5 text-[12px] text-slate-500">
                        {filtered.length} job{filtered.length !== 1 ? 's' : ''}
                        {search ? ` matching "${search}"` : ''}
                    </div>
                )}
            </div>

            <JobDetailModal
                jobId={selectedJobId}
                onClose={() => setSelectedJobId(null)}
                onUpdated={load}
            />
        </>
    );
}
