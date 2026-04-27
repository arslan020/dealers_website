'use client';

import { useState, useEffect } from 'react';

type CalView = 'week' | 'day' | 'month';

interface Appointment {
    _id: string;
    title: string;
    startTime: string;
    endTime: string;
    customerName?: string;
}

// ── London time helpers (manual UTC arithmetic — bypasses Intl/OS bugs) ──────────
//
// Europe/London is GMT (UTC+0) in winter and BST (UTC+1) in summer.
// Clocks go FORWARD on the last Sunday of March at 01:00 UTC.
// Clocks go BACK    on the last Sunday of October at 01:00 UTC.
// We compute this purely from UTC so it works regardless of Intl, OS, or
// browser timezone settings.

/** Unix-ms of the last Sunday of `month` (0-based) at 01:00 UTC for `year` */
function lastSundayUTC(year: number, month: number): number {
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const dow = lastDay.getUTCDay();
    lastDay.setUTCDate(lastDay.getUTCDate() - dow);
    lastDay.setUTCHours(1, 0, 0, 0);
    return lastDay.getTime();
}

/** Returns 1 during BST (summer), 0 during GMT (winter) */
function londonOffsetHours(date: Date): 0 | 1 {
    const year = date.getUTCFullYear();
    const bstStart = lastSundayUTC(year, 2);  // last Sunday of March
    const bstEnd = lastSundayUTC(year, 9);  // last Sunday of October
    return (date.getTime() >= bstStart && date.getTime() < bstEnd) ? 1 : 0;
}

/** FIX #4: Returns "GMT" or "BST" depending on the current offset */
function londonTZLabel(date: Date): string {
    return londonOffsetHours(date) === 1 ? 'BST' : 'GMT';
}

/** Hour (0-23) and minute (0-59) in Europe/London time */
function getLondonHourMinute(date: Date): { hour: number; minute: number } {
    const shifted = new Date(date.getTime() + londonOffsetHours(date) * 3_600_000);
    return { hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}

/** Returns "YYYY-MM-DD" string for the date in Europe/London time */
function londonDateKey(date: Date): string {
    const shifted = new Date(date.getTime() + londonOffsetHours(date) * 3_600_000);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** true if the given Date falls on today in Europe/London time */
function isLondonToday(date: Date): boolean {
    return londonDateKey(date) === londonDateKey(new Date());
}

/**
 * FIX #5: Convert a London-local date string "YYYY-MM-DD" + hour (0-23) into a UTC Date.
 * This is the inverse of londonDateKey — given what the user typed (London date + hour),
 * produce the correct UTC instant to store.
 */
function londonLocalToUTC(dateStr: string, hour: number): Date {
    // Build a UTC instant as if it were London local time, then subtract the offset.
    const [year, month, day] = dateStr.split('-').map(Number);
    // First, assume UTC = London (offset 0) to calculate offset for that instant.
    const provisional = new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0));
    // Now compute the actual London offset at that provisional UTC time.
    const offset = londonOffsetHours(provisional);
    // Subtract offset to get true UTC.
    return new Date(provisional.getTime() - offset * 3_600_000);
}

/**
 * FIX #3 & #2: Build a UTC Date representing London midnight for a given London date key.
 * Used to anchor week/day/range calculations correctly.
 */
function londonMidnightUTC(dateKey: string, endOfDay = false): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    const provisional = new Date(Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
    const offset = londonOffsetHours(provisional);
    return new Date(provisional.getTime() - offset * 3_600_000);
}

/**
 * FIX #3: Build the 7 week-day Date objects anchored to London date arithmetic,
 * so that "start of week" is always correct regardless of browser timezone.
 */
function getLondonWeekDays(anchorDate: Date): Date[] {
    // Get the London date key for the anchor
    const key = londonDateKey(anchorDate);
    const [year, month, day] = key.split('-').map(Number);
    // What day of week is this in London?
    // We create a Date in London midnight UTC and read its UTC day-of-week
    const provisional = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)); // noon to avoid DST edge
    const dow = provisional.getUTCDay(); // 0=Sun
    // Build the 7 days starting from Sunday
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.UTC(year, month - 1, day - dow + i, 12, 0, 0, 0));
        return d;
    });
}

