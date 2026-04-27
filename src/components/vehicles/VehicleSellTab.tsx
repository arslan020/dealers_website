'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Customer { _id: string; firstName: string; lastName: string; email?: string; phone?: string; }
interface LineItem { name: string; description?: string; priceExcVat: number; vatRate: 'No VAT' | '5%' | '20%'; isVehicle?: boolean; }
interface PartExchange { vrm: string; vehicleName?: string; vin?: string; mileage?: number; price: number; vatRate: 'No VAT' | '5%' | '20%'; createPurchaseInvoice: boolean; addToVehicles: boolean; }
interface Payment { date: string; amount: number; method: 'Cash' | 'Card' | 'Bank Transfer' | 'Finance' | 'Other'; note?: string; }
interface Sale {
    _id: string;
    type: 'invoice' | 'order';
    status: 'draft' | 'issued' | 'paid' | 'void';
    invoiceNumber: string;
    invoiceType: 'VAT Invoice' | 'Margin Scheme';
    invoiceDate: string;
    timeOfSupply?: string;
    invoiceNotes?: string;
    customerId: Customer;
    lineItems: LineItem[];
    partExchanges: PartExchange[];
    finance?: { amount: number; providerName?: string; generateProviderInvoice: boolean; customerDeposit: number; paidBy?: string; };
    payments: Payment[];
    handoverComplete: boolean;
    issuedAt?: string;
    paidAt?: string;
}

interface Props {
    vehicleId: string;
    vehiclePrice?: number;
    vehicleName?: string;
    vehicleStatus?: string;
    onStatusChange?: (s: string) => void;
    onNavigateToReserve?: () => void;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function initials(first?: string, last?: string) { return `${first?.charAt(0) ?? ''}${last?.charAt(0) ?? ''}`.toUpperCase(); }
function fmtCurrency(n: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n); }
function today() { return new Date().toISOString().split('T')[0]; }

function vatAmount(price: number, rate: 'No VAT' | '5%' | '20%') {
    if (rate === '5%') return price * 0.05;
    if (rate === '20%') return price * 0.2;
    return 0;
}

function calcTotals(items: LineItem[], px: PartExchange[]) {
    let subtotal = 0, vat = 0;
    items.forEach(i => { subtotal += i.priceExcVat; vat += vatAmount(i.priceExcVat, i.vatRate); });
    px.forEach(p => { subtotal -= p.price; vat -= vatAmount(p.price, p.vatRate); });
    return { subtotal, vat, total: subtotal + vat };
}

