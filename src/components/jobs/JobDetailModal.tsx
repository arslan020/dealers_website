'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { format, formatDistanceToNow, isToday } from 'date-fns';
import { formatUkVrmDisplay } from '@/lib/formatUkVrm';
import { useRouter } from 'next/navigation';

type JobComment = {
    _id: string;
    text: string;
    createdAt: string | null;
    author: { _id: string; name: string } | null;
};

type TimeCard = {
    _id: string;
    date: string | null;
    hours: number;
    minutes: number;
    notes: string;
    staff: { _id: string; name: string } | null;
};

type JobDetail = {
    _id: string;
    jobType: string;
    details: string;
    status: string;
    location: string;
    dueAt: string | null;
    createdAt: string | null;
    assignee: { _id: string; name: string; email: string } | null;
    createdBy: { name: string } | null;
    comments: JobComment[];
    timeCards: TimeCard[];
    vehicle: {
        _id: string;
        vrm: string;
        make: string;
        model: string;
        derivative: string;
        status: string;
    } | null;
};

type StaffMember = { _id: string; name: string; email: string; role: string };

function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
    'bg-orange-400', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500',
    'bg-rose-500', 'bg-amber-500', 'bg-teal-500', 'bg-indigo-500',
];
function avatarColor(name: string) {
    let hash = 0;
    for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatCommentTime(isoStr: string | null) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    if (isToday(d)) return `Today at ${format(d, 'h:mmaaa')}`;
    return formatDistanceToNow(d, { addSuffix: true });
}

function todayInputValue() {
    return new Date().toISOString().slice(0, 10);
}

