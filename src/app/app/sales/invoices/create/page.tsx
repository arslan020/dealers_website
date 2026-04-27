'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Customer { _id: string; firstName: string; lastName: string; businessName?: string; email?: string; phone?: string; }
interface Vehicle { _id: string; vrm: string; make: string; model: string; derivative: string; price: number; stockId?: string; vin?: string; engineNumber?: string; colour?: string; dateOfRegistration?: string; mileage?: number; }
interface Product { _id: string; name: string; description?: string; price?: number; vatRate?: string; variants?: { name: string; price: number; vatRate: string }[]; }
interface LineItem { name: string; description?: string; priceExcVat: number; vatRate: 'No VAT' | '5%' | '20%'; isVehicle?: boolean; variants?: { name: string; price: number; vatRate: string }[]; selectedVariant?: string; }
interface PartExchange { vrm: string; vehicleName?: string; vin?: string; mileage?: number; price: number; vatRate: 'No VAT' | '5%' | '20%'; createPurchaseInvoice: boolean; addToVehicles: boolean; }
interface Adjustment { name: string; type: '+' | '-'; amount: number; unit: '£' | '%'; vatRate: 'No VAT' | '5%' | '20%'; item: 'Default'; }
interface Discount { name: string; amount: number; unit: '£' | '%'; vatRate: 'No VAT' | '5%' | '20%'; item: 'Default'; }

function today() { return new Date().toISOString().split('T')[0]; }
function GBP(n: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n); }
function vatAmt(price: number, rate: string) {
    if (rate === '5%') return price * 0.05;
    if (rate === '20%') return price * 0.2;
    return 0;
}