/* ─── New Contact Modal ──────────────────────────────────────────────────────── */
function NewContactModal({ onCreated, onClose }: { onCreated: (c: Customer) => void; onClose: () => void; }) {
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [saving, setSaving] = useState(false);
    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.firstName.trim() || !form.lastName.trim()) { toast.error('Name required'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/crm/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, source: 'Walk-in', status: 'Active' }) });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success('Contact created');
            onCreated(data.customer);
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    }
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5"><h2 className="text-[15px] font-bold text-slate-800">New Contact</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button></div>
                <form onSubmit={submit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">First Name *</label><input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} /></div>
                        <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Last Name *</label><input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
                    </div>
                    <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Email</label><input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                    <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Phone</label><input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 border border-slate-200 rounded-lg py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 bg-[#4D7CFF] text-white rounded-lg py-2 text-[13px] font-semibold hover:bg-[#3a6ae0] disabled:opacity-60">{saving ? 'Creating…' : 'Create Contact'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Customer Search ────────────────────────────────────────────────────────── */
function CustomerSearch({ selected, onSelect, onNew }: { selected: Customer | null; onSelect: (c: Customer) => void; onNew: () => void; }) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<Customer[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (q.length < 2) { setResults([]); setOpen(false); return; }
        const t = setTimeout(async () => {
            setLoading(true);
            try { const r = await fetch(`/api/crm/customers?q=${encodeURIComponent(q)}&limit=8`); const d = await r.json(); setResults(d.customers || []); setOpen(true); } catch { } finally { setLoading(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    if (selected) return (
        <div className="flex items-center justify-between border border-[#4D7CFF] rounded-xl px-4 py-3 bg-blue-50/30">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#4D7CFF] flex items-center justify-center text-white font-bold text-[12px]">{initials(selected.firstName, selected.lastName)}</div>
                <div><div className="text-[13px] font-bold text-slate-800">{selected.firstName} {selected.lastName}</div>{selected.email && <div className="text-[11px] text-slate-400">{selected.email}</div>}</div>
            </div>
            <button onClick={() => onSelect(null as any)} className="text-slate-400 hover:text-red-500 text-lg">&times;</button>
        </div>
    );
    return (
        <div ref={ref} className="relative">
            <input type="text" placeholder="Start typing to search..." value={q} onChange={e => setQ(e.target.value)} onFocus={() => results.length > 0 && setOpen(true)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
            {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin" /></div>}
            {open && results.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                    {results.map(c => (
                        <button key={c._id} onClick={() => { onSelect(c); setQ(''); setOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0">
                            <div className="w-8 h-8 rounded-full bg-[#4D7CFF] flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">{initials(c.firstName, c.lastName)}</div>
                            <div><div className="text-[13px] font-semibold text-slate-800">{c.firstName} {c.lastName}</div>{c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}</div>
                        </button>
                    ))}
                </div>
            )}
            {open && q.length >= 2 && !loading && results.length === 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 px-4 py-3">
                    <p className="text-[12px] text-slate-400">No contacts found. <button onClick={onNew} className="text-[#4D7CFF] font-semibold hover:underline">Create new</button></p>
                </div>
            )}
        </div>
    );
}

/* ─── Invoice Form ───────────────────────────────────────────────────────────── */
function InvoiceForm({ vehicleId, vehiclePrice, vehicleName, type, onCreated, onBack }: {
    vehicleId: string; vehiclePrice?: number; vehicleName?: string;
    type: 'invoice' | 'order'; onCreated: (s: Sale) => void; onBack: () => void;
}) {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [showNewContact, setShowNewContact] = useState(false);
    const [lineItems, setLineItems] = useState<LineItem[]>([
        { name: vehicleName || 'Vehicle', priceExcVat: vehiclePrice || 0, vatRate: 'No VAT', isVehicle: true }
    ]);
    const [partExchanges, setPartExchanges] = useState<PartExchange[]>([]);
    const [finance, setFinance] = useState({ amount: 0, providerName: '', generateProviderInvoice: false, customerDeposit: 0, paidBy: '' });
    const [invoiceType, setInvoiceType] = useState<'VAT Invoice' | 'Margin Scheme'>('Margin Scheme');
    const [invoiceDate, setInvoiceDate] = useState(today());
    const [timeOfSupply, setTimeOfSupply] = useState('');
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Expandable sections
    const [showProduct, setShowProduct] = useState(false);
    const [showOneOff, setShowOneOff] = useState(false);
    const [showPX, setShowPX] = useState(false);
    const [showFinance, setShowFinance] = useState(false);
    const [showDocs, setShowDocs] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    // One-off product form
    const [oneOff, setOneOff] = useState({ name: '', description: '', priceExcVat: '', vatRate: 'No VAT' as 'No VAT' | '5%' | '20%' });

    // Part exchange form
    const [pxVrm, setPxVrm] = useState('');
    const [pxLooking, setPxLooking] = useState(false);
    const [pxData, setPxData] = useState<Partial<PartExchange>>({});

    const { subtotal, vat, total } = calcTotals(lineItems, partExchanges);

    async function lookupVrm() {
        if (!pxVrm.trim()) return;
        setPxLooking(true);
        try {
            const res = await fetch(`/api/vehicles/derivatives?vrm=${encodeURIComponent(pxVrm.trim())}`);
            const data = await res.json();
            if (data.ok && data.derivative) {
                setPxData(p => ({ ...p, vrm: pxVrm.trim().toUpperCase(), vehicleName: `${data.derivative.make} ${data.derivative.model} ${data.derivative.derivative}`.trim(), vin: data.derivative.vin || '' }));
            } else {
                setPxData(p => ({ ...p, vrm: pxVrm.trim().toUpperCase(), vehicleName: '' }));
            }
        } catch { setPxData(p => ({ ...p, vrm: pxVrm.trim().toUpperCase() })); } finally { setPxLooking(false); }
    }

    function addPX() {
        if (!pxData.vrm) return;
        setPartExchanges(p => [...p, { vrm: pxData.vrm!, vehicleName: pxData.vehicleName, vin: pxData.vin, mileage: pxData.mileage, price: pxData.price || 0, vatRate: pxData.vatRate || 'No VAT', createPurchaseInvoice: pxData.createPurchaseInvoice ?? false, addToVehicles: pxData.addToVehicles ?? true }]);
        setPxVrm(''); setPxData({});
    }

    async function handleSave() {
        if (!customer) { toast.error('Please select a customer'); return; }
        setSaving(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/sale`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: customer._id, type, invoiceType, invoiceDate, timeOfSupply: timeOfSupply || undefined, invoiceNotes: invoiceNotes || undefined, lineItems, partExchanges, finance: finance.amount > 0 || finance.customerDeposit > 0 ? finance : undefined }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed');
            toast.success(type === 'invoice' ? 'Invoice created' : 'Order created');
            onCreated(data.sale);
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    }

    const title = type === 'invoice' ? 'Create Invoice' : 'Create Order';

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <h2 className="text-[16px] font-bold text-slate-900">{title}</h2>
                    </div>
                    <button className="flex items-center gap-2 border border-[#4D7CFF] text-[#4D7CFF] text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Currency Converter
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Customer */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[14px] font-semibold text-slate-700">Customer</label>
                            <button onClick={() => setShowNewContact(true)} className="flex items-center gap-1.5 border border-[#4D7CFF] text-[#4D7CFF] text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                New Contact
                            </button>
                        </div>
                        <CustomerSearch selected={customer} onSelect={setCustomer} onNew={() => setShowNewContact(true)} />
                    </div>

                    {/* Vehicle line item */}
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
                            <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Vehicle</span>
                        </div>
                        {lineItems.filter(i => i.isVehicle).map((item, idx) => (
                            <div key={idx} className="px-4 py-3 flex items-center gap-4">
                                <div className="flex-1 text-[13px] font-semibold text-slate-800">{item.name}</div>
                                <div className="w-36">
                                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                                        <span className="px-2 text-slate-400 text-[13px] bg-slate-50 border-r border-slate-200 py-2">£</span>
                                        <input type="number" className="flex-1 px-2 py-2 text-[13px] focus:outline-none" value={item.priceExcVat} onChange={e => setLineItems(items => items.map((it, i) => i === idx ? { ...it, priceExcVat: parseFloat(e.target.value) || 0 } : it))} />
                                    </div>
                                </div>
                                <select value={item.vatRate} onChange={e => setLineItems(items => items.map((it, i) => i === idx ? { ...it, vatRate: e.target.value as any } : it))} className="border border-slate-200 rounded-lg px-2 py-2 text-[12px] focus:outline-none">
                                    <option>No VAT</option><option>5%</option><option>20%</option>
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Add Product */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <button onClick={() => setShowProduct(!showProduct)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <span className="text-[14px] font-bold text-[#4D7CFF]">Add Product</span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showProduct ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showProduct && (
                    <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4">
                        <input placeholder="Start typing to search..." className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        <button onClick={() => setShowOneOff(!showOneOff)} className="flex items-center gap-1.5 text-[#4D7CFF] text-[13px] font-semibold">
                            <svg className={`w-3.5 h-3.5 transition-transform ${showOneOff ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            Add One-Off Product
                        </button>
                        {showOneOff && (
                            <div className="space-y-4 border border-slate-100 rounded-xl p-4">
                                <div><label className="block text-[12px] font-semibold text-slate-500 mb-1">Product Name</label><input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={oneOff.name} onChange={e => setOneOff(p => ({ ...p, name: e.target.value }))} /></div>
                                <div><label className="block text-[12px] font-semibold text-slate-500 mb-1">Description</label><textarea rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" value={oneOff.description} onChange={e => setOneOff(p => ({ ...p, description: e.target.value }))} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[12px] font-semibold text-slate-500 mb-1">Price Exc. VAT</label>
                                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                                            <span className="px-2 text-slate-400 text-[13px] bg-slate-50 border-r border-slate-200 py-2">£</span>
                                            <input type="number" className="flex-1 px-2 py-2 text-[13px] focus:outline-none" value={oneOff.priceExcVat} onChange={e => setOneOff(p => ({ ...p, priceExcVat: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[12px] font-semibold text-slate-500 mb-1">VAT</label>
                                        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none" value={oneOff.vatRate} onChange={e => setOneOff(p => ({ ...p, vatRate: e.target.value as any }))}>
                                            <option>No VAT</option><option>5%</option><option>20%</option>
                                        </select>
                                    </div>
                                </div>
                                <button onClick={() => { if (!oneOff.name) return; setLineItems(p => [...p, { name: oneOff.name, description: oneOff.description, priceExcVat: parseFloat(oneOff.priceExcVat as any) || 0, vatRate: oneOff.vatRate }]); setOneOff({ name: '', description: '', priceExcVat: '', vatRate: 'No VAT' }); setShowOneOff(false); }} className="bg-[#4D7CFF] text-white text-[12px] font-bold px-4 py-2 rounded-lg hover:bg-[#3a6ae0]">
                                    Add One-Off Product
                                </button>
                            </div>
                        )}
                        {/* Added extra line items */}
                        {lineItems.filter(i => !i.isVehicle).length > 0 && (
                            <div className="space-y-2">
                                {lineItems.map((item, idx) => !item.isVehicle && (
                                    <div key={idx} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                                        <div><div className="text-[13px] font-semibold text-slate-700">{item.name}</div>{item.description && <div className="text-[11px] text-slate-400">{item.description}</div>}</div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[13px] font-semibold text-slate-800">{fmtCurrency(item.priceExcVat)}</span>
                                            <span className="text-[11px] text-slate-400">{item.vatRate}</span>
                                            <button onClick={() => setLineItems(p => p.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-sm">&times;</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Part Exchanges */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <button onClick={() => setShowPX(!showPX)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <span className="text-[14px] font-bold text-[#4D7CFF]">Part Exchanges</span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showPX ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showPX && (
                    <div className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-4">
                        <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                            <span className="col-span-4">Vehicle</span><span className="col-span-4">Price</span><span className="col-span-3">VAT</span>
                        </div>
                        {/* PX entry row */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Registration</label>
                                    <div className="flex gap-2">
                                        <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] uppercase focus:outline-none focus:border-[#4D7CFF]" value={pxVrm} onChange={e => setPxVrm(e.target.value.toUpperCase())} placeholder="FP13HLJ" />
                                        <button onClick={lookupVrm} disabled={pxLooking} className="bg-[#4D7CFF] text-white px-3 py-2 rounded-lg text-[12px] font-bold hover:bg-[#3a6ae0] disabled:opacity-60">
                                            {pxLooking ? '…' : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" /></svg>}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Vehicle</label>
                                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none" value={pxData.vehicleName || ''} onChange={e => setPxData(p => ({ ...p, vehicleName: e.target.value }))} placeholder="Make Model Derivative" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">VIN</label><input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none" value={pxData.vin || ''} onChange={e => setPxData(p => ({ ...p, vin: e.target.value }))} /></div>
                                <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Mileage</label><input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none" value={pxData.mileage || ''} onChange={e => setPxData(p => ({ ...p, mileage: parseInt(e.target.value) || 0 }))} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Price</label>
                                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                                        <span className="px-2 text-slate-400 bg-slate-50 border-r border-slate-200 py-2 text-[13px]">£</span>
                                        <input type="number" className="flex-1 px-2 py-2 text-[13px] focus:outline-none" value={pxData.price || ''} onChange={e => setPxData(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">VAT</label>
                                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none" value={pxData.vatRate || 'No VAT'} onChange={e => setPxData(p => ({ ...p, vatRate: e.target.value as any }))}>
                                        <option>No VAT</option><option>5%</option><option>20%</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Create Purchase Invoice</label><div className="flex gap-4 mt-1"><label className="flex items-center gap-1.5 text-[13px]"><input type="radio" name="cpi" checked={pxData.createPurchaseInvoice === true} onChange={() => setPxData(p => ({ ...p, createPurchaseInvoice: true }))} /> Yes</label><label className="flex items-center gap-1.5 text-[13px]"><input type="radio" name="cpi" checked={!pxData.createPurchaseInvoice} onChange={() => setPxData(p => ({ ...p, createPurchaseInvoice: false }))} /> No</label></div></div>
                                <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Add to Vehicles</label><div className="flex gap-4 mt-1"><label className="flex items-center gap-1.5 text-[13px]"><input type="radio" name="atv" checked={pxData.addToVehicles !== false} onChange={() => setPxData(p => ({ ...p, addToVehicles: true }))} /> Yes</label><label className="flex items-center gap-1.5 text-[13px]"><input type="radio" name="atv" checked={pxData.addToVehicles === false} onChange={() => setPxData(p => ({ ...p, addToVehicles: false }))} /> No</label></div></div>
                            </div>
                            <button onClick={addPX} disabled={!pxData.vrm} className="flex items-center gap-1.5 border border-slate-300 text-slate-600 text-[12px] font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 4v16m8-8H4" /></svg>
                                Add Another Vehicle
                            </button>
                        </div>
                        {partExchanges.map((px, idx) => (
                            <div key={idx} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 bg-slate-50/40">
                                <div><div className="text-[13px] font-bold text-slate-700">{px.vrm}</div><div className="text-[11px] text-slate-400">{px.vehicleName}</div></div>
                                <div className="flex items-center gap-3"><span className="text-[13px] font-semibold text-slate-700">- {fmtCurrency(px.price)}</span><button onClick={() => setPartExchanges(p => p.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">&times;</button></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Finance */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <button onClick={() => setShowFinance(!showFinance)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <span className="text-[14px] font-bold text-[#4D7CFF]">Finance</span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showFinance ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showFinance && (
                    <div className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-500 mb-1">Finance Amount</label>
                                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                                    <span className="px-2 text-slate-400 bg-slate-50 border-r border-slate-200 py-2 text-[13px]">£</span>
                                    <input type="number" className="flex-1 px-2 py-2 text-[13px] focus:outline-none" value={finance.amount || ''} onChange={e => setFinance(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-500 mb-1">Finance Provider</label>
                                <input placeholder="Start typing to search..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={finance.providerName} onChange={e => setFinance(p => ({ ...p, providerName: e.target.value }))} />
                            </div>
                        </div>
                        <div><label className="flex items-center gap-2 text-[13px] font-semibold text-slate-600"><input type="checkbox" checked={finance.generateProviderInvoice} onChange={e => setFinance(p => ({ ...p, generateProviderInvoice: e.target.checked }))} className="rounded" /> Generate Finance Provider Invoice</label></div>
                        <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-500 mb-1">OR Customer Deposit</label>
                                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                                    <span className="px-2 text-slate-400 bg-slate-50 border-r border-slate-200 py-2 text-[13px]">£</span>
                                    <input type="number" className="flex-1 px-2 py-2 text-[13px] focus:outline-none" value={finance.customerDeposit || ''} onChange={e => setFinance(p => ({ ...p, customerDeposit: parseFloat(e.target.value) || 0 }))} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-500 mb-1">Due From/Paid By</label>
                                <input placeholder="Customer Name" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={finance.paidBy} onChange={e => setFinance(p => ({ ...p, paidBy: e.target.value }))} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Documents */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <button onClick={() => setShowDocs(!showDocs)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <span className="text-[14px] font-bold text-[#4D7CFF]">Documents</span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showDocs ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showDocs && (
                    <div className="px-6 pb-6 border-t border-slate-100 pt-4">
                        <label className="block text-[12px] font-semibold text-slate-500 mb-2">Attach Documents</label>
                        <div className="border border-slate-200 rounded-lg px-4 py-3"><input type="file" multiple className="text-[13px] text-slate-600" /></div>
                    </div>
                )}
            </div>

            {/* Options */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <button onClick={() => setShowOptions(!showOptions)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <span className="text-[14px] font-bold text-[#4D7CFF]">Options</span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showOptions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showOptions && (
                    <div className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-5">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-500 mb-2">Invoice Type</label>
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-2 text-[13px]"><input type="radio" name="invType" checked={invoiceType === 'VAT Invoice'} onChange={() => setInvoiceType('VAT Invoice')} /> VAT Invoice</label>
                                    <label className="flex items-center gap-2 text-[13px]"><input type="radio" name="invType" checked={invoiceType === 'Margin Scheme'} onChange={() => setInvoiceType('Margin Scheme')} /> Margin Scheme</label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-500 mb-2">Invoice Date</label>
                                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-500 mb-1">Time of Supply</label>
                            <input type="date" className="w-64 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={timeOfSupply} onChange={e => setTimeOfSupply(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-500 mb-1">Invoice Notes</label>
                            <textarea rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} placeholder="Add notes to appear on the invoice..." />
                        </div>
                    </div>
                )}
            </div>

            {/* Totals + Save */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1 text-[13px]">
                        <div className="flex gap-6"><span className="text-slate-500 w-28">Subtotal</span><span className="font-semibold text-slate-800">{fmtCurrency(subtotal)}</span></div>
                        {vat !== 0 && <div className="flex gap-6"><span className="text-slate-500 w-28">VAT</span><span className="font-semibold text-slate-800">{fmtCurrency(vat)}</span></div>}
                        {partExchanges.length > 0 && <div className="flex gap-6"><span className="text-slate-500 w-28">Part Exchanges</span><span className="font-semibold text-red-600">- {fmtCurrency(partExchanges.reduce((s, p) => s + p.price, 0))}</span></div>}
                        <div className="flex gap-6 border-t border-slate-100 pt-2 mt-2"><span className="text-slate-700 font-bold w-28">Total</span><span className="font-bold text-slate-900 text-[15px]">{fmtCurrency(total)}</span></div>
                    </div>
                    <button onClick={handleSave} disabled={saving || !customer} className="bg-[#4D7CFF] text-white text-[14px] font-bold px-8 py-3 rounded-lg hover:bg-[#3a6ae0] disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save ' + (type === 'invoice' ? 'Invoice' : 'Order')}
                    </button>
                </div>
            </div>

            {showNewContact && <NewContactModal onCreated={c => { setCustomer(c); setShowNewContact(false); }} onClose={() => setShowNewContact(false)} />}
        </div>
    );
}

/* ─── Invoice Viewer ─────────────────────────────────────────────────────────── */
function InvoiceViewer({ vehicleId, sale, onUpdated, onBack }: { vehicleId: string; sale: Sale; onUpdated: (s: Sale) => void; onBack: () => void; }) {
    const [actioning, setActioning] = useState(false);
    const [showPayForm, setShowPayForm] = useState(false);
    const [payment, setPayment] = useState({ date: today(), amount: '', method: 'Cash' as any, note: '' });
    const { subtotal, vat, total } = calcTotals(sale.lineItems, sale.partExchanges);

    async function doAction(action: string, extra?: any) {
        setActioning(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/sale`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            onUpdated(data.sale);
            toast.success(action === 'issue' ? 'Invoice issued!' : action === 'markPaid' ? 'Marked as paid!' : action === 'handover' ? 'Handover complete!' : 'Updated');
        } catch (err: any) { toast.error(err.message); } finally { setActioning(false); setShowPayForm(false); }
    }

    const totalPaid = sale.payments.reduce((s, p) => s + p.amount, 0);
    const balance = total - totalPaid;
    const title = sale.type === 'invoice' ? 'Invoice' : 'Order';

    return (
        <div className="space-y-4">
            {/* Status banner */}
            {sale.status === 'draft' && (
                <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-5 py-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div>
                            <div className="text-[14px] font-bold text-teal-700">Draft {title}</div>
                            <div className="text-[12px] text-teal-600">This {title.toLowerCase()} is a draft and has not yet been issued. You must issue it to print/send/sign, and to mark as paid.</div>
                        </div>
                    </div>
                    <button onClick={() => doAction('issue')} disabled={actioning} className="bg-teal-600 text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-teal-700 disabled:opacity-60 whitespace-nowrap ml-4">
                        Issue {title}
                    </button>
                </div>
            )}
            {sale.status === 'issued' && (
                <div className="flex items-center justify-between bg-emerald-500 rounded-xl px-5 py-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-white flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div>
                            <div className="text-[14px] font-bold text-white">{title} issued successfully!</div>
                            <div className="text-[12px] text-emerald-100">This {title.toLowerCase()} is now ready to print/send/sign, and to mark as paid.</div>
                        </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                        {['Share', 'Email', 'eSign'].map(a => <button key={a} className="bg-[#4D7CFF] text-white text-[12px] font-bold px-4 py-2 rounded-lg hover:bg-[#3a6ae0]">{a}</button>)}
                    </div>
                </div>
            )}
            {sale.status === 'paid' && !sale.handoverComplete && (
                <div className="flex items-center justify-between bg-emerald-500 rounded-xl px-5 py-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-white flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div>
                            <div className="text-[14px] font-bold text-white">Invoice payments saved successfully!</div>
                            <div className="text-[12px] text-emerald-100">Vehicle has been marked as sold and removed from sales channels.</div>
                        </div>
                    </div>
                    <div className="flex gap-2 ml-4">{['Share', 'Email'].map(a => <button key={a} className="bg-[#4D7CFF] text-white text-[12px] font-bold px-4 py-2 rounded-lg hover:bg-[#3a6ae0]">{a}</button>)}</div>
                </div>
            )}
            {sale.status === 'paid' && !sale.handoverComplete && (
                <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-5 py-4">
                    <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="text-[13px] font-bold text-teal-700">Vehicle successfully marked as sold!</span>
                    </div>
                    <button className="border border-teal-500 text-teal-600 text-[12px] font-bold px-4 py-2 rounded-lg hover:bg-teal-50">Sell Vehicle</button>
                </div>
            )}

            {/* Invoice details card */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
                        <div>
                            <h2 className="text-[16px] font-bold text-slate-900">{title} #{sale.invoiceNumber}</h2>
                            <p className="text-[12px] text-slate-400">{sale.customerId.firstName} {sale.customerId.lastName} · {sale.invoiceDate}</p>
                        </div>
                    </div>
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${sale.status === 'draft' ? 'bg-amber-100 text-amber-700' : sale.status === 'issued' ? 'bg-blue-100 text-blue-700' : sale.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {sale.status}
                    </span>
                </div>

                <div className="p-6 space-y-4">
                    {/* Line items */}
                    <table className="w-full text-left">
                        <thead><tr className="border-b border-slate-100"><th className="text-[11px] font-bold text-slate-400 uppercase pb-2">Item</th><th className="text-[11px] font-bold text-slate-400 uppercase pb-2 text-right">Price</th><th className="text-[11px] font-bold text-slate-400 uppercase pb-2 text-right">VAT</th><th className="text-[11px] font-bold text-slate-400 uppercase pb-2 text-right">Total</th></tr></thead>
                        <tbody>
                            {sale.lineItems.map((item, i) => <tr key={i} className="border-b border-slate-50"><td className="py-2.5 text-[13px] text-slate-700">{item.name}{item.description && <div className="text-[11px] text-slate-400">{item.description}</div>}</td><td className="py-2.5 text-[13px] text-slate-700 text-right">{fmtCurrency(item.priceExcVat)}</td><td className="py-2.5 text-[12px] text-slate-400 text-right">{item.vatRate}</td><td className="py-2.5 text-[13px] font-semibold text-slate-800 text-right">{fmtCurrency(item.priceExcVat + vatAmount(item.priceExcVat, item.vatRate))}</td></tr>)}
                            {sale.partExchanges.map((px, i) => <tr key={`px${i}`} className="border-b border-slate-50"><td className="py-2.5 text-[13px] text-slate-700">Part Exchange: {px.vrm}{px.vehicleName && <span className="text-slate-400 ml-1">({px.vehicleName})</span>}</td><td className="py-2.5 text-[13px] text-red-600 text-right">- {fmtCurrency(px.price)}</td><td className="py-2.5 text-[12px] text-slate-400 text-right">{px.vatRate}</td><td className="py-2.5 text-[13px] font-semibold text-red-600 text-right">- {fmtCurrency(px.price + vatAmount(px.price, px.vatRate))}</td></tr>)}
                        </tbody>
                        <tfoot>
                            <tr><td colSpan={3} className="pt-3 text-right text-[13px] font-bold text-slate-800 pr-4">Total</td><td className="pt-3 text-right text-[15px] font-bold text-slate-900">{fmtCurrency(total)}</td></tr>
                            {sale.payments.length > 0 && <>
                                {sale.payments.map((p, i) => <tr key={i}><td colSpan={3} className="pt-1 text-right text-[12px] text-slate-400 pr-4">Payment ({p.method})</td><td className="pt-1 text-right text-[12px] text-emerald-600">- {fmtCurrency(p.amount)}</td></tr>)}
                                <tr><td colSpan={3} className="pt-2 text-right text-[13px] font-bold text-slate-700 pr-4 border-t border-slate-100">Balance Due</td><td className="pt-2 text-right text-[14px] font-bold text-slate-900 border-t border-slate-100">{fmtCurrency(balance)}</td></tr>
                            </>}
                        </tfoot>
                    </table>

                    {/* Invoice type */}
                    <div className="text-[12px] text-slate-400 border-t border-slate-100 pt-3">{sale.invoiceType} · Invoice Date: {sale.invoiceDate}</div>
                    {sale.invoiceNotes && <div className="text-[12px] text-slate-600 bg-slate-50 rounded-lg px-4 py-3">{sale.invoiceNotes}</div>}
                </div>
            </div>

            {/* Mark as Paid */}
            {sale.status === 'issued' && (
                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
                    <h3 className="text-[14px] font-bold text-slate-800 mb-4">Mark as Paid</h3>
                    {!showPayForm ? (
                        <button onClick={() => setShowPayForm(true)} className="bg-emerald-500 text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-emerald-600">Record Payment</button>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Date</label><input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={payment.date} onChange={e => setPayment(p => ({ ...p, date: e.target.value }))} /></div>
                                <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Amount</label><div className="flex items-center border border-slate-200 rounded-lg overflow-hidden"><span className="px-2 text-slate-400 bg-slate-50 border-r border-slate-200 py-2 text-[13px]">£</span><input type="number" className="flex-1 px-2 py-2 text-[13px] focus:outline-none" value={payment.amount} onChange={e => setPayment(p => ({ ...p, amount: e.target.value }))} /></div></div>
                                <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Method</label><select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none" value={payment.method} onChange={e => setPayment(p => ({ ...p, method: e.target.value as any }))}><option>Cash</option><option>Card</option><option>Bank Transfer</option><option>Finance</option><option>Other</option></select></div>
                            </div>
                            <div><label className="block text-[11px] font-semibold text-slate-500 mb-1">Note (optional)</label><input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={payment.note} onChange={e => setPayment(p => ({ ...p, note: e.target.value }))} /></div>
                            <div className="flex gap-2">
                                <button onClick={() => doAction('addPayment', { payment: { ...payment, amount: parseFloat(payment.amount as any) || 0 } })} disabled={actioning} className="border border-slate-200 text-slate-600 text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-60">Save (Part Payment)</button>
                                <button onClick={() => doAction('markPaid', { payment: { ...payment, amount: parseFloat(payment.amount as any) || 0 } })} disabled={actioning} className="bg-emerald-500 text-white text-[13px] font-bold px-4 py-2 rounded-lg hover:bg-emerald-600 disabled:opacity-60">Mark as Paid</button>
                                <button onClick={() => setShowPayForm(false)} className="text-slate-400 hover:text-slate-600 text-[13px]">Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Handover */}
            {sale.status === 'paid' && !sale.handoverComplete && (
                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center text-teal-600 font-bold text-[14px]">3</div>
                        <div><div className="text-[14px] font-bold text-slate-800">Confirm Handover</div><div className="text-[12px] text-slate-400">Customer takes ownership</div></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: 'Send to Driver', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
                            { label: 'Delivery Report', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                            { label: 'Upload Documents', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
                            { label: 'eSign', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
                        ].map(btn => (
                            <button key={btn.label} className="flex items-center gap-2 bg-[#4D7CFF] text-white text-[12px] font-bold px-4 py-2.5 rounded-lg hover:bg-[#3a6ae0]">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d={btn.icon} /></svg>
                                {btn.label}
                            </button>
                        ))}
                        <button onClick={() => doAction('handover')} disabled={actioning} className="flex items-center gap-2 bg-emerald-500 text-white text-[12px] font-bold px-4 py-2.5 rounded-lg hover:bg-emerald-600 disabled:opacity-60">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" /></svg>
                            Mark as Complete
                        </button>
                    </div>
                </div>
            )}
            {sale.handoverComplete && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-[14px] font-bold text-emerald-700">Vehicle handed over to customer. Sale complete!</span>
                </div>
            )}
        </div>
    );
}

/* ─── Steps View (Main) ──────────────────────────────────────────────────────── */
function StepsView({ sale, vehicleStatus, onNavigateToReserve, onCreateInvoice, onCreateOrder, onViewSale }: {
    sale: Sale | null; vehicleStatus: string; onNavigateToReserve: () => void;
    onCreateInvoice: () => void; onCreateOrder: () => void; onViewSale: () => void;
}) {
    const isReserved = vehicleStatus === 'Reserved';
    const isSold = vehicleStatus === 'Sold' || sale?.status === 'paid';
    const hasSale = !!sale;

    return (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <h2 className="text-[16px] font-bold text-slate-900">Sell Vehicle</h2>
                <div className="flex items-center gap-2">
                    <button className="w-9 h-9 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                    <button className="bg-[#4D7CFF] text-white text-[13px] font-bold px-4 py-1.5 rounded-lg hover:bg-[#3a6ae0]">For Sale</button>
                </div>
            </div>

            <div className="p-6 space-y-0">
                {/* Step 1 */}
                <div className="flex gap-5">
                    <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-[14px] flex-shrink-0 ${isReserved ? 'bg-teal-50 border-teal-300 text-teal-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                            {isReserved ? <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" /></svg> : '1'}
                        </div>
                        <div className="w-px flex-1 bg-slate-200 my-2" style={{ minHeight: '40px' }} />
                    </div>
                    <div className="pb-8 flex-1">
                        <div className="text-[14px] font-bold text-slate-800 mb-0.5">Reserve Vehicle</div>
                        <div className="text-[12px] text-slate-400 mb-3">Secure vehicle for customer</div>
                        {!isReserved && !hasSale && (
                            <div>
                                <p className="text-[13px] text-slate-600 mb-3">Optional. Reserve this vehicle to prevent duplicate sale.</p>
                                <button onClick={onNavigateToReserve} className="bg-[#4D7CFF] text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-[#3a6ae0]">Reserve Vehicle</button>
                            </div>
                        )}
                        {isReserved && <p className="text-[13px] text-emerald-600 font-semibold">✓ Vehicle is reserved</p>}
                    </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-5">
                    <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-[14px] flex-shrink-0 ${isSold ? 'bg-teal-50 border-teal-300 text-teal-600' : hasSale ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                            {isSold ? <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" /></svg> : '2'}
                        </div>
                        <div className="w-px flex-1 bg-slate-200 my-2" style={{ minHeight: '40px' }} />
                    </div>
                    <div className="pb-8 flex-1">
                        <div className="text-[14px] font-bold text-slate-800 mb-0.5">Invoice Customer</div>
                        <div className="text-[12px] text-slate-400 mb-3">Complete sale &amp; payment</div>
                        {!hasSale && (
                            <div>
                                <p className="text-[13px] text-slate-600 mb-3">Create an invoice and provide payment instructions to customer.</p>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={onCreateInvoice} className="bg-[#4D7CFF] text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-[#3a6ae0]">Create Invoice</button>
                                    <button onClick={onCreateOrder} className="bg-slate-500 text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-slate-600">Create Order</button>
                                    <button className="bg-slate-500 text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-slate-600">Create Deal</button>
                                </div>
                            </div>
                        )}
                        {hasSale && (
                            <div className="flex items-center gap-3">
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase ${sale!.status === 'draft' ? 'bg-amber-100 text-amber-700' : sale!.status === 'issued' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{sale!.status}</span>
                                <span className="text-[13px] text-slate-600">{sale!.type === 'invoice' ? 'Invoice' : 'Order'} #{sale!.invoiceNumber}</span>
                                <button onClick={onViewSale} className="text-[#4D7CFF] text-[12px] font-semibold hover:underline">View →</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-5">
                    <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-[14px] flex-shrink-0 ${sale?.handoverComplete ? 'bg-teal-50 border-teal-300 text-teal-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                            {sale?.handoverComplete ? <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 13l4 4L19 7" /></svg> : '3'}
                        </div>
                        <div className="w-px flex-1 bg-slate-200 my-2" style={{ minHeight: '40px' }} />
                    </div>
                    <div className="pb-8 flex-1">
                        <div className="text-[14px] font-bold text-slate-800 mb-0.5">Confirm Handover</div>
                        <div className="text-[12px] text-slate-400 mb-3">Customer takes ownership</div>
                        {isSold && !sale?.handoverComplete && (
                            <button onClick={onViewSale} className="text-[#4D7CFF] text-[13px] font-semibold hover:underline">Go to handover →</button>
                        )}
                        {!isSold && <p className="text-[13px] text-slate-400">Vehicle must be marked as sold before handover.</p>}
                        {sale?.handoverComplete && <p className="text-[13px] text-emerald-600 font-semibold">✓ Handover complete</p>}
                    </div>
                </div>

                {/* Sold! */}
                <div className="flex gap-5">
                    <div className="flex flex-col items-center">
                        <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center font-bold text-[13px] flex-shrink-0 ${sale?.handoverComplete ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                            Sold!
                        </div>
                    </div>
                    <div className="flex items-center">
                        {sale?.handoverComplete && <p className="text-[14px] font-bold text-emerald-600">Sale complete 🎉</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */
export function VehicleSellTab({ vehicleId, vehiclePrice, vehicleName, vehicleStatus, onStatusChange, onNavigateToReserve }: Props) {
    const [sale, setSale] = useState<Sale | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'steps' | 'createInvoice' | 'createOrder' | 'viewSale'>('steps');

    const fetchSale = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/sale`);
            const data = await res.json();
            if (data.ok && data.sale) { setSale(data.sale); if (data.sale.status !== 'draft') setView('viewSale'); }
        } catch { } finally { setLoading(false); }
    }, [vehicleId]);

    useEffect(() => { fetchSale(); }, [fetchSale]);

    function handleCreated(s: Sale) { setSale(s); setView('viewSale'); }
    function handleUpdated(s: Sale) {
        setSale(s);
        if (s.status === 'paid') onStatusChange?.('Sold');
    }

    if (loading) return (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-12 text-center">
            <div className="w-8 h-8 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-slate-400">Loading…</p>
        </div>
    );

    if (view === 'createInvoice') return <InvoiceForm vehicleId={vehicleId} vehiclePrice={vehiclePrice} vehicleName={vehicleName} type="invoice" onCreated={handleCreated} onBack={() => setView('steps')} />;
    if (view === 'createOrder') return <InvoiceForm vehicleId={vehicleId} vehiclePrice={vehiclePrice} vehicleName={vehicleName} type="order" onCreated={handleCreated} onBack={() => setView('steps')} />;
    if (view === 'viewSale' && sale) return <InvoiceViewer vehicleId={vehicleId} sale={sale} onUpdated={handleUpdated} onBack={() => setView('steps')} />;

    return (
        <StepsView
            sale={sale}
            vehicleStatus={vehicleStatus || ''}
            onNavigateToReserve={onNavigateToReserve || (() => { })}
            onCreateInvoice={() => { if (sale) { setView('viewSale'); } else { setView('createInvoice'); } }}
            onCreateOrder={() => { if (sale) { setView('viewSale'); } else { setView('createOrder'); } }}
            onViewSale={() => setView('viewSale')}
        />
    );
}
