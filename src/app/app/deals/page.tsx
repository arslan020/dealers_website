'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

interface Consumer {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    type: string | null;
}

interface Deal {
    dealId: string;
    created: string;
    lastUpdated: string;
    advertiserDealStatus: string;
    consumerDealStatus: string;
    advertiserCancellationReason: string | null;
    consumer: Consumer;
    stock: { stockId: string; searchId: string; vrm: string | null };
    vehicleId: string | null;
    customerId: string | null;
    price: { suppliedPrice?: { amountGBP: number }; totalPrice?: { amountGBP: number } };
    reservation?: { status: string | null; fee?: { amountGBP: number; status: string } };
    buyingSignals?: { dealIntentScore: number; intent: string };
    financeApplication?: { status: string } | null;
    partExchange?: { id?: string; lastUpdated?: string } | null;
    delivery?: { type?: string } | null;
    messages?: { id: string; lastUpdated: string } | null;
}

const AVATAR_COLORS = [
    'bg-[#4ca7ba]', 'bg-[#e8b57b]', 'bg-[#59b889]',
    'bg-[#57a1e0]', 'bg-[#6e7ebf]', 'bg-[#8c8c8c]',
];

function getFromDate(filter: string): string {
    const now = new Date();
    if (filter === 'Today') { now.setHours(0, 0, 0, 0); return now.toISOString().split('T')[0]; }
    if (filter === 'Last 7 Days') { now.setDate(now.getDate() - 7); return now.toISOString().split('T')[0]; }
    if (filter === 'Last 30 Days') { now.setDate(now.getDate() - 30); return now.toISOString().split('T')[0]; }
    return '';
}

function getDealRef(dealId: string): string {
    const chars = dealId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return chars.slice(-6).padStart(6, '0');
}

function getDealNumber(idx: number): string {
    return String(idx + 1).padStart(6, '0');
}

function getSource(deal: Deal): string {
    if (deal.buyingSignals || deal.stock?.searchId) return 'AutoTrader';
    return 'Deal Builder';
}

function getStage(deal: Deal): { label: string; highlight: boolean } {
    const status = (deal.advertiserDealStatus || '').toLowerCase();
    const consumer = (deal.consumerDealStatus || '').toLowerCase();
    if (status === 'completed' || status === 'complete') return { label: 'Complete', highlight: false };
    if (status === 'cancelled') return { label: 'Cancelled', highlight: false };
    if (deal.reservation?.fee?.status?.toLowerCase() === 'paid') return { label: 'Payment', highlight: true };
    if (consumer.includes('payment') || consumer.includes('pay')) return { label: 'Payment', highlight: true };
    if (deal.financeApplication) return { label: 'Finance', highlight: true };
    if (deal.delivery) return { label: 'Delivery', highlight: false };
    if (deal.partExchange) return { label: 'Part Exchange', highlight: false };
    return { label: 'Product', highlight: false };
}

// 7 progress steps: Vehicle, Products, Part Exchange, Customer, Finance, Payment, Complete
function getProgress(deal: Deal): boolean[] {
    const status = (deal.advertiserDealStatus || '').toLowerCase();
    const isComplete = status === 'completed' || status === 'complete';
    const isPaid = deal.reservation?.fee?.status?.toLowerCase() === 'paid' || isComplete;
    return [
        !!deal.stock?.stockId,
        false,
        !!(deal.partExchange as any)?.id,
        !!deal.consumer?.email,
        !!deal.financeApplication,
        isPaid,
        isComplete,
    ];
}

const PROGRESS_ICONS = [
    // Vehicle
    <svg key="v" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8l2-2zM13 6l3.586 3.586A2 2 0 0117 11v5h2a2 2 0 002-2v-2.586a2 2 0 00-.586-1.414L18 8H13z"/></svg>,
    // Products / Shopping bag
    <svg key="p" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>,
    // Part Exchange / swap arrows
    <svg key="px" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>,
    // Customer / person
    <svg key="c" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
    // Finance / bank building
    <svg key="f" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>,
    // Payment / credit card
    <svg key="pay" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
    // Complete / checkmark
    <svg key="ok" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>,
];

type SortField = 'deal' | 'vehicle' | 'customer' | 'stage' | 'source';
type SortDir = 'asc' | 'desc';

