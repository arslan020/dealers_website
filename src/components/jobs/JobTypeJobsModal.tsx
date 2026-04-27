'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { formatUkVrmDisplay } from '@/lib/formatUkVrm';
import { useRouter } from 'next/navigation';
import { JobDetailModal } from './JobDetailModal';

export type JobRow = {
    _id: string;
    jobType: string;
    details: string;
    status: string;
    location: string;
    dueAt: string | null;
    createdAt: string | null;
    assigneeName: string | null;
    vehicle: {
        _id: string;
        vrm: string;
        make: string;
        model: string;
        status: string;
    } | null;
};

type SortKey = 'vehicleStatus' | 'dueAt' | null;
type SortDir = 'asc' | 'desc';

export function JobTypeJobsModal({
    open,
    jobType,
    onClose,
    refreshTrigger = 0,
}: {
    open: boolean;
    jobType: string | null;
    onClose: () => void;
    refreshTrigger?: number;
}) {
    const router = useRouter();
    const [jobs, setJobs] = useState<JobRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>(null);
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!jobType) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ jobType });
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
    }, [jobType]);

    useEffect(() => {
        if (!open || !jobType) {
            setSearch('');
            setSortKey(null);
            return;
        }
        load();
    }, [open, jobType, load, refreshTrigger]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
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
                const blob = [j.details, j.vehicle?.vrm, j.vehicle?.make, j.vehicle?.model, j.assigneeName || '', j.location]
                    .join(' ').toLowerCase();
                return blob.includes(q);
            });
        }
        if (sortKey) {
            rows = [...rows].sort((a, b) => {
                let valA: string | number = '';
                let valB: string | number = '';
                if (sortKey === 'vehicleStatus') {
                    valA = a.vehicle?.status || '';
                    valB = b.vehicle?.status || '';
                } else if (sortKey === 'dueAt') {
                    valA = a.dueAt ? new Date(a.dueAt).getTime() : 0;
                    valB = b.dueAt ? new Date(b.dueAt).getTime() : 0;
                }
                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return rows;
    }, [jobs, search, sortKey, sortDir]);

    const handlePrint = () => window.print();

    if (!open || !jobType) return null;

    function vehicleStockLabel(status: string) {
        if (status === 'In Stock') return 'Stock';
        if (status === 'Sold') return 'Sold';
        return status || '—';
    }

    function SortIcon({ colKey }: { colKey: SortKey }) {
        const active = sortKey === colKey;
        return (
            <span className={`ml-1 inline-flex flex-col leading-[0] ${active ? 'text-white' : 'text-white/40'}`}>
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 6" fill="currentColor">
                    <path d={sortDir === 'asc' && active ? 'M5 0L10 6H0L5 0Z' : 'M5 6L0 0H10L5 6Z'} />
                </svg>
            </span>
        );
    }

    return (
        <div className="fixed inset-0 z-[320] flex items-center justify-center p-2 sm:p-4 print:static print:p-0">
            {/* Backdrop */}
            <button
                type="button"
                aria-label="Close"
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-[3px] print:hidden"
                onClick={onClose}
            />

            <div
                className="job-type-print-root relative z-10 flex h-[calc(100dvh-2rem)] w-full max-w-[1280px] flex-col overflow-hidden rounded-xl border border-slate-300/60 bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] print:max-h-none print:shadow-none"
                role="dialog"
                aria-modal="true"
                aria-labelledby="job-type-modal-title"
            >
                {/* Header — dark navy */}
                <header className="flex shrink-0 items-center justify-between gap-3 bg-[#1e1b72] px-5 py-4 print:bg-[#1e1b72]">
                    <h2 id="job-type-modal-title" className="text-[18px] font-bold tracking-tight text-white">
                        {jobType}
                    </h2>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white print:hidden"
                            aria-label="Print"
                            title="Print"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white print:hidden"
                            aria-label="Close"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Search bar */}
                <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
                    <div className="relative">
                        <svg
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="search"
                            placeholder="Search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#1e1b72] focus:ring-2 focus:ring-[#1e1b72]/15 print:hidden"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="min-h-0 flex-1 overflow-auto bg-white">
                    <table className="w-full min-w-[960px] border-collapse text-left text-[12px]">
                        <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-white">
                            <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                <th className="whitespace-nowrap px-4 py-3">Created At</th>
                                <th className="min-w-[160px] px-3 py-3">Title</th>
                                <th className="whitespace-nowrap px-3 py-3">Status</th>
                                <th className="whitespace-nowrap px-3 py-3">Registration</th>
                                <th className="min-w-[140px] px-3 py-3">Vehicle</th>
                                <th
                                    className="whitespace-nowrap px-3 py-3 cursor-pointer select-none hover:text-slate-700"
                                    onClick={() => handleSort('vehicleStatus')}
                                >
                                    <span className="inline-flex items-center gap-0.5">
                                        VE...
                                        <SortIcon colKey="vehicleStatus" />
                                    </span>
                                </th>
                                <th
                                    className="whitespace-nowrap px-3 py-3 cursor-pointer select-none hover:text-slate-700"
                                    onClick={() => handleSort('dueAt')}
                                >
                                    <span className="inline-flex items-center gap-0.5">
                                        Due At
                                        <SortIcon colKey="dueAt" />
                                    </span>
                                </th>
                                <th className="whitespace-nowrap px-3 py-3">Age</th>
                                <th className="min-w-[100px] px-3 py-3">Assigned</th>
                                <th className="whitespace-nowrap px-3 py-3 pr-5">Location</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading && (
                                <tr>
                                    <td colSpan={10} className="px-4 py-14 text-center text-[13px] text-slate-500">
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-4 py-14 text-center text-[13px] text-slate-500">
                                        No jobs for this type yet. Use + Add Job to create one.
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.map((j) => {
                                const created = j.createdAt ? new Date(j.createdAt) : null;
                                const ageDays = created && !Number.isNaN(created.getTime())
                                    ? differenceInDays(new Date(), created)
                                    : null;
                                const due = j.dueAt ? new Date(j.dueAt) : null;
                                const vm = j.vehicle;
                                const vrmShown = vm?.vrm ? formatUkVrmDisplay(vm.vrm) : '';

                                return (
                                    <tr key={j._id} className="align-middle transition-colors hover:bg-slate-50/70">
                                        {/* Created At */}
                                        <td className="whitespace-nowrap px-4 py-3 text-[12px] text-slate-600">
                                            {created ? format(created, 'dd/MM/yyyy') : '—'}
                                        </td>

                                        {/* Title + Details */}
                                        <td className="max-w-[220px] px-3 py-3">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedJobId(j._id)}
                                                className="text-[13px] font-semibold leading-snug text-[#1e1b72] hover:underline text-left"
                                            >
                                                {j.jobType}
                                            </button>
                                            {j.details ? (
                                                <div className="mt-0.5 text-[12px] leading-snug text-slate-600">
                                                    {j.details}
                                                </div>
                                            ) : null}
                                        </td>

                                        {/* Status */}
                                        <td className="whitespace-nowrap px-3 py-3">
                                            <span className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                {j.status || 'Incomplete'}
                                            </span>
                                        </td>

                                        {/* Registration */}
                                        <td className="whitespace-nowrap px-3 py-3">
                                            {vrmShown ? (
                                                <span
                                                    className="inline-block min-w-[7rem] rounded border-2 border-amber-400 bg-[#FFD200] px-2 py-0.5 text-center font-mono text-[11px] font-black uppercase leading-tight tracking-wide text-black shadow-sm"
                                                    style={{ fontFamily: 'ui-monospace, monospace' }}
                                                >
                                                    {vrmShown}
                                                </span>
                                            ) : '—'}
                                        </td>

                                        {/* Vehicle */}
                                        <td className="px-3 py-3">
                                            {vm ? (
                                                <button
                                                    type="button"
                                                    onClick={() => { onClose(); router.push(`/app/vehicles/${vm._id}`); }}
                                                    className="text-[12px] font-bold uppercase leading-snug tracking-tight text-[#1e40af] hover:underline text-left"
                                                >
                                                    {`${vm.make} ${vm.model}`.trim().toUpperCase()}
                                                </button>
                                            ) : '—'}
                                        </td>

                                        {/* Vehicle Status */}
                                        <td className="whitespace-nowrap px-3 py-3">
                                            {vm ? (
                                                <span className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                                    {vehicleStockLabel(vm.status)}
                                                </span>
                                            ) : '—'}
                                        </td>

                                        {/* Due At */}
                                        <td className="whitespace-nowrap px-3 py-3 text-[12px] text-slate-600">
                                            {due && !Number.isNaN(due.getTime()) ? format(due, 'dd/MM/yyyy') : '—'}
                                        </td>

                                        {/* Age */}
                                        <td className="whitespace-nowrap px-3 py-3 text-[12px] text-slate-700 tabular-nums">
                                            {ageDays !== null ? `${ageDays} days` : '—'}
                                        </td>

                                        {/* Assigned */}
                                        <td className="max-w-[130px] px-3 py-3 text-[12px] text-slate-700">
                                            {j.assigneeName || '—'}
                                        </td>

                                        {/* Location */}
                                        <td className="whitespace-nowrap px-3 py-3 pr-5 text-[12px] text-slate-700">
                                            {j.location || '—'}
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
                onUpdated={() => { load(); }}
            />
        </div>
    );
}
