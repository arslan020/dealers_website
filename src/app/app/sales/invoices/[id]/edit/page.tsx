'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface LineItem { name: string; description?: string; priceExcVat: number; vatRate: 'No VAT' | '5%' | '20%'; isVehicle?: boolean; }
interface PartExchange { vrm: string; vehicleName?: string; vin?: string; mileage?: number; price: number; vatRate: 'No VAT' | '5%' | '20%'; createPurchaseInvoice: boolean; addToVehicles: boolean; }
interface Product { _id: string; name: string; description?: string; price?: number; vatRate?: string; variants?: { name: string; price: number; vatRate: string }[]; }
interface Invoice {
    _id: string;
    invoiceNumber: string;
    status: 'draft' | 'issued' | 'paid' | 'credited' | 'cancelled' | 'void';
    invoiceType: 'VAT Invoice' | 'Margin Scheme';
    invoiceDate: string;
    issuedAt?: string;
    timeOfSupply?: string;
    customerId: { _id: string; firstName: string; lastName: string; businessName?: string } | null;
    vehicleId: { vrm: string; make: string; model: string } | null;
    lineItems: LineItem[];
    partExchanges: PartExchange[];
    finance?: { amount: number; providerName?: string; generateProviderInvoice: boolean; customerDeposit: number; paidBy?: string };
    invoiceNotes?: string;
    termsAndConditions?: string;
}

function GBP(n: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n); }
function vatAmt(price: number, rate: string) {
    if (rate === '5%') return price * 0.05;
    if (rate === '20%') return price * 0.2;
    return 0;
}
function fmtDate(s?: string) {
    if (!s) return '';
    try { return new Date(s).toISOString().split('T')[0]; } catch { return ''; }
}

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-[#14b8a6] text-white',
    issued: 'bg-[#4D7CFF] text-white',
    paid: 'bg-[#10b981] text-white',
    credited: 'bg-[#f59e0b] text-white',
    cancelled: 'bg-slate-400 text-white',
    void: 'bg-slate-300 text-slate-600',
};

/* ─── VAT Select ─────────────────────────────────────────────────────────────── */
function VatSelect({ value, onChange }: { value: string; onChange: (v: 'No VAT' | '5%' | '20%') => void }) {
    return (
        <select value={value} onChange={e => onChange(e.target.value as any)}
            className="border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
            <option value="No VAT">No VAT</option>
            <option value="5%">5% VAT</option>
            <option value="20%">20% VAT</option>
        </select>
    );
}

