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
    id?: string;
    dealId?: string;
    source: 'Local' | 'AutoTrader';
    status: string;
    advertiserDealStatus?: string;
    platform?: string;
    message?: string;
    createdAt?: string;
    created?: string;
    lastUpdated?: string;
    customerId?: Customer | string;
    customer?: { firstName?: string; lastName?: string; name?: string; email?: string; phone?: string };
    vehicleId?: any;
    vehicle?: { stockId?: string; searchId?: string };
    stock?: { stockId?: string; vrm?: string; make?: string; model?: string };
    intentScore?: number;
    intentLevel?: string;
    messagesId?: string;
    assignedTo?: string;
};

type ChatMessage = {
    sender: 'dealer' | 'customer';
    text: string;
    timestamp: string;
};

const QUICK_INSERTS = [
    "Thank you for your enquiry! I'll be in touch shortly.",
    "This vehicle is still available. Would you like to arrange a viewing?",
    "Could you let me know your availability for a test drive?",
    "Happy to answer any questions about the vehicle.",
    "We're open Mon–Sat 9am–6pm. Feel free to visit anytime.",
];

const AVATAR_PALETTE = ['#3eb6cd', '#6c757d', '#e67e22', '#9b59b6', '#e74c3c', '#1abc9c', '#3498db'];

function getAvatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function CRMContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'customers') router.replace('/app/contacts');
    }, [searchParams, router]);

    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [showFilter, setShowFilter] = useState(false);
    const [showQuickInsert, setShowQuickInsert] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [sendVia, setSendVia] = useState('Email Templ');
    const [includeThread, setIncludeThread] = useState(false);

    const [closeModalLead, setCloseModalLead] = useState<Lead | null>(null);
    const [cancellationReason, setCancellationReason] = useState('Different Vehicle');
    const [isClosingDeal, setIsClosingDeal] = useState(false);

    const [showCreateLead, setShowCreateLead] = useState(false);
    const [createLeadForm, setCreateLeadForm] = useState({ leadType: 'Enquiry', name: '', email: '', sms: '', phone: '', preferredMethod: 'Email', marketingConsent: 'No', avatarColor: '#3eb6cd' });
    const [isCreatingLead, setIsCreatingLead] = useState(false);

    const [showAcknowledgeNew, setShowAcknowledgeNew] = useState(false);
    const [isAcknowledgingAll, setIsAcknowledgingAll] = useState(false);

    const [isCreatingContact, setIsCreatingContact] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [appointmentType, setAppointmentType] = useState('Appointment');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('12:00');
    const [appointmentPurpose, setAppointmentPurpose] = useState('');
    const [appointmentReminder, setAppointmentReminder] = useState('Reminder');

    const [filterUpdatedIn, setFilterUpdatedIn] = useState('Last 7 Days');
    const [filterType, setFilterType] = useState('All');
    const [filterChannel, setFilterChannel] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterAssignedTo, setFilterAssignedTo] = useState('All');
    const [filterSearch, setFilterSearch] = useState('');

    useEffect(() => { fetchLeads(); }, []);

    useEffect(() => {
        let reconnectTimeout: NodeJS.Timeout;
        let eventSource: EventSource;
        const connect = () => {
            eventSource = new EventSource('/api/leads/stream');
            eventSource.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'connected') return;
                    if (data.event === 'WEBHOOK_UPDATE' && data.lead) {
                        toast.success(`Lead updated: ${data.lead.status.replace(/_/g, ' ')}`, { style: { borderRadius: '8px' } });
                        fetchLeads();
                    }
                } catch { /* ignore */ }
            };
            eventSource.onerror = () => { eventSource.close(); reconnectTimeout = setTimeout(connect, 3000); };
        };
        connect();
        return () => { clearTimeout(reconnectTimeout); if (eventSource) eventSource.close(); };
    }, []);

    useEffect(() => {
        if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const localRes = await fetch('/api/crm/leads');
            const localData = await localRes.json();
            let allLeads: Lead[] = [];
            if (localData.ok) {
                allLeads = localData.leads.map((l: any) => ({
                    ...l, source: l.platform || 'Local',
                    status: typeof l.status === 'object' ? (l.status.name || String(l.status)) : (l.status || 'NEW_LEAD'),
                }));
            }
            let page = 1, hasMore = true, allATDeals: any[] = [];
            while (hasMore) {
                try {
                    const r = await fetch(`/api/deals?page=${page}`);
                    const d = await r.json();
                    if (d.ok && d.deals) {
                        allATDeals = [...allATDeals, ...d.deals];
                        if (allATDeals.length >= d.totalResults || d.deals.length < 50) hasMore = false;
                        else page++;
                    } else hasMore = false;
                } catch { hasMore = false; }
            }
            if (allATDeals.length > 0) {
                const mapped = allATDeals.map((d: any) => {
                    let s: string;
                    switch (d.advertiserDealStatus) {
                        case 'In progress': case 'In Progress': s = 'IN_PROGRESS'; break;
                        case 'Completed': s = 'WON'; break;
                        case 'Cancelled': s = 'LOST'; break;
                        default: s = 'NEW_LEAD';
                    }
                    return { id: d.dealId, dealId: d.dealId, source: 'AutoTrader' as const, status: s, advertiserDealStatus: d.advertiserDealStatus, created: d.created, lastUpdated: d.lastUpdated, customer: d.consumer, stock: d.stock, intentScore: d.buyingSignals?.dealIntentScore, intentLevel: d.buyingSignals?.intent, messagesId: d.messages?.id ?? null };
                });
                const ids = new Set(mapped.map((d: any) => d.dealId));
                allLeads = [...allLeads.filter(l => !l.dealId || !ids.has(l.dealId)), ...mapped];
            }
            allLeads.sort((a, b) => new Date(b.lastUpdated || b.createdAt || b.created || 0).getTime() - new Date(a.lastUpdated || a.createdAt || a.created || 0).getTime());
            setLeads(allLeads);
        } catch { toast.error('Failed to sync pipeline.'); }
        finally { setLoading(false); }
    };

    const openChat = async (lead: Lead) => {
        setSelectedLead(lead);
        setChatHistory([]);
        if (lead.source === 'AutoTrader' && lead.messagesId) {
            setChatLoading(true);
            try {
                const res = await fetch(`/api/crm/chat/autotrader/${lead.messagesId}`);
                const data = await res.json();
                if (data.ok) {
                    setChatHistory(data.history || []);
                    fetch(`/api/crm/chat/autotrader/${lead.messagesId}`, { method: 'PATCH' }).catch(() => {});
                }
            } catch { toast.error('Failed to load chat history.'); }
            finally { setChatLoading(false); }
        } else if (lead.message) {
            setChatHistory([{ sender: 'customer', text: lead.message, timestamp: lead.createdAt || new Date().toISOString() }]);
        }
    };

    const sendReply = async () => {
        if (!newMessage.trim() || !selectedLead) return;
        if (selectedLead.source === 'AutoTrader') {
            try {
                const res = await fetch(`/api/crm/chat/autotrader/${selectedLead.messagesId || 'new'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: newMessage, dealId: selectedLead.dealId }) });
                const data = await res.json();
                if (data.ok) { setChatHistory(prev => [...prev, { sender: 'dealer', text: newMessage, timestamp: new Date().toISOString() }]); setNewMessage(''); toast.success('Message sent!'); }
                else toast.error(data.error || 'Failed to send.');
            } catch { toast.error('Connection error.'); }
        } else {
            setChatHistory(prev => [...prev, { sender: 'dealer', text: newMessage, timestamp: new Date().toISOString() }]);
            setNewMessage('');
            toast.success('Reply saved locally');
        }
    };

    const handleAcknowledge = async (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        try {
            await fetch('/api/crm/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead._id || lead.dealId, status: 'ACKNOWLEDGED' }) });
            toast.success('Lead acknowledged');
            setLeads(prev => prev.map(l => (l._id === lead._id || l.dealId === lead.dealId) ? { ...l, status: 'ACKNOWLEDGED' } : l));
        } catch { toast.error('Update failed'); }
    };

    const handleCloseDeal = (e: React.MouseEvent, lead: Lead) => { e.stopPropagation(); setCloseModalLead(lead); };

    const submitCloseDeal = async () => {
        if (!closeModalLead) return;
        setIsClosingDeal(true);
        try {
            if (closeModalLead.source === 'AutoTrader' && closeModalLead.dealId) {
                const res = await fetch(`/api/deals/${closeModalLead.dealId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ advertiserDealStatus: 'Cancelled', advertiserCancellationReason: cancellationReason }) });
                if (res.ok) { toast.success('Deal closed'); fetchLeads(); setCloseModalLead(null); }
            } else if (closeModalLead._id) {
                const res = await fetch('/api/crm/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: closeModalLead._id, status: 'CLOSED' }) });
                if (res.ok) { toast.success('Lead closed'); setLeads(prev => prev.map(l => l._id === closeModalLead._id ? { ...l, status: 'CLOSED' } : l)); setCloseModalLead(null); }
            }
        } catch { toast.error('Connection error'); }
        finally { setIsClosingDeal(false); }
    };

    const submitCreateLead = async () => {
        if (!createLeadForm.name.trim()) { toast.error('Name is required'); return; }
        setIsCreatingLead(true);
        try {
            const [firstName, ...rest] = createLeadForm.name.trim().split(' ');
            const res = await fetch('/api/crm/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerDetails: { firstName, lastName: rest.join(' ') || '', email: createLeadForm.email, phone: createLeadForm.phone || createLeadForm.sms }, type: createLeadForm.leadType, preferredMethod: createLeadForm.preferredMethod, marketingConsent: createLeadForm.marketingConsent === 'Yes', status: 'NEW_LEAD', platform: 'Manual' }) });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success('Lead created'); setShowCreateLead(false);
            setCreateLeadForm({ leadType: 'Enquiry', name: '', email: '', sms: '', phone: '', preferredMethod: 'Email', marketingConsent: 'No', avatarColor: '#3eb6cd' });
            fetchLeads();
        } catch (err: any) { toast.error(err.message || 'Failed'); }
        finally { setIsCreatingLead(false); }
    };

    const submitAcknowledgeAll = async () => {
        setIsAcknowledgingAll(true);
        try {
            const toAck = leads.filter(l => ['NEW_LEAD', 'NEW'].includes((l.status || '').toUpperCase()));
            await Promise.all(toAck.map(l => fetch('/api/crm/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l._id || l.dealId, status: 'ACKNOWLEDGED' }) })));
            toast.success(`${toAck.length} lead(s) acknowledged`); setShowAcknowledgeNew(false); fetchLeads();
        } catch { toast.error('Failed'); }
        finally { setIsAcknowledgingAll(false); }
    };

    const getStatusStr = (s: any) => !s ? '' : typeof s === 'object' ? (s.name || s.value || '') : String(s);

    const getStatusBadge = (status: any) => {
        const s = getStatusStr(status).toUpperCase();
        if (s === 'NEW_LEAD') return { label: 'New Lead', cls: 'bg-emerald-500 text-white' };
        if (s === 'ACKNOWLEDGED') return { label: 'Acknowledged', cls: 'bg-[#3eb6cd] text-white' };
        if (s === 'IN_PROGRESS') return { label: 'In Progress', cls: 'bg-blue-500 text-white' };
        if (s === 'WON') return { label: 'Won', cls: 'bg-green-600 text-white' };
        if (s === 'LOST' || s === 'CLOSED') return { label: s === 'LOST' ? 'Lost' : 'Closed', cls: 'bg-slate-300 text-slate-600' };
        return { label: s.replace(/_/g, ' '), cls: 'bg-slate-200 text-slate-600' };
    };

    const getTimeAgo = (d?: string) => {
        if (!d) return '';
        const ms = Date.now() - new Date(d).getTime();
        const m = Math.floor(ms / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m} minutes ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} hours ago`;
        const days = Math.floor(h / 24);
        if (days === 1) return 'Yesterday';
        return `${days} days ago`;
    };

    const getCustomerInitials = (lead: Lead) => {
        const c = lead.customerId as Customer;
        if (c?.firstName) return `${c.firstName[0]}${c.lastName?.[0] || ''}`.toUpperCase();
        if (lead.customer?.firstName) return `${lead.customer.firstName[0]}${lead.customer.lastName?.[0] || ''}`.toUpperCase();
        if (lead.customer?.name) return lead.customer.name.substring(0, 2).toUpperCase();
        return '?';
    };

    const getCustomerName = (lead: Lead) => {
        const c = lead.customerId as Customer;
        if (c?.firstName) return `${c.firstName} ${c.lastName || ''}`.trim();
        if (lead.customer?.firstName) return `${lead.customer.firstName} ${lead.customer.lastName || ''}`.trim();
        if (lead.customer?.name) return lead.customer.name;
        return 'Unknown Lead';
    };

    const getCustomerEmail = (lead: Lead) => {
        const c = lead.customerId as Customer;
        return c?.email || lead.customer?.email || '';
    };

    const filteredLeads = useMemo(() => leads.filter(l => {
        if (filterChannel !== 'All' && l.source !== filterChannel) return false;
        if (filterStatus !== 'All') {
            const s = (l.status || '').toUpperCase();
            if (filterStatus === 'New Lead' && s !== 'NEW_LEAD') return false;
            if (filterStatus === 'Acknowledged' && s !== 'ACKNOWLEDGED') return false;
            if (filterStatus === 'In Progress' && s !== 'IN_PROGRESS') return false;
            if (filterStatus === 'Won' && s !== 'WON') return false;
            if (filterStatus === 'Lost' && s !== 'LOST') return false;
            if (filterStatus === 'Closed' && s !== 'CLOSED') return false;
        }
        if (filterSearch) {
            const q = filterSearch.toLowerCase();
            const name = getCustomerName(l).toLowerCase();
            const email = getCustomerEmail(l).toLowerCase();
            if (!name.includes(q) && !email.includes(q)) return false;
        }
        if (filterUpdatedIn !== 'All Time') {
            const ts = new Date(l.lastUpdated || l.createdAt || l.created || 0).getTime();
            const now = Date.now();
            if (filterUpdatedIn === 'Last 7 Days' && now - ts > 7 * 86400000) return false;
            if (filterUpdatedIn === 'Last 30 Days' && now - ts > 30 * 86400000) return false;
        }
        return true;
    }), [leads, filterChannel, filterStatus, filterSearch, filterUpdatedIn]);

    const isClosed = selectedLead?.source === 'AutoTrader' && ['Completed', 'Cancelled'].includes(selectedLead?.advertiserDealStatus || '');
    const noMessages = selectedLead?.source === 'AutoTrader' && !selectedLead?.messagesId;
    const selectedBadge = selectedLead ? getStatusBadge(selectedLead.status) : null;
    const selectedName = selectedLead ? getCustomerName(selectedLead) : '';
    const selectedEmail = selectedLead ? getCustomerEmail(selectedLead) : '';
    const selectedInitials = selectedLead ? getCustomerInitials(selectedLead) : '';
    const selectedAvatarColor = selectedName !== 'Unknown Lead' && selectedName ? getAvatarColor(selectedName) : '#9ca3af';

    return (
        <div className="w-full h-[calc(100vh-60px)] bg-white flex flex-col font-sans -mt-8 pt-8 overflow-hidden">
            <div className="flex-1 flex overflow-hidden min-h-0">

                {/* ══ COL 1: Leads List ══ */}
                <div className="w-[240px] flex flex-col border-r border-slate-200 shrink-0 min-h-0 bg-white">
                    {/* Header */}
                    <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0">
                        <span className="font-bold text-slate-800 text-[14px]">Leads & Chat</span>
                        <button
                            onClick={() => setShowFilter(f => !f)}
                            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border transition-colors ${showFilter ? 'bg-[#3eb6cd] text-white border-[#3eb6cd]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                            Filter
                        </button>
                    </div>

                    {showFilter ? (
                        /* ── Filter Panel ── */
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {[
                                { label: 'Updated In', val: filterUpdatedIn, set: setFilterUpdatedIn, opts: ['Last 7 Days', 'Last 30 Days', 'All Time'] },
                                { label: 'Type', val: filterType, set: setFilterType, opts: ['All', 'Enquiry', 'Callback', 'Chat', 'Walk-in', 'Test Drive', 'Finance', 'Deal Builder', 'Guaranteed Part Exchange'] },
                                { label: 'Channel', val: filterChannel, set: setFilterChannel, opts: ['All', 'AutoTrader', 'Chat', 'Website', 'Email', 'SMS', 'Phone', 'WhatsApp', 'Facebook', 'Instagram', 'Manual'] },
                                { label: 'Status', val: filterStatus, set: setFilterStatus, opts: ['All', 'New Lead', 'Acknowledged', 'In Progress', 'Won', 'Lost', 'Closed'] },
                                { label: 'Assigned To', val: filterAssignedTo, set: setFilterAssignedTo, opts: ['All', 'Not Assigned', 'Me'] },
                            ].map(f => (
                                <div key={f.label}>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">{f.label}</label>
                                    <select value={f.val} onChange={e => f.set(e.target.value)} className="w-full text-[11px] border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-[#3eb6cd]">
                                        {f.opts.map(o => <option key={o}>{o}</option>)}
                                    </select>
                                </div>
                            ))}
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Tags</label>
                                <select className="w-full text-[11px] border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-[#3eb6cd]">
                                    <option>Nothing selected</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Name, Email or Phone</label>
                                <input type="text" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="w-full text-[11px] border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#3eb6cd]" />
                            </div>
                            <div className="flex items-center gap-1 pt-1 text-slate-400 text-[11px] justify-center">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            </div>
                        </div>
                    ) : (
                        /* ── Lead List ── */
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center p-8"><div className="w-6 h-6 border-4 border-slate-100 border-t-[#3eb6cd] rounded-full animate-spin" /></div>
                            ) : filteredLeads.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 text-[12px]">No leads found.</div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredLeads.map(lead => {
                                        const isSelected = selectedLead?.dealId === lead.dealId || (selectedLead?._id && selectedLead._id === lead._id);
                                        const name = getCustomerName(lead);
                                        const initials = getCustomerInitials(lead);
                                        const badge = getStatusBadge(lead.status);
                                        const avatarColor = name === 'Unknown Lead' ? '#9ca3af' : getAvatarColor(name);
                                        const isNew = (lead.status || '').toUpperCase().includes('NEW');

                                        return (
                                            <div
                                                key={lead._id || lead.dealId}
                                                onClick={() => openChat(lead)}
                                                className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer border-l-[3px] transition-colors ${isSelected ? 'bg-slate-50 border-[#3eb6cd]' : 'border-transparent hover:bg-slate-50/60'}`}
                                            >
                                                <div style={{ backgroundColor: avatarColor }} className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[12px] shrink-0 mt-0.5">
                                                    {initials}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-slate-800 text-[13px] truncate">{name === 'Unknown Lead' ? `Lead #${(lead._id || lead.dealId || '').slice(-3)}` : name}</div>
                                                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                        <span className="text-[10px] text-slate-400">{lead.platform || lead.source || 'Enquiry'}</span>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label.slice(0, 6)}{badge.label.length > 6 ? '...' : ''}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${isNew ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                        <span className="text-[10px] text-slate-400">{getTimeAgo(lead.lastUpdated || lead.createdAt || lead.created)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bottom */}
                    <div className="p-3 border-t border-slate-200 flex items-center gap-2 shrink-0">
                        <button onClick={() => setShowCreateLead(true)} className="flex-1 py-2 bg-[#3eb6cd] text-white text-[12px] font-bold rounded-lg hover:bg-[#37a3b8] transition-colors">
                            Create New Lead
                        </button>
                        <button title="Mute notifications" className="p-1.5 text-slate-400 hover:text-slate-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 14M12 6a7 7 0 000 14m0-14v14" /></svg>
                        </button>
                    </div>
                </div>

                {/* ══ COL 2: Chat / Enquiry ══ */}
                <div className="flex-1 flex flex-col border-r border-slate-200 min-w-0 min-h-0 bg-white">
                    {selectedLead ? (
                        <>
                            {/* Chat Header */}
                            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0">
                                <h2 className="text-[15px] font-bold text-slate-800">{selectedLead.platform || (selectedLead.source === 'AutoTrader' ? 'AutoTrader' : 'Enquiry')}</h2>
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-1.5 border border-[#3eb6cd] text-[#3eb6cd] text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-[#3eb6cd]/5 transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        {selectedLead.source === 'AutoTrader' ? 'Chat' : 'Email'}
                                    </button>
                                    {selectedBadge && (
                                        <button className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg ${selectedBadge.cls}`}>
                                            {selectedBadge.label}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Message Area */}
                            <div className="flex-1 overflow-y-auto min-h-0">
                                {chatLoading ? (
                                    <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-slate-200 border-t-[#3eb6cd] rounded-full animate-spin" /></div>
                                ) : chatHistory.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-10">
                                        <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mb-3">
                                            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                        </div>
                                        <p className="text-slate-400 text-[13px]">No messages yet.</p>
                                    </div>
                                ) : selectedLead.source === 'AutoTrader' ? (
                                    /* AutoTrader: chat bubble style */
                                    <>
                                        {chatHistory.map((msg, idx) => (
                                            <div key={idx} className={`flex p-4 gap-3 ${idx === 0 ? 'pt-5' : ''} ${msg.sender === 'dealer' ? 'justify-end' : 'justify-start'}`}>
                                                {msg.sender === 'customer' && (
                                                    <div style={{ backgroundColor: selectedAvatarColor }} className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0 mt-0.5">
                                                        {selectedInitials}
                                                    </div>
                                                )}
                                                <div className={`max-w-[75%] flex flex-col ${msg.sender === 'dealer' ? 'items-end' : 'items-start'}`}>
                                                    <div className={`px-4 py-3 text-[13px] leading-relaxed rounded-2xl border bg-white text-slate-800 border-slate-200 ${msg.sender === 'dealer' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                                                        {msg.text}
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {msg.sender === 'dealer' && <svg className="w-3 h-3 text-[#3eb6cd]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                                                        <span className="text-[10px] text-slate-400">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </>
                                ) : (
                                    /* Email / Local: show as formatted email body */
                                    <div className="p-5">
                                        {chatHistory.map((msg, idx) => (
                                            <div key={idx} className={`mb-5 ${msg.sender === 'dealer' ? 'pl-6 border-l-2 border-[#3eb6cd]/40' : ''}`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div style={{ backgroundColor: msg.sender === 'dealer' ? '#3eb6cd' : selectedAvatarColor }} className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                                                        {msg.sender === 'dealer' ? 'ME' : selectedInitials}
                                                    </div>
                                                    <span className="text-[11px] text-slate-400">{new Date(msg.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                </div>
                                                <div className="text-[13px] text-slate-800 leading-relaxed whitespace-pre-wrap pl-9">{msg.text}</div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Input — always at bottom */}
                            {isClosed ? (
                                <div className="p-3 border-t border-slate-200 text-center text-[12px] text-slate-400 bg-slate-50">
                                    Deal is {selectedLead.advertiserDealStatus} — messaging disabled.
                                </div>
                            ) : noMessages ? (
                                <div className="p-3 border-t border-slate-200 text-center text-[12px] text-slate-400 bg-slate-50">
                                    Consumer has not started a conversation.
                                </div>
                            ) : (
                                <div className="border-t border-slate-200 shrink-0">
                                    {/* Action row */}
                                    <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
                                        <select className="text-[11px] border border-slate-200 rounded px-2 py-1 bg-white text-slate-500 focus:outline-none">
                                            <option>Assign</option><option>Me</option>
                                        </select>
                                        <div className="flex items-center gap-1.5">
                                            <div className="relative">
                                                <button onClick={() => { setShowQuickInsert(v => !v); setShowActions(false); }} className="flex items-center gap-0.5 border border-slate-200 text-slate-500 text-[11px] font-semibold px-2.5 py-1 rounded hover:bg-slate-50">
                                                    Quick Insert <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </button>
                                                {showQuickInsert && (
                                                    <div className="absolute bottom-full right-0 mb-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-30">
                                                        {QUICK_INSERTS.map((t, i) => (
                                                            <button key={i} onClick={() => { setNewMessage(t); setShowQuickInsert(false); }} className="w-full text-left px-4 py-2.5 text-[12px] text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-0">{t}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <button onClick={() => { setShowActions(v => !v); setShowQuickInsert(false); }} className="flex items-center gap-0.5 border border-slate-200 text-slate-500 text-[11px] font-semibold px-2.5 py-1 rounded hover:bg-slate-50">
                                                    Actions <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </button>
                                                {showActions && (
                                                    <div className="absolute bottom-full right-0 mb-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30">
                                                        <button onClick={(e) => { handleAcknowledge(e, selectedLead!); setShowActions(false); }} className="w-full text-left px-4 py-2.5 text-[12px] text-slate-700 hover:bg-slate-50 border-b border-slate-50">Acknowledge</button>
                                                        <button onClick={(e) => { handleCloseDeal(e, selectedLead!); setShowActions(false); }} className="w-full text-left px-4 py-2.5 text-[12px] text-red-500 hover:bg-red-50">Close Lead</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Textarea */}
                                    <div className="px-3 pb-1">
                                        <textarea rows={4} value={newMessage} maxLength={1500} onChange={e => setNewMessage(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                                            placeholder="Type a message…"
                                            className="w-full border border-slate-200 rounded-lg p-3 text-[13px] resize-none outline-none text-slate-800 placeholder:text-slate-300 focus:border-[#3eb6cd] focus:ring-1 focus:ring-[#3eb6cd]/20"
                                        />
                                    </div>
                                    {/* Send row */}
                                    <div className="px-3 pb-3 flex items-center gap-2 flex-wrap">
                                        <button onClick={sendReply} disabled={!newMessage.trim()} className="px-4 py-1.5 bg-[#3eb6cd] text-white font-bold text-[13px] rounded-lg hover:bg-[#37a3b8] disabled:opacity-40 transition-colors">Send</button>
                                        <button title="Attach link" className="p-1.5 border border-slate-200 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                        </button>
                                        <span className="text-[11px] text-slate-400">via</span>
                                        <select value={sendVia} onChange={e => setSendVia(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-600 focus:outline-none focus:border-[#3eb6cd] bg-white">
                                            <option>Email Templ</option>
                                            <option>Chat</option>
                                            <option>SMS</option>
                                            <option>WhatsApp</option>
                                        </select>
                                        <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                                            <input type="checkbox" checked={includeThread} onChange={e => setIncludeThread(e.target.checked)} className="rounded border-slate-300 text-[#3eb6cd]" />
                                            Include Thread
                                        </label>
                                        <button className="ml-auto border border-slate-200 text-slate-600 text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">Preview</button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                            <div className="w-14 h-14 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mb-3">
                                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </div>
                            <h3 className="text-[14px] font-bold text-slate-700 mb-1">Select a conversation</h3>
                            <p className="text-[12px] text-slate-400">Choose a lead from the list to view messages.</p>
                        </div>
                    )}
                </div>

                {/* ══ COL 3: Visitor Panel ══ */}
                <div className="w-[280px] flex flex-col border-r border-slate-200 shrink-0 overflow-y-auto min-h-0 bg-white hidden lg:flex">
                    {selectedLead ? (
                        <>
                            {/* Visitor */}
                            <div className="p-4 border-b border-slate-200">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="font-bold text-slate-800 text-[14px]">Visitor</span>
                                    <button className="flex items-center gap-1 text-[11px] border border-slate-200 px-2 py-1 rounded text-slate-500 hover:bg-slate-50">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        Edit
                                    </button>
                                </div>
                                {/* Avatar centered */}
                                <div className="flex flex-col items-center mb-4">
                                    <div style={{ backgroundColor: selectedAvatarColor }} className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2">
                                        {selectedInitials}
                                    </div>
                                    <p className="font-semibold text-slate-800 text-[14px]">{selectedName === 'Unknown Lead' ? 'Name Unknown' : selectedName}</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{selectedLead.platform || selectedLead.source || 'Email'}</p>
                                </div>
                                <div className="space-y-2">
                                    {selectedEmail && (
                                        <div className="flex items-start gap-3 text-[12px]">
                                            <span className="text-slate-400 w-12 shrink-0 pt-px">Email:</span>
                                            <a href={`mailto:${selectedEmail}`} className="text-[#3eb6cd] hover:underline break-all leading-snug">{selectedEmail}</a>
                                        </div>
                                    )}
                                    {(() => { const c = selectedLead.customerId as Customer; const phone = c?.phone || selectedLead.customer?.phone; return phone ? (
                                        <div className="flex items-center gap-3 text-[12px]">
                                            <span className="text-slate-400 w-12 shrink-0">Phone:</span>
                                            <a href={`tel:${phone}`} className="text-[#3eb6cd] hover:underline">{phone}</a>
                                        </div>
                                    ) : null; })()}
                                    <div className="flex items-center gap-3 text-[12px]">
                                        <span className="text-slate-400 w-12 shrink-0">Source:</span>
                                        <span className="text-slate-700">{selectedLead.source}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Link Contact */}
                            <div className="p-4 border-b border-slate-200">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-bold text-slate-800 text-[14px]">Link Contact</span>
                                    <button className="flex items-center gap-1 text-[11px] border border-slate-200 px-2 py-1 rounded text-slate-500 hover:bg-slate-50">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        View
                                    </button>
                                </div>
                                {selectedEmail ? (
                                    /* Matched contact card */
                                    <div>
                                        <p className="text-[11px] text-slate-500 mb-3">The following contact profile matches this visitor's email address:</p>
                                        <div className="flex items-start gap-3 mb-4">
                                            <div style={{ backgroundColor: selectedAvatarColor }} className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[12px] shrink-0">
                                                {selectedInitials}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 text-[13px]">{selectedName === 'Unknown Lead' ? 'Name Unknown' : selectedName}</p>
                                                {selectedEmail && <p className="text-[11px] text-slate-400 mt-0.5 break-all">{selectedEmail}</p>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={async () => {
                                                setIsCreatingContact(true);
                                                try {
                                                    const [firstName, ...rest] = (selectedName === 'Unknown Lead' ? 'Unknown' : selectedName).split(' ');
                                                    const res = await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName, lastName: rest.join(' ') || '', email: selectedEmail, source: selectedLead.source, status: 'Active' }) });
                                                    const data = await res.json();
                                                    if (data.ok) toast.success('Contact linked!');
                                                    else toast.error(data.error || 'Failed');
                                                } catch { toast.error('Connection error'); }
                                                finally { setIsCreatingContact(false); }
                                            }} disabled={isCreatingContact} className="flex-1 py-2 bg-[#3eb6cd] text-white font-bold text-[12px] rounded-lg hover:bg-[#37a3b8] disabled:opacity-50 transition-colors flex items-center justify-center">
                                                {isCreatingContact ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Link Contact'}
                                            </button>
                                            <button className="flex-1 py-2 bg-slate-600 text-white font-bold text-[12px] rounded-lg hover:bg-slate-700 transition-colors">
                                                Ignore
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* No match — create new */
                                    <div className="text-center py-3">
                                        <p className="text-[12px] text-slate-500 mb-3">Would you like to create a customer profile for this visitor?</p>
                                        <button onClick={async () => {
                                            setIsCreatingContact(true);
                                            try {
                                                const [firstName, ...rest] = (selectedName === 'Unknown Lead' ? 'Unknown' : selectedName).split(' ');
                                                const res = await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName, lastName: rest.join(' ') || '', email: selectedEmail, source: selectedLead.source, status: 'Active' }) });
                                                const data = await res.json();
                                                if (data.ok) toast.success('Contact created!');
                                                else toast.error(data.error || 'Failed');
                                            } catch { toast.error('Connection error'); }
                                            finally { setIsCreatingContact(false); }
                                        }} disabled={isCreatingContact} className="w-full py-2 bg-[#3eb6cd] text-white font-bold text-[12px] rounded-lg hover:bg-[#37a3b8] disabled:opacity-50 transition-colors flex items-center justify-center">
                                            {isCreatingContact ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Contact'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Vehicles of Interest */}
                            <div className="p-4 border-b border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-slate-800 text-[14px]">Vehicles of Interest</span>
                                    <button className="flex items-center gap-1 text-[11px] border border-slate-200 px-2 py-1 rounded text-slate-500 hover:bg-slate-50">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        Edit
                                    </button>
                                </div>
                                {selectedLead.stock ? (
                                    <div className="text-[12px] text-slate-700">
                                        <p className="font-semibold">{selectedLead.stock.make} {selectedLead.stock.model}</p>
                                        {selectedLead.stock.vrm && <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">{selectedLead.stock.vrm}</span>}
                                    </div>
                                ) : (
                                    <p className="text-[12px] text-slate-400 italic">No vehicles.</p>
                                )}
                            </div>

                            {/* Tags */}
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-slate-800 text-[14px]">Tags</span>
                                    <button className="flex items-center gap-1 text-[11px] border border-slate-200 px-2 py-1 rounded text-slate-500 hover:bg-slate-50">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        Edit
                                    </button>
                                </div>
                                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-400 focus:outline-none focus:border-[#3eb6cd] bg-white">
                                    <option>Select Tags</option>
                                </select>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center p-6 text-center">
                            <p className="text-[12px] text-slate-300">Select a lead to view visitor details.</p>
                        </div>
                    )}
                </div>

                {/* ══ COL 4: Appointments + Notes ══ */}
                <div className="w-[240px] flex flex-col shrink-0 overflow-y-auto min-h-0 bg-white hidden xl:flex">
                    {/* Appointments */}
                    <div className="p-4 border-b border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-slate-800 text-[14px]">Appointments</span>
                            <select value={appointmentReminder} onChange={e => setAppointmentReminder(e.target.value)} className="text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none text-slate-500">
                                <option>Reminder</option>
                                <option>No Reminder</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Type</label>
                                <select value={appointmentType} onChange={e => setAppointmentType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:border-[#3eb6cd]">
                                    <option>Appointment</option>
                                    <option>Test Drive</option>
                                    <option>Viewing</option>
                                    <option>Callback</option>
                                </select>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-semibold text-slate-500">Calendar</label>
                                    <button className="text-[10px] text-[#3eb6cd] border border-[#3eb6cd]/30 px-1.5 py-0.5 rounded hover:bg-[#3eb6cd]/5 flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        Manage
                                    </button>
                                </div>
                                <select className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] bg-white focus:outline-none focus:border-[#3eb6cd]">
                                    <option>Primary Calendar</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Date & Time</label>
                                <div className="flex gap-1">
                                    <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-[#3eb6cd] min-w-0" />
                                    <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} className="w-[72px] border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-[#3eb6cd]" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Purpose</label>
                                <input type="text" value={appointmentPurpose} onChange={e => setAppointmentPurpose(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-[#3eb6cd]" />
                            </div>
                            <button className="flex items-center gap-1 text-[#3eb6cd] text-[11px] font-semibold hover:underline">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                Appointment Options
                            </button>
                            <button className="w-full py-2 bg-[#4D7CFF] text-white font-bold text-[12px] rounded-lg hover:bg-blue-600 transition-colors">
                                Add Appointment
                            </button>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="p-4 flex-1 flex flex-col">
                        <span className="font-bold text-slate-800 text-[14px] mb-3 block">Notes</span>
                        <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Add a note…"
                            className="flex-1 border border-slate-200 rounded-lg p-3 text-[12px] resize-none focus:outline-none focus:border-[#3eb6cd] text-slate-700 placeholder:text-slate-300 min-h-[80px]"
                        />
                        <button className="mt-2 w-full py-2 border border-slate-200 text-slate-600 font-semibold text-[12px] rounded-lg hover:bg-slate-50 transition-colors">
                            Add Note
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Close Deal Modal ── */}
            {closeModalLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-[400px] p-6">
                        <h2 className="text-[15px] font-bold text-slate-800 mb-2">Close Lead</h2>
                        <p className="text-[12px] text-slate-500 mb-5">Select a reason for closing this lead.</p>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Reason</label>
                        <select value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] mb-6 focus:outline-none">
                            {['Different Vehicle', 'Unaffordable', 'Not Interested', 'Went Elsewhere', 'Not Available', 'Condition', 'Poor Customer Service', 'Other'].map(r => <option key={r}>{r}</option>)}
                        </select>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setCloseModalLead(null)} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button onClick={submitCloseDeal} disabled={isClosingDeal} className="px-4 py-2 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg min-w-[90px] flex items-center justify-center">
                                {isClosingDeal ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Create New Lead Modal ── */}
            {showCreateLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-[460px] max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-[15px] font-bold text-slate-800">Create New Lead</h2>
                            <button onClick={() => setShowCreateLead(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            {[
                                { label: 'Lead Type', type: 'select', val: createLeadForm.leadType, key: 'leadType', opts: ['Enquiry', 'Callback', 'Walk-in', 'Chat', 'Test Drive', 'Other'] },
                            ].map(f => (
                                <div key={f.label}>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">{f.label}</label>
                                    <select value={f.val} onChange={e => setCreateLeadForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#3eb6cd]">
                                        {f.opts.map(o => <option key={o}>{o}</option>)}
                                    </select>
                                </div>
                            ))}
                            {[
                                { label: 'Name', key: 'name', type: 'text', ph: 'Full name' },
                                { label: 'Email', key: 'email', type: 'email', ph: 'email@example.com' },
                                { label: 'Phone', key: 'phone', type: 'tel', ph: 'Phone number' },
                                { label: 'SMS', key: 'sms', type: 'tel', ph: 'SMS number' },
                            ].map(f => (
                                <div key={f.label}>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">{f.label}</label>
                                    <input type={f.type} placeholder={f.ph} value={(createLeadForm as any)[f.key]} onChange={e => setCreateLeadForm(p => ({ ...p, [f.key]: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#3eb6cd]" />
                                </div>
                            ))}
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Preferred Method</label>
                                <select value={createLeadForm.preferredMethod} onChange={e => setCreateLeadForm(p => ({ ...p, preferredMethod: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#3eb6cd]">
                                    <option>Email</option><option>Phone</option><option>SMS</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Marketing Consent</label>
                                <div className="flex gap-2">
                                    {['No', 'Yes'].map(o => <button key={o} type="button" onClick={() => setCreateLeadForm(p => ({ ...p, marketingConsent: o }))} className={`flex-1 py-2 text-[12px] font-semibold rounded-lg border transition-colors ${createLeadForm.marketingConsent === o ? 'bg-[#3eb6cd] text-white border-[#3eb6cd]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{o}</button>)}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                            <button onClick={() => setShowCreateLead(false)} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button onClick={submitCreateLead} disabled={isCreatingLead} className="px-5 py-2 text-[13px] font-semibold text-white bg-[#3eb6cd] hover:bg-[#37a3b8] rounded-lg min-w-[110px] flex items-center justify-center">
                                {isCreatingLead ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Lead'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Acknowledge New Modal ── */}
            {showAcknowledgeNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-[380px] p-6">
                        <h2 className="text-[15px] font-bold text-slate-800 mb-2">Confirm Acknowledge</h2>
                        <p className="text-[13px] text-slate-500 mb-6">Acknowledge all leads with a &lsquo;New Lead&rsquo; status?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAcknowledgeNew(false)} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button onClick={submitAcknowledgeAll} disabled={isAcknowledgingAll} className="px-5 py-2 text-[13px] font-semibold text-white bg-[#3eb6cd] rounded-lg min-w-[150px] flex items-center justify-center">
                                {isAcknowledgingAll ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm Acknowledge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
            `}</style>
        </div>
    );
}

export default function CRMPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center text-slate-400 font-semibold">Loading…</div>}>
            <CRMContent />
        </Suspense>
    );
}
