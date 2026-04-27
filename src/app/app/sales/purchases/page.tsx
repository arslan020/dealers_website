'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Purchase {
    _id: string;
    purchaseNumber: string;
    status: 'draft' | 'issued' | 'paid' | 'void';
    type: 'VAT' | 'Marginal' | 'No VAT';
    invoiceDate: string;
    contactId: { firstName: string; lastName: string; businessName?: string } | null;
    linkedVehicleId: { vrm: string } | null;
    linkedVehicleVrm?: string;
    reference?: string;
    lineItems: { priceExcVat: number }[];
    adjustment: number;
}

const GBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

function subTotal(p: Purchase) { return p.lineItems.reduce((s, i) => s + i.priceExcVat, 0); }

function contactName(c: Purchase['contactId']) {
    if (!c) return '—';
    if (c.businessName) return c.businessName;
    return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—';
}

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-[#14b8a6] text-white',
    issued: 'bg-[#4D7CFF] text-white',
    paid: 'bg-[#10b981] text-white',
    void: 'bg-slate-300 text-slate-600',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex px-3 py-1 rounded-md text-[12px] font-semibold capitalize ${STATUS_STYLES[status] ?? 'bg-slate-200 text-slate-700'}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}

export default function PurchasesPage() {
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const limit = 25;

    const fetchPurchases = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit), search });
            const res = await fetch(`/api/purchases?${params}`);
            const data = await res.json();
            if (data.ok) { setPurchases(data.purchases || []); setTotal(data.total || 0); }
        } catch { } finally { setLoading(false); }
    }, [page, search]);

    useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">Purchase Invoices</h1>
                    <div className="flex items-center gap-2">
                        <Link href="/app/sales/purchases/create"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#4D7CFF] text-[#4D7CFF] rounded-lg text-[13px] font-semibold hover:bg-blue-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            Create Purchase
                        </Link>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-[13px] font-semibold hover:bg-slate-50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                            Filter
                        </button>
                        <input
                            type="text" placeholder="Search"
                            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] w-40 focus:outline-none focus:border-[#4D7CFF]"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="px-4 py-3 text-left w-8"><input type="checkbox" className="rounded border-slate-300" /></th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px] whitespace-nowrap">Purchase ↓</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Contact</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px] whitespace-nowrap">Linked Vehicle</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Reference</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Status</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Type</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px] whitespace-nowrap">Sub-Total</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Adjustment</th>
                                <th className="px-4 py-3 w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        {Array.from({ length: 10 }).map((__, j) => (
                                            <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-16" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : purchases.length === 0 ? (
                                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400 text-[13px]">No purchase invoices found</td></tr>
                            ) : purchases.map(p => {
                                const sub = subTotal(p);
                                const vrm = p.linkedVehicleId?.vrm ?? p.linkedVehicleVrm ?? null;
                                return (
                                    <tr key={p._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3"><input type="checkbox" className="rounded border-slate-300" /></td>
                                        <td className="px-4 py-3">
                                            <Link href={`/app/sales/purchases/${p._id}`} className="text-[#4D7CFF] font-semibold hover:underline">
                                                {p.purchaseNumber}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-[#4D7CFF] hover:underline cursor-pointer">{contactName(p.contactId)}</td>
                                        <td className="px-4 py-3">
                                            {vrm ? (
                                                <span className="inline-flex items-center gap-1 text-[#4D7CFF] font-medium">
                                                    {vrm}
                                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                </span>
                                            ) : <span className="text-slate-400 italic text-[12px]">None</span>}
                                        </td>
                                        <td className="px-4 py-3">{p.reference ? <span className="text-slate-700">{p.reference}</span> : <span className="text-slate-400 italic text-[12px]">None</span>}</td>
                                        <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                                        <td className="px-4 py-3 text-slate-700">{p.type}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700">{GBP(sub)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{GBP(p.adjustment)}</td>
                                        <td className="px-4 py-3">
                                            <Link href={`/app/sales/purchases/${p._id}`}
                                                className="w-7 h-7 rounded-md bg-[#4D7CFF] text-white flex items-center justify-center hover:bg-[#3a6ae0] ml-auto">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[13px] text-slate-500">
                        <span>Show</span>
                        <select className="border border-slate-200 rounded px-2 py-0.5 text-[13px]" disabled><option>25</option></select>
                        <button className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-[12px]">CSV</button>
                        <button className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-[12px]">Excel</button>
                    </div>
                    <div className="flex items-center gap-1 text-[13px]">
                        <span className="text-slate-500 mr-2">{total === 0 ? '0' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)}`} of {total}</span>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-[12px]">Previous</button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                            <button key={n} onClick={() => setPage(n)}
                                className={`w-7 h-7 rounded text-[12px] font-semibold ${n === page ? 'bg-[#4D7CFF] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{n}</button>
                        ))}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                            className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-[12px]">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
