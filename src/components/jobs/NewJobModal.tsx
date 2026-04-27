'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { JOB_TYPES } from '@/lib/jobTypes';

type VehiclePick = {
    _id: string;
    make: string;
    model: string;
    derivative?: string;
    vrm: string;
    primaryImage?: string;
};

function VehicleListThumb({ src }: { src?: string }) {
    const [failed, setFailed] = useState(false);
    const showImg = Boolean(src) && !failed;
    return (
        <div
            className="relative h-9 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100"
            aria-hidden
        >
            {showImg ? (
                <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
            ) : (
                <div className="flex h-full w-full items-center justify-center px-0.5 text-center text-[7px] font-bold uppercase leading-tight text-slate-400">
                    No img
                </div>
            )}
        </div>
    );
}

function formatVehicleLabel(v: VehiclePick) {
    const bits = [v.make, v.model, v.derivative].filter(Boolean).join(' ').trim();
    return `${bits} · ${v.vrm}`;
}

type StaffMember = {
    _id: string;
    name: string;
    email: string;
    role: string;
};

function formatStaffLabel(s: StaffMember) {
    if (s.role === 'DEALER_ADMIN') return `${s.name} (Admin)`;
    return s.name;
}

export function NewJobModal({
    open,
    onClose,
    onSaved,
    initialVehicle,
}: {
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;
    initialVehicle?: VehiclePick;
}) {
    const [selectedVehicle, setSelectedVehicle] = useState<VehiclePick | null>(initialVehicle ?? null);
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [vehicleOptions, setVehicleOptions] = useState<VehiclePick[]>([]);
    const [loadingVehicles, setLoadingVehicles] = useState(false);
    const [vehicleMenuOpen, setVehicleMenuOpen] = useState(false);
    const [jobType, setJobType] = useState('');
    const [details, setDetails] = useState('');
    const [location, setLocation] = useState('');
    const [assignToId, setAssignToId] = useState('');
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [saving, setSaving] = useState(false);
    const vehicleWrapRef = useRef<HTMLDivElement>(null);

    const resetForm = useCallback(() => {
        setSelectedVehicle(initialVehicle ?? null);
        setVehicleSearch('');
        setVehicleOptions([]);
        setVehicleMenuOpen(false);
        setJobType('');
        setDetails('');
        setLocation('');
        setAssignToId('');
    }, [initialVehicle]);

    useEffect(() => {
        if (!open) {
            resetForm();
        }
    }, [open, resetForm]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (vehicleWrapRef.current && !vehicleWrapRef.current.contains(e.target as Node)) {
                setVehicleMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    useEffect(() => {
        if (!open || selectedVehicle) return;
        const q = vehicleSearch;
        const t = window.setTimeout(async () => {
            setLoadingVehicles(true);
            try {
                const params = new URLSearchParams({ status: 'All' });
                const trimmed = q.trim();
                if (trimmed) params.set('search', trimmed);
                const res = await fetch(`/api/vehicles?${params.toString()}`);
                const data = await res.json();
                if (data.ok && Array.isArray(data.vehicles)) {
                    setVehicleOptions(
                        data.vehicles.map((v: VehiclePick) => ({
                            _id: v._id,
                            make: v.make || '',
                            model: v.model || '',
                            derivative: v.derivative,
                            vrm: v.vrm || '',
                            primaryImage: v.primaryImage,
                        }))
                    );
                } else {
                    setVehicleOptions([]);
                }
            } catch {
                setVehicleOptions([]);
            } finally {
                setLoadingVehicles(false);
            }
        }, 250);
        return () => window.clearTimeout(t);
    }, [open, vehicleSearch, selectedVehicle]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            setLoadingStaff(true);
            try {
                const res = await fetch('/api/users/staff');
                const data = await res.json();
                if (cancelled) return;
                if (data.ok && Array.isArray(data.staff)) {
                    setStaffList(data.staff);
                } else {
                    setStaffList([]);
                }
            } catch {
                if (!cancelled) setStaffList([]);
            } finally {
                if (!cancelled) setLoadingStaff(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open]);

    const inputDisplay = selectedVehicle ? formatVehicleLabel(selectedVehicle) : vehicleSearch;

    if (!open) return null;

    const submitJob = async (mode: 'close' | 'another') => {
        if (!selectedVehicle?._id || !jobType.trim()) {
            alert('Please select a vehicle and job type.');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicleId: selectedVehicle._id,
                    jobType: jobType.trim(),
                    details: details.trim(),
                    location: location.trim() || undefined,
                    assigneeId: assignToId || null,
                }),
            });
            const data = await res.json();
            if (!data.ok) {
                alert(typeof data.error === 'string' ? data.error : data.error?.message || 'Could not save job.');
                return;
            }
            onSaved?.();
            if (mode === 'close') onClose();
            else resetForm();
        } catch {
            alert('Network error — please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = () => submitJob('close');
    const handleSaveAndNew = () => submitJob('another');

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close dialog"
                className="absolute inset-0 bg-slate-900/55 backdrop-blur-[3px]"
                onClick={onClose}
            />

            <div
                className="relative w-full max-w-lg animate-in fade-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-job-title"
            >
                <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                        <h2 id="new-job-title" className="text-lg font-bold tracking-tight text-slate-800">
                            New Job
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Close"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="space-y-4 px-5 py-5 sm:px-6">
                        <div ref={vehicleWrapRef} className="relative">
                            <label htmlFor="new-job-vehicle" className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                                Vehicle
                            </label>
                            <input
                                id="new-job-vehicle"
                                type="text"
                                autoComplete="off"
                                placeholder="Select vehicle..."
                                value={inputDisplay}
                                readOnly={!!initialVehicle}
                                onChange={(e) => {
                                    if (initialVehicle) return;
                                    setSelectedVehicle(null);
                                    setVehicleSearch(e.target.value);
                                    setVehicleMenuOpen(true);
                                }}
                                onFocus={() => { if (!initialVehicle) setVehicleMenuOpen(true); }}
                                className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20 ${initialVehicle ? 'opacity-70 cursor-default' : ''}`}
                            />
                            {vehicleMenuOpen && (
                                <div
                                    className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                                    role="listbox"
                                >
                                    {loadingVehicles && (
                                        <div className="px-3 py-2.5 text-[12px] text-slate-500">Loading…</div>
                                    )}
                                    {!loadingVehicles && vehicleOptions.length === 0 && (
                                        <div className="px-3 py-2.5 text-[12px] leading-snug text-slate-500">
                                            No vehicles match your search. Try different words or clear the search to see full stock (including AutoTrader).
                                        </div>
                                    )}
                                    {!loadingVehicles &&
                                        vehicleOptions.map((v) => {
                                            const label = formatVehicleLabel(v);
                                            return (
                                                <button
                                                    key={v._id}
                                                    type="button"
                                                    role="option"
                                                    className="flex w-full cursor-pointer items-center gap-2.5 px-2 py-1.5 text-left hover:bg-slate-50"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        setSelectedVehicle(v);
                                                        setVehicleSearch('');
                                                        setVehicleMenuOpen(false);
                                                    }}
                                                >
                                                    <VehicleListThumb src={v.primaryImage} />
                                                    <span className="min-w-0 flex-1 text-[13px] leading-snug text-slate-800">
                                                        {label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="new-job-type" className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                                Job
                            </label>
                            <select
                                id="new-job-type"
                                value={jobType}
                                onChange={(e) => setJobType(e.target.value)}
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 shadow-sm outline-none focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                            >
                                <option value="">Select job type…</option>
                                {JOB_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="new-job-details" className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                                Details
                            </label>
                            <textarea
                                id="new-job-details"
                                rows={3}
                                placeholder="Add more detail if needed."
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                            />
                        </div>

                        <div>
                            <label htmlFor="new-job-location" className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                                Location
                            </label>
                            <input
                                id="new-job-location"
                                type="text"
                                placeholder="e.g. Hayes"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                            />
                        </div>

                        <div>
                            <label htmlFor="new-job-assign" className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                                Assign to
                            </label>
                            <select
                                id="new-job-assign"
                                value={assignToId}
                                onChange={(e) => setAssignToId(e.target.value)}
                                disabled={loadingStaff}
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 shadow-sm outline-none focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20 disabled:cursor-wait disabled:opacity-70"
                            >
                                <option value="">
                                    {loadingStaff ? 'Loading staff…' : 'Select staff…'}
                                </option>
                                {!loadingStaff &&
                                    staffList.map((s) => (
                                        <option key={s._id} value={s._id}>
                                            {formatStaffLabel(s)}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={handleSave}
                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={handleSaveAndNew}
                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {saving ? 'Saving…' : 'Save & New'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