export function DashboardCalendar() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<CalView>('week');
    const [showModal, setShowModal] = useState(false);
    const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
    const [newAppt, setNewAppt] = useState({ title: '', customerName: '', day: '', time: '10:00' });
    const [mounted, setMounted] = useState(false);
    const [nowTime, setNowTime] = useState(new Date());

    useEffect(() => {
        setMounted(true);
    }, []);

    // Tick every minute so the red time-indicator moves in real time
    useEffect(() => {
        const id = setInterval(() => setNowTime(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    // Mini calendar month state — must be here (before any early return) to satisfy Rules of Hooks
    const [showMiniCal, setShowMiniCal] = useState(false);
    const [miniYear, setMiniYear] = useState(() => {
        const key = londonDateKey(new Date());
        return parseInt(key.split('-')[0], 10);
    });
    const [miniMonth, setMiniMonth] = useState(() => {
        const key = londonDateKey(new Date());
        return parseInt(key.split('-')[1], 10) - 1; // 0-based
    });

    // Sync mini calendar when currentDate changes (Today button, main nav, mini day click)
    useEffect(() => {
        const key = londonDateKey(currentDate);
        const [y, m] = key.split('-').map(Number);
        setMiniYear(y);
        setMiniMonth(m - 1);
    }, [currentDate]);


    // Hours 1 AM – 11 PM only (no midnight, no extra boxes after 11 PM)
    const hours = Array.from({ length: 23 }, (_, i) => i + 1);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // FIX #3: Use London-aware week days instead of local date arithmetic
    const weekDays = getLondonWeekDays(currentDate);

    // ── Fetch range based on view ──────────────────────────────────────────────
    // FIX #2: Use London midnight UTC for fetch ranges
    function getFetchRange() {
        if (view === 'day') {
            const key = londonDateKey(currentDate);
            return {
                start: londonMidnightUTC(key, false),
                end: londonMidnightUTC(key, true),
            };
        }
        if (view === 'month') {
            const londonKey = londonDateKey(currentDate);
            const [year, month] = londonKey.split('-').map(Number);
            const firstDayKey = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
            const lastDayKey = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            return {
                start: londonMidnightUTC(firstDayKey, false),
                end: londonMidnightUTC(lastDayKey, true),
            };
        }
        // week
        return {
            start: londonMidnightUTC(londonDateKey(weekDays[0]), false),
            end: londonMidnightUTC(londonDateKey(weekDays[6]), true),
        };
    }

    async function fetchAppointments() {
        const { start, end } = getFetchRange();
        try {
            const res = await fetch(`/api/appointments?start=${start.toISOString()}&end=${end.toISOString()}`);
            const data = await res.json();
            if (data.ok) setAppointments(data.appointments);
        } catch (err) {
            console.error('[Calendar] Failed to fetch', err);
        }
    }

    useEffect(() => { fetchAppointments(); }, [currentDate, view]);

    // ── Navigate forward / backward ───────────────────────────────────────────
    function navigate(dir: 1 | -1) {
        const key = londonDateKey(currentDate);
        const [year, month, day] = key.split('-').map(Number);

        let newKey: string;
        if (view === 'day') {
            const d = new Date(Date.UTC(year, month - 1, day + dir, 12, 0, 0, 0));
            newKey = londonDateKey(d);
        } else if (view === 'week') {
            const d = new Date(Date.UTC(year, month - 1, day + dir * 7, 12, 0, 0, 0));
            newKey = londonDateKey(d);
        } else {
            // month: move to same day in next/prev month
            const d = new Date(Date.UTC(year, month - 1 + dir, day, 12, 0, 0, 0));
            newKey = londonDateKey(d);
        }
        const [ny, nm, nd] = newKey.split('-').map(Number);
        setCurrentDate(new Date(Date.UTC(ny, nm - 1, nd, 12, 0, 0, 0)));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    // FIX #1: Use London date key and London hour for slot matching
    function getApptsForSlot(day: Date, hour: number) {
        const dayKey = londonDateKey(day);
        return appointments.filter(a => {
            const aDate = new Date(a.startTime);
            const { hour: aHour } = getLondonHourMinute(aDate);
            return londonDateKey(aDate) === dayKey && aHour === hour;
        });
    }

    // FIX #1: Use London date key for day matching
    function getApptsForDay(day: Date) {
        const dayKey = londonDateKey(day);
        return appointments.filter(a => {
            const aDate = new Date(a.startTime);
            return londonDateKey(aDate) === dayKey;
        });
    }

    function fmtHour(h: number) {
        if (h === 0) return '12 AM';
        if (h < 12) return `${h} AM`;
        if (h === 12) return '12 PM';
        return `${h - 12} PM`;
    }

    // ── Add / Edit / Delete ───────────────────────────────────────────────────
    async function handleAddAppointment(e: React.FormEvent) {
        e.preventDefault();
        try {
            const [h] = newAppt.time.split(':').map(Number);

            // FIX #5: Convert London-local input to UTC before saving
            const startUTC = londonLocalToUTC(newAppt.day, h);
            const endUTC = londonLocalToUTC(newAppt.day, h + 1);

            const isEditing = !!editingAppt;
            const res = await fetch('/api/appointments', {
                method: isEditing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingAppt?._id,
                    title: newAppt.title,
                    customerName: newAppt.customerName,
                    startTime: startUTC.toISOString(),
                    endTime: endUTC.toISOString(),
                }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                setShowModal(false);
                setEditingAppt(null);
                setNewAppt({ title: '', customerName: '', day: '', time: '10:00' });
                fetchAppointments();
            } else {
                alert(`Error: ${data.error || 'Failed to save'}`);
            }
        } catch (err) {
            console.error('[Calendar] Error in handleAdd:', err);
        }
    }

    async function handleDeleteAppointment() {
        if (!editingAppt) return;
        if (!confirm('Delete this appointment?')) return;
        try {
            const res = await fetch(`/api/appointments?id=${editingAppt._id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.ok) {
                setShowModal(false);
                setEditingAppt(null);
                setNewAppt({ title: '', customerName: '', day: '', time: '10:00' });
                fetchAppointments();
            }
        } catch (err) {
            console.error('[Calendar] Error in handleDelete:', err);
        }
    }

    function openCreate(day: Date, hour: number) {
        setEditingAppt(null);
        // Use London date key so the pre-filled date is correct
        const dayKey = londonDateKey(day);
        setNewAppt({
            title: '',
            customerName: '',
            day: dayKey,
            time: `${hour.toString().padStart(2, '0')}:00`,
        });
        setShowModal(true);
    }

    // FIX #1: Use getLondonHourMinute and londonDateKey when pre-filling edit form
    function openEdit(a: Appointment) {
        setEditingAppt(a);
        const aDate = new Date(a.startTime);
        const dayKey = londonDateKey(aDate);
        const { hour } = getLondonHourMinute(aDate);
        setNewAppt({
            title: a.title,
            customerName: a.customerName || '',
            day: dayKey,
            time: `${hour.toString().padStart(2, '0')}:00`,
        });
        setShowModal(true);
    }

    // ── Time grid (shared by Week + Day) ──────────────────────────────────────
    function TimeGrid({ days }: { days: Date[] }) {
        const colCount = days.length;

        // Red current-time indicator — position based on London (BST/GMT) time
        const { hour: nowHour, minute: nowMinute } = getLondonHourMinute(nowTime);
        const HOUR_PX = 64; // each h-16 slot = 64px
        // Grid starts at hour 1 (1 AM). Position = offset from top of column.
        const nowTopPx = (nowHour - 1) * HOUR_PX + (nowMinute / 60) * HOUR_PX;
        const showRedLine = nowHour >= 1 && nowHour <= 23;

        return (
            <div className="grid grid-cols-[64px_1fr] relative">
                {/* Time labels */}
                <div className="bg-white border-r border-slate-300 shrink-0 pt-[10px]">
                    {hours.map(h => (
                        <div key={h} className="h-16 relative">
                            <span className="absolute -top-[9px] right-2 text-[10px] font-semibold text-slate-500 select-none whitespace-nowrap">
                                {fmtHour(h)}
                            </span>
                        </div>
                    ))}
                </div>
                {/* Day columns */}
                <div className="grid relative pt-[10px]" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
                    {days.map((day, dayIdx) => {
                        const isTodayCol = isLondonToday(day);
                        return (
                            <div key={dayIdx} className="border-r border-slate-200 last:border-r-0 relative">
                                {/* ── Red current-time line (today only) ── */}
                                {isTodayCol && showRedLine && (
                                    <div
                                        className="absolute left-0 right-0 z-20 pointer-events-none"
                                        style={{ top: `${nowTopPx}px` }}
                                    >
                                        <div className="flex items-center">
                                            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0 -ml-[6px] shadow-sm" />
                                            <div className="flex-1 h-[2px] bg-red-500" />
                                        </div>
                                    </div>
                                )}
                                {hours.map(h => {
                                    const slotAppts = getApptsForSlot(day, h);
                                    return (
                                        <div
                                            key={h}
                                            className="h-16 border-b border-slate-200 p-1 relative cursor-pointer hover:bg-blue-50/40"
                                            onClick={() => openCreate(day, h)}
                                        >
                                            {slotAppts.map(a => (
                                                <div
                                                    key={a._id}
                                                    className="bg-indigo-600 rounded-md p-1.5 shadow-sm text-white overflow-hidden absolute inset-x-1 z-10 hover:brightness-110 transition-all border-l-4 border-white/20"
                                                    style={{ top: '2px', height: 'calc(100% - 4px)' }}
                                                    onClick={e => { e.stopPropagation(); openEdit(a); }}
                                                >
                                                    <div className="text-[10px] font-bold leading-none truncate">{a.title}</div>
                                                    <div className="text-[8px] font-medium text-indigo-100 mt-1 truncate">{a.customerName || 'No Name'}</div>
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

    // ── Header title ──────────────────────────────────────────────────────────
    function headerTitle() {
        if (view === 'day') {
            return currentDate.toLocaleString('default', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
        if (view === 'week') {
            const s = weekDays[0]; const e = weekDays[6];
            const sKey = londonDateKey(s);
            const eKey = londonDateKey(e);
            const [sy, sm, sd] = sKey.split('-').map(Number);
            const [, em, ed] = eKey.split('-').map(Number);
            if (sm === em) {
                const monthName = new Date(Date.UTC(sy, sm - 1, 1)).toLocaleString('default', { month: 'long' });
                return `${sd} – ${ed} ${monthName} ${sy}`;
            }
            const sDate = new Date(Date.UTC(sy, sm - 1, sd));
            const eDate = new Date(Date.UTC(sy, em - 1, ed));
            return `${sDate.toLocaleString('default', { day: 'numeric', month: 'short' })} – ${eDate.toLocaleString('default', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
        return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    if (!mounted) {
        return (
            <div className="flex h-[400px] md:h-[750px] bg-white border border-slate-100 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-sm items-center justify-center">
                <div className="w-8 h-8 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    // Compute current TZ label dynamically (GMT or BST)
    const tzLabel = londonTZLabel(new Date());

    // ── Mini calendar cells (derived, not hooks — fine after early return) ─────
    const daysInMonth = new Date(Date.UTC(miniYear, miniMonth + 1, 0)).getUTCDate();
    const firstDayOfWeek = new Date(Date.UTC(miniYear, miniMonth, 1)).getUTCDay();
    const miniCells = Array.from({ length: firstDayOfWeek + daysInMonth }, (_, i) =>
        i < firstDayOfWeek ? null : i - firstDayOfWeek + 1
    );

    return (
        <div className="flex flex-col md:flex-row h-auto md:h-[750px] bg-white border border-slate-100 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-sm">

            {/* ── Mobile Top Bar ──────────────────────────────────────────────── */}
            <div className="md:hidden flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                <button
                    onClick={() => { setEditingAppt(null); setShowModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm text-slate-700 font-bold text-sm"
                >
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Create
                </button>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowMiniCal(v => !v)} className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                        {new Date(Date.UTC(miniYear, miniMonth, 1)).toLocaleString('default', { month: 'short', year: 'numeric' })}
                    </button>
                    <select
                        value={view}
                        onChange={e => setView(e.target.value as CalView)}
                        className="px-2 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white"
                    >
                        <option value="week">Week</option>
                        <option value="day">Day</option>
                        <option value="month">Month</option>
                    </select>
                </div>
            </div>

            {/* ── Mobile Mini Calendar (collapsible) ──────────────────────────── */}
            {showMiniCal && (
                <div className="md:hidden px-4 py-3 border-b border-slate-100 bg-white">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-slate-800">
                            {new Date(Date.UTC(miniYear, miniMonth, 1)).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </h4>
                        <div className="flex gap-2">
                            <button onClick={() => { if (miniMonth === 0) { setMiniMonth(11); setMiniYear(y => y - 1); } else setMiniMonth(m => m - 1); }} className="p-1 hover:bg-slate-50 rounded-lg text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2} /></svg>
                            </button>
                            <button onClick={() => { if (miniMonth === 11) { setMiniMonth(0); setMiniYear(y => y + 1); } else setMiniMonth(m => m + 1); }} className="p-1 hover:bg-slate-50 rounded-lg text-slate-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2} /></svg>
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-[10px] text-center font-bold text-slate-400 mb-1">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((s, i) => <div key={`${s}-${i}`}>{s}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {miniCells.map((day, i) => day === null ? <div key={`empty-${i}`} /> : (
                            <button key={day} onClick={() => { const clicked = new Date(Date.UTC(miniYear, miniMonth, day, 12, 0, 0, 0)); setCurrentDate(clicked); setShowMiniCal(false); }}
                                className={`h-7 w-full flex items-center justify-center rounded-full text-[11px] font-medium transition-colors ${londonDateKey(new Date(Date.UTC(miniYear, miniMonth, day, 12, 0, 0, 0))) === londonDateKey(currentDate) ? 'bg-indigo-600 text-white' : isLondonToday(new Date(Date.UTC(miniYear, miniMonth, day, 12, 0, 0, 0))) ? 'ring-2 ring-indigo-400 text-indigo-600' : 'hover:bg-slate-50 text-slate-600'}`}>
                                {day}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
            <aside className="hidden md:flex w-64 border-r border-slate-100 p-4 flex-col gap-8 bg-white shrink-0">
                <button
                    onClick={() => { setEditingAppt(null); setShowModal(true); }}
                    className="flex items-center gap-4 px-6 py-3.5 bg-white border border-slate-200 rounded-full shadow-md hover:shadow-lg transition-all text-slate-800 font-bold text-sm"
                >
                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Create
                </button>

                {/* Mini calendar */}
                <div className="space-y-4">
                    <div className="px-2 flex items-center justify-between">
                        {/* FIX #6: Mini calendar navigates its own month state independently */}
                        <h4 className="text-sm font-bold text-slate-800">
                            {new Date(Date.UTC(miniYear, miniMonth, 1)).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </h4>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (miniMonth === 0) { setMiniMonth(11); setMiniYear(y => y - 1); }
                                    else setMiniMonth(m => m - 1);
                                }}
                                className="p-1 hover:bg-slate-50 rounded-lg text-slate-400"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2} /></svg>
                            </button>
                            <button
                                onClick={() => {
                                    if (miniMonth === 11) { setMiniMonth(0); setMiniYear(y => y + 1); }
                                    else setMiniMonth(m => m + 1);
                                }}
                                className="p-1 hover:bg-slate-50 rounded-lg text-slate-400"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2} /></svg>
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-[10px] text-center font-bold text-slate-400">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((s, i) => <div key={`${s}-${i}`}>{s}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {miniCells.map((day, i) =>
                            day === null ? (
                                <div key={`empty-${i}`} />
                            ) : (
                                <button
                                    key={day}
                                    onClick={() => {
                                        // FIX #6: clicking a mini-calendar day updates main view correctly
                                        const clicked = new Date(Date.UTC(miniYear, miniMonth, day, 12, 0, 0, 0));
                                        setCurrentDate(clicked);
                                    }}
                                    className={`h-7 w-7 flex items-center justify-center rounded-full text-[11px] font-medium transition-colors
                                        ${londonDateKey(new Date(Date.UTC(miniYear, miniMonth, day, 12, 0, 0, 0))) === londonDateKey(currentDate)
                                            ? 'bg-indigo-600 text-white'
                                            : isLondonToday(new Date(Date.UTC(miniYear, miniMonth, day, 12, 0, 0, 0)))
                                                ? 'ring-2 ring-indigo-400 text-indigo-600'
                                                : 'hover:bg-slate-50 text-slate-600'}`}
                                >
                                    {day}
                                </button>
                            )
                        )}
                    </div>
                </div>
            </aside>

            {/* ── Main area ───────────────────────────────────────────────────── */}
            <main className="flex-1 flex flex-col bg-white min-w-0 min-h-[400px] md:min-h-0">
                {/* Desktop Header */}
                <header className="hidden md:flex p-4 border-b border-slate-100 items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => {
                                const londonKey = londonDateKey(new Date());
                                const [y, m, d] = londonKey.split('-').map(Number);
                                setCurrentDate(new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0)));
                            }}
                            className="px-4 py-2 text-sm font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-slate-700 shrink-0"
                        >
                            Today
                        </button>
                        <div className="flex gap-1">
                            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 rounded-full text-slate-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2.5} /></svg>
                            </button>
                            <button onClick={() => navigate(1)} className="p-2 hover:bg-slate-50 rounded-full text-slate-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2.5} /></svg>
                            </button>
                        </div>
                        <h2 className="text-base font-bold text-slate-800 truncate">{headerTitle()}</h2>
                    </div>
                    <select
                        value={view}
                        onChange={e => setView(e.target.value as CalView)}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 bg-white shrink-0"
                    >
                        <option value="week">Week</option>
                        <option value="day">Day</option>
                        <option value="month">Month</option>
                    </select>
                </header>
                {/* Mobile nav (today + prev/next + title) */}
                <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                    <button onClick={() => { const k = londonDateKey(new Date()); const [y,m,d] = k.split('-').map(Number); setCurrentDate(new Date(Date.UTC(y,m-1,d,12,0,0,0))); }} className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-700 shrink-0">Today</button>
                    <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-50 rounded-full text-slate-500 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2.5} /></svg>
                    </button>
                    <button onClick={() => navigate(1)} className="p-1.5 hover:bg-slate-50 rounded-full text-slate-500 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2.5} /></svg>
                    </button>
                    <h2 className="text-xs font-bold text-slate-700 truncate flex-1">{headerTitle()}</h2>
                </div>

                {/* ── WEEK VIEW ──────────────────────────────────────────────── */}
                {view === 'week' && (
                    <div className="flex-1 overflow-auto">
                        <div className="min-w-[600px]">
                            <div className="grid grid-cols-[64px_1fr] border-b border-slate-300 sticky top-0 bg-white z-30">
                                {/* FIX #4: Dynamic GMT/BST label */}
                                <div className="border-r border-slate-300 h-20 flex items-end justify-center pb-3 text-[9px] text-slate-500 font-black tracking-widest">{tzLabel}</div>
                                <div className="grid grid-cols-7 h-20">
                                    {weekDays.map((date, i) => (
                                        <div key={i} className="flex flex-col items-center justify-center border-r border-slate-200 last:border-r-0">
                                            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isLondonToday(date) ? 'text-indigo-600' : 'text-slate-600'}`}>
                                                {dayNames[i]}
                                            </span>
                                            <span className={`text-lg w-9 h-9 flex items-center justify-center rounded-full ${isLondonToday(date) ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-100' : 'text-slate-800 hover:bg-slate-100'}`}>
                                                {/* FIX #3: Show London date number */}
                                                {parseInt(londonDateKey(date).split('-')[2], 10)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <TimeGrid days={weekDays} />
                        </div>
                    </div>
                )}

                {/* ── DAY VIEW ───────────────────────────────────────────────── */}
                {view === 'day' && (
                    <div className="flex-1 overflow-auto">
                        <div className="min-w-[300px]">
                            <div className="grid grid-cols-[64px_1fr] border-b border-slate-300 sticky top-0 bg-white z-30">
                                {/* FIX #4: Dynamic GMT/BST label */}
                                <div className="border-r border-slate-300 h-20 flex items-end justify-center pb-3 text-[9px] text-slate-500 font-black tracking-widest">{tzLabel}</div>
                                <div className="h-20 flex flex-col items-center justify-center">
                                    <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isLondonToday(currentDate) ? 'text-indigo-600' : 'text-slate-600'}`}>
                                        {dayNames[new Date(Date.UTC(...(londonDateKey(currentDate).split('-').map(Number) as [number, number, number]))).getUTCDay()]}
                                    </span>
                                    <span className={`text-lg w-9 h-9 flex items-center justify-center rounded-full ${isLondonToday(currentDate) ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-100' : 'text-slate-800'}`}>
                                        {parseInt(londonDateKey(currentDate).split('-')[2], 10)}
                                    </span>
                                </div>
                            </div>
                            <TimeGrid days={[currentDate]} />
                        </div>
                    </div>
                )}

                {/* ── MONTH VIEW ─────────────────────────────────────────────── */}
                {view === 'month' && (() => {
                    const londonKey = londonDateKey(currentDate);
                    const [year, month] = londonKey.split('-').map(Number);
                    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
                    const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
                    const cells: (number | null)[] = [
                        ...Array(firstDay).fill(null),
                        ...Array.from({ length: totalDays }, (_, i) => i + 1),
                    ];
                    while (cells.length % 7 !== 0) cells.push(null);

                    return (
                        <div className="flex-1 overflow-auto p-2">
                            <div className="grid grid-cols-7 mb-1 border-b border-slate-300">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(n => (
                                    <div key={n} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-600 py-2">{n}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-px bg-slate-300 border border-slate-300 rounded-2xl overflow-hidden">
                                {cells.map((day, i) => {
                                    if (day === null) {
                                        return <div key={`empty-${i}`} className="bg-white min-h-[90px]" />;
                                    }
                                    const cellDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
                                    const isToday = isLondonToday(cellDate);
                                    const isSelected = londonDateKey(cellDate) === londonDateKey(currentDate);
                                    const dayAppts = getApptsForDay(cellDate);
                                    return (
                                        <div
                                            key={day}
                                            className={`bg-white min-h-[90px] p-2 cursor-pointer hover:bg-slate-50/80 transition-colors ${isSelected && !isToday ? 'ring-2 ring-inset ring-indigo-200' : ''}`}
                                            onClick={() => { setCurrentDate(cellDate); setView('day'); }}
                                        >
                                            <div className="flex justify-end mb-1">
                                                <span className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors
                                                    ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                                                    {day}
                                                </span>
                                            </div>
                                            <div className="space-y-0.5">
                                                {dayAppts.slice(0, 3).map(a => {
                                                    // FIX #1: Use London hour for month view time display
                                                    const { hour: aHour } = getLondonHourMinute(new Date(a.startTime));
                                                    const displayHour = aHour % 12 || 12;
                                                    const ampm = aHour >= 12 ? 'p' : 'a';
                                                    return (
                                                        <div
                                                            key={a._id}
                                                            className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 truncate cursor-pointer hover:bg-indigo-200 transition-colors"
                                                            onClick={e => { e.stopPropagation(); openEdit(a); }}
                                                        >
                                                            {displayHour}{ampm} {a.title}
                                                        </div>
                                                    );
                                                })}
                                                {dayAppts.length > 3 && (
                                                    <div className="text-[9px] font-bold text-slate-400 pl-1">+{dayAppts.length - 3} more</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </main>

            {/* ── Modal ───────────────────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
                        <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
                            <h3 className="text-xl font-bold text-slate-800">
                                {editingAppt ? 'Update Appointment' : 'New Appointment'}
                            </h3>
                            <button
                                onClick={() => { setShowModal(false); setEditingAppt(null); }}
                                className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleAddAppointment} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2 ml-1">Title</label>
                                    <input
                                        required
                                        placeholder="e.g. Test Drive LS16 BVU"
                                        value={newAppt.title}
                                        onChange={e => setNewAppt({ ...newAppt, title: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 focus:bg-white transition-all outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2 ml-1">Customer Name</label>
                                    <input
                                        placeholder="Full Name"
                                        value={newAppt.customerName}
                                        onChange={e => setNewAppt({ ...newAppt, customerName: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 focus:bg-white transition-all outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2 ml-1">Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={newAppt.day}
                                            onChange={e => setNewAppt({ ...newAppt, day: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 focus:bg-white transition-all outline-none"
                                        />
                                    </div>
                                    <div>
                                        {/* FIX #4: Show BST/GMT in label so user knows which timezone */}
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2 ml-1">Time ({tzLabel})</label>
                                        <select
                                            value={newAppt.time}
                                            onChange={e => setNewAppt({ ...newAppt, time: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 focus:bg-white transition-all outline-none"
                                        >
                                            {hours.map(h => (
                                                <option key={h} value={`${h.toString().padStart(2, '0')}:00`}>{fmtHour(h)}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 flex flex-col gap-3">
                                <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all">
                                    {editingAppt ? 'Save Changes' : 'Create Appointment'}
                                </button>
                                {editingAppt && (
                                    <button type="button" onClick={handleDeleteAppointment} className="w-full py-4 bg-white border border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 text-sm font-bold rounded-2xl transition-all">
                                        Remove Appointment
                                    </button>
                                )}
                                <button type="button" onClick={() => { setShowModal(false); setEditingAppt(null); }} className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">
                                    Dismiss
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}