/* ─── Customer Search ────────────────────────────────────────────────────────── */
function CustomerSearch({ selected, onSelect, onNew }: { selected: Customer | null; onSelect: (c: Customer) => void; onNew: () => void; }) {
    const [q, setQ] = useState(selected ? `${selected.firstName} ${selected.lastName}`.trim() : '');
    const [results, setResults] = useState<Customer[]>([]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!q.trim() || q === `${selected?.firstName} ${selected?.lastName}`.trim()) { setResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/crm/customers?search=${encodeURIComponent(q)}&limit=8`);
                const data = await res.json();
                if (data.ok) setResults(data.customers || []);
            } catch { }
        }, 300);
        return () => clearTimeout(t);
    }, [q, selected]);

    useEffect(() => {
        function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF]/20"
                placeholder="Search customers by name or email…"
                value={q}
                onChange={e => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
            />
            {open && results.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                    {results.map(c => (
                        <button key={c._id} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-[13px] border-b border-slate-50 last:border-0"
                            onClick={() => { onSelect(c); setQ(`${c.firstName} ${c.lastName}`.trim()); setOpen(false); }}>
                            <span className="font-medium text-slate-800">{c.firstName} {c.lastName}</span>
                            {c.businessName && <span className="text-slate-500 ml-1">— {c.businessName}</span>}
                            {c.email && <span className="block text-[11px] text-slate-400">{c.email}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── New Contact Modal ──────────────────────────────────────────────────────── */
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
            toast.success('Contact created');
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

/* ─── Product Search Dropdown ────────────────────────────────────────────────── */
function ProductDropdown({ onSelect }: { onSelect: (p: Product) => void; }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [q, setQ] = useState('');
    useEffect(() => {
        fetch('/api/products?limit=50').then(r => r.json()).then(d => { if (d.ok) setProducts(d.products || []); }).catch(() => { });
    }, []);
    const filtered = q ? products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())) : products;
    return (
        <div className="border border-slate-200 rounded-xl shadow-lg bg-white">
            <div className="p-3 border-b border-slate-100">
                <input autoFocus className="w-full border border-[#4D7CFF] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#4D7CFF]/20"
                    placeholder="Start typing to search…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="max-h-64 overflow-y-auto">
                {filtered.length === 0 && (
                    <div className="px-4 py-3 text-[13px] text-slate-400">No products found</div>
                )}
                {filtered.map(p => (
                    <button key={p._id} className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                        onClick={() => onSelect(p)}>
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-[13px] text-slate-800">{p.name}</span>
                            {p.price != null && <span className="text-[13px] font-semibold text-slate-700">{GBP(p.price)}</span>}
                        </div>
                        {p.description && <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-1">{p.description}</p>}
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ─── Section Card ───────────────────────────────────────────────────────────── */
function Section({ title, open, toggle, children }: { title: string; open: boolean; toggle: () => void; children: React.ReactNode; }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/50" onClick={toggle}>
                <h2 className="text-[14px] font-bold text-[#4D7CFF]">{title}</h2>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && <div className="px-5 pb-5 border-t border-slate-100">{children}</div>}
        </div>
    );
}

/* ─── VAT Rate Select ────────────────────────────────────────────────────────── */
function VatSelect({ value, onChange }: { value: string; onChange: (v: 'No VAT' | '5%' | '20%') => void; }) {
    return (
        <select value={value} onChange={e => onChange(e.target.value as any)}
            className="border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
            <option value="No VAT">No VAT</option>
            <option value="5%">5% VAT</option>
            <option value="20%">20% VAT</option>
        </select>
    );
}

/* ─── Main Create Invoice Form ───────────────────────────────────────────────── */
export default function CreateInvoicePage() {
    const router = useRouter();

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [showNewContact, setShowNewContact] = useState(false);

    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [oneOff, setOneOff] = useState({ name: '', description: '', price: '', vatRate: 'No VAT' as 'No VAT' | '5%' | '20%' });
    const [showOneOff, setShowOneOff] = useState(false);

    const [partExchanges, setPartExchanges] = useState<PartExchange[]>([]);
    const [adjustments, setAdjustments] = useState<Adjustment[]>([{ name: '', type: '+', amount: 0, unit: '£', vatRate: 'No VAT', item: 'Default' }]);
    const [discounts, setDiscounts] = useState<Discount[]>([{ name: '', amount: 0, unit: '£', vatRate: 'No VAT', item: 'Default' }]);

    const [finance, setFinance] = useState({ amount: '', providerId: '', providerName: '', generateProviderInvoice: false, customerDeposit: '0', paidBy: '' });
    const [financeProviders, setFinanceProviders] = useState<Customer[]>([]);

    const [invoiceType, setInvoiceType] = useState<'VAT Invoice' | 'Margin Scheme'>('Margin Scheme');
    const [invoiceDate, setInvoiceDate] = useState(today());
    const [invoiceTime, setInvoiceTime] = useState('');
    const [timeOfSupply, setTimeOfSupply] = useState('');
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [termsAndConditions, setTermsAndConditions] = useState('');
    const [requestESign, setRequestESign] = useState(true);
    const [allowCard, setAllowCard] = useState(false);

    // Sections open/close
    const [sections, setSections] = useState({
        partExchanges: false,
        adjustments: false,
        discounts: false,
        finance: false,
        documents: false,
        options: true,
    });
    function toggleSection(k: keyof typeof sections) { setSections(p => ({ ...p, [k]: !p[k] })); }

    const [saving, setSaving] = useState(false);

    // Finance provider search
    useEffect(() => {
        fetch('/api/crm/customers?limit=100').then(r => r.json()).then(d => {
            if (d.ok) setFinanceProviders(d.customers || []);
        }).catch(() => { });
    }, []);

    /* Part exchange VRM lookup */
    async function lookupPxVrm(idx: number) {
        const vrm = partExchanges[idx]?.vrm;
        if (!vrm) return;
        try {
            const res = await fetch(`/api/vehicles/lookup?vrm=${vrm}`);
            const data = await res.json();
            if (data.ok && data.vehicle) {
                setPartExchanges(prev => prev.map((px, i) => i === idx ? {
                    ...px,
                    vehicleName: `${data.vehicle.make} ${data.vehicle.model}`,
                    vin: data.vehicle.vin || px.vin,
                } : px));
            }
        } catch { }
    }

    /* Calculate totals */
    function calcTotals() {
        let subtotal = 0;
        lineItems.forEach(i => { subtotal += i.priceExcVat; });
        const pxTotal = partExchanges.reduce((s, p) => s + p.price, 0);

        // Adjustments
        let adjTotal = 0;
        adjustments.forEach(a => {
            const base = a.unit === '%' ? subtotal * (a.amount / 100) : a.amount;
            adjTotal += a.type === '+' ? base : -base;
        });

        // Discounts
        const discTotal = discounts.reduce((s, d) => {
            return s + (d.unit === '%' ? subtotal * (d.amount / 100) : d.amount);
        }, 0);

        const total = subtotal - pxTotal + adjTotal - discTotal;
        const financeAmt = parseFloat(finance.amount) || 0;
        const deposit = parseFloat(finance.customerDeposit) || 0;
        const totalDue = total - financeAmt;
        return { subtotal, pxTotal, adjTotal, discTotal, total, financeAmt, deposit, totalDue };
    }

    const totals = calcTotals();

    /* Submit */
    async function handleSubmit() {
        if (!customer) { toast.error('Please select a customer'); return; }
        setSaving(true);
        try {
            const body = {
                customerId: customer._id,
                type: 'invoice',
                invoiceCategory: 'sale',
                invoiceType,
                invoiceDate,
                timeOfSupply: timeOfSupply || undefined,
                invoiceNotes: invoiceNotes || undefined,
                termsAndConditions: termsAndConditions || undefined,
                lineItems: lineItems.map(({ variants, selectedVariant, ...rest }) => rest),
                partExchanges,
                finance: finance.amount ? {
                    amount: parseFloat(finance.amount) || 0,
                    providerName: finance.providerName || undefined,
                    providerId: finance.providerId || undefined,
                    generateProviderInvoice: finance.generateProviderInvoice,
                    customerDeposit: parseFloat(finance.customerDeposit) || 0,
                    paidBy: finance.paidBy || undefined,
                } : undefined,
            };
            const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success('Invoice created');
            router.push(`/app/sales/invoices/${data.invoice._id}`);
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    }

    function addProduct(p: Product) {
        setLineItems(prev => [...prev, {
            name: p.name,
            description: p.description,
            priceExcVat: p.price ?? 0,
            vatRate: (p.vatRate as any) ?? '20%',
            variants: p.variants,
        }]);
        setShowProductDropdown(false);
    }

    function addOneOff() {
        if (!oneOff.name.trim()) { toast.error('Product name required'); return; }
        setLineItems(prev => [...prev, { name: oneOff.name, description: oneOff.description || undefined, priceExcVat: parseFloat(oneOff.price) || 0, vatRate: oneOff.vatRate }]);
        setOneOff({ name: '', description: '', price: '', vatRate: 'No VAT' });
        setShowOneOff(false);
    }

    return (
        <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
                <a href="/app/sales/invoices" className="hover:text-[#4D7CFF]">Sales</a>
                <span>/</span>
                <a href="/app/sales/invoices" className="hover:text-[#4D7CFF]">Invoices</a>
                <span>/</span>
                <span className="text-slate-800 font-semibold">Create Invoice</span>
            </div>

            {/* Create Invoice card */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">Create Invoice</h1>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-[13px] font-semibold hover:bg-slate-50">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        Currency Converter
                    </button>
                </div>

                <div className="p-5 space-y-6">
                    {/* Customer */}
                    <div>
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
                                    {customer.businessName && <span className="text-[12px] text-slate-400">— {customer.businessName}</span>}
                                    <button onClick={() => setCustomer(null)} className="ml-auto text-red-400 hover:text-red-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Products / Line Items */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-[14px] font-bold text-slate-800">Products &amp; Services</h2>
                </div>
                <div className="p-5 space-y-3">
                    {/* Items list */}
                    {lineItems.length > 0 && (
                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                            <table className="w-full text-[13px]">
                                <thead className="bg-slate-50/80">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide w-16">QTY</th>
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
                                                <input type="number" min="1" defaultValue="1" className="w-12 border border-slate-200 rounded px-2 py-1 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-800">{item.name}</div>
                                                {item.description && <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>}
                                                {/* Variants */}
                                                {item.variants && item.variants.length > 0 && (
                                                    <div className="mt-2 space-y-1">
                                                        {item.variants.map((v, vi) => (
                                                            <label key={vi} className="flex items-center gap-2 text-[12px] text-slate-600">
                                                                <input type="radio" name={`variant-${idx}`}
                                                                    checked={item.selectedVariant === v.name || (!item.selectedVariant && vi === 0)}
                                                                    onChange={() => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, selectedVariant: v.name, priceExcVat: v.price, vatRate: v.vatRate as any } : li))}
                                                                    className="text-[#4D7CFF]" />
                                                                <span className="font-medium">{v.name}</span>
                                                                <span className="ml-auto">{GBP(v.price)}</span>
                                                                <span className="text-slate-400">{v.vatRate}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input type="number" step="0.01" value={item.priceExcVat}
                                                    onChange={e => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, priceExcVat: parseFloat(e.target.value) || 0 } : li))}
                                                    className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-right text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <VatSelect value={item.vatRate} onChange={v => setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, vatRate: v } : li))} />
                                            </td>
                                            <td className="px-4 py-3 text-center">
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

                    {/* Add Product */}
                    <div className="relative">
                        <button onClick={() => { setShowProductDropdown(p => !p); setShowOneOff(false); }}
                            className="text-[#4D7CFF] text-[13px] font-semibold hover:underline">
                            + Add Product / Service
                        </button>
                        {showProductDropdown && (
                            <div className="mt-2">
                                <ProductDropdown onSelect={addProduct} />
                            </div>
                        )}
                    </div>

                    {/* One-off product */}
                    <div>
                        <button onClick={() => { setShowOneOff(p => !p); setShowProductDropdown(false); }}
                            className="text-[#4D7CFF] text-[13px] font-semibold hover:underline">
                            ▼ Add One-Off Product
                        </button>
                        {showOneOff && (
                            <div className="mt-3 bg-slate-50 rounded-xl p-4 space-y-3">
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
            </div>

            {/* Part Exchanges */}
            <Section title="Part Exchanges" open={sections.partExchanges} toggle={() => toggleSection('partExchanges')}>
                <div className="pt-4 space-y-4">
                    {partExchanges.length > 0 && (
                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                            <table className="w-full text-[13px]">
                                <thead className="bg-slate-50/80">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Vehicle</th>
                                        <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Price</th>
                                        <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase text-[11px] tracking-wide">VAT</th>
                                        <th className="px-4 py-2.5 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {partExchanges.map((px, idx) => (
                                        <tr key={idx} className="border-t border-slate-50">
                                            <td className="px-4 py-3 space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Registration</label>
                                                        <div className="flex gap-1">
                                                            <input className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] uppercase focus:outline-none focus:border-[#4D7CFF]"
                                                                value={px.vrm} onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, vrm: e.target.value.toUpperCase() } : p))} />
                                                            <button onClick={() => lookupPxVrm(idx)}
                                                                className="bg-[#4D7CFF] text-white px-2 rounded-lg hover:bg-[#3a6ae0]">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Vehicle</label>
                                                        <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                            value={px.vehicleName || ''} onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, vehicleName: e.target.value } : p))} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">VIN</label>
                                                        <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                            value={px.vin || ''} onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, vin: e.target.value } : p))} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Mileage</label>
                                                        <input type="number" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                            value={px.mileage || ''} onChange={e => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, mileage: parseInt(e.target.value) } : p))} />
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 text-[12px]">
                                                    <label className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-slate-600">Create Purchase Invoice</span>
                                                        <div className="flex gap-2 ml-1">
                                                            <label className="flex items-center gap-1"><input type="radio" checked={px.createPurchaseInvoice} onChange={() => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, createPurchaseInvoice: true } : p))} /> Yes</label>
                                                            <label className="flex items-center gap-1"><input type="radio" checked={!px.createPurchaseInvoice} onChange={() => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, createPurchaseInvoice: false } : p))} /> No</label>
                                                        </div>
                                                    </label>
                                                    <label className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-slate-600">Add to Vehicles</span>
                                                        <div className="flex gap-2 ml-1">
                                                            <label className="flex items-center gap-1"><input type="radio" checked={px.addToVehicles} onChange={() => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, addToVehicles: true } : p))} /> Yes</label>
                                                            <label className="flex items-center gap-1"><input type="radio" checked={!px.addToVehicles} onChange={() => setPartExchanges(prev => prev.map((p, i) => i === idx ? { ...p, addToVehicles: false } : p))} /> No</label>
                                                        </div>
                                                    </label>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right align-top">
                                                <div className="flex">
                                                    <span className="border border-r-0 border-slate-200 rounded-l-lg px-2 py-1.5 text-[13px] text-slate-500 bg-slate-50">£</span>
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
                        + Add Another Vehicle
                    </button>
                </div>
            </Section>

            {/* Adjustments & Discounts */}
            <Section title="Adjustments" open={sections.adjustments} toggle={() => toggleSection('adjustments')}>
                <div className="pt-4 space-y-3">
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                        <table className="w-full text-[13px]">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Name</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Adjustment</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">VAT</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Item</th>
                                    <th className="px-4 py-2.5 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {adjustments.map((adj, idx) => (
                                    <tr key={idx} className="border-t border-slate-50">
                                        <td className="px-4 py-3">
                                            <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                value={adj.name} onChange={e => setAdjustments(prev => prev.map((a, i) => i === idx ? { ...a, name: e.target.value } : a))} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                <select value={adj.type} onChange={e => setAdjustments(prev => prev.map((a, i) => i === idx ? { ...a, type: e.target.value as '+' | '-' } : a))}
                                                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                    <option value="+">+</option>
                                                    <option value="-">-</option>
                                                </select>
                                                <input type="number" step="0.01" value={adj.amount} onChange={e => setAdjustments(prev => prev.map((a, i) => i === idx ? { ...a, amount: parseFloat(e.target.value) || 0 } : a))}
                                                    className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                                <select value={adj.unit} onChange={e => setAdjustments(prev => prev.map((a, i) => i === idx ? { ...a, unit: e.target.value as '£' | '%' } : a))}
                                                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                    <option value="£">£</option>
                                                    <option value="%">%</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <VatSelect value={adj.vatRate} onChange={v => setAdjustments(prev => prev.map((a, i) => i === idx ? { ...a, vatRate: v } : a))} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <select className="border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                <option>Default</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => setAdjustments(prev => prev.filter((_, i) => i !== idx))}
                                                className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={() => setAdjustments(prev => [...prev, { name: '', type: '+', amount: 0, unit: '£', vatRate: 'No VAT', item: 'Default' }])}
                        className="text-[#4D7CFF] text-[13px] font-semibold hover:underline">+ Add Another Adjustment</button>

                    {/* Discounts */}
                    <h3 className="text-[13px] font-bold text-[#4D7CFF] mt-4">Discounts</h3>
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                        <table className="w-full text-[13px]">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Name</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Discount</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">VAT</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Item</th>
                                    <th className="px-4 py-2.5 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {discounts.map((disc, idx) => (
                                    <tr key={idx} className="border-t border-slate-50">
                                        <td className="px-4 py-3">
                                            <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                value={disc.name} onChange={e => setDiscounts(prev => prev.map((d, i) => i === idx ? { ...d, name: e.target.value } : d))} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                <input type="number" step="0.01" value={disc.amount} onChange={e => setDiscounts(prev => prev.map((d, i) => i === idx ? { ...d, amount: parseFloat(e.target.value) || 0 } : d))}
                                                    className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                                <select value={disc.unit} onChange={e => setDiscounts(prev => prev.map((d, i) => i === idx ? { ...d, unit: e.target.value as '£' | '%' } : d))}
                                                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                    <option value="£">£</option>
                                                    <option value="%">%</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <VatSelect value={disc.vatRate} onChange={v => setDiscounts(prev => prev.map((d, i) => i === idx ? { ...d, vatRate: v } : d))} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <select className="border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                <option>Default</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => setDiscounts(prev => prev.filter((_, i) => i !== idx))}
                                                className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={() => setDiscounts(prev => [...prev, { name: '', amount: 0, unit: '£', vatRate: 'No VAT', item: 'Default' }])}
                        className="text-[#4D7CFF] text-[13px] font-semibold hover:underline">+ Add Another Discount</button>
                </div>
            </Section>

            {/* Finance */}
            <Section title="Finance" open={sections.finance} toggle={() => toggleSection('finance')}>
                <div className="pt-4 grid grid-cols-2 gap-5">
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Finance Amount <sup className="text-[#4D7CFF]">[?]</sup></label>
                        <div className="flex">
                            <span className="border border-r-0 border-slate-200 rounded-l-lg px-3 py-2 text-[13px] text-slate-500 bg-slate-50">£</span>
                            <input type="number" step="0.01" value={finance.amount}
                                onChange={e => setFinance(p => ({ ...p, amount: e.target.value }))}
                                className="flex-1 border border-slate-200 rounded-r-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[12px] font-semibold text-slate-600">Finance Provider</label>
                            <button className="text-[11px] text-[#4D7CFF] border border-[#4D7CFF] px-2 py-0.5 rounded hover:bg-blue-50 font-semibold">+ New Contact</button>
                        </div>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                            placeholder="Start typing to search…"
                            value={finance.providerName}
                            onChange={e => setFinance(p => ({ ...p, providerName: e.target.value }))}
                            list="finance-providers" />
                        <datalist id="finance-providers">
                            {financeProviders.map(c => (
                                <option key={c._id} value={`${c.firstName} ${c.lastName}`.trim()}>
                                    {c.businessName}
                                </option>
                            ))}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Generate Finance Provider Invoice <sup className="text-[#4D7CFF]">[?]</sup></label>
                        <label className="flex items-center gap-2 text-[13px] text-slate-700">
                            <input type="checkbox" checked={finance.generateProviderInvoice}
                                onChange={e => setFinance(p => ({ ...p, generateProviderInvoice: e.target.checked }))}
                                className="rounded text-[#4D7CFF]" />
                            Enable
                        </label>
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">OR Customer Deposit <sup className="text-[#4D7CFF]">[?]</sup></label>
                        <div className="flex">
                            <span className="border border-r-0 border-slate-200 rounded-l-lg px-3 py-2 text-[13px] text-slate-500 bg-slate-50">£</span>
                            <input type="number" step="0.01" value={finance.customerDeposit}
                                onChange={e => setFinance(p => ({ ...p, customerDeposit: e.target.value }))}
                                className="flex-1 border border-slate-200 rounded-r-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Due From / Paid By</label>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" placeholder="Customer Name"
                            value={finance.paidBy} onChange={e => setFinance(p => ({ ...p, paidBy: e.target.value }))} />
                    </div>
                </div>
            </Section>

            {/* Documents */}
            <Section title="Documents" open={sections.documents} toggle={() => toggleSection('documents')}>
                <div className="pt-4">
                    <label className="block text-[12px] font-semibold text-slate-600 mb-2">Attach Documents</label>
                    <input type="file" multiple className="block w-full text-[13px] text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:border file:border-slate-200 file:rounded-lg file:text-[12px] file:font-semibold file:text-slate-600 file:bg-white hover:file:bg-slate-50" />
                </div>
            </Section>

            {/* Options */}
            <Section title="Options" open={sections.options} toggle={() => toggleSection('options')}>
                <div className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 mb-2">Invoice Type</label>
                            <div className="space-y-1.5">
                                {(['VAT Invoice', 'Margin Scheme'] as const).map(t => (
                                    <label key={t} className="flex items-center gap-2 text-[13px] text-slate-700">
                                        <input type="radio" name="invoiceType" checked={invoiceType === t} onChange={() => setInvoiceType(t)} className="text-[#4D7CFF]" />
                                        {t}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 mb-1">Invoice Date</label>
                            <div className="flex gap-2">
                                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                <input type="time" value={invoiceTime} onChange={e => setInvoiceTime(e.target.value)}
                                    className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 mb-1">Time of Supply</label>
                            <input type="date" value={timeOfSupply} onChange={e => setTimeOfSupply(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Invoice Notes</label>
                        <textarea rows={4} value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[12px] font-semibold text-slate-600">Invoice Terms &amp; Conditions</label>
                            <button className="text-[11px] text-[#4D7CFF] border border-[#4D7CFF] px-2 py-0.5 rounded hover:bg-blue-50 font-semibold">Use Default</button>
                        </div>
                        <textarea rows={5} value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" />
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 mb-2">Request Electronic Signature</label>
                            <label className="flex items-center gap-2 text-[13px] text-slate-700">
                                <input type="checkbox" checked={requestESign} onChange={e => setRequestESign(e.target.checked)} className="rounded text-[#4D7CFF]" />
                                Enable
                            </label>
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 mb-2">Allow Credit/Debit Card Payment</label>
                            <label className="flex items-center gap-2 text-[13px] text-slate-700">
                                <input type="checkbox" checked={allowCard} onChange={e => setAllowCard(e.target.checked)} className="rounded text-[#4D7CFF]" />
                                Enable
                            </label>
                        </div>
                    </div>
                </div>
            </Section>

            {/* Summary & Create */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex items-end justify-between">
                    <div className="space-y-1 text-[13px]">
                        <div className="flex gap-8">
                            <span className="text-slate-500">Sub-Total:</span>
                            <span className="font-semibold text-slate-800">{GBP(totals.subtotal)}</span>
                        </div>
                        {totals.pxTotal > 0 && (
                            <div className="flex gap-8">
                                <span className="text-slate-500">Part Exchanges:</span>
                                <span className="font-semibold text-red-500">-{GBP(totals.pxTotal)}</span>
                            </div>
                        )}
                        <div className="flex gap-8 border-t border-slate-100 pt-1 mt-1">
                            <span className="text-slate-700 font-semibold">Total:</span>
                            <span className="font-bold text-slate-900 text-[15px]">{GBP(totals.total)}</span>
                        </div>
                        {totals.financeAmt > 0 && (
                            <div className="flex gap-8">
                                <span className="text-slate-500">Finance Due:</span>
                                <span className="font-semibold text-slate-700">{GBP(totals.financeAmt)}</span>
                            </div>
                        )}
                        {totals.totalDue !== totals.total && (
                            <div className="flex gap-8">
                                <span className="text-slate-700 font-semibold">Total Due:</span>
                                <span className="font-bold text-slate-900">{GBP(totals.totalDue)}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={handleSubmit} disabled={saving}
                        className="bg-[#4D7CFF] text-white px-6 py-3 rounded-xl text-[14px] font-bold hover:bg-[#3a6ae0] disabled:opacity-60 transition-colors shadow-sm">
                        {saving ? 'Creating…' : 'Create Invoice'}
                    </button>
                </div>
            </div>

            {showNewContact && <NewContactModal onCreated={c => { setCustomer(c); setShowNewContact(false); }} onClose={() => setShowNewContact(false)} />}
        </div>
    );
}