export function JobDetailModal({
    jobId,
    onClose,
    onUpdated,
}: {
    jobId: string | null;
    onClose: () => void;
    onUpdated?: () => void;
}) {
    const router = useRouter();
    const [job, setJob] = useState<JobDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [details, setDetails] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Assign
    const [showAssign, setShowAssign] = useState(false);
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);

    // Comments
    const [newComment, setNewComment] = useState('');
    const [savingComment, setSavingComment] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

    // Due Date panel
    const [showDueDate, setShowDueDate] = useState(false);
    const [dueDateInput, setDueDateInput] = useState('');
    const [dueTimeInput, setDueTimeInput] = useState('');
    const [savingDue, setSavingDue] = useState(false);
    const duePanelRef = useRef<HTMLDivElement>(null);

    // Time Card panel
    const [showTimeCard, setShowTimeCard] = useState(false);
    const [tcDate, setTcDate] = useState(todayInputValue());
    const [tcStaffId, setTcStaffId] = useState('');
    const [tcHours, setTcHours] = useState('');
    const [tcMinutes, setTcMinutes] = useState('');
    const [tcNotes, setTcNotes] = useState('');
    const [savingTimeCard, setSavingTimeCard] = useState(false);
    const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!jobId) return;
        setLoading(true);
        setLoadError(false);
        try {
            const res = await fetch(`/api/jobs/${jobId}`);
            const data = await res.json();
            if (data.ok) {
                setJob(data.job);
                setDetails(data.job.details || '');
                if (data.job.dueAt) {
                    const d = new Date(data.job.dueAt);
                    setDueDateInput(d.toISOString().slice(0, 10));
                    setDueTimeInput(format(d, 'HH:mm'));
                } else {
                    setDueDateInput('');
                    setDueTimeInput('');
                }
            } else {
                setLoadError(true);
            }
        } catch {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        if (jobId) load();
        else { setJob(null); setNewComment(''); setLoadError(false); setShowDueDate(false); setShowTimeCard(false); }
    }, [jobId, load]);

    useEffect(() => {
        if (!jobId) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [jobId, onClose]);

    // Load staff when assign or time card panel opens
    useEffect(() => {
        if (!showAssign && !showTimeCard) return;
        if (staffList.length > 0) return;
        let cancelled = false;
        setLoadingStaff(true);
        fetch('/api/users/staff')
            .then(r => r.json())
            .then(d => { if (!cancelled && d.ok) setStaffList(d.staff || []); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoadingStaff(false); });
        return () => { cancelled = true; };
    }, [showAssign, showTimeCard, staffList.length]);

    const patch = async (updates: Record<string, unknown>) => {
        if (!job) return;
        setSaving(true);
        try {
            await fetch(`/api/jobs/${job._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            await load();
            onUpdated?.();
        } finally {
            setSaving(false);
        }
    };

    const handleComplete = () => {
        if (!job) return;
        patch({ status: job.status === 'Complete' ? 'Incomplete' : 'Complete' });
    };

    const handleSaveDetails = () => patch({ details });

    const handleDelete = async () => {
        if (!job || !confirm('Delete this job?')) return;
        setDeleting(true);
        try {
            await fetch(`/api/jobs/${job._id}`, { method: 'DELETE' });
            onUpdated?.();
            onClose();
        } finally {
            setDeleting(false);
        }
    };

    const handleAssign = async (staffId: string | null) => {
        await patch({ assigneeId: staffId });
        setShowAssign(false);
    };

    const handleSaveDueDate = async () => {
        if (!job) return;
        setSavingDue(true);
        try {
            const iso = dueDateInput && dueTimeInput
                ? new Date(`${dueDateInput}T${dueTimeInput}`).toISOString()
                : dueDateInput
                    ? new Date(`${dueDateInput}T00:00`).toISOString()
                    : null;
            await fetch(`/api/jobs/${job._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dueAt: iso }),
            });
            await load();
            onUpdated?.();
            setShowDueDate(false);
        } finally {
            setSavingDue(false);
        }
    };

    const handleRemoveDueDate = async () => {
        if (!job) return;
        setSavingDue(true);
        try {
            await fetch(`/api/jobs/${job._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dueAt: null }),
            });
            setDueDateInput('');
            setDueTimeInput('');
            await load();
            onUpdated?.();
            setShowDueDate(false);
        } finally {
            setSavingDue(false);
        }
    };

    const handleAttachTimeCard = async () => {
        if (!job || !tcStaffId || !tcDate) return;
        setSavingTimeCard(true);
        try {
            const res = await fetch(`/api/jobs/${job._id}/timecards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffId: tcStaffId,
                    date: tcDate,
                    hours: parseInt(tcHours) || 0,
                    minutes: parseInt(tcMinutes) || 0,
                    notes: tcNotes,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setJob(prev => prev ? { ...prev, timeCards: data.timeCards } : prev);
                setShowTimeCard(false);
                setTcDate(todayInputValue());
                setTcStaffId('');
                setTcHours('');
                setTcMinutes('');
                setTcNotes('');
            }
        } finally {
            setSavingTimeCard(false);
        }
    };

    const handleDeleteTimeCard = async (cardId: string) => {
        if (!job) return;
        setDeletingCardId(cardId);
        try {
            await fetch(`/api/jobs/${job._id}/timecards/${cardId}`, { method: 'DELETE' });
            setJob(prev => prev ? { ...prev, timeCards: prev.timeCards.filter(t => t._id !== cardId) } : prev);
        } finally {
            setDeletingCardId(null);
        }
    };

    const handleSaveComment = async () => {
        if (!job || !newComment.trim()) return;
        setSavingComment(true);
        try {
            const res = await fetch(`/api/jobs/${job._id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: newComment.trim() }),
            });
            const data = await res.json();
            if (data.ok) {
                setJob(prev => prev ? { ...prev, comments: data.comments } : prev);
                setNewComment('');
            }
        } finally {
            setSavingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!job) return;
        setDeletingCommentId(commentId);
        try {
            await fetch(`/api/jobs/${job._id}/comments/${commentId}`, { method: 'DELETE' });
            setJob(prev => prev ? { ...prev, comments: prev.comments.filter(c => c._id !== commentId) } : prev);
        } finally {
            setDeletingCommentId(null);
        }
    };

    if (!jobId) return null;

    const vrm = job?.vehicle?.vrm ? formatUkVrmDisplay(job.vehicle.vrm) : '';
    const vehicleLabel = job?.vehicle
        ? `${job.vehicle.make} ${job.vehicle.model}${job.vehicle.derivative ? ' ' + job.vehicle.derivative : ''}`.trim()
        : '';
    const createdAt = job?.createdAt ? new Date(job.createdAt) : null;
    const dueAt = job?.dueAt ? new Date(job.dueAt) : null;

    const totalTimeMinutes = (job?.timeCards || []).reduce((sum, t) => sum + (t.hours * 60) + t.minutes, 0);
    const totalHours = totalTimeMinutes / 60;

    return (
        <div className="fixed inset-0 z-[400] flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
            <button type="button" aria-label="Close" className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />

            <div className="relative z-10 w-full max-w-[920px] my-auto rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                    <span className="text-[13px] font-semibold text-slate-500">Job</span>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {loading && <div className="flex items-center justify-center py-20 text-[13px] text-slate-500">Loading…</div>}
                {!loading && loadError && (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <p className="text-[14px] font-semibold text-slate-700">Failed to load job</p>
                        <button type="button" onClick={load} className="mt-3 text-[13px] text-[#1e1b72] hover:underline">Try again</button>
                    </div>
                )}

                {!loading && job && (
                    <div className="flex">
                        {/* Main Content */}
                        <div className="flex-1 min-w-0 px-6 py-5 space-y-5">
                            {/* Title + Vehicle */}
                            <div>
                                <h2 className="text-[22px] font-bold text-slate-900 leading-tight">
                                    {job.jobType}{job.details ? ` - ${job.details}` : ''}
                                </h2>
                                {job.vehicle && (
                                    <div className="mt-2 flex items-center gap-3">
                                        {vrm && (
                                            <button type="button" onClick={() => { onClose(); router.push(`/app/vehicles/${job.vehicle!._id}`); }}
                                                className="inline-block rounded border-2 border-amber-400 bg-[#FFD200] px-2.5 py-0.5 font-mono text-[12px] font-black uppercase tracking-wide text-black shadow-sm hover:brightness-95"
                                                style={{ fontFamily: 'ui-monospace, monospace' }}>
                                                {vrm}
                                            </button>
                                        )}
                                        {vehicleLabel && <span className="text-[13px] text-slate-500">{vehicleLabel}</span>}
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <div>
                                <div className="flex items-start gap-2">
                                    <svg className="mt-2.5 h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                                    <textarea rows={2} value={details} onChange={e => setDetails(e.target.value)} placeholder="Add a more detailed description..."
                                        className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1e1b72] focus:ring-2 focus:ring-[#1e1b72]/10" />
                                </div>
                                {details !== (job.details || '') && (
                                    <div className="mt-2 flex gap-2 pl-6">
                                        <button type="button" onClick={handleSaveDetails} disabled={saving} className="rounded-lg bg-[#1e1b72] px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-[#16136a] disabled:opacity-60">
                                            {saving ? 'Saving…' : 'Save'}
                                        </button>
                                        <button type="button" onClick={() => setDetails(job.details || '')} className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                                    </div>
                                )}
                            </div>

                            {/* Meta row */}
                            <div className="flex flex-wrap gap-8">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Status</p>
                                    <span className={`text-[13px] font-semibold ${job.status === 'Complete' ? 'text-emerald-600' : 'text-slate-700'}`}>{job.status || 'Incomplete'}</span>
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Assigned To</p>
                                    {job.assignee ? (
                                        <button type="button" onClick={() => setShowAssign(v => !v)} className="flex items-center gap-2">
                                            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(job.assignee.name)}`}>{getInitials(job.assignee.name)}</span>
                                        </button>
                                    ) : (
                                        <button type="button" onClick={() => setShowAssign(v => !v)} className="text-[13px] text-slate-400 hover:text-slate-700">Unassigned</button>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Due</p>
                                    <span className="text-[13px] text-slate-700">
                                        {dueAt && !Number.isNaN(dueAt.getTime()) ? format(dueAt, 'dd/MM/yyyy HH:mm') : '—'}
                                    </span>
                                </div>
                                {job.location && (
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Location</p>
                                        <span className="text-[13px] text-slate-700">{job.location}</span>
                                    </div>
                                )}
                            </div>

                            {/* Assign dropdown */}
                            {showAssign && (
                                <div className="rounded-xl border border-slate-200 bg-white shadow-lg p-4 space-y-1">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Assign to</p>
                                    {loadingStaff && <p className="text-[13px] text-slate-500">Loading…</p>}
                                    {!loadingStaff && (
                                        <>
                                            <button type="button" onClick={() => handleAssign(null)} className="block w-full text-left rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50">Unassign</button>
                                            {staffList.map(s => (
                                                <button key={s._id} type="button" onClick={() => handleAssign(s._id)} className="flex items-center gap-2.5 w-full text-left rounded-lg px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                                                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(s.name)}`}>{getInitials(s.name)}</span>
                                                    {s.name}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Times Table */}
                            {job.timeCards.length > 0 && (
                                <div className="rounded-xl border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                                        <h3 className="text-[14px] font-bold text-slate-800">Times</h3>
                                    </div>
                                    <table className="w-full text-[13px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                                <th className="px-4 py-2.5 text-left">Date</th>
                                                <th className="px-4 py-2.5 text-left">Team Member</th>
                                                <th className="px-4 py-2.5 text-right">Time</th>
                                                <th className="w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {job.timeCards.map(tc => {
                                                const d = tc.date ? new Date(tc.date) : null;
                                                const timeStr = tc.hours > 0 || tc.minutes > 0
                                                    ? `${tc.hours > 0 ? `${tc.hours}.${String(tc.minutes).padStart(2, '0')} hours` : `${tc.minutes} min`}`
                                                    : '—';
                                                return (
                                                    <tr key={tc._id} className="hover:bg-slate-50/60">
                                                        <td className="px-4 py-2.5 text-slate-700">{d ? format(d, 'd MMM') : '—'}</td>
                                                        <td className="px-4 py-2.5 text-slate-700">{tc.staff?.name || '—'}</td>
                                                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{timeStr}</td>
                                                        <td className="px-2 py-2.5 text-right">
                                                            <button type="button" onClick={() => handleDeleteTimeCard(tc._id)} disabled={deletingCardId === tc._id}
                                                                className="text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-40">
                                                                ×
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-slate-200 bg-slate-50/40">
                                                <td colSpan={2} className="px-4 py-2.5 text-right text-[12px] font-bold text-slate-600">Total</td>
                                                <td className="px-4 py-2.5 text-right text-[13px] font-bold text-slate-900">{totalHours.toFixed(1)} hours</td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Comments */}
                            <div className="pt-1 border-t border-slate-100">
                                <h3 className="text-[16px] font-bold text-[#1e1b72] mb-4">Comments</h3>
                                {job.comments.length > 0 && (
                                    <div className="space-y-4 mb-5">
                                        {job.comments.map(comment => (
                                            <div key={comment._id} className="flex gap-3">
                                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${comment.author ? avatarColor(comment.author.name) : 'bg-slate-400'}`}>
                                                    {comment.author ? getInitials(comment.author.name) : '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[13px] font-bold text-slate-800">{comment.author?.name || 'Unknown'}</span>
                                                        <button type="button" onClick={() => handleDeleteComment(comment._id)} disabled={deletingCommentId === comment._id} className="shrink-0 text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-40">
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                    <div className="mt-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 leading-relaxed">{comment.text}</div>
                                                    <p className="mt-1.5 text-right text-[11px] text-slate-400">{formatCommentTime(comment.createdAt)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <textarea rows={3} placeholder="Write a comment..." value={newComment} onChange={e => setNewComment(e.target.value)}
                                    className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1e1b72] focus:ring-2 focus:ring-[#1e1b72]/10" />
                                <button type="button" onClick={handleSaveComment} disabled={savingComment || !newComment.trim()}
                                    className="mt-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {savingComment ? 'Saving…' : 'Save Comment'}
                                </button>
                            </div>

                            {/* Footer */}
                            {(job.createdBy || createdAt) && (
                                <p className="text-[11px] text-slate-400 pb-2">
                                    {job.createdBy ? `Job created by ${job.createdBy.name}` : 'Job created'}
                                    {createdAt && !Number.isNaN(createdAt.getTime()) ? `, ${format(createdAt, "EEE dd/MM/yyyy 'at' HH:mm")}` : ''}
                                </p>
                            )}
                        </div>

                        {/* Right Sidebar */}
                        <div className="w-56 shrink-0 border-l border-slate-100 bg-slate-50/50 px-4 py-5 space-y-5">
                            <div>
                                <p className="text-[12px] font-bold text-slate-700 mb-2">Add</p>
                                <div className="space-y-1.5">
                                    {/* VEHICLE */}
                                    <SidebarBtn icon="🚗" label="VEHICLE" onClick={() => {}} />
                                    {/* PART / EXPENSE */}
                                    <SidebarBtn icon="💲" label="PART / EXPENSE" onClick={() => {}} />
                                    {/* IMAGES / DOCS */}
                                    <SidebarBtn icon="📎" label="IMAGES / DOCS" onClick={() => {}} />
                                    {/* TIME */}
                                    <SidebarBtn icon="⏱️" label="TIME" onClick={() => { setShowTimeCard(true); setShowDueDate(false); }} active={showTimeCard} />
                                    {/* DUE DATE */}
                                    <SidebarBtn icon="🗓️" label="DUE DATE" onClick={() => { setShowDueDate(v => !v); setShowTimeCard(false); }} active={showDueDate} />
                                </div>

                                {/* DUE DATE panel */}
                                {showDueDate && (
                                    <div ref={duePanelRef} className="mt-2 rounded-xl border border-slate-200 bg-white shadow-md p-4 space-y-3">
                                        <p className="text-[13px] font-bold text-slate-700">Due Date</p>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Date</label>
                                            <input type="date" value={dueDateInput} onChange={e => setDueDateInput(e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#1e1b72] focus:ring-2 focus:ring-[#1e1b72]/10" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Time</label>
                                            <input type="time" value={dueTimeInput} onChange={e => setDueTimeInput(e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#1e1b72] focus:ring-2 focus:ring-[#1e1b72]/10" />
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={handleSaveDueDate} disabled={savingDue || !dueDateInput}
                                                className="flex-1 rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-900 disabled:opacity-60">
                                                {savingDue ? '…' : 'SAVE'}
                                            </button>
                                            <button type="button" onClick={handleRemoveDueDate} disabled={savingDue}
                                                className="flex-1 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-60">
                                                REMOVE
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className="text-[12px] font-bold text-slate-700 mb-2">Actions</p>
                                <div className="space-y-1.5">
                                    <button type="button" onClick={handleComplete} disabled={saving}
                                        className="flex items-center gap-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors disabled:opacity-60">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                        {job.status === 'Complete' ? 'MARK INCOMPLETE' : 'COMPLETE'}
                                    </button>
                                    <button type="button" onClick={() => { setShowAssign(v => !v); setShowDueDate(false); setShowTimeCard(false); }}
                                        className="flex items-center gap-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        ASSIGN
                                    </button>
                                    <button type="button" onClick={handleDelete} disabled={deleting}
                                        className="flex items-center gap-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 transition-colors disabled:opacity-60">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        {deleting ? 'DELETING…' : 'DELETE'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Attach Time Card Modal */}
            {showTimeCard && (
                <div className="fixed inset-0 z-[410] flex items-center justify-center p-4">
                    <button type="button" className="absolute inset-0 bg-slate-900/30" onClick={() => setShowTimeCard(false)} />
                    <div className="relative z-10 w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <h3 className="text-[16px] font-bold text-slate-800">Attach Time Card</h3>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-[#1e1b72] mb-1.5 block">Date</label>
                                <input type="date" value={tcDate} onChange={e => setTcDate(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#1e1b72] focus:ring-2 focus:ring-[#1e1b72]/10" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-[#1e1b72] mb-1.5 block">Team Member</label>
                                <select value={tcStaffId} onChange={e => setTcStaffId(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#1e1b72] focus:ring-2 focus:ring-[#1e1b72]/10 appearance-none bg-white">
                                    <option value="">Select…</option>
                                    {staffList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Notes (e.g. Changed oil &amp; filter)</label>
                            <input type="text" value={tcNotes} onChange={e => setTcNotes(e.target.value)} placeholder="Optional notes…"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#1e1b72] focus:ring-2 focus:ring-[#1e1b72]/10" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Hours</label>
                                <input type="number" min="0" max="99" value={tcHours} onChange={e => setTcHours(e.target.value)} placeholder="0"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#1e1b72] focus:ring-2 focus:ring-[#1e1b72]/10" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Minutes</label>
                                <input type="number" min="0" max="59" value={tcMinutes} onChange={e => setTcMinutes(e.target.value)} placeholder="0"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#1e1b72] focus:ring-2 focus:ring-[#1e1b72]/10" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setShowTimeCard(false)}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50">
                                CANCEL
                            </button>
                            <button type="button" onClick={handleAttachTimeCard} disabled={savingTimeCard || !tcStaffId || !tcDate}
                                className="rounded-lg bg-[#1e1b72] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#16136a] disabled:opacity-60">
                                {savingTimeCard ? 'ATTACHING…' : 'ATTACH'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SidebarBtn({ icon, label, onClick, active }: { icon: string; label: string; onClick: () => void; active?: boolean }) {
    return (
        <button type="button" onClick={onClick}
            className={`flex items-center gap-2.5 w-full rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors ${active ? 'border-[#1e1b72] bg-[#1e1b72]/5 text-[#1e1b72]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}>
            <span className="text-sm">{icon}</span>
            {label}
        </button>
    );
}
