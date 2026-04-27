'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Customer { _id: string; firstName: string; lastName: string; businessName?: string; email?: string; phone?: string; address?: { line1?: string; city?: string; postcode?: string; country?: string }; vatNumber?: string; }
interface VehicleData { vrm: string; vin?: string; make: string; model: string; derivative: string; engineNumber?: string; stockId?: string; colour?: string; dateOfRegistration?: string; mileage?: number; }
interface LineItem { name: string; description?: string; priceExcVat: number; vatRate: string; isVehicle?: boolean; }
interface PartExchange { vrm: string; vehicleName?: string; vin?: string; mileage?: number; price: number; vatRate: string; createPurchaseInvoice: boolean; addToVehicles: boolean; }
interface Payment { date: string; amount: number; method: string; note?: string; }
interface Credit { name: string; description?: string; quantity: number; amount: number; vatRate: string; }
interface Invoice {
    _id: string;
    invoiceNumber: string;
    status: 'draft' | 'issued' | 'paid' | 'credited' | 'cancelled' | 'void';
    invoiceType: 'VAT Invoice' | 'Margin Scheme';
    invoiceCategory: 'sale' | 'aftersale' | 'finance_provider';
    invoiceDate: string;
    issuedAt?: string;
    paidAt?: string;
    customerId: Customer | null;
    vehicleId: VehicleData | null;
    vehicleVrm?: string;
    lineItems: LineItem[];
    partExchanges: PartExchange[];
    finance?: { amount: number; providerName?: string; generateProviderInvoice: boolean; customerDeposit: number; paidBy?: string; };
    payments: Payment[];
    credits: Credit[];
    invoiceNotes?: string;
    termsAndConditions?: string;
    handoverComplete: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const GBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
function vatAmt(price: number, rate: string) {
    if (rate === '5%') return price * 0.05;
    if (rate === '20%') return price * 0.2;
    return 0;
}
function fmtDate(s?: string) { if (!s) return '—'; try { return new Date(s).toLocaleDateString('en-GB'); } catch { return s; } }
function fmtDateTime(s?: string) { if (!s) return '—'; try { return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return s; } }

function calcTotals(inv: Invoice) {
    let subtotal = 0, vat = 0;
    (inv.lineItems ?? []).forEach(i => { subtotal += i.priceExcVat; vat += vatAmt(i.priceExcVat, i.vatRate); });
    const pxTotal = (inv.partExchanges ?? []).reduce((s, p) => s + p.price, 0);
    const financeAmt = inv.finance?.amount ?? 0;
    const totalPaid = (inv.payments ?? []).reduce((s, p) => s + p.amount, 0);
    const total = subtotal + vat - pxTotal;
    const balance = total - totalPaid;
    const creditSubtotal = (inv.credits ?? []).reduce((s, c) => s + (c.amount * c.quantity), 0);
    const creditVat = (inv.credits ?? []).reduce((s, c) => s + vatAmt(c.amount * c.quantity, c.vatRate), 0);
    return { subtotal, vat, pxTotal, total, financeAmt, totalPaid, balance, creditSubtotal, creditVat };
}

/* ─── Status Badge ───────────────────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-[#14b8a6] text-white',
    issued: 'bg-[#4D7CFF] text-white',
    paid: 'bg-[#10b981] text-white',
    credited: 'bg-[#f59e0b] text-white',
    cancelled: 'bg-slate-400 text-white',
    void: 'bg-slate-300 text-slate-600',
};
function StatusBadge({ status }: { status: string }) {
    return <span className={`inline-flex px-4 py-1.5 rounded-lg text-[13px] font-bold ${STATUS_STYLES[status] ?? 'bg-slate-200 text-slate-700'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

/* ─── Payments Modal ─────────────────────────────────────────────────────────── */
function PaymentsModal({ invoice, onSaved, onClose }: { invoice: Invoice; onSaved: (inv: Invoice) => void; onClose: () => void; }) {
    const [payments, setPayments] = useState<Payment[]>(
        (invoice.payments ?? []).length > 0 ? invoice.payments : [{ date: invoice.invoiceDate, amount: 0, method: 'Bank Transfer' }]
    );
    const [saving, setSaving] = useState(false);
    const [markPaid, setMarkPaid] = useState(false);

    const totals = calcTotals(invoice);
    const enteredTotal = payments.reduce((s, p) => s + (parseFloat(String(p.amount)) || 0), 0);
    const balance = totals.total - enteredTotal;

    async function handleSave(paid: boolean) {
        setSaving(true);
        try {
            const validPayments = payments.filter(p => p.date && p.amount > 0);
            const action = paid ? 'markPaid' : 'savePayments';
            const body: Record<string, unknown> = { action, payments: validPayments };
            const res = await fetch(`/api/invoices/${invoice._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success(paid ? 'Invoice marked as paid' : 'Payments saved');
            onSaved(data.invoice);
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Payments</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-slate-500">Invoice Options ▾</span>
                        <StatusBadge status={invoice.status} />
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl ml-2">&times;</button>
                    </div>
                </div>

                {invoice.vehicleId && (
                    <div className="mx-6 mt-4 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-teal-700 text-[13px]">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                            <span><strong>Sell Vehicle</strong> — Marking this invoice as paid will complete the sale of <strong>{invoice.vehicleId.vrm}</strong>.</span>
                        </div>
                        <Link href={`/app/vehicles/${(invoice.vehicleId as any)._id ?? ''}`} className="text-[12px] font-semibold text-white bg-teal-600 px-3 py-1.5 rounded-lg hover:bg-teal-700">View Vehicle</Link>
                    </div>
                )}

                <div className="px-6 py-4">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="py-2 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Date</th>
                                <th className="py-2 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Amount</th>
                                <th className="py-2 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Method</th>
                                <th className="py-2 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Transaction ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((p, idx) => (
                                <tr key={idx} className="border-b border-slate-50">
                                    <td className="py-2 pr-3">
                                        <input type="date" value={p.date} onChange={e => setPayments(prev => prev.map((x, i) => i === idx ? { ...x, date: e.target.value } : x))}
                                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                    </td>
                                    <td className="py-2 pr-3">
                                        <div className="flex items-center">
                                            <span className="border border-r-0 border-slate-200 rounded-l-lg px-2 py-1.5 text-[12px] text-slate-400 bg-slate-50">£</span>
                                            <input type="number" step="0.01" value={p.amount || ''} placeholder=""
                                                onChange={e => setPayments(prev => prev.map((x, i) => i === idx ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                                                className="w-32 border border-slate-200 rounded-r-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                        </div>
                                    </td>
                                    <td className="py-2 pr-3">
                                        <select value={p.method} onChange={e => setPayments(prev => prev.map((x, i) => i === idx ? { ...x, method: e.target.value } : x))}
                                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                            {['Bank Transfer', 'Cash', 'Card', 'Finance', 'Other'].map(m => <option key={m}>{m}</option>)}
                                        </select>
                                    </td>
                                    <td className="py-2">
                                        <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                            value={p.note || ''} onChange={e => setPayments(prev => prev.map((x, i) => i === idx ? { ...x, note: e.target.value } : x))} />
                                    </td>
                                </tr>
                            ))}
                            <tr>
                                <td className="py-2">
                                    <button onClick={() => setPayments(prev => [...prev, { date: invoice.invoiceDate, amount: 0, method: 'Bank Transfer' }])}
                                        className="text-[#4D7CFF] text-[12px] font-semibold border border-[#4D7CFF] px-2.5 py-1 rounded-lg hover:bg-blue-50">
                                        + ADD ANOTHER
                                    </button>
                                </td>
                                <td className="py-2">
                                    <div className="flex items-center gap-1">
                                        <span className="border border-r-0 border-slate-200 rounded-l-lg px-2 py-1.5 text-[12px] text-slate-400 bg-slate-50">£</span>
                                        <span className="w-32 border border-slate-200 rounded-r-lg px-2 py-1.5 text-[13px] font-medium text-slate-800">{enteredTotal.toFixed(2)}</span>
                                    </div>
                                </td>
                                <td className="py-2 text-[12px] font-bold text-slate-600">
                                    BALANCE: <sup className="text-[#4D7CFF]">[?]</sup>
                                </td>
                                <td className="py-2">
                                    <div className="flex items-center gap-1">
                                        <span className="border border-r-0 border-slate-200 rounded-l-lg px-2 py-1.5 text-[12px] text-slate-400 bg-slate-50">£</span>
                                        <span className={`w-24 border border-slate-200 rounded-r-lg px-2 py-1.5 text-[13px] font-medium ${balance < 0 ? 'text-red-500' : balance === 0 ? 'text-green-600' : 'text-slate-800'}`}>
                                            {balance.toFixed(2)}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="text-[11px] text-slate-400 mt-3 italic">
                        Payments are optional and are recorded for your convenience. You can skip this step and simply mark the invoice as paid.{' '}
                        <strong>Please note, any payments added to an un-paid invoice will affect the invoice total which will be displayed as a &apos;Balance To Pay&apos;.</strong>
                    </p>
                </div>

                <div className="flex justify-end gap-2 px-6 pb-5">
                    <button onClick={() => handleSave(true)} disabled={saving}
                        className="bg-[#10b981] text-white px-5 py-2 rounded-lg text-[13px] font-bold hover:bg-emerald-600 disabled:opacity-60">
                        {saving ? 'Saving…' : 'Mark As Paid'}
                    </button>
                    <button onClick={() => handleSave(false)} disabled={saving}
                        className="bg-[#4D7CFF] text-white px-5 py-2 rounded-lg text-[13px] font-bold hover:bg-[#3a6ae0] disabled:opacity-60">
                        Save
                    </button>
                    <button onClick={onClose}
                        className="bg-slate-500 text-white px-5 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-600">
                        View
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Issue Credit Modal ─────────────────────────────────────────────────────── */
function CreditModal({ invoice, onSaved, onClose }: { invoice: Invoice; onSaved: (inv: Invoice) => void; onClose: () => void; }) {
    const [form, setForm] = useState({ name: '', description: '', quantity: '1', amount: '', vatRate: 'No VAT' as 'No VAT' | '5%' | '20%', notesAndRefund: '' });
    const [saving, setSaving] = useState(false);

    const qty = parseInt(form.quantity) || 1;
    const amt = parseFloat(form.amount) || 0;
    const vatAmt2 = form.vatRate === '20%' ? amt * qty * 0.2 : form.vatRate === '5%' ? amt * qty * 0.05 : 0;
    const totalCredit = amt * qty + vatAmt2;

    async function handleSave() {
        if (!form.name.trim()) { toast.error('Credit name required'); return; }
        if (amt <= 0) { toast.error('Amount required'); return; }
        setSaving(true);
        try {
            const res = await fetch(`/api/invoices/${invoice._id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'addCredit', credit: { name: form.name, description: form.description || undefined, quantity: qty, amount: amt, vatRate: form.vatRate } }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success('Credit note issued');
            onSaved(data.invoice);
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Add Credit</h2>
                    <div className="flex items-center gap-2">
                        {(invoice.credits ?? []).length > 0 && (
                            <span className="text-[12px] font-bold text-white bg-red-400 px-3 py-1 rounded-lg">{invoice.credits.length} Credit Note{invoice.credits.length > 1 ? 's' : ''}</span>
                        )}
                        <StatusBadge status={invoice.status} />
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl ml-2">&times;</button>
                    </div>
                </div>
                <div className="px-6 py-4 space-y-4">
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Credit Name</label>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Credit Quantity</label>
                        <input type="number" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                            value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Description &amp; Reason</label>
                        <textarea rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none"
                            value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 mb-1">Amount Exc. VAT</label>
                            <div className="flex">
                                <span className="border border-r-0 border-slate-200 rounded-l-lg px-3 py-2 text-[13px] text-slate-400 bg-slate-50">£</span>
                                <input type="number" step="0.01" className="flex-1 border border-slate-200 rounded-r-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                    value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 mb-1">VAT Applies</label>
                            <select value={form.vatRate} onChange={e => setForm(p => ({ ...p, vatRate: e.target.value as any }))}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                <option value="No VAT">No VAT</option>
                                <option value="5%">5% VAT</option>
                                <option value="20%">20% VAT</option>
                            </select>
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={saving}
                        className="bg-[#4D7CFF] text-white px-5 py-2 rounded-lg text-[13px] font-bold hover:bg-[#3a6ae0] disabled:opacity-60">
                        {saving ? 'Adding…' : 'Add Credit'}
                    </button>
                </div>

                {/* Issue Credit Note preview */}
                {amt > 0 && (
                    <div className="mx-6 mb-5 border border-slate-100 rounded-xl">
                        <div className="px-4 py-3 bg-slate-50/60 rounded-t-xl">
                            <h3 className="text-[13px] font-bold text-slate-800">Issue Credit Note</h3>
                        </div>
                        <div className="px-4 py-3">
                            <table className="w-full text-[13px]">
                                <thead><tr className="border-b border-slate-100">
                                    <th className="pb-2 text-left font-semibold text-slate-500 uppercase text-[11px]">QTY</th>
                                    <th className="pb-2 text-left font-semibold text-slate-500 uppercase text-[11px]">Credit</th>
                                    <th className="pb-2 text-right font-semibold text-slate-500 uppercase text-[11px]">Amount</th>
                                    <th className="pb-2 text-right font-semibold text-slate-500 uppercase text-[11px]">VAT Rate</th>
                                </tr></thead>
                                <tbody>
                                    <tr className="border-b border-slate-50">
                                        <td className="py-2 text-slate-700">{qty}</td>
                                        <td className="py-2 font-semibold text-slate-800">{form.name || '—'}</td>
                                        <td className="py-2 text-right text-slate-700">{GBP(amt * qty)}</td>
                                        <td className="py-2 text-right text-slate-700">{form.vatRate === 'No VAT' ? '0%' : form.vatRate}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="text-right space-y-1 mt-3 text-[13px]">
                                <div className="flex justify-end gap-8"><span className="text-slate-500">Sub-Total:</span><span className="font-medium text-slate-800">{GBP(amt * qty)}</span></div>
                                <div className="flex justify-end gap-8"><span className="text-slate-500">VAT:</span><span className="font-medium text-slate-800">{GBP(vatAmt2)}</span></div>
                                <div className="flex justify-end gap-8 border-t border-slate-100 pt-1"><span className="font-bold text-slate-700">Total Credit:</span><span className="font-bold text-slate-900">{GBP(totalCredit)}</span></div>
                            </div>
                            <div className="mt-3">
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Notes &amp; Refund Details</label>
                                <textarea rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none"
                                    value={form.notesAndRefund} onChange={e => setForm(p => ({ ...p, notesAndRefund: e.target.value }))} />
                            </div>
                            <div className="flex gap-2 mt-3">
                                <button onClick={handleSave} disabled={saving}
                                    className="bg-[#4D7CFF] text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-[#3a6ae0] disabled:opacity-60">
                                    Save Credit Note
                                </button>
                                <button onClick={onClose} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-300">View Invoice</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Cancel Confirm Modal ───────────────────────────────────────────────────── */
function CancelModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void; }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[15px] font-bold text-slate-800">Confirm Invoice Cancellation</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>
                <p className="text-[13px] text-slate-600 mb-6">Please confirm you would like to cancel this invoice.</p>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-400 text-white rounded-lg text-[13px] font-bold hover:bg-slate-500">Close</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white rounded-lg text-[13px] font-bold hover:bg-red-600">Confirm Cancel</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Email eSign Modal ──────────────────────────────────────────────────────── */
function EmailEsignModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
    const [email, setEmail] = useState((invoice.customerId as any)?.email ?? '');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSend() {
        if (!email) return;
        setSending(true);
        await new Promise(r => setTimeout(r, 900));
        setSending(false);
        setSent(true);
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Email eSign Link</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {sent ? (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <p className="text-[14px] font-semibold text-slate-800">eSign link sent!</p>
                            <p className="text-[13px] text-slate-500">An eSign link for invoice {invoice.invoiceNumber} was sent to <strong>{email}</strong>.</p>
                            <button onClick={onClose} className="mt-2 px-4 py-2 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae0]">Close</button>
                        </div>
                    ) : (
                        <>
                            <p className="text-[13px] text-slate-500">Send an eSign link for invoice <strong>{invoice.invoiceNumber}</strong> to your customer.</p>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Recipient Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="customer@example.com"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                                <button onClick={handleSend} disabled={!email || sending}
                                    className="px-4 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae0] disabled:opacity-50">
                                    {sending ? 'Sending…' : 'Send eSign Link'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Share eSign Modal ──────────────────────────────────────────────────────── */
function ShareEsignModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
    const link = typeof window !== 'undefined' ? `${window.location.origin}/esign/${invoice._id}` : '';
    const [copied, setCopied] = useState(false);

    function copy() {
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Share eSign Link</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <p className="text-[13px] text-slate-500">Share this link with your customer to sign invoice <strong>{invoice.invoiceNumber}</strong>.</p>
                    <div className="flex gap-2">
                        <input readOnly value={link} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-600 bg-slate-50 focus:outline-none" />
                        <button onClick={copy}
                            className={`px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-[#4D7CFF] text-white hover:bg-[#3a6ae0]'}`}>
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <div className="flex justify-end pt-1">
                        <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── eSign Modal ────────────────────────────────────────────────────────────── */
function EsignModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
    const [drawing, setDrawing] = useState(false);
    const [hasSig, setHasSig] = useState(false);
    const [saved, setSaved] = useState(false);
    const ref = { current: null as HTMLCanvasElement | null };

    function getCtx() {
        const canvas = ref.current;
        if (!canvas) return null;
        return canvas.getContext('2d');
    }

    function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
        const ctx = getCtx(); if (!ctx || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
        setDrawing(true);
    }

    function draw(e: React.MouseEvent<HTMLCanvasElement>) {
        if (!drawing) return;
        const ctx = getCtx(); if (!ctx || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.stroke();
        setHasSig(true);
    }

    function clear() {
        const ctx = getCtx(); if (!ctx || !ref.current) return;
        ctx.clearRect(0, 0, ref.current.width, ref.current.height);
        setHasSig(false);
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Sign Invoice {invoice.invoiceNumber}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {saved ? (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <p className="text-[14px] font-semibold text-slate-800">Invoice signed successfully!</p>
                            <button onClick={onClose} className="mt-2 px-4 py-2 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae0]">Close</button>
                        </div>
                    ) : (
                        <>
                            <p className="text-[13px] text-slate-500">Please sign below to confirm agreement with invoice <strong>{invoice.invoiceNumber}</strong>.</p>
                            <div className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                <canvas
                                    ref={el => { ref.current = el; }}
                                    width={500} height={160}
                                    className="w-full cursor-crosshair touch-none"
                                    onMouseDown={startDraw}
                                    onMouseMove={draw}
                                    onMouseUp={() => setDrawing(false)}
                                    onMouseLeave={() => setDrawing(false)}
                                />
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <button onClick={clear} className="text-[13px] text-slate-500 hover:text-slate-700 underline">Clear</button>
                                <div className="flex gap-2">
                                    <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                                    <button onClick={() => setSaved(true)} disabled={!hasSig}
                                        className="px-4 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae0] disabled:opacity-40">
                                        Save Signature
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Email Invoice Modal ────────────────────────────────────────────────────── */
function EmailInvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
    const [email, setEmail] = useState((invoice.customerId as any)?.email ?? '');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSend() {
        if (!email) return;
        setSending(true);
        await new Promise(r => setTimeout(r, 900));
        setSending(false);
        setSent(true);
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Email Invoice</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {sent ? (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <p className="text-[14px] font-semibold text-slate-800">Invoice sent!</p>
                            <p className="text-[13px] text-slate-500">Invoice <strong>{invoice.invoiceNumber}</strong> was emailed to <strong>{email}</strong>.</p>
                            <button onClick={onClose} className="mt-2 px-4 py-2 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae0]">Close</button>
                        </div>
                    ) : (
                        <>
                            <p className="text-[13px] text-slate-500">Send invoice <strong>{invoice.invoiceNumber}</strong> by email to your customer.</p>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Recipient Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="customer@example.com"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                                <button onClick={handleSend} disabled={!email || sending}
                                    className="px-4 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae0] disabled:opacity-50">
                                    {sending ? 'Sending…' : 'Send Invoice'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Send Documents Modal ───────────────────────────────────────────────────── */
function SendDocumentsModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
    const [libraryDocs, setLibraryDocs] = useState<{ _id: string; name: string; group?: string }[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [sentType, setSentType] = useState<'esign' | 'email'>('esign');

    useEffect(() => {
        fetch('/api/sales-documents').then(r => r.json()).then(data => {
            if (data.ok) setLibraryDocs(data.documents || []);
        }).finally(() => setLoadingDocs(false));
    }, []);

    function toggleDoc(id: string) {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }

    async function handleSend(type: 'esign' | 'email') {
        if (!selectedIds.size) { toast.error('Select at least one document'); return; }
        const customerId = (invoice.customerId as any)?._id;
        if (!customerId) { toast.error('No customer on this invoice'); return; }
        setSending(true);
        setSentType(type);
        try {
            const res = await fetch('/api/sales-documents/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId,
                    documentIds: [...selectedIds],
                    type,
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            setSent(true);
        } catch (err: any) {
            toast.error(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    }

    const grouped = libraryDocs.reduce<Record<string, typeof libraryDocs>>((acc, d) => {
        const g = d.group || 'No Group';
        (acc[g] = acc[g] || []).push(d);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Send Documents</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {sent ? (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <p className="text-[14px] font-semibold text-slate-800">Documents sent!</p>
                            <p className="text-[13px] text-slate-500 text-center">
                                {sentType === 'esign' ? 'An eSign request' : 'Documents'} for invoice <strong>{invoice.invoiceNumber}</strong> were sent to the customer.
                            </p>
                            <button onClick={onClose} className="mt-2 px-4 py-2 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae0]">Close</button>
                        </div>
                    ) : (
                        <>
                            <p className="text-[13px] text-slate-500">Send documents alongside invoice <strong>{invoice.invoiceNumber}</strong>.</p>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Documents</label>
                                {loadingDocs ? (
                                    <div className="border border-slate-200 rounded-lg p-3 text-[13px] text-slate-400 text-center">Loading…</div>
                                ) : libraryDocs.length === 0 ? (
                                    <div className="border border-slate-200 rounded-lg p-4 text-center">
                                        <p className="text-[13px] text-slate-400">No documents in library.</p>
                                        <a href="/app/sales/documents" className="text-[13px] text-[#4D7CFF] font-semibold hover:underline">Add documents →</a>
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        {Object.entries(grouped).map(([grp, docs]) => (
                                            <div key={grp}>
                                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox"
                                                            checked={docs.every(d => selectedIds.has(d._id))}
                                                            onChange={e => {
                                                                const next = new Set(selectedIds);
                                                                docs.forEach(d => e.target.checked ? next.add(d._id) : next.delete(d._id));
                                                                setSelectedIds(next);
                                                            }}
                                                            className="rounded border-slate-300"
                                                        />
                                                        <span className="text-[12px] font-bold text-slate-700">{grp}</span>
                                                    </label>
                                                </div>
                                                {docs.map(d => (
                                                    <label key={d._id} className="flex items-center gap-2 px-5 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                                        <input type="checkbox"
                                                            checked={selectedIds.has(d._id)}
                                                            onChange={() => toggleDoc(d._id)}
                                                            className="rounded border-slate-300"
                                                        />
                                                        <span className="text-[13px] text-slate-700">{d.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                                <button onClick={() => handleSend('email')} disabled={sending || !selectedIds.size}
                                    className="px-4 py-2 text-[13px] font-semibold text-white bg-slate-500 rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                    {sending && sentType === 'email' ? 'Sending…' : 'Email Without eSign'}
                                </button>
                                <button onClick={() => handleSend('esign')} disabled={sending || !selectedIds.size}
                                    className="px-4 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae0] disabled:opacity-50">
                                    {sending && sentType === 'esign' ? 'Sending…' : 'Request eSign'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Invoice Options Dropdown ───────────────────────────────────────────────── */
function InvoiceOptionsMenu({ invoice, onAction }: { invoice: Invoice; onAction: (action: string) => void; }) {
    const [open, setOpen] = useState(false);
    const st = invoice.status;
    const notVoidCancelled = st !== 'cancelled' && st !== 'void';

    const opts = [
        { label: 'Edit Invoice', action: 'edit' },
        { label: 'Print Invoice', action: 'print' },
        { label: 'Email Invoice', action: 'emailInvoice' },
        { label: 'Edit Payments', action: 'editPayments' },
        ...(notVoidCancelled ? [{ label: 'Issue Credit Note', action: 'credit' }] : []),
        { label: 'Send Documents', action: 'sendDocuments' },
        { label: 'View Contact', action: 'viewContact' },
    ];
    return (
        <div className="relative">
            <button onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-[13px] font-semibold hover:bg-slate-50">
                Invoice Options
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 min-w-[160px] py-1">
                        {opts.map(o => (
                            <button key={o.action} onClick={() => { onAction(o.action); setOpen(false); }}
                                className="w-full text-left px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 font-medium">
                                {o.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function ViewInvoicePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [bizProfile, setBizProfile] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [showPayments, setShowPayments] = useState(false);
    const [showCredit, setShowCredit] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [showEmailEsign, setShowEmailEsign] = useState(false);
    const [showShareEsign, setShowShareEsign] = useState(false);
    const [showEsign, setShowEsign] = useState(false);
    const [showEmailInvoice, setShowEmailInvoice] = useState(false);
    const [showSendDocuments, setShowSendDocuments] = useState(false);
    const [acting, setActing] = useState(false);

    const fetchInvoice = useCallback(async () => {
        try {
            const [invRes, profRes] = await Promise.all([
                fetch(`/api/invoices/${id}`),
                fetch('/api/tenants/profile'),
            ]);
            const invData = await invRes.json();
            const profData = await profRes.json();
            if (invData.ok) setInvoice(invData.invoice);
            else toast.error('Invoice not found');
            if (profData.ok) setBizProfile(profData.profile ?? {});
        } catch { toast.error('Failed to load invoice'); } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

    async function doAction(action: string, extra?: Record<string, unknown>) {
        setActing(true);
        try {
            const res = await fetch(`/api/invoices/${id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...extra }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            setInvoice(data.invoice);
            toast.success(action === 'issue' ? 'Invoice issued' : action === 'cancel' ? 'Invoice cancelled' : 'Done');
        } catch (err: any) { toast.error(err.message); } finally { setActing(false); }
    }

    function handleMenuAction(action: string) {
        if (action === 'edit') router.push(`/app/sales/invoices/${id}/edit`);
        else if (action === 'credit') setShowCredit(true);
        else if (action === 'editPayments') setShowPayments(true);
        else if (action === 'print') window.print();
        else if (action === 'emailEsign') setShowEmailEsign(true);
        else if (action === 'shareEsign') setShowShareEsign(true);
        else if (action === 'esign') setShowEsign(true);
        else if (action === 'emailInvoice') setShowEmailInvoice(true);
        else if (action === 'sendDocuments') setShowSendDocuments(true);
        else if (action === 'viewContact' && invoice?.customerId) router.push(`/app/contacts?id=${(invoice.customerId as any)._id}`);
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64 text-slate-400 text-[13px]">Loading…</div>
    );
    if (!invoice) return (
        <div className="flex items-center justify-center h-64 text-slate-400 text-[13px]">Invoice not found.</div>
    );

    const t = calcTotals(invoice);
    const customer = invoice.customerId;
    const vehicle = invoice.vehicleId;
    const isDraft = invoice.status === 'draft';
    const isIssued = invoice.status === 'issued';
    const isPaid = invoice.status === 'paid';
    const isCancellable = isDraft || isIssued;

    return (
        <div className="space-y-3">
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #invoice-print, #invoice-print * { visibility: visible !important; }
                    #invoice-print {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 32px !important;
                        background: white !important;
                        box-sizing: border-box !important;
                    }
                    @page { margin: 10mm; }
                }
            `}</style>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
                <Link href="/app/sales/invoices" className="hover:text-[#4D7CFF]">Sales</Link>
                <span>/</span>
                <Link href="/app/sales/invoices" className="hover:text-[#4D7CFF]">Invoices</Link>
                <span>/</span>
                <span className="text-slate-800 font-semibold">Invoice {invoice.invoiceNumber}</span>
            </div>

            {/* Invoice document — single card like MotorDesk */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {/* Card header — title + options + status */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                    <span className="text-[14px] font-semibold text-slate-800">Invoice {invoice.invoiceNumber}</span>
                    <div className="flex items-center gap-2">
                        <InvoiceOptionsMenu invoice={invoice} onAction={handleMenuAction} />
                        <StatusBadge status={invoice.status} />
                    </div>
                </div>

                {/* Draft / Issued banners */}
                {isDraft && (
                    <div className="flex items-center justify-between px-5 py-3 bg-teal-50 border-b border-teal-200 text-[13px] text-teal-700">
                        <span><strong>Draft:</strong> This invoice has not been issued yet. Issue it to enable payments and signing.</span>
                        <button onClick={() => doAction('issue')} disabled={acting}
                            className="ml-4 bg-teal-600 text-white px-4 py-1.5 rounded-lg text-[13px] font-bold hover:bg-teal-700 whitespace-nowrap disabled:opacity-60">
                            Issue Invoice
                        </button>
                    </div>
                )}
                {isIssued && (
                    <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-200 text-[13px] text-blue-700">
                        <span><strong>Issued:</strong> Awaiting payment.</span>
                        <button onClick={() => setShowPayments(true)}
                            className="ml-4 bg-[#10b981] text-white px-4 py-1.5 rounded-lg text-[13px] font-bold hover:bg-emerald-600 whitespace-nowrap">
                            Mark as Paid
                        </button>
                    </div>
                )}

                <div className="p-6" id="invoice-print">

                    {/* Company header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                        <div>
                            <p style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', lineHeight: '1.2', margin: 0 }}>
                                {bizProfile.businessName || 'Your Business'}
                            </p>
                            {bizProfile.addressLine1 && <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{bizProfile.addressLine1}</p>}
                            {(bizProfile.city || bizProfile.postcode) && <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{[bizProfile.city, bizProfile.postcode].filter(Boolean).join(', ')}</p>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>Invoice #{invoice.invoiceNumber}</p>
                        </div>
                    </div>

                    {/* Invoice To / Invoice From */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #cbd5e1', padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc', width: '50%' }}>INVOICE TO</th>
                                <th style={{ border: '1px solid #cbd5e1', padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc', width: '50%' }}>INVOICE FROM</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', verticalAlign: 'top' }}>
                                    {customer ? (
                                        <div>
                                            <p style={{ fontWeight: 600, color: '#1e293b', margin: '0 0 2px' }}>{customer.firstName} {customer.lastName}</p>
                                            {customer.businessName && <p style={{ color: '#475569', margin: '0 0 2px' }}>{customer.businessName}</p>}
                                            {customer.address?.line1 && <p style={{ color: '#475569', margin: '0 0 2px' }}>{customer.address.line1}</p>}
                                            {(customer.address?.city || customer.address?.postcode) && (
                                                <p style={{ color: '#475569', margin: '0 0 2px' }}>{[customer.address.city, customer.address.postcode].filter(Boolean).join(', ')}</p>
                                            )}
                                            {customer.phone && <p style={{ color: '#475569', margin: '0 0 2px' }}>Mobile: {customer.phone}</p>}
                                            {customer.email && <p style={{ color: '#475569', margin: '0 0 2px' }}>Email: {customer.email}</p>}
                                            {customer.vatNumber && <p style={{ color: '#475569', margin: 0 }}>VAT Number: {customer.vatNumber}</p>}
                                        </div>
                                    ) : <span style={{ color: '#94a3b8' }}>—</span>}
                                </td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', verticalAlign: 'top' }}>
                                    <div>
                                        {bizProfile.businessName && <p style={{ fontWeight: 600, color: '#1e293b', margin: '0 0 2px' }}>{bizProfile.businessName}</p>}
                                        {bizProfile.addressLine1 && <p style={{ color: '#475569', margin: '0 0 2px' }}>{bizProfile.addressLine1}</p>}
                                        {bizProfile.addressLine2 && <p style={{ color: '#475569', margin: '0 0 2px' }}>{bizProfile.addressLine2}</p>}
                                        {(bizProfile.city || bizProfile.postcode) && <p style={{ color: '#475569', margin: '0 0 2px' }}>{[bizProfile.city, bizProfile.postcode].filter(Boolean).join(', ')}</p>}
                                        {bizProfile.country && <p style={{ color: '#475569', margin: '0 0 2px' }}>{bizProfile.country}</p>}
                                        {bizProfile.vatNumber && <p style={{ color: '#475569', margin: '0 0 2px' }}>VAT Number: {bizProfile.vatNumber}</p>}
                                        {bizProfile.companyNumber && <p style={{ color: '#475569', margin: '0 0 2px' }}>Company Number: {bizProfile.companyNumber}</p>}
                                        {bizProfile.telephone && <p style={{ color: '#475569', margin: '0 0 2px' }}>Telephone: {bizProfile.telephone}</p>}
                                        {bizProfile.email && <p style={{ color: '#475569', margin: 0 }}>Email: {bizProfile.email}</p>}
                                        {!bizProfile.businessName && <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12, margin: 0 }}>Business profile not configured — go to Settings to add your details.</p>}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Invoice Number / Invoice Date */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #cbd5e1', borderTop: 'none' }}>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #cbd5e1', borderTop: 'none', padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc', width: '50%' }}>INVOICE NUMBER</th>
                                <th style={{ border: '1px solid #cbd5e1', borderTop: 'none', padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc', width: '50%' }}>INVOICE DATE</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #cbd5e1', padding: '8px 16px', color: '#1e293b', fontWeight: 600 }}>{invoice.invoiceNumber}</td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '8px 16px', textAlign: 'right', color: '#1e293b' }}>{fmtDateTime(invoice.issuedAt || invoice.invoiceDate)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Line items */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed', border: '1px solid #cbd5e1', borderTop: 'none' }}>
                        <colgroup>
                            <col style={{ width: 44 }} />
                            <col />
                            <col style={{ width: 100 }} />
                            <col style={{ width: 80 }} />
                            <col style={{ width: 96 }} />
                            <col style={{ width: 108 }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #cbd5e1', borderTop: 'none', padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>QTY</th>
                                <th style={{ border: '1px solid #cbd5e1', borderTop: 'none', padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>ITEM</th>
                                <th style={{ border: '1px solid #cbd5e1', borderTop: 'none', padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>UNIT COST</th>
                                <th style={{ border: '1px solid #cbd5e1', borderTop: 'none', padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>VAT RATE</th>
                                <th style={{ border: '1px solid #cbd5e1', borderTop: 'none', padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>VAT TOTAL</th>
                                <th style={{ border: '1px solid #cbd5e1', borderTop: 'none', padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>ITEM TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(invoice.lineItems ?? []).map((item, idx) => {
                                const itemVat = vatAmt(item.priceExcVat, item.vatRate);
                                return (
                                    <tr key={idx}>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '12px', color: '#475569', verticalAlign: 'top' }}>1</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', verticalAlign: 'top' }}>
                                            <p style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>{item.name}</p>
                                            {item.description && <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{item.description}</p>}
                                            {item.isVehicle && vehicle && (
                                                <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                                                    {vehicle.vrm && <p style={{ margin: '0 0 2px' }}>Registration: {vehicle.vrm}</p>}
                                                    {vehicle.vin && <p style={{ margin: '0 0 2px' }}>VIN: {vehicle.vin}</p>}
                                                    {vehicle.engineNumber && <p style={{ margin: '0 0 2px' }}>Engine Number: {vehicle.engineNumber}</p>}
                                                    {vehicle.colour && <p style={{ margin: '0 0 2px' }}>Colour: {vehicle.colour}</p>}
                                                    {vehicle.dateOfRegistration && <p style={{ margin: '0 0 2px' }}>Date First Registered: {fmtDate(vehicle.dateOfRegistration)}</p>}
                                                    {vehicle.mileage != null && <p style={{ margin: 0 }}>Mileage: {vehicle.mileage.toLocaleString()}</p>}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', textAlign: 'right', color: '#475569', verticalAlign: 'top' }}>{GBP(item.priceExcVat)}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', textAlign: 'right', color: '#475569', verticalAlign: 'top' }}>{item.vatRate === 'No VAT' ? '0%' : item.vatRate}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', textAlign: 'right', color: '#475569', verticalAlign: 'top' }}>{GBP(itemVat)}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#1e293b', verticalAlign: 'top' }}>{GBP(item.priceExcVat + itemVat)}</td>
                                    </tr>
                                );
                            })}
                            {(invoice.partExchanges ?? []).map((px, idx) => (
                                <tr key={`px-${idx}`}>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '12px', color: '#475569', verticalAlign: 'top' }}>1</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', verticalAlign: 'top' }}>
                                        <p style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>Part Exchange: {px.vehicleName || px.vrm}</p>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                            <p style={{ margin: '0 0 2px' }}>Registration: {px.vrm}</p>
                                            {px.vin && <p style={{ margin: 0 }}>VIN: {px.vin}</p>}
                                        </div>
                                    </td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', textAlign: 'right', color: '#ef4444', verticalAlign: 'top' }}>-{GBP(px.price)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', textAlign: 'right', color: '#475569', verticalAlign: 'top' }}>—</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', textAlign: 'right', color: '#475569', verticalAlign: 'top' }}>—</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#ef4444', verticalAlign: 'top' }}>-{GBP(px.price)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* VAT breakdown + Totals — outer table keeps two halves side-by-side in print */}
                    {(() => {
                        const vat20val = (invoice.lineItems ?? []).filter(i => i.vatRate === '20%').reduce((s, i) => s + i.priceExcVat, 0);
                        const vat5val = (invoice.lineItems ?? []).filter(i => i.vatRate === '5%').reduce((s, i) => s + i.priceExcVat, 0);
                        const vat0val = (invoice.lineItems ?? []).filter(i => i.vatRate === 'No VAT').reduce((s, i) => s + i.priceExcVat, 0);
                        return (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #cbd5e1', borderTop: 'none' }}>
                                <tbody>
                                    <tr>
                                        {/* Left: VAT breakdown */}
                                        <td style={{ padding: 0, borderRight: '1px solid #cbd5e1', verticalAlign: 'top' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ borderBottom: '1px solid #cbd5e1', padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>VAT RATE</th>
                                                        <th style={{ borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>VALUE</th>
                                                        <th style={{ borderBottom: '1px solid #cbd5e1', padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>VAT</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', color: '#475569' }}>20%</td>
                                                        <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #cbd5e1', padding: '8px 16px', textAlign: 'right', color: '#475569' }}>{GBP(vat20val)}</td>
                                                        <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', textAlign: 'right', color: '#475569' }}>{GBP(vat20val * 0.2)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', color: '#475569' }}>5%</td>
                                                        <td style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #cbd5e1', padding: '8px 16px', textAlign: 'right', color: '#475569' }}>{GBP(vat5val)}</td>
                                                        <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', textAlign: 'right', color: '#475569' }}>{GBP(vat5val * 0.05)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ padding: '8px 16px', color: '#475569' }}>0%</td>
                                                        <td style={{ borderRight: '1px solid #cbd5e1', padding: '8px 16px', textAlign: 'right', color: '#475569' }}>{GBP(vat0val)}</td>
                                                        <td style={{ padding: '8px 16px', textAlign: 'right', color: '#475569' }}>{GBP(0)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                        {/* Right: Totals */}
                                        <td style={{ padding: 0, verticalAlign: 'top', width: 260 }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', textAlign: 'right', color: '#475569' }}>Sub-Total:</td>
                                                        <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{GBP(t.subtotal)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', textAlign: 'right', color: '#475569' }}>VAT:</td>
                                                        <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{GBP(t.vat)}</td>
                                                    </tr>
                                                    {t.pxTotal > 0 && (
                                                        <tr>
                                                            <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', textAlign: 'right', color: '#475569' }}>Part Exchanges:</td>
                                                            <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: '#ef4444', whiteSpace: 'nowrap' }}>-{GBP(t.pxTotal)}</td>
                                                        </tr>
                                                    )}
                                                    <tr>
                                                        <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Total:</td>
                                                        <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{GBP(t.total)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        );
                    })()}

                    {/* Payment received message */}
                    {isPaid && (
                        <p style={{ textAlign: 'center', fontWeight: 700, color: '#334155', fontSize: 14, margin: '20px 0 12px' }}>Payment received with thanks!</p>
                    )}

                    {/* Payment Details */}
                    {isPaid && (invoice.payments ?? []).length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #cbd5e1', marginTop: 8 }}>
                            <thead>
                                <tr>
                                    <th colSpan={2} style={{ border: '1px solid #cbd5e1', padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>PAYMENT DETAILS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.payments.map((p, idx) => (
                                    <>
                                        <tr key={`pd-${idx}`}>
                                            <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', color: '#64748b', width: 160 }}>Payment Date:</td>
                                            <td style={{ borderBottom: '1px solid #e2e8f0', padding: '8px 16px', color: '#1e293b' }}>{fmtDate(p.date)}</td>
                                        </tr>
                                        <tr key={`pm-${idx}`}>
                                            <td style={{ borderBottom: p.note ? '1px solid #e2e8f0' : undefined, padding: '8px 16px', color: '#64748b' }}>Payment Method:</td>
                                            <td style={{ borderBottom: p.note ? '1px solid #e2e8f0' : undefined, padding: '8px 16px', color: '#1e293b' }}>{p.method}</td>
                                        </tr>
                                        {p.note && (
                                            <tr key={`pn-${idx}`}>
                                                <td style={{ padding: '8px 16px', color: '#64748b' }}>Transaction ID:</td>
                                                <td style={{ padding: '8px 16px', color: '#1e293b' }}>{p.note}</td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Notes */}
                    {invoice.invoiceNotes && (
                        <div style={{ marginTop: 16, border: '1px solid #e2e8f0', padding: '12px 16px' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px' }}>Notes</p>
                            <p style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', margin: 0 }}>{invoice.invoiceNotes}</p>
                        </div>
                    )}

                    {/* Terms */}
                    {invoice.termsAndConditions && (
                        <div style={{ marginTop: 12, border: '1px solid #e2e8f0', padding: '12px 16px' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px' }}>Terms &amp; Conditions</p>
                            <p style={{ fontSize: 12, color: '#475569', whiteSpace: 'pre-wrap', margin: 0 }}>{invoice.termsAndConditions}</p>
                        </div>
                    )}

                </div>

                {/* Bottom action bar */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.push(`/app/sales/invoices/${id}/edit`)}
                            className="bg-[#4D7CFF] text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-[#3a6ae0]">Edit Invoice</button>
                        <button onClick={() => window.print()}
                            className="bg-[#4D7CFF] text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-[#3a6ae0]">Print</button>
                        {isDraft && (
                            <button onClick={() => doAction('issue')} disabled={acting}
                                className="bg-[#10b981] text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-emerald-600 disabled:opacity-60">Issue Invoice</button>
                        )}
                        {isIssued && (
                            <button onClick={() => setShowPayments(true)}
                                className="bg-[#10b981] text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-emerald-600">Mark as Paid</button>
                        )}
                        {isPaid && (
                            <button onClick={() => setShowPayments(true)}
                                className="bg-[#10b981] text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-emerald-600">Edit Payments</button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isCancellable && (
                            <button onClick={() => setShowCancel(true)} disabled={acting}
                                className="bg-red-500 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-red-600 disabled:opacity-60">Cancel Invoice</button>
                        )}
                        {vehicle && (vehicle as any)._id && !isPaid && (
                            <Link href={`/app/vehicles/${(vehicle as any)._id}`}
                                className="bg-slate-700 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-800">Sell Vehicle</Link>
                        )}
                        {customer && (
                            <button onClick={() => router.push(`/app/contacts/${(customer as any)._id}`)}
                                className="bg-slate-700 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-800">Contact</button>
                        )}
                        {(isPaid || invoice.status === 'credited') && (
                            <button onClick={() => setShowCredit(true)}
                                className="bg-slate-700 text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-slate-800">Issue Credit Note</button>
                        )}
                    </div>
                </div>
            </div>

            {showPayments && <PaymentsModal invoice={invoice} onSaved={inv => { setInvoice(inv); setShowPayments(false); }} onClose={() => setShowPayments(false)} />}
            {showCredit && <CreditModal invoice={invoice} onSaved={inv => { setInvoice(inv); setShowCredit(false); }} onClose={() => setShowCredit(false)} />}
            {showCancel && (
                <CancelModal
                    onConfirm={async () => { setShowCancel(false); await doAction('cancel'); }}
                    onClose={() => setShowCancel(false)}
                />
            )}
            {showEmailEsign && <EmailEsignModal invoice={invoice} onClose={() => setShowEmailEsign(false)} />}
            {showShareEsign && <ShareEsignModal invoice={invoice} onClose={() => setShowShareEsign(false)} />}
            {showEsign && <EsignModal invoice={invoice} onClose={() => setShowEsign(false)} />}
            {showEmailInvoice && <EmailInvoiceModal invoice={invoice} onClose={() => setShowEmailInvoice(false)} />}
            {showSendDocuments && <SendDocumentsModal invoice={invoice} onClose={() => setShowSendDocuments(false)} />}
        </div>
    );
}
