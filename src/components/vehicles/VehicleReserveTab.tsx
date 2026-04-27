'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface CustomerRef {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
}

interface Reservation {
    _id: string;
    customerId: CustomerRef;
    paymentMethod: string;
    amountPaid: number;
    invoiceNumber: string;
    notes?: string;
    status: 'active' | 'cancelled';
    reservedAt: string;
}

interface CustomerResult {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
}

interface Props {
    vehicleId: string;
    vehicleStatus: string;
    onStatusChange?: (newStatus: string) => void;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function initials(first?: string, last?: string) {
    return `${first?.charAt(0) ?? ''}${last?.charAt(0) ?? ''}`.toUpperCase();
}

function fmtDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtCurrency(amount: number) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

/* ─── New Contact Modal ──────────────────────────────────────────────────────── */
function NewContactModal({ onCreated, onClose }: {
    onCreated: (customer: CustomerResult) => void;
    onClose: () => void;
}) {
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [saving, setSaving] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.firstName.trim() || !form.lastName.trim()) { toast.error('Name required'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/crm/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, source: 'Walk-in', status: 'Lead' }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed');
            toast.success('Contact created');
            onCreated(data.customer);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-bold text-slate-800">New Contact</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>
                <form onSubmit={submit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">First Name *</label>
                            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Last Name *</label>
                            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Email</label>
                        <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Phone</label>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 border border-slate-200 rounded-lg py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 bg-[#4D7CFF] text-white rounded-lg py-2 text-[13px] font-semibold hover:bg-[#3a6ae0] disabled:opacity-60">
                            {saving ? 'Creating…' : 'Create Contact'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */
export function VehicleReserveTab({ vehicleId, vehicleStatus, onStatusChange }: Props) {
    const [reservation, setReservation] = useState<Reservation | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // Form state
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('No Payment');
    const [amountPaid, setAmountPaid] = useState('');
    const [notes, setNotes] = useState('');
    const [showNewContact, setShowNewContact] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const fetchReservation = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/reservation`);
            const data = await res.json();
            if (data.ok) setReservation(data.reservation);
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    }, [vehicleId]);

    useEffect(() => { fetchReservation(); }, [fetchReservation]);

    // Customer search
    useEffect(() => {
        if (customerQuery.length < 2) { setCustomerResults([]); setShowDropdown(false); return; }
        const t = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await fetch(`/api/crm/customers?q=${encodeURIComponent(customerQuery)}&limit=8`);
                const data = await res.json();
                setCustomerResults(data.customers || []);
                setShowDropdown(true);
            } catch { /* silent */ } finally {
                setSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [customerQuery]);

    // Close dropdown on outside click
    useEffect(() => {
        function handle(e: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
        }
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    async function handleReserve() {
        if (!selectedCustomer) { toast.error('Please select a customer'); return; }
        setSaving(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/reservation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: selectedCustomer._id,
                    paymentMethod,
                    amountPaid: paymentMethod === 'No Payment' ? 0 : (parseFloat(amountPaid) || 0),
                    notes: notes.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed to reserve');
            toast.success('Vehicle reserved successfully');
            setReservation(data.reservation);
            onStatusChange?.('Reserved');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleCancel(cancelType: 'with_credit' | 'without_credit') {
        setCancelling(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/reservation`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancelType }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed to cancel');
            toast.success('Reservation cancelled');
            setReservation(null);
            setShowCancelConfirm(false);
            onStatusChange?.('In Stock');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setCancelling(false);
        }
    }

    const isReserved = !!reservation;

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-12 text-center">
                <div className="w-8 h-8 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[13px] text-slate-400">Loading reservation…</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 w-full">
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <h2 className="text-[16px] font-bold text-slate-900">Reserve Vehicle</h2>
                    <div className="flex items-center gap-2">
                        {/* Location pin */}
                        <button className="w-9 h-9 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        {/* Reserved badge */}
                        {isReserved && (
                            <div className="flex items-center gap-1.5 border border-emerald-500 text-emerald-600 text-[12px] font-bold px-3 py-1.5 rounded-lg">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Reserved
                            </div>
                        )}
                        {/* For Sale button */}
                        <button className="bg-[#4D7CFF] text-white text-[13px] font-bold px-4 py-1.5 rounded-lg hover:bg-[#3a6ae0] transition-colors">
                            For Sale
                        </button>
                    </div>
                </div>

                {/* ── Reserved State ── */}
                {isReserved && reservation && (
                    <div className="p-6 space-y-4">
                        {/* Banner */}
                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-4">
                            <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span className="text-[15px] font-bold text-emerald-600">Vehicle Is Reserved!</span>
                        </div>

                        {/* Details table */}
                        <div className="rounded-xl border border-slate-100 overflow-hidden">
                            {/* Reserved For */}
                            <div className="flex items-center px-5 py-4 bg-slate-50/50 border-b border-slate-100">
                                <span className="text-[13px] text-slate-500 w-48">Reserved For:</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#4D7CFF] flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
                                        {initials(reservation.customerId.firstName, reservation.customerId.lastName)}
                                    </div>
                                    <span className="text-[14px] font-bold text-[#4D7CFF]">
                                        {reservation.customerId.firstName} {reservation.customerId.lastName}
                                    </span>
                                </div>
                            </div>
                            {/* Amount Paid */}
                            <div className="flex items-center px-5 py-4 border-b border-slate-100">
                                <span className="text-[13px] text-slate-500 w-48">Amount Paid:</span>
                                <span className="text-[14px] font-semibold text-slate-800">
                                    {reservation.amountPaid > 0 ? fmtCurrency(reservation.amountPaid) : '£0.00'}
                                </span>
                            </div>
                            {/* Payment Method */}
                            <div className="flex items-center px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                                <span className="text-[13px] text-slate-500 w-48">Payment Method:</span>
                                <span className="text-[14px] text-slate-700">{reservation.paymentMethod}</span>
                            </div>
                            {/* Invoice ID */}
                            <div className="flex items-center px-5 py-4 border-b border-slate-100">
                                <span className="text-[13px] text-slate-500 w-48">Invoice ID:</span>
                                <span className="text-[14px] font-bold text-[#4D7CFF]">{reservation.invoiceNumber}</span>
                            </div>
                            {/* Date of Reservation */}
                            <div className="flex items-center px-5 py-4 bg-slate-50/50">
                                <span className="text-[13px] text-slate-500 w-48">Date of Reservation:</span>
                                <span className="text-[14px] text-slate-700">{fmtDate(reservation.reservedAt)}</span>
                            </div>
                            {reservation.notes && (
                                <div className="flex items-start px-5 py-4 border-t border-slate-100">
                                    <span className="text-[13px] text-slate-500 w-48">Notes:</span>
                                    <span className="text-[13px] text-slate-700">{reservation.notes}</span>
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        {!showCancelConfirm ? (
                            <div className="flex flex-wrap gap-2 pt-2">
                                <button
                                    onClick={() => setShowCancelConfirm(true)}
                                    className="bg-[#4D7CFF] text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-[#3a6ae0] transition-colors"
                                >
                                    Cancel &amp; Credit Reservation
                                </button>
                                <button
                                    onClick={() => handleCancel('without_credit')}
                                    disabled={cancelling}
                                    className="bg-slate-500 text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-60"
                                >
                                    Cancel Without Credit
                                </button>
                                <button className="bg-slate-500 text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-slate-600 transition-colors">
                                    Create Invoice
                                </button>
                                <button className="bg-slate-500 text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-slate-600 transition-colors">
                                    Create Deal
                                </button>
                                <button className="bg-slate-500 text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-slate-600 transition-colors">
                                    Sell Vehicle
                                </button>
                            </div>
                        ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                                <p className="text-[14px] font-bold text-amber-800 mb-1">Cancel &amp; Credit Reservation?</p>
                                <p className="text-[12px] text-amber-700 mb-4">This will create a credit note to reverse the reservation and mark the vehicle as available again.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleCancel('with_credit')}
                                        disabled={cancelling}
                                        className="bg-[#4D7CFF] text-white text-[12px] font-bold px-4 py-2 rounded-lg hover:bg-[#3a6ae0] disabled:opacity-60"
                                    >
                                        {cancelling ? 'Cancelling…' : 'Confirm & Credit'}
                                    </button>
                                    <button onClick={() => setShowCancelConfirm(false)} className="border border-slate-200 text-slate-600 text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-slate-50">
                                        Go Back
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Not Reserved State (Form) ── */}
                {!isReserved && (
                    <div className="p-6 space-y-6">
                        {/* Customer field */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[14px] font-semibold text-slate-700">Customer</label>
                                <button
                                    onClick={() => setShowNewContact(true)}
                                    className="flex items-center gap-1.5 border border-[#4D7CFF] text-[#4D7CFF] text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                    New Contact
                                </button>
                            </div>

                            {selectedCustomer ? (
                                <div className="flex items-center justify-between border border-[#4D7CFF] rounded-xl px-4 py-3 bg-blue-50/30">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-[#4D7CFF] flex items-center justify-center text-white font-bold text-[12px]">
                                            {initials(selectedCustomer.firstName, selectedCustomer.lastName)}
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-bold text-slate-800">{selectedCustomer.firstName} {selectedCustomer.lastName}</div>
                                            {selectedCustomer.email && <div className="text-[11px] text-slate-400">{selectedCustomer.email}</div>}
                                        </div>
                                    </div>
                                    <button onClick={() => { setSelectedCustomer(null); setCustomerQuery(''); }} className="text-slate-400 hover:text-red-500 text-lg transition-colors">&times;</button>
                                </div>
                            ) : (
                                <div ref={searchRef} className="relative">
                                    <input
                                        type="text"
                                        placeholder="Start typing to search..."
                                        value={customerQuery}
                                        onChange={e => setCustomerQuery(e.target.value)}
                                        onFocus={() => customerResults.length > 0 && setShowDropdown(true)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] focus:outline-none focus:border-[#4D7CFF] transition-colors"
                                    />
                                    {searchLoading && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="w-4 h-4 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                    {showDropdown && customerResults.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                                            {customerResults.map(c => (
                                                <button
                                                    key={c._id}
                                                    onClick={() => { setSelectedCustomer(c); setCustomerQuery(''); setShowDropdown(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-[#4D7CFF] flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
                                                        {initials(c.firstName, c.lastName)}
                                                    </div>
                                                    <div>
                                                        <div className="text-[13px] font-semibold text-slate-800">{c.firstName} {c.lastName}</div>
                                                        {c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {showDropdown && customerQuery.length >= 2 && !searchLoading && customerResults.length === 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 px-4 py-3">
                                            <p className="text-[12px] text-slate-400">No contacts found. <button onClick={() => setShowNewContact(true)} className="text-[#4D7CFF] font-semibold hover:underline">Create new contact</button></p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-100" />

                        {/* Payment Method */}
                        <div>
                            <label className="block text-[14px] font-semibold text-slate-700 mb-2">Payment Method</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] focus:outline-none focus:border-[#4D7CFF] bg-white appearance-none"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px', paddingRight: '40px' }}
                            >
                                <option>No Payment</option>
                                <option>Cash</option>
                                <option>Bank Transfer</option>
                                <option>Card</option>
                            </select>
                        </div>

                        {/* Amount */}
                        {paymentMethod !== 'No Payment' && (
                            <div>
                                <label className="block text-[14px] font-semibold text-slate-700 mb-2">Amount (£)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={amountPaid}
                                    onChange={e => setAmountPaid(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                />
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <label className="block text-[14px] font-semibold text-slate-700 mb-2">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                            <textarea
                                rows={3}
                                placeholder="Add any reservation notes..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleReserve}
                            disabled={saving || !selectedCustomer}
                            className="bg-[#4D7CFF] text-white text-[14px] font-bold px-6 py-3 rounded-lg hover:bg-[#3a6ae0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px]"
                        >
                            {saving ? 'Reserving…' : 'Reserve Vehicle'}
                        </button>
                    </div>
                )}
            </div>

            {showNewContact && (
                <NewContactModal
                    onCreated={c => { setSelectedCustomer(c); setShowNewContact(false); }}
                    onClose={() => setShowNewContact(false)}
                />
            )}
        </div>
    );
}
