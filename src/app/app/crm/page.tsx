'use client';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type Customer = {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    source: string;
    status: string;
    createdAt: string;
};

type Lead = {
    _id?: string;
    id?: string; // For AutoTrader mapped id
    dealId?: string; // For AutoTrader
    source: 'Local' | 'AutoTrader';
    status: string;
    advertiserDealStatus?: string;
    platform?: string;
    message?: string;
    createdAt?: string;
    created?: string; // For AutoTrader mapping
    lastUpdated?: string;
    customerId?: Customer | string;
    customer?: { // For AutoTrader mapping
        firstName?: string;
        lastName?: string;
        name?: string;
        email?: string;
        phone?: string;
    };
    vehicleId?: any;
    vehicle?: { // For AutoTrader mapping
        stockId?: string;
        searchId?: string;
    };
    stock?: {
        stockId?: string;
        vrm?: string;
        make?: string;
        model?: string;
    };
    intentScore?: number;
    intentLevel?: string;
    messagesId?: string;
    assignedTo?: string;
    assigneeName?: string;
};

type ChatMessage = {
    sender: 'dealer' | 'customer';
    text: string;
    timestamp: string;
};

function CRMContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'customers') {
            router.replace('/app/contacts');
        }
    }, [searchParams, router]);

    const [leads, setLeads] = useState<Lead[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);

    // Chat State
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Modal State
    const [closeModalLead, setCloseModalLead] = useState<Lead | null>(null);
    const [cancellationReason, setCancellationReason] = useState('Different Vehicle');
    const [isClosingDeal, setIsClosingDeal] = useState(false);

    // Create New Lead Modal
    const [showCreateLead, setShowCreateLead] = useState(false);
    const [createLeadForm, setCreateLeadForm] = useState({
        leadType: 'Enquiry',
        name: '',
        email: '',
        sms: '',
        phone: '',
        preferredMethod: 'Email',
        marketingConsent: 'No',
        avatarColor: '#4D7CFF',
    });
    const [isCreatingLead, setIsCreatingLead] = useState(false);

    // Acknowledge New Modal
    const [showAcknowledgeNew, setShowAcknowledgeNew] = useState(false);
    const [isAcknowledgingAll, setIsAcknowledgingAll] = useState(false);

    // Filter State
    const [filterUpdatedIn, setFilterUpdatedIn] = useState('Last 7 Days');
    const [filterType, setFilterType] = useState('All');
    const [filterChannel, setFilterChannel] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterAssignedTo, setFilterAssignedTo] = useState('All');

    useEffect(() => {
        fetchLeads();
    }, []);

    // SSE Setup
    useEffect(() => {

        let reconnectTimeout: NodeJS.Timeout;
        let eventSource: EventSource;

        const connect = () => {
            eventSource = new EventSource('/api/leads/stream');

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'connected') return;

                    if (data.event === 'WEBHOOK_UPDATE' && data.lead) {
                        toast.success(`Pipeline Updated: ${data.lead.status.replace(/_/g, ' ')}`, {
                            icon: '🔄',
                            style: { borderRadius: '12px', background: '#333', color: '#fff' }
                        });
                        // Refresh pipeline or optimistically update
                        fetchLeads();
                    }
                } catch (e) {
                    console.error("SSE parse error", e);
                }
            };

            eventSource.onerror = (err) => {
                console.error('SSE Error, scheduling reconnect...', err);
                eventSource.close();
                reconnectTimeout = setTimeout(connect, 3000);
            };
        };

        connect();

        return () => {
            clearTimeout(reconnectTimeout);
            if (eventSource) eventSource.close();
        };
    }, []);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory]);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const localRes = await fetch('/api/crm/leads');
            const localData = await localRes.json();

            let allLeads: Lead[] = [];

            if (localData.ok) {
                allLeads = [...allLeads, ...localData.leads.map((l: any) => ({ ...l, source: l.platform || 'Local' }))];
            }

            // AutoTrader Pagination Loop to handle 50+ deals
            let page = 1;
            let hasMore = true;
            let allATDeals: any[] = [];

            // Fetch multiple pages sequentially (AutoTrader allows up to 50 per page)
            while (hasMore) {
                try {
                    const atRes = await fetch(`/api/deals?page=${page}`);
                    const atData = await atRes.json();

                    if (atData.ok && atData.deals) {
                        allATDeals = [...allATDeals, ...atData.deals];
                        if (allATDeals.length >= atData.totalResults || atData.deals.length < 50) {
                            hasMore = false;
                        } else {
                            page++;
                        }
                    } else {
                        hasMore = false;
                    }
                } catch (e) {
                    console.error('AutoTrader pagination fetch error:', e);
                    hasMore = false;
                }
            }

            if (allATDeals.length > 0) {
                const mappedATDeals = allATDeals.map((d: any) => ({
                    id: d.dealId,
                    dealId: d.dealId,
                    source: 'AutoTrader' as const,
                    status: d.messages?.lastUpdated ? 'NEW_MESSAGE' : (d.advertiserDealStatus === 'In Progress' ? 'IN_PROGRESS' : 'NEW_LEAD'),
                    advertiserDealStatus: d.advertiserDealStatus,
                    created: d.created,
                    lastUpdated: d.lastUpdated,
                    customer: d.consumer,
                    stock: d.stock,
                    intentScore: d.buyingSignals?.dealIntentScore,
                    intentLevel: d.buyingSignals?.intent,
                    messagesId: d.messages?.messagesId ?? d.messages?.id
                }));

                // Merge, preferring auto trader deals from /deals to local DB representations if they overlap
                const mappedATIds = new Set(mappedATDeals.map((d: any) => d.dealId));
                const filteredLocal = allLeads.filter(l => !l.dealId || !mappedATIds.has(l.dealId));
                allLeads = [...filteredLocal, ...mappedATDeals];
            }

            allLeads.sort((a, b) => {
                const dateA = new Date(a.lastUpdated || a.createdAt || a.created || 0).getTime();
                const dateB = new Date(b.lastUpdated || b.createdAt || b.created || 0).getTime();
                return dateB - dateA; // newest first
            });

            setLeads(allLeads);
        } catch (err) {
            console.error('Failed to fetch leads:', err);
            toast.error('Failed to sync pipeline.');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/crm/customers');
            const data = await res.json();
            if (data.ok) setCustomers(data.customers);
        } catch (err) {
            toast.error('Failed to load customers.');
        } finally {
            setLoading(false);
        }
    };

    const openChat = async (lead: Lead) => {
        setSelectedLead(lead);
        setChatHistory([]);

        if (lead.source === 'AutoTrader') {
            if (lead.messagesId) {
                setChatLoading(true);
                try {
                    const res = await fetch(`/api/crm/chat/autotrader/${lead.messagesId}`);
                    const data = await res.json();
                    if (data.ok) {
                        setChatHistory(data.history || []);
                        // Mark messages as read on AutoTrader's side
                        fetch(`/api/crm/chat/autotrader/${lead.messagesId}`, { method: 'PATCH' }).catch(() => {});
                    }
                } catch (err) {
                    toast.error('Failed to load chat history.');
                } finally {
                    setChatLoading(false);
                }
            } else {
                // Show empty state - no messages yet
                setChatHistory([]);
            }
        } else if (lead.message) {
            setChatHistory([{
                sender: 'customer',
                text: lead.message,
                timestamp: lead.createdAt || new Date().toISOString()
            }]);
        }
    };

    const sendReply = async () => {
        if (!newMessage || !selectedLead) return;

        if (selectedLead.source === 'AutoTrader') {
            try {
                const res = await fetch(`/api/crm/chat/autotrader/${selectedLead.messagesId || 'new'}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: newMessage,
                        dealId: selectedLead.dealId
                    }),
                });

                const data = await res.json();
                if (data.ok) {
                    setChatHistory(prev => [...prev, {
                        sender: 'dealer',
                        text: newMessage,
                        timestamp: new Date().toISOString()
                    }]);
                    setNewMessage('');
                    toast.success('Message sent!');
                } else {
                    toast.error(data.error || 'Failed to send message.');
                }
            } catch (err) {
                toast.error('Connection error.');
            }
        } else {
            setChatHistory(prev => [...prev, { sender: 'dealer', text: newMessage, timestamp: new Date().toISOString() }]);
            setNewMessage('');
            toast.success('Reply saved locally');
        }
    };

    const handleAcknowledge = async (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        try {
            const res = await fetch('/api/crm/leads', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: lead._id || lead.dealId, status: 'ACKNOWLEDGED' })
            });
            if (res.ok) {
                toast.success('Lead acknowledged');
                setLeads(prev => prev.map(l => (l._id === lead._id || l.dealId === lead.dealId) ? { ...l, status: 'ACKNOWLEDGED' } : l));
            }
        } catch (err) {
            toast.error('Update failed');
        }
    };

    const handleCloseDeal = (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        setCloseModalLead(lead);
        setCancellationReason('Different Vehicle');
    };

    const submitCloseDeal = async () => {
        if (!closeModalLead) return;
        setIsClosingDeal(true);
        try {
            if (closeModalLead.source === 'AutoTrader' && closeModalLead.dealId) {
                const res = await fetch(`/api/deals/${closeModalLead.dealId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        advertiserDealStatus: 'Cancelled',
                        advertiserCancellationReason: cancellationReason
                    })
                });
                if (res.ok) {
                    toast.success('Deal Closed on AutoTrader');
                    fetchLeads();
                    setCloseModalLead(null);
                } else {
                    const data = await res.json();
                    toast.error(data.error || 'Failed to close deal');
                }
            } else if (closeModalLead._id) {
                const res = await fetch('/api/crm/leads', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: closeModalLead._id, status: 'CLOSED' })
                });
                if (res.ok) {
                    toast.success('Lead Closed internally');
                    setLeads(prev => prev.map(l => l._id === closeModalLead._id ? { ...l, status: 'CLOSED' } : l));
                    setCloseModalLead(null);
                }
            }
        } catch (err) {
            toast.error('Connection error');
        } finally {
            setIsClosingDeal(false);
        }
    };

    const submitCreateLead = async () => {
        if (!createLeadForm.name.trim()) { toast.error('Name is required'); return; }
        setIsCreatingLead(true);
        try {
            const [firstName, ...rest] = createLeadForm.name.trim().split(' ');
            const res = await fetch('/api/crm/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerDetails: {
                        firstName,
                        lastName: rest.join(' ') || '',
                        email: createLeadForm.email,
                        phone: createLeadForm.phone || createLeadForm.sms,
                    },
                    type: createLeadForm.leadType,
                    preferredMethod: createLeadForm.preferredMethod,
                    marketingConsent: createLeadForm.marketingConsent === 'Yes',
                    avatarColor: createLeadForm.avatarColor,
                    status: 'NEW_LEAD',
                    platform: 'Manual',
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed to create lead');
            toast.success('Lead created');
            setShowCreateLead(false);
            setCreateLeadForm({ leadType: 'Enquiry', name: '', email: '', sms: '', phone: '', preferredMethod: 'Email', marketingConsent: 'No', avatarColor: '#4D7CFF' });
            fetchLeads();
        } catch (err: any) {
            toast.error(err.message || 'Failed to create lead');
        } finally {
            setIsCreatingLead(false);
        }
    };

    const submitAcknowledgeAll = async () => {
        setIsAcknowledgingAll(true);
        try {
            const toAck = leads.filter(l => {
                const s = (l.status || '').toUpperCase();
                return s.includes('NEW_LEAD') || s.includes('NEW_MESSAGE') || s === 'NEW';
            });
            await Promise.all(toAck.map(lead =>
                fetch('/api/crm/leads', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: lead._id || lead.dealId, status: 'ACKNOWLEDGED' }),
                })
            ));
            toast.success(`${toAck.length} lead${toAck.length !== 1 ? 's' : ''} acknowledged`);
            setShowAcknowledgeNew(false);
            fetchLeads();
        } catch (err) {
            toast.error('Failed to acknowledge leads');
        } finally {
            setIsAcknowledgingAll(false);
        }
    };

    const getStatusStyle = (status: string) => {
        const s = (status || '').toUpperCase();
        if (s.includes('NEW_MESSAGE')) return 'bg-emerald-500 text-white border-emerald-600';
        if (s.includes('NEW')) return 'bg-emerald-400 text-white border-emerald-500';
        if (s.includes('ACK') || s.includes('PROGRESS')) return 'bg-blue-500 text-white border-blue-600';
        if (s.includes('CLOSED') || s.includes('CANCEL')) return 'bg-slate-200 text-slate-600 border-slate-300';
        return 'bg-blue-500 text-white border-blue-600';
    };

    const getTimeAgo = (dateStr?: string) => {
        if (!dateStr) return 'unknown';
        const ms = Date.now() - new Date(dateStr).getTime();
        const hrs = Math.floor(ms / (1000 * 60 * 60));
        if (hrs < 1) return 'just now';
        if (hrs < 24) return `${hrs} hours ago`;
        return `${Math.floor(hrs / 24)} days ago`;
    };

    const getCustomerInitials = (lead: Lead) => {
        const c1 = lead.customerId as Customer;
        if (c1?.firstName) return `${c1.firstName[0]}${c1.lastName?.[0] || ''}`.toUpperCase();
        if (lead.customer?.firstName) return `${lead.customer.firstName[0]}${lead.customer.lastName?.[0] || ''}`.toUpperCase();
        if (lead.customer?.name) return lead.customer.name.substring(0, 2).toUpperCase();
        return '?';
    };

    const getCustomerName = (lead: Lead) => {
        const c1 = lead.customerId as Customer;
        if (c1?.firstName) return `${c1.firstName} ${c1.lastName || ''}`.trim();
        if (lead.customer?.firstName) return `${lead.customer.firstName} ${lead.customer.lastName || ''}`.trim();
        if (lead.customer?.name) return lead.customer.name;
        return 'Unknown Lead';
    };

    const filteredLeads = useMemo(() => {
        return leads.filter(l => {
            if (filterChannel !== 'All' && l.source !== filterChannel) return false;

            if (filterStatus !== 'All') {
                const s = (l.status || '').toUpperCase();
                if (filterStatus === 'New Lead' && !s.includes('NEW_LEAD')) return false;
                if (filterStatus === 'New Message' && !s.includes('MESSAGE')) return false;
                if (filterStatus === 'In Progress' && !s.includes('PROGRESS')) return false;
                if (filterStatus === 'Closed' && !s.includes('CLOSE') && !s.includes('CANCEL')) return false;
            }

            if (filterType !== 'All') {
                if (filterType === 'Enquiry' && !l.message && l.source !== 'AutoTrader') return false;
                if (filterType === 'Callback' && !l.message?.toLowerCase().includes('call')) return false;
            }

            if (filterAssignedTo !== 'All') {
                if (filterAssignedTo === 'Unassigned' && l.assignedTo) return false;
            }

            if (filterUpdatedIn !== 'All Time') {
                const dateTs = new Date(l.lastUpdated || l.createdAt || l.created || 0).getTime();
                const now = Date.now();
                if (filterUpdatedIn === 'Last 7 Days' && now - dateTs > 7 * 24 * 60 * 60 * 1000) return false;
                if (filterUpdatedIn === 'Last 30 Days' && now - dateTs > 30 * 24 * 60 * 60 * 1000) return false;
            }

            return true;
        });
    }, [leads, filterChannel, filterStatus, filterType, filterAssignedTo, filterUpdatedIn]);

    return (
        <div className="w-full flex-1 min-h-[calc(100vh-60px)] lg:min-h-[calc(100vh-80px)] bg-slate-50 flex flex-col font-sans -mt-8 pt-8">
            {/* Header */}
            <div className="px-4 sm:px-8 pb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 bg-white">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Leads & Chat</h1>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 border border-slate-200 text-slate-500 text-sm font-semibold rounded-md hover:bg-slate-50 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Help
                    </button>
                    <button className="px-4 py-2 border border-slate-200 text-slate-500 text-sm font-semibold rounded-md hover:bg-slate-50 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Settings
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* ─── Column 1: Leads List ───────────────────────────────────── */}
                <div className="w-full lg:w-[450px] flex flex-col border-r border-slate-200/60 bg-white z-10 shrink-0">
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        {loading ? (
                            <div className="p-10 flex justify-center"><div className="w-8 h-8 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin"></div></div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 text-sm">No leads match your filters.</div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredLeads.map((lead) => {
                                    const isSelected = selectedLead?.dealId === lead.dealId || (selectedLead?._id && selectedLead._id === lead._id);
                                    let avatarColor = 'bg-slate-400';
                                    if (lead.source === 'AutoTrader') avatarColor = 'bg-[#3eb6cd]'; // AT blue
                                    if (lead.status.includes('ACK')) avatarColor = 'bg-[#e49d44]'; // orange 

                                    return (
                                        <div
                                            key={lead._id || lead.dealId || Math.random().toString()}
                                            onClick={() => openChat(lead)}
                                            className={`p-4 flex items-center justify-between cursor-pointer transition-colors border-l-4 ${isSelected ? 'bg-slate-50 border-blue-500' : 'border-transparent hover:bg-slate-50/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${avatarColor}`}>
                                                    {getCustomerInitials(lead)}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${getStatusStyle(lead.status)}`}>
                                                            {lead.status.replace(/_/g, ' ')}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                                            <div className={`w-2 h-2 rounded-full ${lead.status.includes('NEW') ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                                            {getTimeAgo(lead.lastUpdated || lead.createdAt || lead.created)}
                                                        </div>
                                                    </div>
                                                    <h4 className="font-semibold text-slate-800 text-sm truncate">{getCustomerName(lead)}</h4>
                                                    <p className="text-xs text-slate-500 italic mt-0.5 truncate">Enquiry</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 items-end shrink-0">
                                                <select className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-600 focus:outline-none focus:border-blue-500 w-[100px]" onClick={e => e.stopPropagation()}>
                                                    <option>Assign</option>
                                                    <option>Me</option>
                                                </select>
                                                <div className="flex gap-1.5">
                                                    <button onClick={(e) => handleAcknowledge(e, lead)} className="px-2 py-1 text-[10px] font-semibold text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors">Acknowledge</button>
                                                    <button onClick={(e) => handleCloseDeal(e, lead)} className="px-2 py-1 text-[10px] font-semibold text-slate-500 border border-slate-200 rounded hover:bg-slate-50 transition-colors">Close</button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    {/* Bottom Action Bar */}
                    <div className="p-4 border-t border-slate-200/60 flex items-center gap-3 bg-white">
                        <button onClick={() => setShowCreateLead(true)} className="flex-1 py-2.5 bg-blue-500 text-white font-semibold text-sm rounded hover:bg-blue-600 transition-colors">Create New Lead</button>
                        <button onClick={() => setShowAcknowledgeNew(true)} className="flex-1 py-2.5 bg-white border border-blue-200 text-blue-600 font-semibold text-sm rounded hover:bg-blue-50 transition-colors">Acknowledge New</button>
                    </div>
                </div>

                {/* ─── Column 2: Chat Area ───────────────────────────────────── */}
                <div className="flex-1 flex flex-col bg-[#f8fafc] min-w-0 hidden lg:flex">
                    {selectedLead ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-6 bg-white border-b border-slate-200/60 shadow-sm z-10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xl shadow-md ring-4 ring-slate-50">
                                        {getCustomerInitials(selectedLead)}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">{getCustomerName(selectedLead)}</h2>
                                        <div className="flex items-center gap-3 mt-1 text-sm font-medium text-slate-500">
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                {selectedLead.source}
                                            </span>
                                            {selectedLead.advertiserDealStatus && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span>AT Status: {selectedLead.advertiserDealStatus}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    </button>
                                    <button className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </button>
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {chatLoading ? (
                                    <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div></div>
                                ) : chatHistory.length === 0 ? (
                                    <div className="text-center py-20">
                                        <div className="inline-flex w-16 h-16 bg-white rounded-2xl items-center justify-center shadow-sm border border-slate-100 mb-4">
                                            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                        </div>
                                        <p className="text-slate-500 font-medium">No messages yet. Send a reply to start the conversation.</p>
                                    </div>
                                ) : (
                                    chatHistory.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.sender === 'dealer' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] flex flex-col ${msg.sender === 'dealer' ? 'items-end' : 'items-start'}`}>
                                                <div className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${msg.sender === 'dealer'
                                                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                                                        : 'bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-200/60'
                                                    }`}>
                                                    {msg.text}
                                                </div>
                                                <span className="text-[11px] font-semibold text-slate-400 mt-1.5 px-1 uppercase tracking-wider">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {msg.sender === 'dealer' ? 'You' : getCustomerName(selectedLead)}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Chat Input */}
                            {selectedLead?.source === 'AutoTrader' && ['Completed', 'Cancelled'].includes(selectedLead?.advertiserDealStatus || '') ? (
                                <div className="p-4 bg-slate-50 border-t border-slate-200/60 text-center text-sm text-slate-500">
                                    This deal is <span className="font-medium">{selectedLead.advertiserDealStatus}</span> — messaging is disabled.
                                </div>
                            ) : selectedLead?.source === 'AutoTrader' && !selectedLead?.messagesId ? (
                                <div className="p-4 bg-slate-50 border-t border-slate-200/60 text-center text-sm text-slate-500">
                                    Consumer has not started a conversation — messaging is unavailable for this enquiry.
                                </div>
                            ) : (
                            <div className="p-4 bg-white border-t border-slate-200/60 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] z-10">
                                <div className="border border-slate-200 rounded-xl bg-slate-50 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all flex items-end">
                                    <textarea
                                        className="flex-1 max-h-32 min-h-[52px] bg-transparent border-none p-4 text-sm resize-none outline-none text-slate-800 placeholder:text-slate-400"
                                        placeholder="Type a message... (Max 1500 chars)"
                                        value={newMessage}
                                        maxLength={1500}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendReply();
                                            }
                                        }}
                                    />
                                    <div className="p-2 shrink-0 flex items-center gap-2">
                                        <span className="text-xs font-medium text-slate-400 px-2">{newMessage.length}/1500</span>
                                        <button
                                            onClick={sendReply}
                                            disabled={!newMessage.trim()}
                                            className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-md hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none transition-all"
                                        >
                                            <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                            <div className="w-20 h-20 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">Select a conversation</h3>
                            <p className="max-w-xs text-sm">Choose a lead from the pipeline on the left to view the chat history and reply.</p>
                        </div>
                    )}
                </div>

                {/* ─── Column 3: Filters Sidebar ──────────────────────────────── */}
                <div className="w-[300px] border-l border-slate-200/60 bg-white p-6 shrink-0 overflow-y-auto hidden xl:flex xl:flex-col">
                    <h3 className="font-bold text-slate-800 tracking-tight mb-6">Filters</h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-2">Updated In</label>
                            <select
                                value={filterUpdatedIn}
                                onChange={e => setFilterUpdatedIn(e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                            >
                                <option>Last 7 Days</option>
                                <option>Last 30 Days</option>
                                <option>All Time</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-2">Type</label>
                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                            >
                                <option>All</option>
                                <option>Enquiry</option>
                                <option>Callback</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-2">Channel</label>
                            <select
                                value={filterChannel}
                                onChange={e => setFilterChannel(e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                            >
                                <option>All</option>
                                <option>AutoTrader</option>
                                <option>Website</option>
                                <option>Manual</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-2">Status</label>
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                            >
                                <option>All</option>
                                <option>New Lead</option>
                                <option>New Message</option>
                                <option>In Progress</option>
                                <option>Closed</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-2">Assigned To</label>
                            <select
                                value={filterAssignedTo}
                                onChange={e => setFilterAssignedTo(e.target.value)}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                            >
                                <option>All</option>
                                <option>Unassigned</option>
                                <option>Me</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Close Deal Modal */}
            {closeModalLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-[400px] p-6 animate-in fade-in zoom-in duration-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Close Deal</h2>
                        <p className="text-sm text-slate-500 mb-6">Please select the reason for closing this lead. This will be synced.</p>

                        <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Cancellation Reason</label>
                        <select
                            value={cancellationReason}
                            onChange={(e) => setCancellationReason(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-8 text-sm"
                        >
                            <option value="Different Vehicle">Different Vehicle</option>
                            <option value="Unaffordable">Unaffordable</option>
                            <option value="Not Interested">Not Interested</option>
                            <option value="Went Elsewhere">Went Elsewhere</option>
                            <option value="Not Available">Not Available</option>
                            <option value="Condition">Condition</option>
                            <option value="Poor Customer Service">Poor Customer Service</option>
                            <option value="Other">Other</option>
                        </select>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setCloseModalLead(null)}
                                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                                disabled={isClosingDeal}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitCloseDeal}
                                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center min-w-[100px]"
                                disabled={isClosingDeal}
                            >
                                {isClosingDeal ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Close Deal'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create New Lead Modal */}
            {showCreateLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-5 border-b border-slate-100">
                            <h2 className="text-[15px] font-bold text-slate-800">Create New Lead</h2>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            {/* Lead Type */}
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Lead Type</label>
                                <select
                                    value={createLeadForm.leadType}
                                    onChange={e => setCreateLeadForm(p => ({ ...p, leadType: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-blue-400"
                                >
                                    <option>Enquiry</option>
                                    <option>Callback</option>
                                    <option>Walk-in</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            {/* Name */}
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Name</label>
                                <input
                                    type="text"
                                    placeholder="Full name"
                                    value={createLeadForm.name}
                                    onChange={e => setCreateLeadForm(p => ({ ...p, name: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-blue-400"
                                />
                            </div>
                            {/* Email */}
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Email</label>
                                <input
                                    type="email"
                                    placeholder="email@example.com"
                                    value={createLeadForm.email}
                                    onChange={e => setCreateLeadForm(p => ({ ...p, email: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-blue-400"
                                />
                            </div>
                            {/* SMS + Phone */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">SMS</label>
                                    <input
                                        type="tel"
                                        placeholder="SMS number"
                                        value={createLeadForm.sms}
                                        onChange={e => setCreateLeadForm(p => ({ ...p, sms: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-blue-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Phone</label>
                                    <input
                                        type="tel"
                                        placeholder="Phone number"
                                        value={createLeadForm.phone}
                                        onChange={e => setCreateLeadForm(p => ({ ...p, phone: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-blue-400"
                                    />
                                </div>
                            </div>
                            {/* Preferred Method */}
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Preferred Method</label>
                                <select
                                    value={createLeadForm.preferredMethod}
                                    onChange={e => setCreateLeadForm(p => ({ ...p, preferredMethod: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-blue-400"
                                >
                                    <option>Email</option>
                                    <option>Email Template</option>
                                    <option>SMS</option>
                                </select>
                            </div>
                            {/* Marketing Consent */}
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Marketing Consent</label>
                                <div className="flex gap-2">
                                    {['No', 'Yes'].map(opt => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setCreateLeadForm(p => ({ ...p, marketingConsent: opt }))}
                                            className={`flex-1 py-2 text-[13px] font-semibold rounded-lg border transition-colors ${createLeadForm.marketingConsent === opt ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Avatar Color */}
                            <div>
                                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Avatar</label>
                                <div className="flex gap-2">
                                    {['#4D7CFF', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'].map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setCreateLeadForm(p => ({ ...p, avatarColor: color }))}
                                            style={{ backgroundColor: color }}
                                            className={`w-8 h-8 rounded-full transition-transform ${createLeadForm.avatarColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowCreateLead(false)}
                                disabled={isCreatingLead}
                                className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitCreateLead}
                                disabled={isCreatingLead}
                                className="px-5 py-2 text-[13px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center gap-2 min-w-[110px] justify-center"
                            >
                                {isCreatingLead ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Lead'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Acknowledge New Modal */}
            {showAcknowledgeNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-[400px] p-6 animate-in fade-in zoom-in duration-200">
                        <h2 className="text-[15px] font-bold text-slate-800 mb-3">Confirm Acknowledge</h2>
                        <p className="text-[13px] text-slate-500 mb-6">
                            Please confirm you would like to acknowledge all leads with a &lsquo;New Lead&rsquo; or &lsquo;New Message&rsquo; status?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowAcknowledgeNew(false)}
                                disabled={isAcknowledgingAll}
                                className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitAcknowledgeAll}
                                disabled={isAcknowledgingAll}
                                className="px-5 py-2 text-[13px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center gap-2 min-w-[160px] justify-center"
                            >
                                {isAcknowledgingAll ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm Acknowledge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}

export default function CRMPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center font-bold text-slate-400">Loading Pipeline...</div>}>
            <CRMContent />
        </Suspense>
    );
}
