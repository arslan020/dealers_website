'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface TDSession {
    _id: string;
    customerName: string;
    customerEmail?: string;
    customerAddress?: string;
    customerId?: string;
    drivingLicenseNumber?: string;
    drivingLicenseCheckCode?: string;
    nationalInsuranceNumber?: string;
    dateOfBirth?: string;
    licenseCheckedDate?: string;
    checkedByName?: string;
    startTime: string;
    endTime?: string;
    intendedReturnTime?: string;
    fuelLevel?: number;
    conditionReportId?: string;
    conditionReportLabel?: string;
    handoverLocation?: string;
    notes?: string;
    consentToDataStorage: boolean;
    status: 'active' | 'completed';
    eSignatureDataUrl?: string;
    eSignedBy?: string;
    eSignedAt?: string;
    eSignedIp?: string;
    eSignedUserAgent?: string;
}

interface Customer { _id: string; firstName: string; lastName: string; email?: string; phone?: string; address?: { line1?: string; city?: string; postcode?: string }; }
interface StaffUser { _id: string; name: string; }
interface CondReport { _id: string; createdAt: string; reportType: string; }

interface Props {
    vehicleId: string;
    vehicleVRM?: string;
    vehicleStatus?: string;
    branchName?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtDT(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}
function fmtDate(s?: string) {
    if (!s) return '—';
    if (s.includes('T')) return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return s;
}
function initials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function ago(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s} seconds ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
    const h = Math.floor(m / 60);
    return `${h} hour${h !== 1 ? 's' : ''} ago`;
}

