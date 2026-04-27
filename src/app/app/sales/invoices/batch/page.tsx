'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Customer { _id: string; firstName: string; lastName: string; businessName?: string; email?: string; }
interface LineItem { name: string; description?: string; priceExcVat: number; vatRate: 'No VAT' | '5%' | '20%'; }

function GBP(n: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n); }
function vatAmt(price: number, rate: string) {
    if (rate === '5%') return price * 0.05;
    if (rate === '20%') return price * 0.2;
    return 0;
}

export default function BatchInvoicePage() {
    const router = useRouter();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [lineItems, setLineItems] = useState<LineItem[]>([{ name: '', priceExcVat: 0, vatRate: '20%' }]);
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetch('/api/crm/customers?limit=500')
            .then(r => r.json())
            .then(d => { if (d.ok) setCustomers(d.customers || []); })
            .finally(() => setLoading(false));
    }, []);

    const filtered = customers.filter(c => {
        const q = search.toLowerCase();
        return !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.businessName || '').toLowerCase().includes(q);
    });

    const toggleAll = () => {
        if (selected.size === filtered.length) setSelected(new Set());
        else setSelected(new Set(filtered.map(c => c._id)));
    };

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const updateItem = (i: number, field: keyof LineItem, value: any) => {
        setLineItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
    };

    const addItem = () => setLineItems(prev => [...prev, { name: '', priceExcVat: 0, vatRate: '20%' }]);
    const removeItem = (i: number) => setLineItems(prev => prev.filter((_, idx) => idx !== i));

    const subTotal = lineItems.reduce((s, item) => s + item.priceExcVat, 0);
    const vatTotal = lineItems.reduce((s, item) => s + vatAmt(item.priceExcVat, item.vatRate), 0);
    const total = subTotal + vatTotal;

    const handleCreate = async () => {
        if (selected.size === 0) { toast.error('Select at least one customer'); return; }
        if (!lineItems.some(item => item.name.trim())) { toast.error('Add at least one line item'); return; }

        setCreating(true);
        const ids = Array.from(selected);
        let successCount = 0;
        const errors: string[] = [];

        await Promise.all(ids.map(async customerId => {
            try {
                const res = await fetch('/api/invoices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customerId,
                        invoiceDate,
                        invoiceNotes,
                        lineItems: lineItems.filter(item => item.name.trim()),
                        partExchanges: [],
                    }),
                });
                const data = await res.json();
                if (data.ok) successCount++;
                else errors.push(data.error || 'Unknown error');
            } catch {
                errors.push('Network error');
            }
        }));

        setCreating(false);
        if (successCount > 0) toast.success(`${successCount} invoice${successCount > 1 ? 's' : ''} created`);
        if (errors.length > 0) toast.error(`${errors.length} failed`);
        if (successCount > 0) router.push('/app/sales/invoices');
    };

    return (
        <div className="space-y-4 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href="/app/sales/invoices" className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </Link>
                    <h1 className="text-[16px] font-bold text-slate-800">Batch Invoice</h1>
                </div>
                <button
                    onClick={handleCreate}
                    disabled={creating || selected.size === 0}
                    className="px-4 py-2 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {creating && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>}
                    Create {selected.size > 0 ? `${selected.size} ` : ''}Invoice{selected.size !== 1 ? 's' : ''}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Customer Selection */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-[14px] font-semibold text-slate-800">Select Customers</h2>
                        <span className="text-[12px] text-slate-500">{selected.size} selected</span>
                    </div>
                    <div className="px-4 py-3 border-b border-slate-100">
                        <input
                            type="text"
                            placeholder="Search customers…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF]/20"
                        />
                    </div>
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 text-[13px]">Loading…</div>
                    ) : (
                        <div className="overflow-y-auto max-h-80">
                            {filtered.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-[13px]">No customers found</div>
                            ) : (
                                <table className="w-full text-[13px]">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50">
                                            <th className="px-4 py-2 text-left w-8">
                                                <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} className="accent-[#4D7CFF]" />
                                            </th>
                                            <th className="px-4 py-2 text-left text-slate-500 font-medium">Name</th>
                                            <th className="px-4 py-2 text-left text-slate-500 font-medium">Email</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(c => (
                                            <tr key={c._id} className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer" onClick={() => toggleOne(c._id)}>
                                                <td className="px-4 py-2.5">
                                                    <input type="checkbox" checked={selected.has(c._id)} onChange={() => toggleOne(c._id)} onClick={e => e.stopPropagation()} className="accent-[#4D7CFF]" />
                                                </td>
                                                <td className="px-4 py-2.5 font-medium text-slate-800">
                                                    {c.firstName} {c.lastName}
                                                    {c.businessName && <span className="text-slate-400 font-normal ml-1">— {c.businessName}</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-500">{c.email || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>

                {/* Invoice Details */}
                <div className="space-y-4">
                    {/* Date & Notes */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                        <h2 className="text-[14px] font-semibold text-slate-800">Invoice Details</h2>
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1">Invoice Date</label>
                            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF]/20" />
                        </div>
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1">Notes (optional)</label>
                            <textarea value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} rows={2}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF]/20 resize-none" />
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h2 className="text-[14px] font-semibold text-slate-800">Line Items</h2>
                        </div>
                        <div className="p-4 space-y-3">
                            {lineItems.map((item, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                    <div className="flex-1 space-y-1.5">
                                        <input
                                            placeholder="Item name"
                                            value={item.name}
                                            onChange={e => updateItem(i, 'name', e.target.value)}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF]/20"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                placeholder="Price excl. VAT"
                                                value={item.priceExcVat || ''}
                                                onChange={e => updateItem(i, 'priceExcVat', parseFloat(e.target.value) || 0)}
                                                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF]/20"
                                            />
                                            <select
                                                value={item.vatRate}
                                                onChange={e => updateItem(i, 'vatRate', e.target.value)}
                                                className="border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                            >
                                                <option value="No VAT">No VAT</option>
                                                <option value="5%">5%</option>
                                                <option value="20%">20%</option>
                                            </select>
                                        </div>
                                    </div>
                                    {lineItems.length > 1 && (
                                        <button onClick={() => removeItem(i)} className="mt-2 text-slate-300 hover:text-red-400 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button onClick={addItem} className="text-[#4D7CFF] text-[13px] font-medium hover:underline flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                Add Item
                            </button>
                        </div>
                        <div className="border-t border-slate-100 px-5 py-3 space-y-1 text-[13px]">
                            <div className="flex justify-between text-slate-500"><span>Sub-Total</span><span>{GBP(subTotal)}</span></div>
                            <div className="flex justify-between text-slate-500"><span>VAT</span><span>{GBP(vatTotal)}</span></div>
                            <div className="flex justify-between font-bold text-slate-800 text-[14px] pt-1 border-t border-slate-100 mt-1"><span>Total</span><span>{GBP(total)}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
