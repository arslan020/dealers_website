'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Customer { _id: string; firstName: string; lastName: string; businessName?: string; email?: string; }
interface LineItem { name: string; description?: string; priceExcVat: number; vatRate: 'No VAT' | '5%' | '20%'; }

function today() { return new Date().toISOString().split('T')[0]; }
const GBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

function ContactSearch({ selected, onSelect, onNew }: { selected: Customer | null; onSelect: (c: Customer) => void; onNew: () => void; }) {
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
                placeholder="Search contacts…" value={q}
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

export default function CreatePurchasePage() {
    const router = useRouter();
    const [contact, setContact] = useState<Customer | null>(null);
    const [showNewContact, setShowNewContact] = useState(false);
    const [linkedVehicleVrm, setLinkedVehicleVrm] = useState('');
    const [reference, setReference] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(today());
    const [type, setType] = useState<'VAT' | 'Marginal' | 'No VAT'>('Marginal');
    const [lineItems, setLineItems] = useState<LineItem[]>([{ name: '', priceExcVat: 0, vatRate: 'No VAT' }]);
    const [adjustment, setAdjustment] = useState('0');
    const [notes, setNotes] = useState('');

    // Upload tab
    const [tab, setTab] = useState<'create' | 'upload'>('create');

    const [saving, setSaving] = useState(false);

    const subtotal = lineItems.reduce((s, i) => s + i.priceExcVat, 0);

    async function handleSubmit() {
        if (!contact) { toast.error('Please select a contact'); return; }
        setSaving(true);
        try {
            const body = {
                contactId: contact._id,
                linkedVehicleVrm: linkedVehicleVrm || undefined,
                reference: reference || undefined,
                invoiceDate,
                type,
                lineItems: lineItems.filter(i => i.name.trim()),
                adjustment: parseFloat(adjustment) || 0,
                notes: notes || undefined,
            };
            const res = await fetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success('Purchase invoice created');
            router.push(`/app/sales/purchases/${data.purchase._id}`);
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
                <a href="/app/sales/purchases" className="hover:text-[#4D7CFF]">Sales</a>
                <span>/</span>
                <a href="/app/sales/purchases" className="hover:text-[#4D7CFF]">Purchases</a>
                <span>/</span>
                <span className="text-slate-800 font-semibold">Create Purchase</span>
            </div>

            {/* Additional Costs / Upload panel */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">Additional Costs</h1>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-[13px] font-semibold hover:bg-slate-50">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        Currency Converter
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100">
                    <button onClick={() => setTab('create')}
                        className={`px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors ${tab === 'create' ? 'border-[#4D7CFF] text-[#4D7CFF]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        Create Purchase Invoice
                    </button>
                    <button onClick={() => setTab('upload')}
                        className={`px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors ${tab === 'upload' ? 'border-[#4D7CFF] text-[#4D7CFF]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        Add Without Invoice
                    </button>
                </div>

                {tab === 'upload' ? (
                    <div className="p-5 flex items-center gap-6">
                        <label className="flex-1 border-2 border-dashed border-slate-200 rounded-xl p-10 flex items-center justify-center cursor-pointer hover:border-[#4D7CFF] transition-colors">
                            <input type="file" accept="image/*,.pdf" className="hidden" />
                            <p className="text-[13px] text-slate-400 italic">Drop image or PDF file, or click to browse.</p>
                        </label>
                        <div className="flex flex-col items-center gap-3">
                            <span className="text-[13px] text-slate-400 font-medium">OR</span>
                            <button onClick={() => setTab('create')}
                                className="bg-[#4D7CFF] text-white px-6 py-3 rounded-xl text-[14px] font-bold hover:bg-[#3a6ae0] whitespace-nowrap">
                                Create Purchase
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-5 space-y-5">
                        {/* Contact */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[13px] font-semibold text-slate-700">Contact (Supplier)</label>
                                <button onClick={() => setShowNewContact(true)}
                                    className="flex items-center gap-1 text-[12px] font-semibold text-[#4D7CFF] border border-[#4D7CFF] px-2.5 py-1 rounded-lg hover:bg-blue-50">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                    New Contact
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <ContactSearch selected={contact} onSelect={setContact} onNew={() => setShowNewContact(true)} />
                                {contact && (
                                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                                        <span className="text-[13px] font-semibold text-slate-700">{contact.firstName} {contact.lastName}</span>
                                        <button onClick={() => setContact(null)} className="ml-auto text-red-400 hover:text-red-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Meta */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Linked Vehicle (VRM)</label>
                                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] uppercase focus:outline-none focus:border-[#4D7CFF]"
                                    placeholder="e.g. MT04DSK"
                                    value={linkedVehicleVrm} onChange={e => setLinkedVehicleVrm(e.target.value.toUpperCase())} />
                            </div>
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Reference</label>
                                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                    value={reference} onChange={e => setReference(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Invoice Date</label>
                                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                    value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                            </div>
                        </div>

                        {/* Type */}
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 mb-2">Invoice Type</label>
                            <div className="flex gap-4">
                                {(['VAT', 'Marginal', 'No VAT'] as const).map(t => (
                                    <label key={t} className="flex items-center gap-2 text-[13px] text-slate-700">
                                        <input type="radio" checked={type === t} onChange={() => setType(t)} className="text-[#4D7CFF]" />
                                        {t}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Line items */}
                        <div>
                            <label className="block text-[13px] font-semibold text-slate-700 mb-2">Line Items</label>
                            <div className="border border-slate-100 rounded-xl overflow-hidden">
                                <table className="w-full text-[13px]">
                                    <thead className="bg-slate-50/80">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Description</th>
                                            <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase text-[11px] tracking-wide w-36">Price Exc. VAT</th>
                                            <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase text-[11px] tracking-wide w-32">VAT</th>
                                            <th className="px-4 py-2.5 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineItems.map((item, idx) => (
                                            <tr key={idx} className="border-t border-slate-50">
                                                <td className="px-4 py-2">
                                                    <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                        placeholder="Item description"
                                                        value={item.name} onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, name: e.target.value } : l))} />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex">
                                                        <span className="border border-r-0 border-slate-200 rounded-l-lg px-2 py-1.5 text-[12px] text-slate-400 bg-slate-50">£</span>
                                                        <input type="number" step="0.01" value={item.priceExcVat || ''}
                                                            onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, priceExcVat: parseFloat(e.target.value) || 0 } : l))}
                                                            className="w-full border border-slate-200 rounded-r-lg px-2 py-1.5 text-right text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <select value={item.vatRate} onChange={e => setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, vatRate: e.target.value as any } : l))}
                                                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                        <option value="No VAT">No VAT</option>
                                                        <option value="5%">5% VAT</option>
                                                        <option value="20%">20% VAT</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2">
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
                            <button onClick={() => setLineItems(prev => [...prev, { name: '', priceExcVat: 0, vatRate: 'No VAT' }])}
                                className="mt-2 text-[#4D7CFF] text-[13px] font-semibold hover:underline">+ Add Line Item</button>
                        </div>

                        {/* Adjustment */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Adjustment (£)</label>
                                <div className="flex">
                                    <span className="border border-r-0 border-slate-200 rounded-l-lg px-3 py-2 text-[13px] text-slate-400 bg-slate-50">£</span>
                                    <input type="number" step="0.01" className="flex-1 border border-slate-200 rounded-r-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                        value={adjustment} onChange={e => setAdjustment(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Notes</label>
                                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                    value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                        </div>

                        {/* Summary + Submit */}
                        <div className="flex items-end justify-between pt-2 border-t border-slate-100">
                            <div className="text-[13px] space-y-1">
                                <div className="flex gap-8">
                                    <span className="text-slate-500">Sub-Total:</span>
                                    <span className="font-semibold text-slate-800">{GBP(subtotal)}</span>
                                </div>
                                <div className="flex gap-8">
                                    <span className="text-slate-500">Adjustment:</span>
                                    <span className="font-semibold text-slate-800">{GBP(parseFloat(adjustment) || 0)}</span>
                                </div>
                            </div>
                            <button onClick={handleSubmit} disabled={saving}
                                className="bg-[#4D7CFF] text-white px-6 py-3 rounded-xl text-[14px] font-bold hover:bg-[#3a6ae0] disabled:opacity-60">
                                {saving ? 'Creating…' : 'Create Purchase'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showNewContact && <NewContactModal onCreated={c => { setContact(c); setShowNewContact(false); }} onClose={() => setShowNewContact(false)} />}
        </div>
    );
}
