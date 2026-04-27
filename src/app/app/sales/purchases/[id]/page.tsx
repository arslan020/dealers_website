'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface Contact {
    _id: string;
    firstName: string;
    lastName: string;
    businessName?: string;
    email?: string;
    phone?: string;
    address?: { line1?: string; city?: string; postcode?: string; country?: string };
}

interface LinkedVehicle {
    vrm: string;
    vin?: string;
    make: string;
    model: string;
    derivative: string;
    stockId?: string;
    colour?: string;
    dateOfRegistration?: string;
    mileage?: number;
}

interface LineItem {
    name: string;
    description?: string;
    priceExcVat: number;
    vatRate: 'No VAT' | '5%' | '20%';
}

interface Purchase {
    _id: string;
    purchaseNumber: string;
    status: 'draft' | 'issued' | 'paid' | 'void';
    type: 'VAT' | 'Marginal' | 'No VAT';
    invoiceDate: string;
    issuedAt?: string;
    paidAt?: string;
    contactId: Contact | null;
    linkedVehicleId: LinkedVehicle | null;
    linkedVehicleVrm?: string;
    reference?: string;
    lineItems: LineItem[];
    adjustment: number;
    notes?: string;
    documentUrl?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const GBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
function vatAmt(price: number, rate: string) {
    if (rate === '5%') return price * 0.05;
    if (rate === '20%') return price * 0.2;
    return 0;
}
function fmtDate(s?: string) { if (!s) return '—'; try { return new Date(s).toLocaleDateString('en-GB'); } catch { return s; } }

function calcTotals(p: Purchase) {
    let subtotal = 0, vat = 0;
    p.lineItems.forEach(i => { subtotal += i.priceExcVat; vat += vatAmt(i.priceExcVat, i.vatRate); });
    const total = subtotal + vat + p.adjustment;
    return { subtotal, vat, total };
}

function contactName(c: Contact | null) {
    if (!c) return '—';
    if (c.businessName) return c.businessName;
    return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—';
}

/* ─── Status Badge ───────────────────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-[#14b8a6] text-white',
    issued: 'bg-[#4D7CFF] text-white',
    paid: 'bg-[#10b981] text-white',
    void: 'bg-slate-300 text-slate-600',
};
function StatusBadge({ status }: { status: string }) {
    return <span className={`inline-flex px-4 py-1.5 rounded-lg text-[13px] font-bold ${STATUS_STYLES[status] ?? 'bg-slate-200 text-slate-700'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

/* ─── Void Modal ─────────────────────────────────────────────────────────────── */
function VoidModal({ onConfirm, onClose, saving }: { onConfirm: () => void; onClose: () => void; saving: boolean }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Void Purchase Invoice</h2>
                </div>
                <div className="px-6 py-5">
                    <p className="text-[13px] text-slate-600">Are you sure you want to void this purchase invoice? This action cannot be undone.</p>
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
                    <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100">Cancel</button>
                    <button onClick={onConfirm} disabled={saving} className="px-4 py-2 text-[13px] font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50">
                        {saving ? 'Voiding…' : 'Void Invoice'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Options Dropdown ───────────────────────────────────────────────────────── */
function OptionsMenu({ onVoid, canVoid }: { onVoid: () => void; canVoid: boolean }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-[13px] font-semibold hover:bg-slate-50">
                Options
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                        <button onClick={() => { setOpen(false); }} className="w-full text-left px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50">Edit Invoice</button>
                        <button onClick={() => { setOpen(false); window.print(); }} className="w-full text-left px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50">Print</button>
                        {canVoid && (
                            <button onClick={() => { setOpen(false); onVoid(); }} className="w-full text-left px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50">Void Invoice</button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function PurchaseViewPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [purchase, setPurchase] = useState<Purchase | null>(null);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);
    const [showVoid, setShowVoid] = useState(false);

    const fetchPurchase = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/purchases/${id}`);
            const data = await res.json();
            if (data.ok) setPurchase(data.purchase);
        } catch { } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchPurchase(); }, [fetchPurchase]);

    async function action(body: Record<string, unknown>) {
        setActing(true);
        try {
            const res = await fetch(`/api/purchases/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (data.ok) { setPurchase(data.purchase); return true; }
            toast.error(data.error || 'Action failed');
        } catch { toast.error('Network error'); } finally { setActing(false); }
        return false;
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="animate-pulse space-y-3">
                        <div className="h-6 bg-slate-100 rounded w-48" />
                        <div className="h-4 bg-slate-100 rounded w-32" />
                    </div>
                </div>
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <p className="text-slate-400 text-[14px]">Purchase invoice not found</p>
                <Link href="/app/sales/purchases" className="mt-4 inline-block text-[#4D7CFF] text-[13px] font-semibold hover:underline">Back to Purchases</Link>
            </div>
        );
    }

    const { subtotal, vat, total } = calcTotals(purchase);
    const contact = purchase.contactId;
    const vehicle = purchase.linkedVehicleId;
    const vrm = vehicle?.vrm ?? purchase.linkedVehicleVrm ?? null;

    return (
        <div className="space-y-4">
            {/* Header Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <Link href="/app/sales/purchases" className="text-slate-400 hover:text-slate-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-[16px] font-bold text-slate-800">Purchase #{purchase.purchaseNumber}</h1>
                                <StatusBadge status={purchase.status} />
                            </div>
                            <p className="text-[12px] text-slate-400 mt-0.5">{purchase.type} · {fmtDate(purchase.invoiceDate)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {purchase.status === 'draft' && (
                            <button onClick={() => action({ action: 'issue' })} disabled={acting}
                                className="px-4 py-1.5 bg-[#4D7CFF] text-white text-[13px] font-semibold rounded-lg hover:bg-[#3a6ae0] disabled:opacity-50">
                                Issue Invoice
                            </button>
                        )}
                        {purchase.status === 'issued' && (
                            <button onClick={() => action({ action: 'markPaid' })} disabled={acting}
                                className="px-4 py-1.5 bg-[#10b981] text-white text-[13px] font-semibold rounded-lg hover:bg-[#059669] disabled:opacity-50">
                                Mark as Paid
                            </button>
                        )}
                        <OptionsMenu onVoid={() => setShowVoid(true)} canVoid={purchase.status !== 'void'} />
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-slate-100">
                    {/* Contact */}
                    <div className="px-5 py-4">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Contact</p>
                        {contact ? (
                            <>
                                <p className="text-[13px] font-semibold text-slate-800">{contactName(contact)}</p>
                                {contact.email && <p className="text-[12px] text-slate-500 mt-0.5">{contact.email}</p>}
                                {contact.phone && <p className="text-[12px] text-slate-500">{contact.phone}</p>}
                                {contact.address?.line1 && <p className="text-[12px] text-slate-500 mt-0.5">{contact.address.line1}</p>}
                                {(contact.address?.city || contact.address?.postcode) && (
                                    <p className="text-[12px] text-slate-500">{[contact.address.city, contact.address.postcode].filter(Boolean).join(', ')}</p>
                                )}
                            </>
                        ) : <p className="text-[13px] text-slate-400 italic">No contact</p>}
                    </div>

                    {/* Vehicle */}
                    <div className="px-5 py-4">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Linked Vehicle</p>
                        {vrm ? (
                            <>
                                <p className="text-[13px] font-bold text-slate-800">{vrm}</p>
                                {vehicle && (
                                    <>
                                        <p className="text-[12px] text-slate-600 mt-0.5">{[vehicle.make, vehicle.model, vehicle.derivative].filter(Boolean).join(' ')}</p>
                                        {vehicle.colour && <p className="text-[12px] text-slate-500">{vehicle.colour}</p>}
                                        {vehicle.dateOfRegistration && <p className="text-[12px] text-slate-500">Reg: {fmtDate(vehicle.dateOfRegistration)}</p>}
                                        {vehicle.mileage != null && <p className="text-[12px] text-slate-500">{vehicle.mileage.toLocaleString()} miles</p>}
                                        {vehicle.vin && <p className="text-[12px] text-slate-400 font-mono">{vehicle.vin}</p>}
                                    </>
                                )}
                            </>
                        ) : <p className="text-[13px] text-slate-400 italic">None linked</p>}
                    </div>

                    {/* Details */}
                    <div className="px-5 py-4">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Details</p>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[12px]">
                                <span className="text-slate-500">Invoice Date</span>
                                <span className="text-slate-700 font-medium">{fmtDate(purchase.invoiceDate)}</span>
                            </div>
                            {purchase.reference && (
                                <div className="flex justify-between text-[12px]">
                                    <span className="text-slate-500">Reference</span>
                                    <span className="text-slate-700 font-medium">{purchase.reference}</span>
                                </div>
                            )}
                            {purchase.issuedAt && (
                                <div className="flex justify-between text-[12px]">
                                    <span className="text-slate-500">Issued</span>
                                    <span className="text-slate-700 font-medium">{fmtDate(purchase.issuedAt)}</span>
                                </div>
                            )}
                            {purchase.paidAt && (
                                <div className="flex justify-between text-[12px]">
                                    <span className="text-slate-500">Paid</span>
                                    <span className="text-slate-700 font-medium">{fmtDate(purchase.paidAt)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Totals Summary */}
                    <div className="px-5 py-4">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Summary</p>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[12px]">
                                <span className="text-slate-500">Sub-Total</span>
                                <span className="text-slate-700 font-medium">{GBP(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-[12px]">
                                <span className="text-slate-500">VAT</span>
                                <span className="text-slate-700">{GBP(vat)}</span>
                            </div>
                            {purchase.adjustment !== 0 && (
                                <div className="flex justify-between text-[12px]">
                                    <span className="text-slate-500">Adjustment</span>
                                    <span className={purchase.adjustment >= 0 ? 'text-green-600' : 'text-red-600'}>{GBP(purchase.adjustment)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-[13px] font-bold border-t border-slate-100 pt-1 mt-1">
                                <span className="text-slate-700">Total</span>
                                <span className="text-slate-900">{GBP(total)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoice Document */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-[14px] font-bold text-slate-800">Purchase Invoice</h2>
                </div>
                <div className="p-6 md:p-8">
                    {/* Invoice Header */}
                    <div className="flex justify-between mb-8">
                        <div>
                            <h3 className="text-[20px] font-bold text-slate-800 mb-1">PURCHASE INVOICE</h3>
                            <p className="text-[13px] text-slate-500">#{purchase.purchaseNumber}</p>
                            {purchase.reference && <p className="text-[12px] text-slate-400 mt-0.5">Ref: {purchase.reference}</p>}
                        </div>
                        <div className="text-right">
                            <p className="text-[12px] text-slate-500">Invoice Date</p>
                            <p className="text-[14px] font-semibold text-slate-800">{fmtDate(purchase.invoiceDate)}</p>
                            <div className="mt-2">
                                <StatusBadge status={purchase.status} />
                            </div>
                        </div>
                    </div>

                    {/* From / To */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">From</p>
                            {contact ? (
                                <div className="text-[13px] text-slate-700 space-y-0.5">
                                    <p className="font-semibold">{contactName(contact)}</p>
                                    {contact.email && <p>{contact.email}</p>}
                                    {contact.phone && <p>{contact.phone}</p>}
                                    {contact.address?.line1 && <p>{contact.address.line1}</p>}
                                    {(contact.address?.city || contact.address?.postcode) && (
                                        <p>{[contact.address.city, contact.address.postcode].filter(Boolean).join(', ')}</p>
                                    )}
                                    {contact.address?.country && <p>{contact.address.country}</p>}
                                </div>
                            ) : <p className="text-[13px] text-slate-400 italic">No contact</p>}
                        </div>
                        {vrm && (
                            <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Vehicle</p>
                                <div className="text-[13px] text-slate-700 space-y-0.5">
                                    <p className="font-bold text-slate-800">{vrm}</p>
                                    {vehicle && (
                                        <>
                                            <p>{[vehicle.make, vehicle.model, vehicle.derivative].filter(Boolean).join(' ')}</p>
                                            {vehicle.colour && <p>Colour: {vehicle.colour}</p>}
                                            {vehicle.vin && <p className="font-mono text-[12px] text-slate-500">VIN: {vehicle.vin}</p>}
                                            {vehicle.stockId && <p className="text-[12px] text-slate-500">Stock ID: {vehicle.stockId}</p>}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Line Items Table */}
                    <div className="mb-6">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="border-b-2 border-slate-200">
                                    <th className="pb-2 text-left font-semibold text-slate-600">Description</th>
                                    <th className="pb-2 text-right font-semibold text-slate-600">Price (exc. VAT)</th>
                                    <th className="pb-2 text-right font-semibold text-slate-600">VAT Rate</th>
                                    <th className="pb-2 text-right font-semibold text-slate-600">VAT</th>
                                    <th className="pb-2 text-right font-semibold text-slate-600">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchase.lineItems.map((item, i) => {
                                    const itemVat = vatAmt(item.priceExcVat, item.vatRate);
                                    return (
                                        <tr key={i} className="border-b border-slate-100">
                                            <td className="py-3">
                                                <p className="font-medium text-slate-800">{item.name}</p>
                                                {item.description && <p className="text-[12px] text-slate-500 mt-0.5">{item.description}</p>}
                                            </td>
                                            <td className="py-3 text-right text-slate-700">{GBP(item.priceExcVat)}</td>
                                            <td className="py-3 text-right text-slate-500">{item.vatRate}</td>
                                            <td className="py-3 text-right text-slate-700">{GBP(itemVat)}</td>
                                            <td className="py-3 text-right font-medium text-slate-800">{GBP(item.priceExcVat + itemVat)}</td>
                                        </tr>
                                    );
                                })}
                                {purchase.lineItems.length === 0 && (
                                    <tr><td colSpan={5} className="py-6 text-center text-slate-400 italic">No line items</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                        <div className="w-64 space-y-1.5">
                            <div className="flex justify-between text-[13px]">
                                <span className="text-slate-500">Sub-Total (exc. VAT)</span>
                                <span className="text-slate-700 font-medium">{GBP(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-[13px]">
                                <span className="text-slate-500">VAT</span>
                                <span className="text-slate-700">{GBP(vat)}</span>
                            </div>
                            {purchase.adjustment !== 0 && (
                                <div className="flex justify-between text-[13px]">
                                    <span className="text-slate-500">Adjustment</span>
                                    <span className={purchase.adjustment >= 0 ? 'text-green-600' : 'text-red-600'}>{GBP(purchase.adjustment)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-[14px] font-bold border-t-2 border-slate-200 pt-2 mt-2">
                                <span className="text-slate-800">Total</span>
                                <span className="text-slate-900">{GBP(total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {purchase.notes && (
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Notes</p>
                            <p className="text-[13px] text-slate-600 whitespace-pre-wrap">{purchase.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Void Modal */}
            {showVoid && (
                <VoidModal
                    saving={acting}
                    onConfirm={async () => { const ok = await action({ action: 'void' }); if (ok) setShowVoid(false); }}
                    onClose={() => setShowVoid(false)}
                />
            )}
        </div>
    );
}