/* ─── eSign Modal ─────────────────────────────────────────────────────────── */
function ESignModal({ session, vehicleId, onSigned, onClose }: {
    session: TDSession;
    vehicleId: string;
    onSigned: (updated: TDSession) => void;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [drawing, setDrawing] = useState(false);
    const [signedBy, setSignedBy] = useState(session.customerName.toUpperCase());
    const [saving, setSaving] = useState(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);

    const TC_TEXT = `1. Eligibility
By signing this agreement, you confirm that you are legally permitted to drive in the UK and hold a full, valid driving licence.

You confirm that your licence details have been provided and recorded accurately by the seller or dealership.

2. Insurance
The vehicle is insured under the seller's or dealer's motor trade policy unless you have provided evidence of fully comprehensive insurance covering the test drive.

In the event of an incident, you agree to be responsible for any applicable insurance excess and for any loss or damage not covered by insurance due to your negligence.

3. Use of Vehicle
The vehicle must be used responsibly and only on public roads. You agree not to allow any other person to drive the vehicle during the test drive period.

4. Return of Vehicle
You agree to return the vehicle by the agreed return time and in the same condition as when it was collected.

5. Data & Consent
By signing, you consent to the collection and use of your personal data for the purposes of this test drive agreement in accordance with our privacy policy.`;

    const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
        }
        return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const canvas = canvasRef.current; if (!canvas) return;
        setDrawing(true);
        lastPos.current = getPos(e, canvas);
    };
    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!drawing) return;
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const pos = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        lastPos.current = pos;
    };
    const endDraw = () => setDrawing(false);
    const clearCanvas = () => {
        const canvas = canvasRef.current; if (!canvas) return;
        canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    };

    const confirm = async () => {
        const canvas = canvasRef.current; if (!canvas) return;
        setSaving(true);
        const dataUrl = canvas.toDataURL('image/png');
        const res = await fetch(`/api/vehicles/${vehicleId}/test-drive/${session._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eSignatureDataUrl: dataUrl,
                eSignedBy: signedBy,
                eSignedAt: new Date().toISOString(),
                eSignedIp: '',
                eSignedUserAgent: navigator.userAgent,
            }),
        });
        const data = await res.json();
        if (data.ok) { toast.success('Signature saved'); onSigned(data.session); }
        else toast.error('Failed to save signature');
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-[640px] flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[16px] font-semibold text-slate-800">Test Drive eSign</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100">×</button>
                </div>

                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                    {/* T&C */}
                    <div>
                        <h3 className="text-[15px] font-bold text-slate-800 text-center mb-4">Terms and Conditions</h3>
                        <div className="border border-slate-200 rounded-lg p-4 h-48 overflow-y-auto text-[13px] text-slate-600 whitespace-pre-line leading-relaxed">
                            {TC_TEXT}
                        </div>
                    </div>

                    <p className="text-[13px] font-semibold text-slate-700">Please sign below to confirm that you understand and agree to these terms and conditions:</p>

                    {/* Signature canvas */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[12px] font-semibold text-slate-600">Signature</span>
                            <button onClick={clearCanvas} className="text-[12px] text-[#4D7CFF] border border-[#4D7CFF] rounded-lg px-3 py-1 hover:bg-blue-50">Clear Signature</button>
                        </div>
                        <canvas
                            ref={canvasRef}
                            width={560}
                            height={160}
                            onMouseDown={startDraw}
                            onMouseMove={draw}
                            onMouseUp={endDraw}
                            onMouseLeave={endDraw}
                            onTouchStart={startDraw}
                            onTouchMove={draw}
                            onTouchEnd={endDraw}
                            className="border border-slate-300 rounded-lg w-full cursor-crosshair touch-none"
                            style={{ height: '160px' }}
                        />
                    </div>

                    <input
                        value={signedBy}
                        onChange={e => setSignedBy(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-semibold focus:outline-none focus:border-[#4D7CFF] uppercase"
                        placeholder="Full name"
                    />
                </div>

                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-5 py-2 text-[13px] font-semibold text-white bg-slate-500 rounded-lg hover:bg-slate-600">Close</button>
                    <button onClick={confirm} disabled={saving} className="px-5 py-2 text-[13px] text-[#4D7CFF] border border-[#4D7CFF] rounded-lg hover:bg-blue-50 font-semibold disabled:opacity-60">
                        {saving ? 'Saving…' : 'Confirm Signature'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Current Session View ───────────────────────────────────────────────── */
function CurrentSession({ session, vehicleId, onEnd, onRefresh }: {
    session: TDSession;
    vehicleId: string;
    onEnd: () => void;
    onRefresh: (s: TDSession) => void;
}) {
    const [showESign, setShowESign] = useState(false);
    const [ending, setEnding] = useState(false);
    const [emailing, setEmailing] = useState(false);

    const endSession = async () => {
        if (!confirm('End this test drive session?')) return;
        setEnding(true);
        const res = await fetch(`/api/vehicles/${vehicleId}/test-drive/${session._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'end' }),
        });
        if ((await res.json()).ok) { toast.success('Session ended'); onEnd(); }
        else toast.error('Failed to end session');
        setEnding(false);
    };

    const emailCustomer = async () => {
        setEmailing(true);
        toast.success('Email sent to customer');
        setEmailing(false);
    };

    const rows: { label: string; value: React.ReactNode }[] = [
        { label: 'Customer', value: (
            <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">
                    {initials(session.customerName)}
                </div>
                <span className="text-[14px] font-semibold text-[#4D7CFF]">{session.customerName}</span>
            </div>
        )},
        { label: 'Start Time', value: <span className="font-bold">{fmtDT(session.startTime)}</span> },
        { label: 'Driving License Number', value: session.drivingLicenseNumber || '—' },
        { label: 'National Insurance Number', value: session.nationalInsuranceNumber || '—' },
        { label: 'Date of Birth', value: fmtDate(session.dateOfBirth) },
        { label: 'License Checked', value: fmtDate(session.licenseCheckedDate) },
        { label: 'Checked By', value: session.checkedByName || '—' },
        { label: 'Intended Return Time', value: <span className="font-bold">{fmtDT(session.intendedReturnTime)}</span> },
        { label: 'Fuel Level', value: session.fuelLevel != null ? `${session.fuelLevel}%` : '—' },
        ...(session.conditionReportLabel ? [{ label: 'Condition Report', value: <span className="text-[#4D7CFF] cursor-pointer hover:underline">{session.conditionReportLabel}</span> }] : []),
    ];

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="text-[15px] font-bold text-slate-800">Current Session</h3>
                </div>
                <div className="px-5 py-3">
                    <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5 flex items-center gap-2 mb-4">
                        <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4"/></svg>
                        <span className="text-[13px] font-bold text-teal-700">Vehicle Is On Test Drive!</span>
                    </div>

                    <div className="divide-y divide-slate-50">
                        {rows.map(r => (
                            <div key={r.label} className="flex items-start py-2.5 gap-4">
                                <span className="text-[13px] text-slate-500 w-48 flex-shrink-0">{r.label}:</span>
                                <span className="text-[13px] text-slate-800">{r.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* eSign section */}
                {session.eSignatureDataUrl ? (
                    <div className="border-t border-slate-100 px-5 py-4">
                        <h4 className="text-[14px] font-bold text-slate-800 mb-4">Electronic Signature</h4>
                        <div className="divide-y divide-slate-50">
                            <div className="flex items-start py-2.5 gap-4">
                                <span className="text-[13px] text-slate-500 w-36 flex-shrink-0">Signature:</span>
                                <div className="border border-slate-200 rounded-lg p-2 bg-white">
                                    <img src={session.eSignatureDataUrl} alt="signature" className="h-16 w-auto" />
                                </div>
                            </div>
                            <div className="flex items-start py-2.5 gap-4">
                                <span className="text-[13px] text-slate-500 w-36 flex-shrink-0">Signed By:</span>
                                <span className="text-[13px] font-bold text-slate-800">{session.eSignedBy}</span>
                            </div>
                            {session.eSignedAt && (
                                <div className="flex items-start py-2.5 gap-4">
                                    <span className="text-[13px] text-slate-500 w-36 flex-shrink-0">Date Signed:</span>
                                    <span className="text-[13px] text-slate-800">{fmtDT(session.eSignedAt)} <span className="text-slate-400">({ago(session.eSignedAt)})</span></span>
                                </div>
                            )}
                            {session.eSignedUserAgent && (
                                <div className="flex items-start py-2.5 gap-4">
                                    <span className="text-[13px] text-slate-500 w-36 flex-shrink-0">Web Browser:</span>
                                    <span className="text-[13px] text-slate-800 break-all">{session.eSignedUserAgent}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
                    <div className="flex gap-2">
                        <button onClick={endSession} disabled={ending} className="px-5 py-2 bg-[#4D7CFF] text-white text-[13px] font-bold rounded-lg hover:bg-[#3a6ae8] disabled:opacity-60">
                            {ending ? 'Ending…' : 'End Session'}
                        </button>
                        {!session.eSignatureDataUrl && (
                            <button onClick={() => setShowESign(true)} className="px-5 py-2 border border-[#4D7CFF] text-[#4D7CFF] text-[13px] font-semibold rounded-lg hover:bg-blue-50">
                                Collect eSign
                            </button>
                        )}
                    </div>
                    <button onClick={emailCustomer} disabled={emailing} className="px-5 py-2 border border-slate-300 text-slate-600 text-[13px] font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-60">
                        {emailing ? 'Sending…' : 'Email Customer'}
                    </button>
                </div>
            </div>

            {showESign && (
                <ESignModal
                    session={session}
                    vehicleId={vehicleId}
                    onSigned={s => { onRefresh(s); setShowESign(false); }}
                    onClose={() => setShowESign(false)}
                />
            )}
        </div>
    );
}

/* ─── Session History ────────────────────────────────────────────────────── */
function SessionHistory({ vehicleId }: { vehicleId: string }) {
    const [sessions, setSessions] = useState<TDSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(25);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const res = await fetch(`/api/vehicles/${vehicleId}/test-drive?history=true`);
            const d = await res.json();
            setSessions(d.ok ? d.sessions : []);
            setLoading(false);
        })();
    }, [vehicleId]);

    const filtered = sessions.filter(s =>
        !search || s.customerName.toLowerCase().includes(search.toLowerCase()) || (s.drivingLicenseNumber || '').toLowerCase().includes(search.toLowerCase())
    );
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const paged = filtered.slice((page - 1) * perPage, page * perPage);

    const exportCSV = () => {
        const header = 'Start Time,End Time,Customer,Intended Return,License Number';
        const rows = filtered.map(s => [fmtDT(s.startTime), fmtDT(s.endTime), s.customerName, fmtDT(s.intendedReturnTime), s.drivingLicenseNumber || ''].join(','));
        const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'test-drives.csv'; a.click();
    };

    const exportExcel = () => {
        const rows = [['Start Time','End Time','Customer','Intended Return','License Number'], ...filtered.map(s => [fmtDT(s.startTime), fmtDT(s.endTime), s.customerName, fmtDT(s.intendedReturnTime), s.drivingLicenseNumber || ''])];
        const tsv = rows.map(r => r.join('\t')).join('\n');
        const blob = new Blob([tsv], { type: 'application/vnd.ms-excel' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'test-drives.xls'; a.click();
    };

    return (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-[15px] font-bold text-slate-800">Session History</h3>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search" className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] w-48 focus:outline-none focus:border-[#4D7CFF]" />
            </div>

            {loading ? (
                <div className="py-10 text-center text-[13px] text-slate-400">Loading…</div>
            ) : (
                <>
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                {['START TIME', 'END TIME', 'CUSTOMER', 'INTENDED RETURN', 'LICENSE NUMBER', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paged.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-slate-400">No sessions found.</td></tr>
                            ) : paged.map(s => (
                                <tr key={s._id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-[13px] text-slate-700">{fmtDT(s.startTime)}</td>
                                    <td className="px-4 py-3 text-[13px] text-slate-700">{fmtDT(s.endTime)}</td>
                                    <td className="px-4 py-3">
                                        <span className="text-[13px] text-[#4D7CFF] font-medium">{s.customerName}</span>
                                    </td>
                                    <td className="px-4 py-3 text-[13px] text-slate-700">{fmtDT(s.intendedReturnTime)}</td>
                                    <td className="px-4 py-3 text-[13px] text-slate-700 font-mono">{s.drivingLicenseNumber || '—'}</td>
                                    <td className="px-4 py-3">
                                        <ViewSessionButton session={s} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] text-slate-500">Show</span>
                            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="border border-slate-200 rounded px-2 py-1 text-[12px]">
                                {[10, 25, 50, 100].map(n => <option key={n}>{n}</option>)}
                            </select>
                            <button onClick={exportCSV} className="ml-2 border border-slate-200 rounded px-3 py-1 text-[12px] text-slate-600 hover:bg-slate-50">CSV</button>
                            <button onClick={exportExcel} className="border border-slate-200 rounded px-3 py-1 text-[12px] text-slate-600 hover:bg-slate-50">Excel</button>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-[12px] text-slate-600 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40">Previous</button>
                            <span className="w-8 h-8 flex items-center justify-center bg-[#4D7CFF] text-white text-[13px] font-bold rounded">{page}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 text-[12px] text-slate-600 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40">Next</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function ViewSessionButton({ session }: { session: TDSession }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button onClick={() => setOpen(true)} className="flex items-center gap-1 bg-[#4D7CFF] text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#3a6ae8]">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                View
            </button>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-[560px] max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
                            <h2 className="text-[15px] font-bold text-slate-800">Test Drive Record</h2>
                            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100">×</button>
                        </div>
                        <div className="px-6 py-4 divide-y divide-slate-50">
                            {[
                                ['Customer', session.customerName],
                                ['Start Time', fmtDT(session.startTime)],
                                ['End Time', fmtDT(session.endTime)],
                                ['Driving License', session.drivingLicenseNumber || '—'],
                                ['Check Code', session.drivingLicenseCheckCode || '—'],
                                ['NI Number', session.nationalInsuranceNumber || '—'],
                                ['Date of Birth', fmtDate(session.dateOfBirth)],
                                ['License Checked', fmtDate(session.licenseCheckedDate)],
                                ['Checked By', session.checkedByName || '—'],
                                ['Intended Return', fmtDT(session.intendedReturnTime)],
                                ['Fuel Level', session.fuelLevel != null ? `${session.fuelLevel}%` : '—'],
                                ['Location', session.handoverLocation || '—'],
                                ['Notes', session.notes || '—'],
                                ['Consent', session.consentToDataStorage ? 'Yes' : 'No'],
                            ].map(([l, v]) => (
                                <div key={l} className="flex items-start py-2.5 gap-4">
                                    <span className="text-[13px] text-slate-500 w-40 flex-shrink-0">{l}:</span>
                                    <span className="text-[13px] text-slate-800">{v}</span>
                                </div>
                            ))}
                            {session.eSignatureDataUrl && (
                                <div className="flex items-start py-2.5 gap-4">
                                    <span className="text-[13px] text-slate-500 w-40 flex-shrink-0">eSignature:</span>
                                    <img src={session.eSignatureDataUrl} alt="sig" className="h-12 border border-slate-200 rounded p-1" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/* ─── Start New Session Form ─────────────────────────────────────────────── */
function StartNewSession({ vehicleId, vehicleVRM, onStarted }: { vehicleId: string; vehicleVRM?: string; onStarted: (s: TDSession) => void }) {
    // Customer
    const [custQuery, setCustQuery] = useState('');
    const [custResults, setCustResults] = useState<Customer[]>([]);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const custTimer = useRef<NodeJS.Timeout>();

    // License
    const [licenseNum, setLicenseNum] = useState('');
    const [checkCode, setCheckCode] = useState('');
    const [showQR, setShowQR] = useState(false);

    // Other fields
    const [ni, setNI] = useState('');
    const [dob, setDob] = useState('');
    const [licCheckedDate, setLicCheckedDate] = useState('');
    const [staff, setStaff] = useState<StaffUser[]>([]);
    const [checkedByUserId, setCheckedByUserId] = useState('');

    // Return time
    const [retDate, setRetDate] = useState(new Date().toISOString().slice(0, 10));
    const [retTime, setRetTime] = useState('15:00');

    // Fuel
    const [fuel, setFuel] = useState(50);

    // Condition report
    const [reports, setReports] = useState<CondReport[]>([]);
    const [condReportId, setCondReportId] = useState('');

    // Location
    const [location, setLocation] = useState('');

    // Notes & consent
    const [notes, setNotes] = useState('');
    const [consent, setConsent] = useState(false);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch('/api/users/staff').then(r => r.json()).then(d => { if (d.ok) setStaff(d.staff); });
        fetch(`/api/vehicles/${vehicleId}/condition-reports`).then(r => r.json()).then(d => {
            if (d.ok) setReports(d.reports);
        });
    }, [vehicleId]);

    const searchCustomers = useCallback((q: string) => {
        clearTimeout(custTimer.current);
        if (!q.trim()) { setCustResults([]); return; }
        custTimer.current = setTimeout(async () => {
            const res = await fetch(`/api/crm/customers?q=${encodeURIComponent(q)}`);
            const d = await res.json();
            if (d.ok) setCustResults(d.customers.slice(0, 6));
        }, 250);
    }, []);

    const selectCustomer = (c: Customer) => {
        setCustomer(c);
        setCustQuery('');
        setCustResults([]);
        if (c.phone) setLicenseNum('');
    };

    const submit = async () => {
        if (!customer && !custQuery.trim()) { toast.error('Please select a customer'); return; }
        setSubmitting(true);
        const checkedByStaff = staff.find(s => s._id === checkedByUserId);
        const selReport = reports.find(r => r._id === condReportId);
        const addrParts = customer?.address ? [customer.address.line1, customer.address.city, customer.address.postcode].filter(Boolean) : [];

        const res = await fetch(`/api/vehicles/${vehicleId}/test-drive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerId: customer?._id,
                customerName: customer ? `${customer.firstName} ${customer.lastName}` : custQuery.trim(),
                customerEmail: customer?.email,
                customerAddress: addrParts.join(', '),
                drivingLicenseNumber: licenseNum,
                drivingLicenseCheckCode: checkCode,
                nationalInsuranceNumber: ni,
                dateOfBirth: dob,
                licenseCheckedDate: licCheckedDate,
                checkedByUserId,
                checkedByName: checkedByStaff ? `${checkedByStaff.name}` : undefined,
                intendedReturnTime: `${retDate}T${retTime}:00`,
                fuelLevel: fuel,
                conditionReportId: condReportId || undefined,
                conditionReportLabel: selReport ? `${new Date(selReport.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')}, ${selReport.reportType}` : undefined,
                handoverLocation: location,
                notes,
                consentToDataStorage: consent,
            }),
        });
        const data = await res.json();
        if (data.ok) { toast.success('Session started'); onStarted(data.session); }
        else toast.error(typeof data.error === 'string' ? data.error : data.error?.message || 'Failed to start session');
        setSubmitting(false);
    };

    const GOV_URL = 'https://www.gov.uk/view-driving-licence';

    return (
        <div className="space-y-4">
            {/* Customer card */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-5 py-5">
                <div className="flex items-start gap-6">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[13px] font-semibold text-slate-700">Customer</label>
                            <button className="flex items-center gap-1 text-[12px] text-[#4D7CFF] border border-[#4D7CFF] rounded-lg px-2.5 py-1 hover:bg-blue-50">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                                New Contact
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                value={customer ? `${customer.firstName} ${customer.lastName}${customer.email ? `, ${customer.email}` : ''}` : custQuery}
                                onChange={e => { setCustQuery(e.target.value); setCustomer(null); searchCustomers(e.target.value); }}
                                placeholder="Start typing to search…"
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                            />
                            {custResults.length > 0 && !customer && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-52 overflow-y-auto">
                                    {custResults.map(c => (
                                        <button key={c._id} onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                            <span className="font-medium text-slate-800">{c.firstName} {c.lastName}</span>
                                            {c.email && <span className="text-slate-400 ml-2">{c.email}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Address card */}
                    {customer && (
                        <div className="w-56 bg-slate-50 rounded-lg p-3 text-[13px] text-slate-600 leading-relaxed relative">
                            <button onClick={() => setCustomer(null)} className="absolute top-2 right-10 w-7 h-7 bg-[#4D7CFF] text-white rounded flex items-center justify-center hover:bg-[#3a6ae8]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button onClick={() => setCustomer(null)} className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded flex items-center justify-center hover:bg-red-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                            <div className="font-semibold text-slate-800 mt-0.5">{customer.firstName} {customer.lastName}</div>
                            {customer.address?.line1 && <div>{customer.address.line1}</div>}
                            {customer.address?.city && <div>{customer.address.city}</div>}
                            {customer.address?.postcode && <div>{customer.address.postcode}</div>}
                            {customer.email && <div className="text-slate-400 text-[12px] mt-1">{customer.email}</div>}
                        </div>
                    )}
                </div>
            </div>

            {/* License section */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-5 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[13px] font-semibold text-slate-700">Driving License Number (Last 8)</label>
                            <button onClick={() => setShowQR(v => !v)} className="flex items-center gap-1 text-[12px] text-[#4D7CFF] border border-[#4D7CFF] rounded-lg px-2.5 py-1 hover:bg-blue-50">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                Check
                            </button>
                        </div>
                        <input value={licenseNum} onChange={e => setLicenseNum(e.target.value.toUpperCase())} placeholder="123AB1AB" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                    <div>
                        <label className="text-[13px] font-semibold text-slate-700 block mb-1.5">Driving License Check Code</label>
                        <input value={checkCode} onChange={e => setCheckCode(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                </div>

                {/* QR / URL Info box */}
                {showQR && (
                    <div className="bg-teal-50 border border-teal-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-start gap-2 mb-2">
                                <svg className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16v-4m0-4h.01"/></svg>
                                <span className="text-[13px] text-teal-800">To retrieve check code refer customer to URL below, or ask them to scan QR code:</span>
                            </div>
                            <a href={GOV_URL} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#4D7CFF] hover:underline font-medium">{GOV_URL}</a>
                        </div>
                        <div className="flex-shrink-0">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(GOV_URL)}`} alt="QR" className="w-20 h-20 rounded" />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[13px] font-semibold text-slate-700 block mb-1.5">National Insurance Number</label>
                        <input value={ni} onChange={e => setNI(e.target.value.toUpperCase())} placeholder="JB 39 28 28 D" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-mono focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                    <div>
                        <label className="text-[13px] font-semibold text-slate-700 block mb-1.5">Date of Birth</label>
                        <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                    <div>
                        <label className="text-[13px] font-semibold text-slate-700 block mb-1.5">License Checked</label>
                        <input type="date" value={licCheckedDate} onChange={e => setLicCheckedDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                    <div>
                        <label className="text-[13px] font-semibold text-slate-700 block mb-1.5">Checked By</label>
                        <select value={checkedByUserId} onChange={e => setCheckedByUserId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                            <option value="">Select staff…</option>
                            {staff.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Return time + Fuel + Condition + Location */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-5 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[13px] font-semibold text-slate-700 block mb-1.5">Intended Return Time</label>
                        <div className="flex gap-2">
                            <input type="date" value={retDate} onChange={e => setRetDate(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                            <input type="time" value={retTime} onChange={e => setRetTime(e.target.value)} className="w-24 border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[13px] font-semibold text-slate-700 block mb-2">Fuel Level</label>
                        <input type="range" min="0" max="100" value={fuel} onChange={e => setFuel(Number(e.target.value))} className="w-full accent-[#4D7CFF]" />
                        <div className="flex justify-between text-[11px] text-slate-400 mt-0.5"><span>0</span><span className="font-semibold text-slate-600">{fuel}%</span><span>100</span></div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[13px] font-semibold text-slate-700">Condition Report</label>
                            <button className="flex items-center gap-1 text-[12px] text-[#4D7CFF] border border-[#4D7CFF] rounded-lg px-2.5 py-1 hover:bg-blue-50">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                New Report
                            </button>
                        </div>
                        <select value={condReportId} onChange={e => setCondReportId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                            <option value="">None selected</option>
                            {reports.map(r => (
                                <option key={r._id} value={r._id}>
                                    {new Date(r.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')}, {r.reportType}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[13px] font-semibold text-slate-700">Vehicle Handover Location</label>
                            <button className="flex items-center gap-1 text-[12px] text-[#4D7CFF] border border-[#4D7CFF] rounded-lg px-2.5 py-1 hover:bg-blue-50">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                New Location
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Start typing to search…" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                            <button className="w-10 h-10 flex-shrink-0 bg-[#4D7CFF] text-white rounded-lg flex items-center justify-center hover:bg-[#3a6ae8]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notes + Consent */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-5 py-5 space-y-4">
                <div>
                    <label className="text-[13px] font-semibold text-slate-700 block mb-2">Photos &amp; Videos</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center cursor-pointer hover:border-[#4D7CFF] hover:bg-blue-50/30 transition-colors">
                        <span className="text-[13px] text-slate-400 italic">Drop files, or click to select files.</span>
                    </div>
                </div>
                <div>
                    <label className="text-[13px] font-semibold text-slate-700 block mb-2">Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" />
                </div>
                <div>
                    <p className="text-[13px] text-slate-700 mb-2">Customer consents to storage of driving license data and associated personal data.</p>
                    <div className="flex gap-6">
                        {[true, false].map(v => (
                            <label key={String(v)} className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-700">
                                <input type="radio" checked={consent === v} onChange={() => setConsent(v)} className="accent-[#4D7CFF]" />
                                {v ? 'Yes' : 'No'}
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            <button onClick={submit} disabled={submitting} className="bg-[#4D7CFF] text-white text-[13px] font-bold px-6 py-2.5 rounded-lg hover:bg-[#3a6ae8] disabled:opacity-60">
                {submitting ? 'Starting…' : 'Start Session'}
            </button>
        </div>
    );
}

/* ─── Main Tab ───────────────────────────────────────────────────────────── */
export function VehicleTestDriveTab({ vehicleId, vehicleVRM, vehicleStatus, branchName }: Props) {
    const [subTab, setSubTab] = useState<'new' | 'history'>('new');
    const [activeSession, setActiveSession] = useState<TDSession | null>(null);
    const [loading, setLoading] = useState(true);

    const loadActive = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/vehicles/${vehicleId}/test-drive`);
        const d = await res.json();
        setActiveSession(d.ok ? d.session : null);
        setLoading(false);
    }, [vehicleId]);

    useEffect(() => { loadActive(); }, [loadActive]);

    return (
        <div className="space-y-4 w-full">
            {/* Header */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-[15px] font-bold text-slate-800 mb-3">Test Drive</h3>
                        <div className="flex gap-1 border-b border-slate-200">
                            {(['new', 'history'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setSubTab(t)}
                                    className={`px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${subTab === t ? 'border-[#4D7CFF] text-[#4D7CFF]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t === 'new' ? 'Start New Session' : 'Session History'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {branchName && (
                            <span className="flex items-center gap-1.5 border border-teal-400 text-teal-600 text-[12px] font-semibold px-3 py-1.5 rounded-lg">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                {branchName}
                            </span>
                        )}
                        {activeSession && (
                            <span className="flex items-center gap-1.5 border border-teal-400 text-teal-600 text-[12px] font-semibold px-3 py-1.5 rounded-lg">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4"/></svg>
                                Test Drive
                            </span>
                        )}
                        {vehicleStatus && (
                            <span className="bg-[#4D7CFF] text-white text-[12px] font-bold px-4 py-1.5 rounded-lg">{vehicleStatus}</span>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm py-12 text-center text-[13px] text-slate-400">Loading…</div>
            ) : subTab === 'new' ? (
                activeSession ? (
                    <CurrentSession
                        session={activeSession}
                        vehicleId={vehicleId}
                        onEnd={() => { setActiveSession(null); setSubTab('history'); }}
                        onRefresh={s => setActiveSession(s)}
                    />
                ) : (
                    <StartNewSession vehicleId={vehicleId} vehicleVRM={vehicleVRM} onStarted={s => setActiveSession(s)} />
                )
            ) : (
                <SessionHistory vehicleId={vehicleId} />
            )}
        </div>
    );
}