export default function DealsListPage() {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [totalResults, setTotalResults] = useState(0);

    const [updatedIn, setUpdatedIn] = useState('Last 7 Days');
    const [statusFilter, setStatusFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [sortField, setSortField] = useState<SortField>('deal');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const fetchDeals = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const from = getFromDate(updatedIn);
            let url = `/api/deals?page=1`;
            if (from) url += `&from=${from}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.ok) {
                setDeals(data.deals);
                setTotalResults(data.totalResults);
            } else {
                setError(data.error?.message || 'Failed to load deals.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [updatedIn]);

    useEffect(() => { fetchDeals(); }, [fetchDeals]);

    const filteredDeals = useMemo(() => {
        let list = deals.filter(deal => {
            if (statusFilter !== 'All') {
                const s = (deal.advertiserDealStatus || '').toLowerCase();
                if (statusFilter === 'In Progress' && s !== 'in progress') return false;
                if (statusFilter === 'Completed' && s !== 'completed' && s !== 'complete') return false;
                if (statusFilter === 'Cancelled' && s !== 'cancelled') return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = `${deal.consumer?.firstName || ''} ${deal.consumer?.lastName || ''}`.toLowerCase();
                const email = (deal.consumer?.email || '').toLowerCase();
                const vrm = (deal.stock?.stockId || '').toLowerCase();
                if (!name.includes(q) && !email.includes(q) && !vrm.includes(q)) return false;
            }
            return true;
        });

        list = [...list].sort((a, b) => {
            let av = '', bv = '';
            if (sortField === 'customer') {
                av = `${a.consumer?.firstName} ${a.consumer?.lastName}`;
                bv = `${b.consumer?.firstName} ${b.consumer?.lastName}`;
            } else if (sortField === 'vehicle') {
                av = a.stock?.stockId || '';
                bv = b.stock?.stockId || '';
            } else if (sortField === 'stage') {
                av = getStage(a).label;
                bv = getStage(b).label;
            } else if (sortField === 'source') {
                av = getSource(a);
                bv = getSource(b);
            }
            const cmp = av.localeCompare(bv);
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return list;
    }, [deals, statusFilter, searchQuery, sortField, sortDir]);

    function handleSort(field: SortField) {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    }

    function SortIcon({ field }: { field: SortField }) {
        return (
            <span className="inline-flex flex-col ml-1 opacity-40">
                <svg className={`w-2.5 h-2.5 -mb-0.5 ${sortField === field && sortDir === 'asc' ? 'opacity-100 text-[#3eb6cd]' : ''}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0z"/></svg>
                <svg className={`w-2.5 h-2.5 ${sortField === field && sortDir === 'desc' ? 'opacity-100 text-[#3eb6cd]' : ''}`} viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0H10z"/></svg>
            </span>
        );
    }

    return (
        <div className="flex flex-col p-3 sm:p-6 min-h-screen bg-[#f8fafc]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-[#1e293b]">Deals</h1>
                <div className="flex items-center gap-2">
                    {/* Create Deal */}
                    <Link
                        href="/app/deals/create"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-[#3eb6cd] border border-[#3eb6cd] rounded-md hover:bg-[#3eb6cd]/5 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                        Create Deal
                    </Link>
                    {/* Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setShowFilter(f => !f)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-[#3eb6cd] border border-[#3eb6cd] rounded-md hover:bg-[#3eb6cd]/5 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/></svg>
                            Filter
                        </button>
                        {showFilter && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#e2e8f0] rounded-xl shadow-lg p-4 z-50 space-y-4">
                                <div>
                                    <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-1.5">Updated In</label>
                                    <select
                                        value={updatedIn}
                                        onChange={e => setUpdatedIn(e.target.value)}
                                        className="w-full h-9 px-3 text-sm font-medium text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none"
                                    >
                                        <option>Today</option>
                                        <option>Last 7 Days</option>
                                        <option>Last 30 Days</option>
                                        <option>All Time</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-1.5">Deal Status</label>
                                    <select
                                        value={statusFilter}
                                        onChange={e => setStatusFilter(e.target.value)}
                                        className="w-full h-9 px-3 text-sm font-medium text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none"
                                    >
                                        <option value="All">All</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                                {(statusFilter !== 'All' || updatedIn !== 'Last 7 Days') && (
                                    <button
                                        onClick={() => { setStatusFilter('All'); setUpdatedIn('Last 7 Days'); }}
                                        className="text-[12px] font-semibold text-[#3eb6cd] hover:underline"
                                    >
                                        Reset filters
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    {/* Refresh */}
                    <button
                        onClick={fetchDeals}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#64748b] hover:text-[#334155] transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Refresh
                    </button>
                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search"
                            className="w-52 h-9 pl-4 pr-9 text-[13px] text-[#475569] bg-white border border-[#e2e8f0] rounded-md focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none"
                        />
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600 font-medium">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[80px_120px_160px_1fr_130px_110px_120px_48px] border-b border-[#e2e8f0] bg-[#f8fafc]">
                    {[
                        { label: 'DEAL', field: 'deal' as SortField },
                        { label: 'VEHICLE', field: 'vehicle' as SortField },
                        { label: 'CUSTOMER', field: 'customer' as SortField },
                        { label: 'PROGRESS', field: null },
                        { label: 'STAGE', field: 'stage' as SortField },
                        { label: 'SOURCE', field: 'source' as SortField },
                        { label: 'REFERENCE', field: null },
                    ].map(col => (
                        <div
                            key={col.label}
                            onClick={() => col.field && handleSort(col.field)}
                            className={`px-3 py-2.5 text-[10px] font-bold text-[#94a3b8] tracking-wider flex items-center ${col.field ? 'cursor-pointer hover:text-[#64748b] select-none' : ''}`}
                        >
                            {col.label}
                            {col.field && <SortIcon field={col.field} />}
                        </div>
                    ))}
                    <div className="px-3 py-2.5" />
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb6cd]" />
                    </div>
                ) : filteredDeals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-[#64748b]">
                        <svg className="w-10 h-10 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        <p className="text-sm font-medium">No deals found</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[#f1f5f9]">
                        {filteredDeals.map((deal, idx) => {
                            const progress = getProgress(deal);
                            const stage = getStage(deal);
                            const source = getSource(deal);
                            const ref = getDealRef(deal.dealId);
                            const num = getDealNumber(idx);
                            return (
                                <div
                                    key={deal.dealId}
                                    className="grid grid-cols-[80px_120px_160px_1fr_130px_110px_120px_48px] items-center hover:bg-[#f8fafc] transition-colors group"
                                >
                                    {/* Deal # */}
                                    <div className="px-3 py-3">
                                        <Link href={`/app/deals/${deal.dealId}`} className="text-[13px] font-semibold text-[#3eb6cd] hover:underline">
                                            {num}
                                        </Link>
                                    </div>

                                    {/* Vehicle — click opens vehicle detail */}
                                    <div className="px-3 py-3">
                                        {deal.stock?.vrm ? (
                                            deal.vehicleId ? (
                                                <Link href={`/app/vehicles/${deal.vehicleId}`} className="text-[13px] font-semibold text-[#3eb6cd] hover:underline font-mono">
                                                    {deal.stock.vrm}
                                                </Link>
                                            ) : (
                                                <span className="text-[13px] font-semibold text-[#3eb6cd] font-mono">{deal.stock.vrm}</span>
                                            )
                                        ) : (
                                            <span className="text-[13px] text-slate-400">—</span>
                                        )}
                                    </div>

                                    {/* Customer — click opens customer contact page */}
                                    <div className="px-3 py-3">
                                        {deal.customerId ? (
                                            <Link href={`/app/sales/contacts?id=${deal.customerId}`} className="flex items-center gap-2 group/cust">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                                    {(deal.consumer?.firstName?.[0] || '').toUpperCase()}{(deal.consumer?.lastName?.[0] || '').toUpperCase()}
                                                </div>
                                                <span className="text-[13px] font-semibold text-[#3eb6cd] group-hover/cust:underline">
                                                    {deal.consumer?.firstName} {deal.consumer?.lastName}
                                                </span>
                                            </Link>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                                    {(deal.consumer?.firstName?.[0] || '').toUpperCase()}{(deal.consumer?.lastName?.[0] || '').toUpperCase()}
                                                </div>
                                                <span className="text-[13px] font-semibold text-[#475569]">
                                                    {deal.consumer?.firstName} {deal.consumer?.lastName}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Progress icons */}
                                    <div className="px-3 py-3 flex items-center gap-1.5">
                                        {PROGRESS_ICONS.map((icon, i) => (
                                            <div
                                                key={i}
                                                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                                                    progress[i]
                                                        ? 'bg-[#3eb6cd] border-[#3eb6cd] text-white'
                                                        : 'bg-white border-[#e2e8f0] text-[#cbd5e1]'
                                                }`}
                                                title={['Vehicle', 'Products', 'Part Exchange', 'Customer', 'Finance', 'Payment', 'Complete'][i]}
                                            >
                                                {icon}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Stage */}
                                    <div className="px-3 py-3">
                                        {stage.highlight ? (
                                            <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold bg-[#3eb6cd] text-white rounded-md">
                                                {stage.label}
                                            </span>
                                        ) : (
                                            <span className="text-[13px] font-medium text-[#475569]">{stage.label}</span>
                                        )}
                                    </div>

                                    {/* Source */}
                                    <div className="px-3 py-3">
                                        <span className="text-[13px] font-medium text-[#475569]">{source}</span>
                                    </div>

                                    {/* Reference */}
                                    <div className="px-3 py-3">
                                        <span className="text-[13px] font-medium text-[#475569] font-mono">{ref}</span>
                                    </div>

                                    {/* Action */}
                                    <div className="px-2 py-3 flex items-center justify-center">
                                        <Link
                                            href={`/app/deals/${deal.dealId}`}
                                            className="w-8 h-8 flex items-center justify-center bg-[#3eb6cd] text-white rounded-md hover:bg-[#37a3b8] transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer count */}
            {!loading && (
                <p className="mt-3 text-[11px] text-slate-400">
                    Showing {filteredDeals.length} of {totalResults} deal{totalResults !== 1 ? 's' : ''}
                </p>
            )}

            {/* Close filter dropdown on outside click */}
            {showFilter && (
                <div className="fixed inset-0 z-40" onClick={() => setShowFilter(false)} onKeyDown={e => e.key === 'Escape' && setShowFilter(false)} />
            )}
        </div>
    );
}