/* ─── Product Search Dropdown ────────────────────────────────────────────────── */
function ProductDropdown({ onSelect, onClose }: { onSelect: (p: Product) => void; onClose: () => void }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [q, setQ] = useState('');
    useEffect(() => {
        fetch('/api/products?limit=50').then(r => r.json()).then(d => { if (d.ok) setProducts(d.products || []); }).catch(() => {});
    }, []);
    const filtered = q ? products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())) : products;
    return (
        <div className="mt-2 border border-slate-200 rounded-xl shadow-lg bg-white z-10 relative">
            <div className="p-3 border-b border-slate-100">
                <input autoFocus className="w-full border border-[#4D7CFF] rounded-lg px-3 py-2 text-[13px] focus:outline-none"
                    placeholder="Search products…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="max-h-56 overflow-y-auto">
                {filtered.length === 0 && <div className="px-4 py-3 text-[13px] text-slate-400">No products found</div>}
                {filtered.map(p => (
                    <button key={p._id} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                        onClick={() => { onSelect(p); onClose(); }}>
                        <div className="flex justify-between">
                            <span className="font-semibold text-[13px] text-slate-800">{p.name}</span>
                            {p.price != null && <span className="text-[13px] text-slate-600">{GBP(p.price)}</span>}
                        </div>
                        {p.description && <p className="text-[12px] text-slate-400 mt-0.5">{p.description}</p>}
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ─── Main Edit Page ─────────────────────────────────────────────────────────── */
export default function EditInvoicePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    /* Form state */
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [partExchanges, setPartExchanges] = useState<PartExchange[]>([]);
    const [invoiceType, setInvoiceType] = useState<'VAT Invoice' | 'Margin Scheme'>('Margin Scheme');
    const [invoiceDate, setInvoiceDate] = useState('');
    const [timeOfSupply, setTimeOfSupply] = useState('');
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [termsAndConditions, setTermsAndConditions] = useState('');
    const [finance, setFinance] = useState({ amount: '', providerName: '', generateProviderInvoice: false, customerDeposit: '0', paidBy: '' });
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [showOneOff, setShowOneOff] = useState(false);
    const [oneOff, setOneOff] = useState({ name: '', description: '', price: '', vatRate: 'No VAT' as 'No VAT' | '5%' | '20%' });

    const fetchInvoice = useCallback(async () => {
        try {
            const res = await fetch(`/api/invoices/${id}`);
            const data = await res.json();
            if (!data.ok) { toast.error('Invoice not found'); return; }
            const inv: Invoice = data.invoice;
            setInvoice(inv);
            setLineItems(inv.lineItems ?? []);
            setPartExchanges(inv.partExchanges ?? []);
            setInvoiceType(inv.invoiceType ?? 'Margin Scheme');
            setInvoiceDate(fmtDate(inv.invoiceDate));
            setTimeOfSupply(fmtDate(inv.timeOfSupply));
            setInvoiceNotes(inv.invoiceNotes ?? '');
            setTermsAndConditions(inv.termsAndConditions ?? '');
            if (inv.finance) {
                setFinance({
                    amount: String(inv.finance.amount || ''),
                    providerName: inv.finance.providerName ?? '',
                    generateProviderInvoice: inv.finance.generateProviderInvoice ?? false,
                    customerDeposit: String(inv.finance.customerDeposit || '0'),
                    paidBy: inv.finance.paidBy ?? '',
                });
            }
        } catch { toast.error('Failed to load invoice'); } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

    /* Totals */
    const subtotal = lineItems.reduce((s, i) => s + i.priceExcVat, 0);
    const totalVat = lineItems.reduce((s, i) => s + vatAmt(i.priceExcVat, i.vatRate), 0);
    const pxTotal = partExchanges.reduce((s, p) => s + p.price, 0);
    const total = subtotal + totalVat - pxTotal;

    /* Save */
    async function handleSave() {
        setSaving(true);
        try {
            const body = {
                action: 'edit',
                lineItems: lineItems.map(({ isVehicle, ...rest }) => ({ ...rest, isVehicle })),
                partExchanges,
                invoiceType,
                invoiceDate,
                timeOfSupply: timeOfSupply || undefined,
                invoiceNotes: invoiceNotes || undefined,
                termsAndConditions: termsAndConditions || undefined,
                finance: finance.amount ? {
                    amount: parseFloat(finance.amount) || 0,
                    providerName: finance.providerName || undefined,
                    generateProviderInvoice: finance.generateProviderInvoice,
                    customerDeposit: parseFloat(finance.customerDeposit) || 0,
                    paidBy: finance.paidBy || undefined,
                } : undefined,
            };
            const res = await fetch(`/api/invoices/${id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success('Invoice updated');
            router.push(`/app/sales/invoices/${id}`);
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    }

    function addProduct(p: Product) {
        setLineItems(prev => [...prev, {
            name: p.name,
            description: p.description,
            priceExcVat: p.price ?? 0,
            vatRate: (p.vatRate as any) ?? 'No VAT',
        }]);
    }

    function addOneOff() {
        if (!oneOff.name.trim()) { toast.error('Product name required'); return; }
        setLineItems(prev => [...prev, { name: oneOff.name, description: oneOff.description || undefined, priceExcVat: parseFloat(oneOff.price) || 0, vatRate: oneOff.vatRate }]);
        setOneOff({ name: '', description: '', price: '', vatRate: 'No VAT' });
        setShowOneOff(false);
    }

    async function lookupPxVrm(idx: number) {
        const vrm = partExchanges[idx]?.vrm;
        if (!vrm) return;
        try {
            const res = await fetch(`/api/vehicles/lookup?vrm=${vrm}`);
            const data = await res.json();
            if (data.ok && data.vehicle) {
                setPartExchanges(prev => prev.map((px, i) => i === idx ? {
                    ...px, vehicleName: `${data.vehicle.make} ${data.vehicle.model}`, vin: data.vehicle.vin || px.vin,
                } : px));
            }
        } catch {}
    }

    if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-[13px]">Loading…</div>;
    if (!invoice) return <div className="flex items-center justify-center h-64 text-slate-400 text-[13px]">Invoice not found.</div>;

    const customer = invoice.customerId;
    const isNotDraft = invoice.status !== 'draft';

    return (
        <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
                <Link href="/app/sales/invoices" className="hover:text-[#4D7CFF]">Sales</Link>
                <span>/</span>
                <Link href="/app/sales/invoices" className="hover:text-[#4D7CFF]">Invoices</Link>
                <span>/</span>
                <Link href={`/app/sales/invoices/${id}`} className="hover:text-[#4D7CFF]">Invoice {invoice.invoiceNumber}</Link>
                <span>/</span>
                <span className="text-slate-800 font-semibold">Edit</span>
            </div>

            {/* Header card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">Edit Invoice {invoice.invoiceNumber}</h1>
                    <span className={`inline-flex px-4 py-1.5 rounded-lg text-[13px] font-bold ${STATUS_STYLES[invoice.status] ?? 'bg-slate-200 text-slate-700'}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                </div>

                {isNotDraft && (
                    <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-[13px] text-amber-700">
                        <strong>Warning:</strong> This invoice has already been {invoice.status}. Editing line items will change the invoice total.
                    </div>
                )}

                <div className="p-5 space-y-4">
                    {/* Customer (read-only) */}
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Customer</label>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                            {customer ? (
                                <>
                                    <span className="text-[13px] font-semibold text-slate-700">{customer.firstName} {customer.lastName}</span>
                                    {customer.businessName && <span className="text-[12px] text-slate-400">— {customer.businessName}</span>}
                                </>
                            ) : (
                                <span className="text-[13px] text-slate-400">No customer</span>
                            )}
                            <span className="ml-auto text-[11px] text-slate-400 italic">Customer cannot be changed after creation</span>
                        </div>
                    </div>
                    {/* Vehicle (read-only) */}
                    {invoice.vehicleId && (
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Vehicle</label>
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                                <span className="text-[13px] font-semibold text-slate-700">{invoice.vehicleId.vrm}</span>
                                <span className="text-[12px] text-slate-500">{invoice.vehicleId.make} {invoice.vehicleId.model}</span>
                                <span className="ml-auto text-[11px] text-slate-400 italic">Vehicle cannot be changed after creation</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Products & Line Items */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-[14px] font-bold text-slate-800">Products &amp; Services</h2>
                </div>
                <div className="p-5 space-y-3">
                    {lineItems.length > 0 && (
                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                            <table className="w-full text-[13px]">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px]">Product</th>
                                        <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase text-[11px] w-32">Price Exc. VAT</th>
                                        <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase text-[11px] w-28">VAT</th>
                                        <th className="px-4 py-2.5 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item, idx) => (
                                        <tr key={idx} className="border-t border-slate-50">
                                            <td className="px-4 py-3">
                                                <input
                                                    className="w-full font-semibold text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF] mb-1"
                                                    value={item.name}
                                                    onChange={e => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, name: e.target.value } : li))}
                                                />
                                                <input
                                                    className="w-full text-[12px] text-slate-500 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#4D7CFF]"
                                                    placeholder="Description (optional)"
                                                    value={item.description ?? ''}
                                                    onChange={e => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, description: e.target.value } : li))}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right align-top">
                                                <div className="flex items-center justify-end">
                                                    <span className="border border-r-0 border-slate-200 rounded-l-lg px-2 py-1.5 text-[12px] text-slate-400 bg-slate-50">£</span>
                                                    <input
                                                        type="number" step="0.01"
                                                        value={item.priceExcVat}
                                                        onChange={e => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, priceExcVat: parseFloat(e.target.value) || 0 } : li))}
                                                        className="w-28 border border-slate-200 rounded-r-lg px-2 py-1.5 text-right text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <VatSelect value={item.vatRate} onChange={v => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, vatRate: v } : li))} />
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <button onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}
                                                    className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Add from product list */}
                    <button onClick={() => { setShowProductDropdown(p => !p); setShowOneOff(false); }}
                        className="text-[#4D7CFF] text-[13px] font-semibold hover:underline">
                        + Add Product / Service
                    </button>
                    {showProductDropdown && (
                        <ProductDropdown onSelect={p => { addProduct(p); }} onClose={() => setShowProductDropdown(false)} />
                    )}

                    {/* One-off */}
                    <button onClick={() => { setShowOneOff(p => !p); setShowProductDropdown(false); }}
                        className="text-[#4D7CFF] text-[13px] font-semibold hover:underline block">
                        ▼ Add One-Off Product
                    </button>
                    {showOneOff && (
                        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Product Name</label>
                                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                    value={oneOff.name} onChange={e => setOneOff(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Description</label>
                                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                    value={oneOff.description} onChange={e => setOneOff(p => ({ ...p, description: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[12px] font-semibold text-slate-600 mb-1">Price Exc. VAT</label>
                                    <div className="flex">
                                        <span className="border border-r-0 border-slate-200 rounded-l-lg px-3 py-2 text-[13px] text-slate-500 bg-white">£</span>
                                        <input type="number" step="0.01" className="flex-1 border border-slate-200 rounded-r-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                            value={oneOff.price} onChange={e => setOneOff(p => ({ ...p, price: e.target.value }))} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[12px] font-semibold text-slate-600 mb-1">VAT</label>
                                    <VatSelect value={oneOff.vatRate} onChange={v => setOneOff(p => ({ ...p, vatRate: v }))} />
                                </div>
                            </div>
                            <button onClick={addOneOff} className="bg-[#4D7CFF] text-white px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae0]">
                                Add Product
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Part Exchanges */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-[14px] font-bold text-slate-800">Part Exchanges</h2>
                </div>
                <div className="p-5 space-y-3">
                    {partExchanges.length > 0 && (
                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                            <table className="w-full text-[13px]">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px]">Vehicle</th>
                                        <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase text-[11px] w-36">Price</th>
                                        <th className="px-4 py-2.5 font-semibold text-slate-500 uppercase text-[11px] w-28">VAT</th>
                                        <th className="px-4 py-2.5 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {partExchanges.map((px, idx) => (
                                        <tr key={idx} className="border-t border-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Registration</label>
                                                        <div className="flex gap-1">
                                                            <input className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] uppercase focus:outline-none focus:border-[#4D7CFF]"
                                                                value={px.vrm}
                                                                onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, vrm: e.target.value.toUpperCase() } : p))} />
                                                            <button onClick={() => lookupPxVrm(idx)}
                                                                className="bg-[#4D7CFF] text-white px-2 rounded-lg hover:bg-[#3a6ae0] text-[12px] font-semibold">
                                                                Lookup
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Vehicle Name</label>
                                                        <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                            value={px.vehicleName ?? ''}
                                                            onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, vehicleName: e.target.value } : p))} />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">VIN</label>
                                                        <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                            value={px.vin ?? ''}
                                                            onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, vin: e.target.value } : p))} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Mileage</label>
                                                        <input type="number" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                            value={px.mileage ?? ''}
                                                            onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, mileage: parseInt(e.target.value) } : p))} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <div className="flex">
                                                    <span className="border border-r-0 border-slate-200 rounded-l-lg px-2 py-1.5 text-[12px] text-slate-400 bg-slate-50">£</span>
                                                    <input type="number" step="0.01" value={px.price}
                                                        onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, price: parseFloat(e.target.value) || 0 } : p))}
                                                        className="w-28 border border-slate-200 rounded-r-lg px-2 py-1.5 text-right text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <VatSelect value={px.vatRate} onChange={v => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, vatRate: v } : p))} />
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <button onClick={() => setPartExchanges(prev => prev.filter((_, i) => i !== idx))}
                                                    className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <button onClick={() => setPartExchanges(prev => [...prev, { vrm: '', price: 0, vatRate: 'No VAT', createPurchaseInvoice: true, addToVehicles: true }])}
                        className="text-[#4D7CFF] text-[13px] font-semibold hover:underline">
                        + Add Part Exchange
                    </button>
                </div>
            </div>

            {/* Finance */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-[14px] font-bold text-slate-800">Finance</h2>
                </div>
                <div className="p-5 grid grid-cols-2 gap-5">
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Finance Amount</label>
                        <div className="flex">
                            <span className="border border-r-0 border-slate-200 rounded-l-lg px-3 py-2 text-[13px] text-slate-500 bg-slate-50">£</span>
                            <input type="number" step="0.01" value={finance.amount}
                                onChange={e => setFinance(p => ({ ...p, amount: e.target.value }))}
                                className="flex-1 border border-slate-200 rounded-r-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Finance Provider</label>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                            value={finance.providerName}
                            onChange={e => setFinance(p => ({ ...p, providerName: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Customer Deposit</label>
                        <div className="flex">
                            <span className="border border-r-0 border-slate-200 rounded-l-lg px-3 py-2 text-[13px] text-slate-500 bg-slate-50">£</span>
                            <input type="number" step="0.01" value={finance.customerDeposit}
                                onChange={e => setFinance(p => ({ ...p, customerDeposit: e.target.value }))}
                                className="flex-1 border border-slate-200 rounded-r-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Paid By</label>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                            value={finance.paidBy}
                            onChange={e => setFinance(p => ({ ...p, paidBy: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                        <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                            <input type="checkbox" checked={finance.generateProviderInvoice}
                                onChange={e => setFinance(p => ({ ...p, generateProviderInvoice: e.target.checked }))}
                                className="rounded text-[#4D7CFF]" />
                            <span className="font-semibold text-slate-600">Generate Finance Provider Invoice</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Options */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-[14px] font-bold text-slate-800">Options</h2>
                </div>
                <div className="p-5 space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 mb-2">Invoice Type</label>
                            <div className="space-y-1.5">
                                {(['VAT Invoice', 'Margin Scheme'] as const).map(t => (
                                    <label key={t} className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                                        <input type="radio" name="invoiceType" checked={invoiceType === t} onChange={() => setInvoiceType(t)} className="text-[#4D7CFF]" />
                                        {t}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Invoice Date</label>
                                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                            </div>
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Time of Supply</label>
                                <input type="date" value={timeOfSupply} onChange={e => setTimeOfSupply(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Invoice Notes</label>
                        <textarea rows={4} value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Terms &amp; Conditions</label>
                        <textarea rows={5} value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" />
                    </div>
                </div>
            </div>

            {/* Summary & Save */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex items-end justify-between">
                    <div className="space-y-1 text-[13px]">
                        <div className="flex gap-8">
                            <span className="text-slate-500">Sub-Total:</span>
                            <span className="font-semibold text-slate-800">{GBP(subtotal)}</span>
                        </div>
                        <div className="flex gap-8">
                            <span className="text-slate-500">VAT:</span>
                            <span className="font-semibold text-slate-800">{GBP(totalVat)}</span>
                        </div>
                        {pxTotal > 0 && (
                            <div className="flex gap-8">
                                <span className="text-slate-500">Part Exchanges:</span>
                                <span className="font-semibold text-red-500">-{GBP(pxTotal)}</span>
                            </div>
                        )}
                        <div className="flex gap-8 border-t border-slate-100 pt-1 mt-1">
                            <span className="text-slate-700 font-bold">Total:</span>
                            <span className="font-bold text-slate-900 text-[15px]">{GBP(total)}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Link href={`/app/sales/invoices/${id}`}
                            className="px-5 py-3 border border-slate-200 text-slate-600 rounded-xl text-[14px] font-semibold hover:bg-slate-50">
                            Cancel
                        </Link>
                        <button onClick={handleSave} disabled={saving}
                            className="bg-[#4D7CFF] text-white px-6 py-3 rounded-xl text-[14px] font-bold hover:bg-[#3a6ae0] disabled:opacity-60 transition-colors shadow-sm">
                            {saving ? 'Saving…' : 'Save Invoice'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
