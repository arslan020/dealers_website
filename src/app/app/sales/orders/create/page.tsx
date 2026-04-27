'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Customer { _id: string; firstName: string; lastName: string; businessName?: string; email?: string; }
interface LineItem { name: string; description?: string; priceExcVat: number; vatRate: 'No VAT' | '5%' | '20%'; }
interface PartExchange { vrm: string; vehicleName?: string; price: number; vatRate: 'No VAT' | '5%' | '20%'; createPurchaseInvoice: boolean; addToVehicles: boolean; }

function today() { return new Date().toISOString().split('T')[0]; }
const GBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

function CustomerSearch({ selected, onSelect, onNew }: { selected: Customer | null; onSelect: (c: Customer) => void; onNew: () => void; }) {
    const [q, setQ] = useState(selected ? `${selected.firstName} ${selected.lastName}`.trim() : '');
    const [results, setResults] = useState<Customer[]>([]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!q.trim()) { setResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/crm/customers?search=${encodeURIComponent(q)}&limit=8`);
                const data = await res.json();
                if (data.ok) setResults(data.customers || []);
            } catch { }
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} className="relative">
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                placeholder="Search customers by name or email…" value={q}
                onChange={e => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)} />
            {open && results.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                    {results.map(c => (
                        <button key={c._id} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-[13px] border-b border-slate-50 last:border-0"
                            onClick={() => { onSelect(c); setQ(`${c.firstName} ${c.lastName}`.trim()); setOpen(false); }}>
                            <span className="font-medium text-slate-800">{c.firstName} {c.lastName}</span>
                            {c.businessName && <span className="text-slate-500 ml-1">— {c.businessName}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function NewContactModal({ onCreated, onClose }: { onCreated: (c: Customer) => void; onClose: () => void; }) {
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [saving, setSaving] = useState(false);
    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.firstName.trim()) { toast.error('First name required'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/crm/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, source: 'Walk-in', status: 'Active' }) });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            onCreated(data.customer);
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
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
                        <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">First Name *</label>
                            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} /></div>
                        <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Last Name</label>
                            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
                    </div>
                    <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Email</label>
                        <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                    <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Phone</label>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 border border-slate-200 rounded-lg py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 bg-[#4D7CFF] text-white rounded-lg py-2 text-[13px] font-semibold hover:bg-[#3a6ae0] disabled:opacity-60">{saving ? 'Creating…' : 'Create Contact'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

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

export default function CreateOrderPage() {
    const router = useRouter();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [showNewContact, setShowNewContact] = useState(false);
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [partExchanges, setPartExchanges] = useState<PartExchange[]>([]);
    const [invoiceType, setInvoiceType] = useState<'VAT Invoice' | 'Margin Scheme'>('VAT Invoice');
    const [invoiceDate, setInvoiceDate] = useState(today());
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [termsAndConditions, setTermsAndConditions] = useState('');
    const [showPx, setShowPx] = useState(false);
    const [showOneOff, setShowOneOff] = useState(false);
    const [oneOff, setOneOff] = useState({ name: '', description: '', price: '', vatRate: 'No VAT' as 'No VAT' | '5%' | '20%' });
    const [saving, setSaving] = useState(false);

    const subtotal = lineItems.reduce((s, i) => s + i.priceExcVat, 0);
    const pxTotal = partExchanges.reduce((s, p) => s + p.price, 0);
    const total = subtotal - pxTotal;

    function addOneOff() {
        if (!oneOff.name.trim()) { toast.error('Product name required'); return; }
        setLineItems(prev => [...prev, { name: oneOff.name, description: oneOff.description || undefined, priceExcVat: parseFloat(oneOff.price) || 0, vatRate: oneOff.vatRate }]);
        setOneOff({ name: '', description: '', price: '', vatRate: 'No VAT' });
        setShowOneOff(false);
    }

    async function handleSubmit() {
        if (!customer) { toast.error('Please select a customer'); return; }
        setSaving(true);
        try {
            const body = {
                customerId: customer._id,
                type: 'order',
                invoiceType,
                invoiceDate,
                invoiceNotes: invoiceNotes || undefined,
                termsAndConditions: termsAndConditions || undefined,
                lineItems,
                partExchanges,
            };
            const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success('Order created');
            router.push(`/app/sales/invoices/${data.order._id}`);
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
                <a href="/app/sales/orders" className="hover:text-[#4D7CFF]">Sales</a>
                <span>/</span>
                <a href="/app/sales/orders" className="hover:text-[#4D7CFF]">Orders</a>
                <span>/</span>
                <span className="text-slate-800 font-semibold">Create Order</span>
            </div>

            {/* Customer */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">Create Order</h1>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-[13px] font-semibold hover:bg-slate-50">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        Currency Converter
                    </button>
                </div>
                <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-[13px] font-semibold text-slate-700">Customer</label>
                        <button onClick={() => setShowNewContact(true)}
                            className="flex items-center gap-1 text-[12px] font-semibold text-[#4D7CFF] border border-[#4D7CFF] px-2.5 py-1 rounded-lg hover:bg-blue-50">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                            New Contact
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <CustomerSearch selected={customer} onSelect={setCustomer} onNew={() => setShowNewContact(true)} />
                        {customer && (
                            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                                <span className="text-[13px] font-semibold text-slate-700">{customer.firstName} {customer.lastName}</span>
                                <button onClick={() => setCustomer(null)} className="ml-auto text-red-400 hover:text-red-600">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Products */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-[14px] font-bold text-slate-800">Products &amp; Services</h2>
                </div>
                <div className="p-5 space-y-3">
                    {lineItems.length > 0 && (
                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                            <table className="w-full text-[13px]">
                                <thead className="bg-slate-50/80">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Product</th>
                                        <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Price</th>
                                        <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase text-[11px] tracking-wide">VAT</th>
                                        <th className="px-4 py-2.5 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item, idx) => (
                                        <tr key={idx} className="border-t border-slate-50">
                                            <td className="px-4 py-3">
                                                <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                    value={item.name} onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, name: e.target.value } : l))} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input type="number" step="0.01" value={item.priceExcVat}
                                                    onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, priceExcVat: parseFloat(e.target.value) || 0 } : l))}
                                                    className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-right text-[13px] focus:outline-none focus:border-[#4D7CFF] ml-auto block" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <VatSelect value={item.vatRate} onChange={v => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, vatRate: v } : l))} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <button onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}
                                                    className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center ml-auto">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <button onClick={() => setShowOneOff(p => !p)}
                        className="text-[#4D7CFF] text-[13px] font-semibold hover:underline">
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
                                <textarea rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none"
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
                            <button onClick={addOneOff}
                                className="bg-[#4D7CFF] text-white px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae0]">
                                Add One-Off Product
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Part Exchanges */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <button className="w-full flex items-center justify-between px-5 py-4 text-left" onClick={() => setShowPx(p => !p)}>
                    <h2 className="text-[14px] font-bold text-[#4D7CFF]">Part Exchanges</h2>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showPx ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showPx && (
                    <div className="px-5 pb-5 border-t border-slate-100 space-y-3 pt-4">
                        {partExchanges.map((px, idx) => (
                            <div key={idx} className="grid grid-cols-4 gap-3 border border-slate-100 rounded-xl p-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">VRM</label>
                                    <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] uppercase focus:outline-none focus:border-[#4D7CFF]"
                                        value={px.vrm} onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, vrm: e.target.value.toUpperCase() } : p))} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Vehicle Name</label>
                                    <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                        value={px.vehicleName || ''} onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, vehicleName: e.target.value } : p))} />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Price</label>
                                    <div className="flex">
                                        <span className="border border-r-0 border-slate-200 rounded-l-lg px-2 py-1.5 text-[12px] text-slate-400 bg-slate-50">£</span>
                                        <input type="number" step="0.01" value={px.price}
                                            onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, price: parseFloat(e.target.value) || 0 } : p))}
                                            className="flex-1 border border-slate-200 rounded-r-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                    </div>
                                </div>
                                <div className="flex items-end">
                                    <button onClick={() => setPartExchanges(prev => prev.filter((_, i) => i !== idx))}
                                        className="w-8 h-8 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setPartExchanges(prev => [...prev, { vrm: '', price: 0, vatRate: 'No VAT', createPurchaseInvoice: true, addToVehicles: true }])}
                            className="text-[#4D7CFF] text-[13px] font-semibold hover:underline">+ Add Vehicle</button>
                    </div>
                )}
            </div>

            {/* Options */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
                <h2 className="text-[14px] font-bold text-slate-800">Options</h2>
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-2">Invoice Type</label>
                        <div className="space-y-1.5">
                            {(['VAT Invoice', 'Margin Scheme'] as const).map(t => (
                                <label key={t} className="flex items-center gap-2 text-[13px] text-slate-700">
                                    <input type="radio" name="orderType" checked={invoiceType === t} onChange={() => setInvoiceType(t)} className="text-[#4D7CFF]" />
                                    {t}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Order Date</label>
                        <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                </div>
                <div>
                    <label className="block text-[12px] font-semibold text-slate-600 mb-1">Order Notes</label>
                    <textarea rows={3} value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[12px] font-semibold text-slate-600">Terms &amp; Conditions</label>
                        <button className="text-[11px] text-[#4D7CFF] border border-[#4D7CFF] px-2 py-0.5 rounded hover:bg-blue-50 font-semibold">Use Default</button>
                    </div>
                    <textarea rows={4} value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" />
                </div>
            </div>

            {/* Summary */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex items-end justify-between">
                    <div className="space-y-1 text-[13px]">
                        <div className="flex gap-8"><span className="text-slate-500">Sub-Total:</span><span className="font-semibold text-slate-800">{GBP(subtotal)}</span></div>
                        {pxTotal > 0 && <div className="flex gap-8"><span className="text-slate-500">Part Exchanges:</span><span className="font-semibold text-red-500">-{GBP(pxTotal)}</span></div>}
                        <div className="flex gap-8 border-t border-slate-100 pt-1"><span className="font-bold text-slate-700">Total:</span><span className="font-bold text-slate-900 text-[15px]">{GBP(total)}</span></div>
                    </div>
                    <button onClick={handleSubmit} disabled={saving}
                        className="bg-[#4D7CFF] text-white px-6 py-3 rounded-xl text-[14px] font-bold hover:bg-[#3a6ae0] disabled:opacity-60 shadow-sm">
                        {saving ? 'Creating…' : 'Create Order'}
                    </button>
                </div>
            </div>

            {showNewContact && <NewContactModal onCreated={c => { setCustomer(c); setShowNewContact(false); }} onClose={() => setShowNewContact(false)} />}
        </div>
    );
}
