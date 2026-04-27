'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Consumer {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    type: string | null;
}

interface StockRef {
    stockId: string;
    searchId: string;
    /** @deprecated Use Deal.reservation.status instead (Jan 2026 AT API change) */
    reservationStatus?: string | null;
}

interface Deal {
    dealId: string;
    created: string;
    lastUpdated: string;
    advertiserDealStatus: string;
    consumerDealStatus: string;
    consumer: Consumer;
    stock: StockRef;
    price: { suppliedPrice?: { amountGBP: number }; totalPrice?: { amountGBP: number } };
    reservation?: { status: string | null; fee?: { amountGBP: number; status: string } };
    messages?: { id: string; lastUpdated: string };
    calls?: any[];
}

const AVATAR_COLORS = [
    'bg-[#4ca7ba]', // Turquoise
    'bg-[#e8b57b]', // Gold
    'bg-[#59b889]', // Green
    'bg-[#57a1e0]', // Blue
    'bg-[#6e7ebf]', // Indigo
    'bg-[#8c8c8c]', // Grey
];

export default function LeadsAndChatPage() {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter states
    const [updatedIn, setUpdatedIn] = useState('Last 7 Days');
    const [leadType, setLeadType] = useState('Allocated New Car Stock, Callback, Chat, Dea');
    const [channel, setChannel] = useState('Chat, Website, Email, SMS, Phone, WhatsApp');
    const [statusFilter, setStatusFilter] = useState('New Lead, New Message, Read/Acknowled');
    const [assignedTo, setAssignedTo] = useState('Not Assigned, Arslan Ahmed');

    const fetchDeals = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/deals?page=${page}`);
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
    }, [page]);

    useEffect(() => { fetchDeals(); }, [fetchDeals]);

    const getInitials = (firstName?: string, lastName?: string) => {
        return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    };

    const getAvatarColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];

    const getRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
        
        if (diffInHours < 1) return 'Just now';
        if (diffInHours === 1) return '1 hour ago';
        if (diffInHours < 24) return `${diffInHours} hours ago`;
        return `${Math.floor(diffInHours / 24)} days ago`;
    };

    return (
        <div className="flex flex-col gap-6 p-3 sm:p-6 min-h-screen bg-[#f8fafc]">
            {/* ─── Main Content: Leads List ────────────────────────────────────────── */}
            <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-bold text-[#334155]">Leads & Chat</h1>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs font-semibold text-[#64748b] bg-white border border-[#e2e8f0] rounded-md hover:bg-[#f1f5f9] flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Help
                        </button>
                        <button className="px-3 py-1.5 text-xs font-semibold text-[#64748b] bg-white border border-[#e2e8f0] rounded-md hover:bg-[#f1f5f9] flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Settings
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden min-h-[400px] max-h-[calc(100vh-250px)] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a73e8]"></div>
                        </div>
                    ) : deals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#64748b]">
                            <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                            <p className="font-medium">No leads found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[#f1f5f9]">
                            {deals.map((deal, idx) => (
                                <Link key={deal.dealId} href={`/app/deals/${deal.dealId}`} className="flex items-center p-4 hover:bg-[#f8fafc] transition-colors group">
                                    <div className="flex-1 flex items-center gap-4">
                                        {/* Avatar */}
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm ${getAvatarColor(idx)}`}>
                                            {getInitials(deal.consumer?.firstName, deal.consumer?.lastName)}
                                        </div>
                                        
                                        {/* Name & Inquiry */}
                                        <div className="min-w-[150px]">
                                            <h3 className="text-sm font-bold text-[#1e293b] leading-tight group-hover:text-[#1a73e8] transition-colors">
                                                {deal.consumer?.firstName} {deal.consumer?.lastName}
                                            </h3>
                                            <p className="text-[11px] font-medium text-[#64748b] mt-0.5 capitalize">
                                                Enquiry
                                            </p>
                                        </div>

                                        {/* Status Button */}
                                        <div className="hidden sm:block min-w-[120px]">
                                            <span className="inline-flex items-center px-3 py-1 bg-[#49a0b9] text-white text-[10px] font-bold rounded-md uppercase tracking-wider">
                                                Acknowledged
                                            </span>
                                        </div>

                                        {/* Time */}
                                        <div className="hidden md:flex items-center gap-2 min-w-[120px]">
                                            <div className="w-2 h-2 rounded-full bg-[#cbd5e1]" />
                                            <span className="text-[11px] font-medium italic text-[#64748b]">
                                                {getRelativeTime(deal.lastUpdated)}
                                            </span>
                                        </div>

                                        {/* Assign Button */}
                                        <div className="hidden lg:block min-w-[100px]">
                                            <div className="relative">
                                                <button className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-semibold text-[#475569] bg-white border border-[#e2e8f0] rounded-md hover:bg-[#f8fafc]">
                                                    Assign
                                                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Action: Close */}
                                    <button className="px-5 py-1 text-[11px] font-bold text-[#1a73e8] border border-[#1a73e8] rounded-md hover:bg-[#1a73e8] hover:text-white transition-all ml-4">
                                        Close
                                    </button>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button className="flex-1 sm:flex-none px-6 py-2.5 bg-[#4285f4] text-white text-xs font-bold rounded-md shadow-md hover:bg-[#3367d6] transition-colors uppercase tracking-tight">
                            Create New Lead
                        </button>
                        <button className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-[#4285f4] text-[#4285f4] text-xs font-bold rounded-md hover:bg-[#f8fbff] transition-colors uppercase tracking-tight">
                            Acknowledge New
                        </button>
                    </div>
                    
                    {/* Volume Icon (from screenshot) */}
                    <div className="p-2 text-[#94a3b8] hover:text-[#475569] cursor-pointer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </div>
                </div>
            </div>

            {/* ─── Sidebar: Filters ──────────────────────────────────────────────── */}
            <aside className="w-full lg:w-[320px] bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6 flex flex-col gap-6">
                <h2 className="text-xl font-bold text-[#334155]">Filters</h2>
                
                <div className="space-y-4">
                    {/* Updated In */}
                    <div>
                        <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-1.5 font-sans">Updated In</label>
                        <select 
                            value={updatedIn}
                            onChange={(e) => setUpdatedIn(e.target.value)}
                            className="w-full h-11 px-4 text-sm font-medium text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-xl focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
                        >
                            <option>Last 7 Days</option>
                            <option>Last 30 Days</option>
                            <option>Today</option>
                        </select>
                    </div>

                    {/* Type */}
                    <div>
                        <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-1.5 font-sans">Type</label>
                        <select 
                            value={leadType}
                            onChange={(e) => setLeadType(e.target.value)}
                            className="w-full h-11 px-4 text-xs font-semibold text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none"
                        >
                            <option value="Allocated New Car Stock, Callback, Chat, Dea">Allocated New Car Stock, Callback, Chat, Dea</option>
                        </select>
                    </div>

                    {/* Channel */}
                    <div>
                        <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-1.5 font-sans">Channel</label>
                        <select 
                            value={channel}
                            onChange={(e) => setChannel(e.target.value)}
                            className="w-full h-11 px-4 text-xs font-semibold text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none"
                        >
                            <option value="Chat, Website, Email, SMS, Phone, WhatsApp">Chat, Website, Email, SMS, Phone, WhatsApp</option>
                        </select>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-1.5 font-sans">Status</label>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full h-11 px-4 text-xs font-semibold text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none"
                        >
                            <option value="New Lead, New Message, Read/Acknowled">New Lead, New Message, Read/Acknowled</option>
                        </select>
                    </div>

                    {/* Assigned To */}
                    <div>
                        <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-1.5 font-sans">Assigned To</label>
                        <select 
                            value={assignedTo}
                            onChange={(e) => setAssignedTo(e.target.value)}
                            className="w-full h-11 px-4 text-xs font-semibold text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-xl outline-none"
                        >
                            <option value="Not Assigned, Arslan Ahmed">Not Assigned, Arslan Ahmed</option>
                        </select>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-1.5 font-sans">Tags</label>
                        <div className="w-full h-11 px-4 flex items-center text-xs font-semibold text-[#cbd5e1] bg-[#f8fafc] border border-[#e2e8f0] rounded-xl">
                            Nothing selected
                        </div>
                    </div>

                    {/* Search Field */}
                    <div className="pt-4 mt-4 border-t border-[#f1f5f9]">
                        <label className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-1.5 font-sans">Name, Email or Phone</label>
                        <div className="relative">
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-11 pl-4 pr-10 text-sm font-medium text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-xl focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent outline-none transition-all"
                                placeholder="..."
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Floating Contact Icon (from screenshot) */}
            <div className="fixed bottom-8 right-8 w-14 h-14 bg-[#54a49c] rounded-full flex items-center justify-center text-white shadow-xl cursor-pointer hover:scale-110 active:scale-95 transition-all z-50">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            </div>
        </div>
    );
}
