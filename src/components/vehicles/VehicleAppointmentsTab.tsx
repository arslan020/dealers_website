'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Appt {
    _id: string;
    apptType: 'appointment' | 'reminder';
    calendarName?: string;
    startTime: string;
    durationMinutes?: number;
    purpose?: string;
    customerName?: string;
    staffUserIds?: string[];
    vehicleIds?: string[];
    notes?: string;
    completed: boolean;
}

interface Calendar { _id: string; name: string; color: string; isPrimary: boolean; }
interface Customer { _id: string; firstName: string; lastName: string; email?: string; }
interface StaffUser { _id: string; name: string; }

interface Props {
    vehicleId: string;
    vehicleVRM?: string;
    vehicleStatus?: string;
    branchName?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(iso: string) {
    const d = new Date(iso);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}

function groupByDay(appts: Appt[]): { label: string; items: Appt[] }[] {
    const map = new Map<string, Appt[]>();
    for (const a of appts) {
        const key = new Date(a.startTime).toDateString();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(a);
    }
    return Array.from(map.entries()).map(([, items]) => ({
        label: dayLabel(items[0].startTime),
        items,
    }));
}

const DURATION_UNITS = ['Min', 'Hour'] as const;
const FOLLOWUP_UNITS = ['Min', 'Hour', 'Day', 'Week'] as const;
type DurUnit = typeof DURATION_UNITS[number];
type FupUnit = typeof FOLLOWUP_UNITS[number];

function toMinutes(val: number, unit: DurUnit | FupUnit) {
    if (unit === 'Hour') return val * 60;
    if (unit === 'Day') return val * 60 * 24;
    if (unit === 'Week') return val * 60 * 24 * 7;
    return val;
}

/* ─── Manage Calendars Modal ─────────────────────────────────────────────── */
function ManageCalendarsModal({ calendars, onClose, onRefresh }: {
    calendars: Calendar[];
    onClose: () => void;
    onRefresh: () => void;
}) {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#4D7CFF');
    const [saving, setSaving] = useState(false);

    const add = async () => {
        if (!name.trim()) return;
        setSaving(true);
        const res = await fetch('/api/calendars', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), color }),
        });
        if ((await res.json()).ok) { toast.success('Calendar added'); setName(''); onRefresh(); }
        else toast.error('Failed to add calendar');
        setSaving(false);
    };

    const del = async (id: string) => {
        const res = await fetch(`/api/calendars?id=${id}`, { method: 'DELETE' });
        if ((await res.json()).ok) { toast.success('Deleted'); onRefresh(); }
        else toast.error('Cannot delete primary calendar');
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-[460px] p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-semibold text-slate-800">Manage Calendars</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
                </div>
                <div className="space-y-2 mb-5 max-h-48 overflow-y-auto">
                    {calendars.map(c => (
                        <div key={c._id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-2.5">
                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color }} />
                                <span className="text-[13px] text-slate-700">{c.name}</span>
                                {c.isPrimary && <span className="text-[10px] text-slate-400 font-medium">Primary</span>}
                            </div>
                            {!c.isPrimary && (
                                <button onClick={() => del(c._id)} className="text-red-400 hover:text-red-600 text-[12px]">Delete</button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="border-t border-slate-100 pt-4">
                    <p className="text-[12px] font-semibold text-slate-600 mb-2">Add Calendar</p>
                    <div className="flex gap-2">
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Calendar name"
                            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                        />
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-9 rounded border border-slate-200 cursor-pointer p-0.5" />
                        <button onClick={add} disabled={saving || !name.trim()} className="px-4 py-2 bg-[#4D7CFF] text-white text-[13px] font-semibold rounded-lg hover:bg-[#3a6ae8] disabled:opacity-50">
                            Add
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── New Contact Mini-Modal ─────────────────────────────────────────────── */
function NewContactModal({ onCreated, onClose }: { onCreated: (c: Customer) => void; onClose: () => void }) {
    const [first, setFirst] = useState('');
    const [last, setLast] = useState('');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (!first.trim() || !last.trim()) { toast.error('First and last name required'); return; }
        setSaving(true);
        const res = await fetch('/api/crm/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: first.trim(), lastName: last.trim(), email: email.trim() || undefined, source: 'Walk-in', status: 'Lead' }),
        });
        const data = await res.json();
        if (data.ok) { onCreated(data.customer); toast.success('Contact created'); }
        else toast.error('Failed to create contact');
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-[400px] p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-semibold text-slate-800">New Contact</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
                </div>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[12px] font-medium text-slate-600 block mb-1">First Name *</label>
                            <input value={first} onChange={e => setFirst(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-600 block mb-1">Last Name *</label>
                            <input value={last} onChange={e => setLast(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[12px] font-medium text-slate-600 block mb-1">Email</label>
                        <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-5">
                    <button onClick={onClose} className="px-4 py-2 text-[13px] text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button onClick={save} disabled={saving} className="px-5 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae8] disabled:opacity-60">
                        {saving ? 'Creating…' : 'Create Contact'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Add / Edit Appointment Modal ───────────────────────────────────────── */
function AppointmentModal({
    vehicleId,
    vehicleVRM,
    calendars,
    editAppt,
    onSaved,
    onClose,
    onManageCalendars,
}: {
    vehicleId: string;
    vehicleVRM?: string;
    calendars: Calendar[];
    editAppt: Appt | null;
    onSaved: () => void;
    onClose: () => void;
    onManageCalendars: () => void;
}) {
    const isEdit = !!editAppt;

    // Form state
    const [apptType, setApptType] = useState<'appointment' | 'reminder'>(editAppt?.apptType ?? 'appointment');
    const [calendarId, setCalendarId] = useState(editAppt?.calendarName ? (calendars.find(c => c.name === editAppt.calendarName)?._id ?? calendars[0]?._id ?? '') : (calendars[0]?._id ?? ''));

    const defaultDate = editAppt
        ? new Date(editAppt.startTime).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const defaultTime = editAppt
        ? new Date(editAppt.startTime).toTimeString().slice(0, 5)
        : '12:00';

    const [date, setDate] = useState(defaultDate);
    const [time, setTime] = useState(defaultTime);
    const [durVal, setDurVal] = useState(editAppt?.durationMinutes ? String(editAppt.durationMinutes) : '');
    const [durUnit, setDurUnit] = useState<DurUnit>('Min');
    const [fupVal, setFupVal] = useState('');
    const [fupUnit, setFupUnit] = useState<FupUnit>('Day');

    // Customer
    const [custQuery, setCustQuery] = useState(editAppt?.customerName ?? '');
    const [custResults, setCustResults] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showNewContact, setShowNewContact] = useState(false);
    const custTimer = useRef<NodeJS.Timeout>();

    // Staff
    const [staff, setStaff] = useState<StaffUser[]>([]);
    const [staffIds, setStaffIds] = useState<string[]>(editAppt?.staffUserIds ?? []);

    // Purpose
    const [purpose, setPurpose] = useState(editAppt?.purpose ?? '');

    // Vehicles of interest
    const [vrmQuery, setVrmQuery] = useState('');
    const [vrmResults, setVrmResults] = useState<{ _id: string; vrm: string; make: string; model: string }[]>([]);
    const [selectedVRMs, setSelectedVRMs] = useState<string[]>(
        editAppt?.vehicleIds?.length ? editAppt.vehicleIds : (vehicleVRM ? [vehicleVRM] : [])
    );
    const vrmTimer = useRef<NodeJS.Timeout>();

    // Notes
    const [notes, setNotes] = useState(editAppt?.notes ?? '');
    const [saving, setSaving] = useState(false);

    // Load staff on mount
    useEffect(() => {
        fetch('/api/users/staff').then(r => r.json()).then(d => { if (d.ok) setStaff(d.staff); });
    }, []);

    // Customer search
    const searchCustomers = useCallback((q: string) => {
        clearTimeout(custTimer.current);
        if (!q.trim()) { setCustResults([]); return; }
        custTimer.current = setTimeout(async () => {
            const res = await fetch(`/api/crm/customers?q=${encodeURIComponent(q)}`);
            const d = await res.json();
            if (d.ok) setCustResults(d.customers.slice(0, 6));
        }, 250);
    }, []);

    // VRM search
    const searchVRMs = useCallback((q: string) => {
        clearTimeout(vrmTimer.current);
        if (!q.trim()) { setVrmResults([]); return; }
        vrmTimer.current = setTimeout(async () => {
            const res = await fetch(`/api/vehicles?q=${encodeURIComponent(q)}&limit=6`);
            const d = await res.json();
            if (d.ok) setVrmResults((d.vehicles || []).map((v: any) => ({ _id: v._id || v.id, vrm: v.vrm, make: v.make, model: v.model })));
        }, 250);
    }, []);

    const toggleStaff = (id: string) => {
        setStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const removeVRM = (vrm: string) => setSelectedVRMs(prev => prev.filter(v => v !== vrm));
    const addVRM = (vrm: string) => {
        if (!selectedVRMs.includes(vrm)) setSelectedVRMs(prev => [...prev, vrm]);
        setVrmQuery('');
        setVrmResults([]);
    };

    const submit = async () => {
        if (!date || !time) { toast.error('Date and time required'); return; }
        setSaving(true);
        const startTime = new Date(`${date}T${time}:00`).toISOString();
        const cal = calendars.find(c => c._id === calendarId);
        const durMins = durVal ? toMinutes(Number(durVal), durUnit) : undefined;
        const fupMins = fupVal ? toMinutes(Number(fupVal), fupUnit) : undefined;

        const payload = {
            apptType,
            calendarId: cal?._id,
            calendarName: cal?.name,
            startTime,
            durationMinutes: durMins,
            followUpAfterMinutes: fupMins,
            customerId: selectedCustomer?._id,
            customerName: selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : (custQuery || undefined),
            staffUserIds: staffIds,
            purpose,
            vehicleIds: selectedVRMs,
            notes,
        };

        const url = isEdit
            ? `/api/vehicles/${vehicleId}/appointments/${editAppt!._id}`
            : `/api/vehicles/${vehicleId}/appointments`;
        const method = isEdit ? 'PATCH' : 'POST';

        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.ok) {
            toast.success(isEdit ? 'Appointment updated' : 'Appointment added');
            onSaved();
        } else {
            toast.error(typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to save appointment');
        }
        setSaving(false);
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-[700px] flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <h2 className="text-[16px] font-semibold text-slate-800">{isEdit ? 'Edit Appointment' : 'Add Appointment'}</h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100">×</button>
                    </div>

                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                        {/* Type + Calendar */}
                        <div className="flex items-start gap-6">
                            <div className="flex-1">
                                <label className="text-[12px] font-semibold text-slate-600 block mb-2">Type</label>
                                <div className="flex gap-6">
                                    {(['appointment', 'reminder'] as const).map(t => (
                                        <label key={t} className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-700 capitalize">
                                            <input type="radio" checked={apptType === t} onChange={() => setApptType(t)} className="accent-[#4D7CFF]" />
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[12px] font-semibold text-slate-600">Calendar</label>
                                    <button onClick={onManageCalendars} className="flex items-center gap-1 text-[12px] text-[#4D7CFF] border border-[#4D7CFF] rounded-lg px-2.5 py-1 hover:bg-blue-50">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 2v4M8 2v4M3 10h18"/></svg>
                                        Manage Calendars
                                    </button>
                                </div>
                                <select value={calendarId} onChange={e => setCalendarId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                    {calendars.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Date Time Duration FollowUp */}
                        <div className="border border-slate-200 rounded-xl p-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="text-[12px] font-semibold text-slate-600 block mb-1.5">Date & Time</label>
                                    <div className="flex gap-2">
                                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                        <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-24 border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[12px] font-semibold text-slate-600 block mb-1.5">Duration</label>
                                    <div className="flex gap-1.5">
                                        <input type="number" min="1" value={durVal} onChange={e => setDurVal(e.target.value)} placeholder="" className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                        <select value={durUnit} onChange={e => setDurUnit(e.target.value as DurUnit)} className="flex-1 border border-slate-200 rounded-lg px-1 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                            {DURATION_UNITS.map(u => <option key={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[12px] font-semibold text-slate-600 block mb-1.5">Follow-Up Reminder After</label>
                                    <div className="flex gap-1.5">
                                        <input type="number" min="1" value={fupVal} onChange={e => setFupVal(e.target.value)} placeholder="" className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                        <select value={fupUnit} onChange={e => setFupUnit(e.target.value as FupUnit)} className="flex-1 border border-slate-200 rounded-lg px-1 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                            {FOLLOWUP_UNITS.map(u => <option key={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Customer + Staff */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Customer */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600">Customer</label>
                                    <button onClick={() => setShowNewContact(true)} className="flex items-center gap-1 text-[12px] text-[#4D7CFF] border border-[#4D7CFF] rounded-lg px-2.5 py-1 hover:bg-blue-50">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                                        New Contact
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        value={selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}${selectedCustomer.email ? `, ${selectedCustomer.email}` : ''}` : custQuery}
                                        onChange={e => { setCustQuery(e.target.value); setSelectedCustomer(null); searchCustomers(e.target.value); }}
                                        placeholder="Start typing to search…"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                    />
                                    {custResults.length > 0 && !selectedCustomer && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                            {custResults.map(c => (
                                                <button
                                                    key={c._id}
                                                    onClick={() => { setSelectedCustomer(c); setCustQuery(''); setCustResults([]); }}
                                                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 border-b border-slate-50 last:border-0"
                                                >
                                                    <span className="font-medium text-slate-800">{c.firstName} {c.lastName}</span>
                                                    {c.email && <span className="text-slate-400 ml-1.5">{c.email}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Staff */}
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 block mb-1.5">Staff/Users</label>
                                <select
                                    value=""
                                    onChange={e => { if (e.target.value) toggleStaff(e.target.value); }}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                >
                                    <option value="">Select staff…</option>
                                    {staff.map(s => (
                                        <option key={s._id} value={s._id}>
                                            {staffIds.includes(s._id) ? '✓ ' : ''}{s.name}
                                        </option>
                                    ))}
                                </select>
                                {staffIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {staffIds.map(sid => {
                                            const s = staff.find(u => u._id === sid);
                                            return s ? (
                                                <span key={sid} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-[12px] font-medium px-2.5 py-1 rounded-full">
                                                    {s.name}
                                                    <button onClick={() => toggleStaff(sid)} className="text-slate-400 hover:text-slate-600 leading-none">×</button>
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Purpose + Vehicles of Interest */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 block mb-1.5">Purpose</label>
                                <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Subject of the meeting…" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 block mb-1.5">Vehicles of Interest</label>
                                <div className="relative">
                                    <input
                                        value={vrmQuery}
                                        onChange={e => { setVrmQuery(e.target.value); searchVRMs(e.target.value); }}
                                        placeholder="Start typing to search…"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                    />
                                    {vrmResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                                            {vrmResults.map(v => (
                                                <button
                                                    key={v._id}
                                                    onClick={() => addVRM(v.vrm)}
                                                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 border-b border-slate-50 last:border-0"
                                                >
                                                    <span className="font-bold text-slate-800">{v.vrm}</span>
                                                    <span className="text-slate-400 ml-1.5">{v.make} {v.model}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {selectedVRMs.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {selectedVRMs.map(vrm => (
                                            <span key={vrm} className="flex items-center gap-1 bg-slate-600 text-white text-[12px] font-bold px-2.5 py-1 rounded">
                                                {vrm}
                                                <button onClick={() => removeVRM(vrm)} className="text-slate-300 hover:text-white leading-none ml-0.5">×</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="text-[12px] font-semibold text-slate-600 block mb-1.5">Notes</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={4}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                        <div className="flex gap-2">
                            <button
                                onClick={() => { if (vehicleVRM && !selectedVRMs.includes(vehicleVRM)) addVRM(vehicleVRM); }}
                                className="flex items-center gap-1.5 bg-slate-600 text-white text-[13px] font-semibold px-3 py-2 rounded-lg hover:bg-slate-700"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                                Vehicles
                            </button>
                            <button
                                onClick={() => { if (selectedCustomer) { setCustQuery(''); setSelectedCustomer(null); } }}
                                className="bg-slate-600 text-white text-[13px] font-semibold px-3 py-2 rounded-lg hover:bg-slate-700"
                            >
                                Contact
                            </button>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-4 py-2 text-[13px] text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                            <button onClick={submit} disabled={saving} className="px-5 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae8] disabled:opacity-60">
                                {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Appointment')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showNewContact && (
                <NewContactModal
                    onCreated={c => { setSelectedCustomer(c); setShowNewContact(false); }}
                    onClose={() => setShowNewContact(false)}
                />
            )}
        </>
    );
}

/* ─── Main Tab ───────────────────────────────────────────────────────────── */
export function VehicleAppointmentsTab({ vehicleId, vehicleVRM, vehicleStatus, branchName }: Props) {
    const [appts, setAppts] = useState<Appt[]>([]);
    const [loading, setLoading] = useState(true);
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editAppt, setEditAppt] = useState<Appt | null>(null);
    const [showManageCals, setShowManageCals] = useState(false);

    const loadCalendars = useCallback(async () => {
        const res = await fetch('/api/calendars');
        const d = await res.json();
        if (d.ok) setCalendars(d.calendars);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/appointments`);
            const d = await res.json();
            setAppts(d.ok ? d.appointments : []);
        } catch { setAppts([]); }
        finally { setLoading(false); }
    }, [vehicleId]);

    useEffect(() => { load(); loadCalendars(); }, [load, loadCalendars]);

    const toggleComplete = async (appt: Appt) => {
        const res = await fetch(`/api/vehicles/${vehicleId}/appointments/${appt._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !appt.completed }),
        });
        if ((await res.json()).ok) {
            setAppts(prev => prev.map(a => a._id === appt._id ? { ...a, completed: !a.completed } : a));
        }
    };

    const deleteAppt = async (appt: Appt) => {
        if (!confirm(`Delete this appointment?`)) return;
        const res = await fetch(`/api/vehicles/${vehicleId}/appointments/${appt._id}`, { method: 'DELETE' });
        if ((await res.json()).ok) {
            setAppts(prev => prev.filter(a => a._id !== appt._id));
            toast.success('Deleted');
        }
    };

    const groups = groupByDay(appts);

    return (
        <div className="space-y-4 w-full">
            {/* Header */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-6 py-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-bold text-slate-800">Appointments</h3>
                    <div className="flex items-center gap-2">
                        {branchName && (
                            <span className="flex items-center gap-1.5 border border-teal-400 text-teal-600 text-[12px] font-semibold px-3 py-1.5 rounded-lg">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                {branchName}
                            </span>
                        )}
                        {vehicleStatus && (
                            <span className="bg-[#4D7CFF] text-white text-[12px] font-bold px-4 py-1.5 rounded-lg">
                                {vehicleStatus}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Appointment list */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                {loading ? (
                    <div className="px-6 py-10 text-center text-[13px] text-slate-400">Loading…</div>
                ) : groups.length === 0 ? (
                    <div className="px-6 py-10 text-center text-[13px] text-slate-400">No appointments yet.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {groups.map(group => (
                            <div key={group.label}>
                                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100">
                                    <span className="text-[12px] font-bold text-slate-600">{group.label}</span>
                                </div>
                                {group.items.map(appt => (
                                    <div key={appt._id} className={`flex items-center px-5 py-3.5 hover:bg-slate-50 transition-colors gap-4 ${appt.completed ? 'opacity-50' : ''}`}>
                                        {/* Time */}
                                        <div className="flex items-center gap-2 w-24 flex-shrink-0">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 2v4M8 2v4M3 10h18"/></svg>
                                            <span className="text-[13px] text-slate-500 italic">{fmtTime(appt.startTime)}</span>
                                        </div>
                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[14px] font-bold text-slate-800 ${appt.completed ? 'line-through' : ''}`}>
                                                {appt.purpose || (appt.apptType === 'reminder' ? 'Reminder' : 'Appointment')}
                                            </p>
                                            {appt.customerName && (
                                                <p className="text-[13px] text-slate-500 italic mt-0.5">{appt.customerName}</p>
                                            )}
                                        </div>
                                        {/* Actions */}
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => toggleComplete(appt)}
                                                title={appt.completed ? 'Mark incomplete' : 'Mark complete'}
                                                className={`w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 ${appt.completed ? 'text-green-500' : 'text-slate-300 hover:text-green-500'}`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                                            </button>
                                            <button
                                                onClick={() => { setEditAppt(appt); setShowModal(true); }}
                                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                                                title="Edit"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                            </button>
                                            <button
                                                onClick={() => deleteAppt(appt)}
                                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-red-500"
                                                title="Delete"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* Add Appointment button */}
                <div className="px-5 py-4 border-t border-slate-100">
                    <button
                        onClick={() => { setEditAppt(null); setShowModal(true); }}
                        className="bg-[#4D7CFF] text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-[#3a6ae8] flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                        Add Appointment
                    </button>
                </div>
            </div>

            {showModal && (
                <AppointmentModal
                    vehicleId={vehicleId}
                    vehicleVRM={vehicleVRM}
                    calendars={calendars}
                    editAppt={editAppt}
                    onSaved={() => { setShowModal(false); setEditAppt(null); load(); }}
                    onClose={() => { setShowModal(false); setEditAppt(null); }}
                    onManageCalendars={() => setShowManageCals(true)}
                />
            )}

            {showManageCals && (
                <ManageCalendarsModal
                    calendars={calendars}
                    onClose={() => setShowManageCals(false)}
                    onRefresh={loadCalendars}
                />
            )}
        </div>
    );
}
