'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type CalView = 'month' | 'week' | 'day';

interface Appointment {
    _id: string;
    title: string;
    purpose?: string;
    startTime: string;
    endTime: string;
    customerName?: string;
    notes?: string;
    apptType?: 'appointment' | 'reminder';
    calendarName?: string;
    durationMinutes?: number;
    followUpAfterMinutes?: number;
}

interface VehicleResult {
    _id: string;
    make: string;
    model: string;
    derivative?: string;
    vrm: string;
}

// ── London timezone helpers ────────────────────────────────────────────────────
function lastSundayUTC(year: number, month: number): number {
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const dow = lastDay.getUTCDay();
    lastDay.setUTCDate(lastDay.getUTCDate() - dow);
    lastDay.setUTCHours(1, 0, 0, 0);
    return lastDay.getTime();
}

function londonOffsetHours(date: Date): 0 | 1 {
    const year = date.getUTCFullYear();
    const bstStart = lastSundayUTC(year, 2);
    const bstEnd = lastSundayUTC(year, 9);
    return (date.getTime() >= bstStart && date.getTime() < bstEnd) ? 1 : 0;
}

function londonTZLabel(date: Date): string {
    return londonOffsetHours(date) === 1 ? 'BST' : 'GMT';
}

function getLondonHourMinute(date: Date): { hour: number; minute: number } {
    const shifted = new Date(date.getTime() + londonOffsetHours(date) * 3_600_000);
    return { hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}

function londonDateKey(date: Date): string {
    const shifted = new Date(date.getTime() + londonOffsetHours(date) * 3_600_000);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function isLondonToday(date: Date): boolean {
    return londonDateKey(date) === londonDateKey(new Date());
}

function londonLocalToUTC(dateStr: string, hour: number, minute = 0): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const provisional = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
    const offset = londonOffsetHours(provisional);
    return new Date(provisional.getTime() - offset * 3_600_000);
}

function londonMidnightUTC(dateKey: string, endOfDay = false): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    const provisional = new Date(Date.UTC(year, month - 1, day,
        endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
    const offset = londonOffsetHours(provisional);
    return new Date(provisional.getTime() - offset * 3_600_000);
}

function getLondonWeekDays(anchorDate: Date): Date[] {
    const key = londonDateKey(anchorDate);
    const [year, month, day] = key.split('-').map(Number);
    const provisional = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    const dow = provisional.getUTCDay();
    return Array.from({ length: 7 }, (_, i) =>
        new Date(Date.UTC(year, month - 1, day - dow + i, 12, 0, 0, 0))
    );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 23 }, (_, i) => i + 1);

function fmtHour(h: number) {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
}

function fmtApptTime(date: Date): string {
    const { hour, minute } = getLondonHourMinute(date);
    const h = hour % 12 || 12;
    const ampm = hour >= 12 ? 'p' : 'a';
    const m = minute > 0 ? `:${String(minute).padStart(2, '0')}` : '';
    return `${h}${m}${ampm}`;
}

const BLANK_FORM = {
    apptType: 'appointment' as 'appointment' | 'reminder',
    calendarName: 'Primary Calendar',
    day: '',
    time: '12:00',
    durationAmount: '',
    durationUnit: 'Minutes',
    followUpAmount: '',
    followUpUnit: 'Days',
    customerName: '',
    staffName: '',
    purpose: '',
    vehicleSearch: '',
    notes: '',
};

export function DashboardCalendar() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<CalView>('month');
    const [showModal, setShowModal] = useState(false);
    const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
    const [form, setForm] = useState({ ...BLANK_FORM });
    const [mounted, setMounted] = useState(false);
    const [nowTime, setNowTime] = useState(new Date());

    // Vehicle search
    const [vehicleResults, setVehicleResults] = useState<VehicleResult[]>([]);
    const [selectedVehicles, setSelectedVehicles] = useState<VehicleResult[]>([]);
    const [vehicleSearchLoading, setVehicleSearchLoading] = useState(false);
    const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
    const vehicleSearchRef = useRef<HTMLDivElement>(null);
    const vehicleSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => {
        const id = setInterval(() => setNowTime(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    // Close vehicle dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (vehicleSearchRef.current && !vehicleSearchRef.current.contains(e.target as Node)) {
                setShowVehicleDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    function searchVehicles(q: string) {
        if (vehicleSearchTimer.current) clearTimeout(vehicleSearchTimer.current);
        if (!q.trim()) { setVehicleResults([]); setShowVehicleDropdown(false); return; }
        vehicleSearchTimer.current = setTimeout(async () => {
            setVehicleSearchLoading(true);
            try {
                const r = await fetch(`/api/vehicles?search=${encodeURIComponent(q)}&status=In+Stock`);
                const d = await r.json();
                const vehicles: VehicleResult[] = (d.vehicles || [])
                    .slice(0, 8)
                    .map((v: any) => ({
                        _id: String(v._id),
                        make: v.make || '',
                        model: v.model || '',
                        derivative: v.derivative,
                        vrm: v.vrm || '',
                    }));
                setVehicleResults(vehicles);
                setShowVehicleDropdown(true);
            } catch { /* ignore */ }
            setVehicleSearchLoading(false);
        }, 300);
    }

    function addVehicle(v: VehicleResult) {
        if (!selectedVehicles.find(s => s._id === v._id)) {
            setSelectedVehicles(prev => [...prev, v]);
        }
        setForm(f => ({ ...f, vehicleSearch: '' }));
        setVehicleResults([]);
        setShowVehicleDropdown(false);
    }

    function removeVehicle(id: string) {
        setSelectedVehicles(prev => prev.filter(v => v._id !== id));
    }

    const weekDays = getLondonWeekDays(currentDate);

    function getFetchRange() {
        if (view === 'day') {
            const key = londonDateKey(currentDate);
            return { start: londonMidnightUTC(key, false), end: londonMidnightUTC(key, true) };
        }
        if (view === 'month') {
            const key = londonDateKey(currentDate);
            const [year, month] = key.split('-').map(Number);
            const firstKey = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
            const lastKey = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            return { start: londonMidnightUTC(firstKey, false), end: londonMidnightUTC(lastKey, true) };
        }
        return {
            start: londonMidnightUTC(londonDateKey(weekDays[0]), false),
            end: londonMidnightUTC(londonDateKey(weekDays[6]), true),
        };
    }

    async function fetchAppointments() {
        const { start, end } = getFetchRange();
        try {
            const r = await fetch(`/api/appointments?start=${start.toISOString()}&end=${end.toISOString()}`);
            const d = await r.json();
            if (d.ok) setAppointments(d.appointments);
        } catch { /* ignore */ }
    }

    useEffect(() => { fetchAppointments(); }, [currentDate, view]);

    function navigate(dir: 1 | -1) {
        const key = londonDateKey(currentDate);
        const [year, month, day] = key.split('-').map(Number);
        let newKey: string;
        if (view === 'day') {
            const d = new Date(Date.UTC(year, month - 1, day + dir, 12));
            newKey = londonDateKey(d);
        } else if (view === 'week') {
            const d = new Date(Date.UTC(year, month - 1, day + dir * 7, 12));
            newKey = londonDateKey(d);
        } else {
            const d = new Date(Date.UTC(year, month - 1 + dir, day, 12));
            newKey = londonDateKey(d);
        }
        const [ny, nm, nd] = newKey.split('-').map(Number);
        setCurrentDate(new Date(Date.UTC(ny, nm - 1, nd, 12)));
    }

    function goToday() {
        const key = londonDateKey(new Date());
        const [y, m, d] = key.split('-').map(Number);
        setCurrentDate(new Date(Date.UTC(y, m - 1, d, 12)));
    }

    function headerTitle() {
        if (view === 'day') {
            const key = londonDateKey(currentDate);
            const [y, m, d] = key.split('-').map(Number);
            return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleString('default', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
        if (view === 'week') {
            const s = weekDays[0]; const e = weekDays[6];
            const sk = londonDateKey(s); const ek = londonDateKey(e);
            const [sy, sm, sd] = sk.split('-').map(Number);
            const [, em, ed] = ek.split('-').map(Number);
            if (sm === em) {
                const mn = new Date(Date.UTC(sy, sm - 1, 1)).toLocaleString('default', { month: 'long' });
                return `${sd} – ${ed} ${mn} ${sy}`;
            }
            return `${new Date(Date.UTC(sy, sm - 1, sd)).toLocaleString('default', { day: 'numeric', month: 'short' })} – ${new Date(Date.UTC(sy, em - 1, ed)).toLocaleString('default', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
        const key = londonDateKey(currentDate);
        const [y, m] = key.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    function getApptsForDay(day: Date) {
        const dayKey = londonDateKey(day);
        return appointments.filter(a => londonDateKey(new Date(a.startTime)) === dayKey);
    }

    function getApptsForSlot(day: Date, hour: number) {
        const dayKey = londonDateKey(day);
        return appointments.filter(a => {
            const ad = new Date(a.startTime);
            return londonDateKey(ad) === dayKey && getLondonHourMinute(ad).hour === hour;
        });
    }

    function openCreate(day?: Date, hour?: number) {
        setEditingAppt(null);
        setSelectedVehicles([]);
        const dayKey = day ? londonDateKey(day) : londonDateKey(currentDate);
        const h = hour ?? 12;
        const m = h.toString().padStart(2, '0');
        setForm({ ...BLANK_FORM, day: dayKey, time: `${m}:00` });
        setShowModal(true);
    }

    function openEdit(a: Appointment) {
        setEditingAppt(a);
        setSelectedVehicles([]);
        const ad = new Date(a.startTime);
        const { hour } = getLondonHourMinute(ad);
        setForm({
            apptType: a.apptType || 'appointment',
            calendarName: a.calendarName || 'Primary Calendar',
            day: londonDateKey(ad),
            time: `${hour.toString().padStart(2, '0')}:00`,
            durationAmount: a.durationMinutes ? String(a.durationMinutes) : '',
            durationUnit: 'Minutes',
            followUpAmount: a.followUpAfterMinutes ? String(Math.round(a.followUpAfterMinutes / 1440)) : '',
            followUpUnit: 'Days',
            customerName: a.customerName || '',
            staffName: '',
            purpose: a.purpose || a.title || '',
            vehicleSearch: '',
            notes: a.notes || '',
        });
        setShowModal(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const [h, min] = form.time.split(':').map(Number);
        const startUTC = londonLocalToUTC(form.day, h, min);
        const durMin = form.durationAmount ? parseInt(form.durationAmount) : 60;
        const endUTC = new Date(startUTC.getTime() + durMin * 60_000);
        const followUpMinutes = form.followUpAmount
            ? parseInt(form.followUpAmount) * (form.followUpUnit === 'Days' ? 1440 : 60)
            : undefined;

        const payload: any = {
            title: form.purpose || 'Appointment',
            purpose: form.purpose,
            startTime: startUTC.toISOString(),
            endTime: endUTC.toISOString(),
            apptType: form.apptType,
            calendarName: form.calendarName,
            customerName: form.customerName || undefined,
            notes: form.notes || undefined,
            durationMinutes: durMin,
            followUpAfterMinutes: followUpMinutes,
            vehicleIds: selectedVehicles.map(v => v._id),
        };

        if (editingAppt) payload.id = editingAppt._id;

        const res = await fetch('/api/appointments', {
            method: editingAppt ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
            setShowModal(false);
            setEditingAppt(null);
            fetchAppointments();
        } else {
            alert(data.error || 'Failed to save');
        }
    }

    async function handleDelete() {
        if (!editingAppt || !confirm('Delete this appointment?')) return;
        const res = await fetch(`/api/appointments?id=${editingAppt._id}`, { method: 'DELETE' });
        if (res.ok) { setShowModal(false); setEditingAppt(null); fetchAppointments(); }
    }

    if (!mounted) {
        return (
            <div className="flex h-[600px] bg-white border border-slate-200 rounded-xl items-center justify-center">
                <div className="w-8 h-8 border-4 border-slate-100 border-t-[#4D7CFF] rounded-full animate-spin" />
            </div>
        );
    }

    const tzLabel = londonTZLabel(new Date());

    // ── Month grid ──────────────────────────────────────────────────────────────
    function MonthView() {
        const key = londonDateKey(currentDate);
        const [year, month] = key.split('-').map(Number);
        const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
        const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const cells: (number | null)[] = [
            ...Array(firstDay).fill(null),
            ...Array.from({ length: totalDays }, (_, i) => i + 1),
        ];
        while (cells.length % 7 !== 0) cells.push(null);

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(n => (
                        <div key={n} className="text-center text-[11px] font-bold text-slate-500 py-2">{n}</div>
                    ))}
                </div>
                {/* Grid */}
                <div className="flex-1 overflow-auto">
                    <div className="grid grid-cols-7 border-l border-slate-200">
                        {cells.map((day, i) => {
                            if (day === null) return (
                                <div key={`e${i}`} className="min-h-[100px] border-r border-b border-slate-200 bg-slate-50/30" />
                            );
                            const cellDate = new Date(Date.UTC(year, month - 1, day, 12));
                            const isToday = isLondonToday(cellDate);
                            const dayAppts = getApptsForDay(cellDate);
                            return (
                                <div
                                    key={day}
                                    className={`min-h-[100px] border-r border-b border-slate-200 p-1.5 cursor-pointer hover:bg-blue-50/30 transition-colors ${isToday ? 'bg-amber-50/30' : ''}`}
                                    onClick={() => openCreate(cellDate)}
                                >
                                    <div className="flex justify-start mb-1">
                                        <span className={`text-[12px] font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#4D7CFF] text-white font-bold' : 'text-slate-600'}`}>
                                            {day}
                                        </span>
                                    </div>
                                    <div className="space-y-0.5">
                                        {dayAppts.slice(0, 3).map(a => (
                                            <div
                                                key={a._id}
                                                className="flex items-center gap-1 text-[11px] text-slate-700 hover:text-[#4D7CFF] cursor-pointer truncate"
                                                onClick={ev => { ev.stopPropagation(); openEdit(a); }}
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#4D7CFF] shrink-0" />
                                                <span className="truncate">
                                                    {fmtApptTime(new Date(a.startTime))} {a.purpose || a.title}
                                                </span>
                                            </div>
                                        ))}
                                        {dayAppts.length > 3 && (
                                            <div className="text-[10px] text-slate-400 pl-3">+{dayAppts.length - 3} more</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // ── Week / Day time grid ────────────────────────────────────────────────────
    function TimeGrid({ days }: { days: Date[] }) {
        const { hour: nowHour, minute: nowMinute } = getLondonHourMinute(nowTime);
        const HOUR_PX = 56;
        const nowTopPx = (nowHour - 1) * HOUR_PX + (nowMinute / 60) * HOUR_PX;
        const showRedLine = nowHour >= 1 && nowHour <= 23;

        return (
            <div className="flex-1 overflow-auto">
                <div className={`grid min-w-[400px]`} style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
                    {/* Time col */}
                    <div className="border-r border-slate-200 pt-3">
                        {HOURS.map(h => (
                            <div key={h} className="relative" style={{ height: HOUR_PX }}>
                                <span className="absolute -top-[9px] right-2 text-[9px] font-semibold text-slate-400 whitespace-nowrap">
                                    {fmtHour(h)}
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Day cols */}
                    {days.map((day, di) => {
                        const isTodayCol = isLondonToday(day);
                        return (
                            <div key={di} className="relative border-r border-slate-200 last:border-r-0 pt-3">
                                {isTodayCol && showRedLine && (
                                    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${nowTopPx + 12}px` }}>
                                        <div className="flex items-center">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-[5px]" />
                                            <div className="flex-1 h-[2px] bg-red-500" />
                                        </div>
                                    </div>
                                )}
                                {HOURS.map(h => {
                                    const slotAppts = getApptsForSlot(day, h);
                                    return (
                                        <div
                                            key={h}
                                            className="border-b border-slate-100 p-0.5 cursor-pointer hover:bg-blue-50/40"
                                            style={{ height: HOUR_PX }}
                                            onClick={() => openCreate(day, h)}
                                        >
                                            {slotAppts.map(a => (
                                                <div
                                                    key={a._id}
                                                    className="bg-[#4D7CFF] rounded px-1.5 py-1 text-white text-[10px] font-semibold truncate cursor-pointer hover:bg-blue-600 absolute inset-x-0.5 z-10 mx-0.5"
                                                    style={{ top: 2, height: HOUR_PX - 4 }}
                                                    onClick={ev => { ev.stopPropagation(); openEdit(a); }}
                                                >
                                                    {fmtApptTime(new Date(a.startTime))} {a.purpose || a.title}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    function WeekView() {
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Day headers */}
                <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                    <div className="border-r border-slate-200 h-14 flex items-end justify-center pb-2 text-[9px] text-slate-400 font-bold">{tzLabel}</div>
                    {weekDays.map((date, i) => (
                        <div key={i} className="flex flex-col items-center justify-center h-14 border-r border-slate-200 last:border-r-0">
                            <span className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isLondonToday(date) ? 'text-[#4D7CFF]' : 'text-slate-500'}`}>
                                {DAY_NAMES[i]}
                            </span>
                            <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full font-semibold ${isLondonToday(date) ? 'bg-[#4D7CFF] text-white' : 'text-slate-700'}`}>
                                {parseInt(londonDateKey(date).split('-')[2], 10)}
                            </span>
                        </div>
                    ))}
                </div>
                <TimeGrid days={weekDays} />
            </div>
        );
    }

    function DayView() {
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: '56px 1fr' }}>
                    <div className="border-r border-slate-200 h-14 flex items-end justify-center pb-2 text-[9px] text-slate-400 font-bold">{tzLabel}</div>
                    <div className="flex flex-col items-center justify-center h-14">
                        <span className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isLondonToday(currentDate) ? 'text-[#4D7CFF]' : 'text-slate-500'}`}>
                            {DAY_NAMES[new Date(Date.UTC(...(londonDateKey(currentDate).split('-').map(Number) as [number, number, number]))).getUTCDay()]}
                        </span>
                        <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full font-semibold ${isLondonToday(currentDate) ? 'bg-[#4D7CFF] text-white' : 'text-slate-700'}`}>
                            {parseInt(londonDateKey(currentDate).split('-')[2], 10)}
                        </span>
                    </div>
                </div>
                <TimeGrid days={[currentDate]} />
            </div>
        );
    }

    const viewTabs: { key: CalView; label: string }[] = [
        { key: 'month', label: 'Month' },
        { key: 'week', label: 'Week' },
        { key: 'day', label: 'Day' },
    ];

    return (
        <>
            {/* ── Calendar Card ──────────────────────────────────────────────────── */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm flex flex-col overflow-hidden" style={{ minHeight: 560 }}>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 gap-2 flex-wrap">
                    {/* Left: Add Appointment + title + nav */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => openCreate()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4D7CFF] text-white text-[12px] font-bold rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Appointment
                        </button>
                        <h2 className="text-[14px] font-bold text-slate-800 min-w-[140px]">{headerTitle()}</h2>
                        <div className="flex items-center gap-0.5">
                            <button onClick={() => navigate(-1)} className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded text-slate-500 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <button onClick={() => navigate(1)} className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 rounded text-slate-500 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Right: view tabs + today */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                            {viewTabs.map(t => (
                                <button key={t.key} onClick={() => setView(t.key)}
                                    className={`px-3 py-1.5 text-[11px] font-bold transition-all border-r border-slate-200 last:border-r-0 ${
                                        view === t.key ? 'bg-[#4D7CFF] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={goToday}
                            className="px-3 py-1.5 text-[11px] font-bold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                            Today
                        </button>
                    </div>
                </div>

                {/* Calendar body */}
                {view === 'month' && <MonthView />}
                {view === 'week' && <WeekView />}
                {view === 'day' && <DayView />}

            </div>

            {/* ── Modal ─────────────────────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl my-4 mx-auto">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <h3 className="text-[16px] font-bold text-slate-800">
                                {editingAppt ? 'Edit Appointment' : 'Add Appointment'}
                            </h3>
                            <button onClick={() => { setShowModal(false); setEditingAppt(null); }}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                            {/* Row 1: Type + Calendar */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-2">Type</label>
                                    <div className="flex items-center gap-4">
                                        {(['appointment', 'reminder'] as const).map(t => (
                                            <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="apptType"
                                                    value={t}
                                                    checked={form.apptType === t}
                                                    onChange={() => setForm(f => ({ ...f, apptType: t }))}
                                                    className="accent-[#4D7CFF]"
                                                />
                                                <span className="text-[13px] text-slate-700 capitalize">{t}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[11px] font-bold text-slate-600">Calendar</label>
                                    </div>
                                    <select
                                        value={form.calendarName}
                                        onChange={e => setForm(f => ({ ...f, calendarName: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                    >
                                        <option>Primary Calendar</option>
                                    </select>
                                </div>
                            </div>

                            {/* Row 2: Date & Time + Duration + Follow-Up */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-2">Date &amp; Time</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            required
                                            value={form.day}
                                            onChange={e => setForm(f => ({ ...f, day: e.target.value }))}
                                            className="flex-1 min-w-0 px-2 py-2 border border-slate-200 rounded-lg text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                        />
                                        <input
                                            type="time"
                                            value={form.time}
                                            onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                                            className="w-20 px-2 py-2 border border-slate-200 rounded-lg text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-2">Duration</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder=""
                                            value={form.durationAmount}
                                            onChange={e => setForm(f => ({ ...f, durationAmount: e.target.value }))}
                                            className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                        />
                                        <select
                                            value={form.durationUnit}
                                            onChange={e => setForm(f => ({ ...f, durationUnit: e.target.value }))}
                                            className="flex-1 px-2 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                        >
                                            <option>Minutes</option>
                                            <option>Hours</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-2">Follow-Up Reminder After</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder=""
                                            value={form.followUpAmount}
                                            onChange={e => setForm(f => ({ ...f, followUpAmount: e.target.value }))}
                                            className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                        />
                                        <select
                                            value={form.followUpUnit}
                                            onChange={e => setForm(f => ({ ...f, followUpUnit: e.target.value }))}
                                            className="flex-1 px-2 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                        >
                                            <option>Days</option>
                                            <option>Hours</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Row 3: Customer + Staff */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-2">Customer</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Start typing to search..."
                                            value={form.customerName}
                                            onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                                            className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                        />
                                        <button type="button" className="px-2.5 py-2 border border-slate-200 rounded-lg text-[11px] font-semibold text-[#4D7CFF] hover:bg-blue-50 whitespace-nowrap transition-colors flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            New Contact
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-2">Staff/Users</label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                    >
                                        <option>Arslan Ahmed</option>
                                    </select>
                                </div>
                            </div>

                            {/* Row 4: Purpose */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-2">Purpose</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Test Drive, Viewing, Collection..."
                                    value={form.purpose}
                                    onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                />
                            </div>

                            {/* Row 5: Vehicles of Interest */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-2">Vehicles of Interest</label>
                                <div ref={vehicleSearchRef} className="relative">
                                    {/* Selected vehicle tags */}
                                    {selectedVehicles.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {selectedVehicles.map(v => (
                                                <span key={v._id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-700 rounded-full">
                                                    {v.vrm} — {v.make} {v.model}
                                                    <button type="button" onClick={() => removeVehicle(v._id)}
                                                        className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-blue-200 transition-colors">
                                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {/* Search input */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Start typing to search..."
                                            value={form.vehicleSearch}
                                            onChange={e => {
                                                setForm(f => ({ ...f, vehicleSearch: e.target.value }));
                                                searchVehicles(e.target.value);
                                            }}
                                            onFocus={() => { if (vehicleResults.length > 0) setShowVehicleDropdown(true); }}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF]"
                                        />
                                        {vehicleSearchLoading && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-[#4D7CFF] rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    {/* Dropdown results */}
                                    {showVehicleDropdown && vehicleResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
                                            {vehicleResults.map(v => (
                                                <button
                                                    key={v._id}
                                                    type="button"
                                                    onClick={() => addVehicle(v)}
                                                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0"
                                                >
                                                    <span className="text-[12px] font-bold text-slate-800">{v.vrm}</span>
                                                    <span className="text-[12px] text-slate-500 ml-2">{v.make} {v.model}{v.derivative ? ` ${v.derivative}` : ''}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {showVehicleDropdown && !vehicleSearchLoading && vehicleResults.length === 0 && form.vehicleSearch.trim() && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 px-3 py-2.5">
                                            <span className="text-[12px] text-slate-400">No in-stock vehicles found</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Row 6: Notes */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-2">Notes</label>
                                <textarea
                                    rows={3}
                                    value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]/20 focus:border-[#4D7CFF] resize-none"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center justify-between pt-1">
                                {editingAppt ? (
                                    <button type="button" onClick={handleDelete}
                                        className="text-[12px] font-semibold text-red-500 hover:text-red-600 transition-colors">
                                        Delete Appointment
                                    </button>
                                ) : <div />}
                                <button type="submit"
                                    className="px-6 py-2.5 bg-[#4D7CFF] text-white text-[13px] font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-sm">
                                    {editingAppt ? 'Save Changes' : 'Add Appointment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
