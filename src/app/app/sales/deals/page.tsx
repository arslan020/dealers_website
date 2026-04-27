'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Deal {
    dealId: string;
    created: string;
    lastUpdated: string;
    advertiserDealStatus: string;
    consumerDealStatus: string;
    consumer: { firstName: string; lastName: string; email: string; phone?: string | null; type?: string | null };
    stock: { stockId: string; searchId?: string; vrm?: string };
    price?: { suppliedPrice?: { amountGBP: number }; totalPrice?: { amountGBP: number } };
    reservation?: { status: string | null; fee?: { amountGBP: number; status: string } };
    messages?: { id: string; lastUpdated: string } | null;
    buyingSignals?: { intent?: string; dealIntentScore?: number };
}

const AVATAR_COLORS = ['bg-[#4ca7ba]', 'bg-[#e8b57b]', 'bg-[#59b889]', 'bg-[#57a1e0]', 'bg-[#6e7ebf]', 'bg-[#8c8c8c]'];

function ago(iso?: string) {
    if (!iso) return '—';
    try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return '—'; }
}

function initials(first?: string, last?: string) {
    return `${first?.charAt(0) ?? ''}${last?.charAt(0) ?? ''}`.toUpperCase();
}

/* Progress icons — circular MotorDesk style */
function ProgressIcons({ deal }: { deal: Deal }) {
    const hasReservation = deal.reservation?.status === 'RESERVED';
    const hasInvoice = false;
    const isTransferred =
        deal.advertiserDealStatus === 'Complete' || deal.advertiserDealStatus === 'Completed';
    const hasContact = true;
    const hasPayment = deal.reservation?.fee?.status === 'Paid';
    const hasMsg = !!deal.messages;
    const isDone =
        deal.advertiserDealStatus === 'Complete' || deal.advertiserDealStatus === 'Completed';

    const icon = (active: boolean, title: string, path: string) => (
        <span title={title} className={`inline-flex items-center justify-center w-6 h-6 rounded-full border transition-colors ${active ? 'border-[#4ca7ba] bg-[#4ca7ba] text-white' : 'border-slate-200 bg-white text-slate-300'}`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={path} />
            </svg>
        </span>
    );

    return (
        <div className="flex items-center gap-1">
            {icon(hasReservation, 'Reserved', 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1 1h1m0-5h10m0 5h1l1-1V8.65a1 1 0 00-.22-.624l-3.48-4.35A1 1 0 0014.52 3H13')}
            {icon(hasInvoice, 'Invoice', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2')}
            {icon(isTransferred, 'Transferred', 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4')}
            {icon(hasContact, 'Contact', 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z')}
            {icon(hasPayment, 'Payment', 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z')}
            {icon(hasMsg, 'Messages', 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z')}
            {icon(isDone, 'Complete', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z')}
        </div>
    );
}

export default function SalesDealsPage() {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchDeals = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/deals?page=${page}`);
            const data = await res.json();
            if (data.ok) { setDeals(data.deals || []); setTotal(data.totalResults || 0); }
        } catch { /* silent */ } finally { setLoading(false); }
    }, [page]);

    useEffect(() => { fetchDeals(); }, [fetchDeals]);

    const filtered = deals.filter(d => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            `${d.consumer.firstName} ${d.consumer.lastName}`.toLowerCase().includes(q) ||
            d.stock?.vrm?.toLowerCase().includes(q) ||
            d.dealId.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
                <span className="font-semibold">Sales</span>
                <span>/</span>
                <span className="text-slate-600 font-semibold">Deals</span>
            </div>

            {/* Header + Actions */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-900">Deals</h1>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/app/sales/deals/create"
                            className="inline-flex items-center gap-1.5 border border-[#4D7CFF] text-[#4D7CFF] text-[12px] font-bold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 4v16m8-8H4" /></svg>
                            Create Deal
                        </Link>
                        <button className="flex items-center gap-1.5 border border-slate-200 text-slate-600 text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                            Filter
                        </button>
                        <button onClick={fetchDeals} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Refresh
                        </button>
                        <input
                            type="text"
                            placeholder="Search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] w-44 focus:outline-none focus:border-[#4D7CFF]"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                {['DEAL', 'VEHICLE', 'CUSTOMER', 'PROGRESS', 'STAGE', 'SOURCE', 'REFERENCE', 'UPDATED', 'ACCESSED', ''].map(col => (
                                    <th key={col} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                        <div className="flex items-center gap-1">
                                            {col}
                                            {['DEAL', 'VEHICLE', 'CUSTOMER', 'STAGE', 'SOURCE', 'REFERENCE', 'UPDATED', 'ACCESSED'].includes(col) && (
                                                <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={10} className="px-5 py-12 text-center">
                                        <div className="w-7 h-7 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-[12px] text-slate-400">Loading deals…</p>
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-5 py-16 text-center">
                                        <div className="text-slate-300 mb-2">
                                            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        </div>
                                        <p className="text-[13px] font-semibold text-slate-500">No deals found</p>
                                        {search && <p className="text-[11px] text-slate-400 mt-1">Try a different search term</p>}
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.map((deal, idx) => {
                                const dealNum = String(idx + 1 + (page - 1) * 20).padStart(6, '0');
                                const vrm = deal.stock?.vrm || deal.stock?.stockId?.slice(0, 8) || '—';
                                const ref = deal.stock?.searchId?.slice(-6).toUpperCase() || deal.dealId.slice(0, 6).toUpperCase();
                                return (
                                    <tr key={deal.dealId} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                                        {/* DEAL */}
                                        <td className="px-4 py-3">
                                            <Link href={`/app/deals/${deal.dealId}`} className="text-[13px] font-bold text-[#4D7CFF] hover:underline">
                                                {dealNum}
                                            </Link>
                                        </td>
                                        {/* VEHICLE */}
                                        <td className="px-4 py-3">
                                            <span className="text-[13px] font-bold text-[#4D7CFF]">{vrm}</span>
                                        </td>
                                        {/* CUSTOMER */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                                    {initials(deal.consumer.firstName, deal.consumer.lastName)}
                                                </div>
                                                <span className="text-[13px] font-semibold text-[#4D7CFF]">
                                                    {deal.consumer.firstName} {deal.consumer.lastName}
                                                </span>
                                            </div>
                                        </td>
                                        {/* PROGRESS */}
                                        <td className="px-4 py-3">
                                            <ProgressIcons deal={deal} />
                                        </td>
                                        {/* STAGE */}
                                        <td className="px-4 py-3">
                                            {(() => {
                                                const stage = deal.consumerDealStatus || deal.advertiserDealStatus || '';
                                                const isPayment = stage.toLowerCase().includes('payment') || stage === 'In Progress';
                                                const isComplete = stage === 'Complete' || stage === 'Completed';
                                                const isCancelled = stage === 'Cancelled';
                                                if (isPayment && !isComplete && !isCancelled)
                                                    return <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-[#4D7CFF] text-white">Payment</span>;
                                                if (isComplete)
                                                    return <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-emerald-100 text-emerald-700">Complete</span>;
                                                if (isCancelled)
                                                    return <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-500">Cancelled</span>;
                                                return <span className="text-[12px] text-slate-600">{stage || 'Product'}</span>;
                                            })()}
                                        </td>
                                        {/* SOURCE */}
                                        <td className="px-4 py-3">
                                            <span className="text-[12px] text-slate-600">AutoTrader</span>
                                        </td>
                                        {/* REFERENCE */}
                                        <td className="px-4 py-3">
                                            <span className="text-[12px] font-mono font-semibold text-slate-600">{ref}</span>
                                        </td>
                                        {/* UPDATED */}
                                        <td className="px-4 py-3">
                                            <span className="text-[12px] text-slate-500">{ago(deal.lastUpdated)}</span>
                                        </td>
                                        {/* ACCESSED */}
                                        <td className="px-4 py-3">
                                            <span className="text-[12px] text-slate-500">{ago(deal.lastUpdated)}</span>
                                        </td>
                                        {/* Action */}
                                        <td className="px-4 py-3">
                                            <Link href={`/app/deals/${deal.dealId}`} className="w-8 h-8 flex items-center justify-center bg-[#4D7CFF] text-white rounded-lg hover:bg-[#3a6ae0] transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                {!loading && total > 0 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                        <span className="text-[12px] text-slate-400">{total} total deals</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-40">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <span className="w-7 h-7 flex items-center justify-center bg-[#4D7CFF] text-white text-[12px] font-bold rounded">{page}</span>
                            <button onClick={() => setPage(p => p + 1)} className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded text-slate-400 hover:bg-slate-100">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
