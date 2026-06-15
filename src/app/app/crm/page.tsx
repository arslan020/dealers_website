'use client';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
    price?: { suppliedPrice?: { amountGBP: number }; totalPrice?: { amountGBP: number } };
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

function EditIcon() {
    return (
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
    );
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

    const [showMediaModal, setShowMediaModal] = useState(false);
    const [vehicleImages, setVehicleImages] = useState<string[]>([]);
    const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
    const [loadingMedia, setLoadingMedia] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [showQuickInsert, setShowQuickInsert] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [sendVia, setSendVia] = useState('Email Templ');

    const [closeModalLead, setCloseModalLead] = useState<Lead | null>(null);
    const [cancellationReason, setCancellationReason] = useState('Different Vehicle');
    const [isClosingDeal, setIsClosingDeal] = useState(false);

    const [showCreateLead, setShowCreateLead] = useState(false);
    const [createLeadForm, setCreateLeadForm] = useState({ leadType: 'Enquiry', name: '', email: '', sms: '', phone: '', preferredMethod: 'Email', marketingConsent: 'No' });
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
                    return {
                        id: d.dealId, dealId: d.dealId, source: 'AutoTrader' as const,
                        status: s, advertiserDealStatus: d.advertiserDealStatus,
                        created: d.created, lastUpdated: d.lastUpdated,
                        customer: d.consumer, stock: d.stock, price: d.price,
                        intentScore: d.buyingSignals?.dealIntentScore,
                        intentLevel: d.buyingSignals?.intent,
                        messagesId: d.messages?.id ?? null,
                    };
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
                    fetch(`/api/crm/chat/autotrader/${lead.messagesId}`, { method: 'PATCH' }).catch(() => { });
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
                const res = await fetch(`/api/crm/chat/autotrader/${selectedLead.messagesId || 'new'}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: newMessage, dealId: selectedLead.dealId }),
                });
                const data = await res.json();
                if (data.ok) {
                    setChatHistory(prev => [...prev, { sender: 'dealer', text: newMessage, timestamp: new Date().toISOString() }]);
                    setNewMessage('');
                    toast.success('Message sent!');
                } else toast.error(data.error || 'Failed to send.');
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

    const handleSendLink = async () => {
        if (!selectedLead?.stock?.stockId) return;
        try {
            const res = await fetch(`/api/vehicles/${selectedLead.stock.stockId}`);
            const data = await res.json();
            const v = data.vehicle;
            let url = '';
            if (selectedLead.stock.vrm && v?.make && v?.model) {
                url = `https://www.autotrader.co.uk/car-details/${selectedLead.stock.stockId}`;
            } else if (selectedLead.stock.stockId) {
                url = `https://www.autotrader.co.uk/car-details/${selectedLead.stock.stockId}`;
            }
            const make = v?.make || selectedLead.stock.make || '';
            const model = v?.model || selectedLead.stock.model || '';
            const vrm = selectedLead.stock.vrm || '';
            const desc = [make, model, vrm].filter(Boolean).join(' ');
            setNewMessage(`To view this vehicle${desc ? ` (${desc})` : ''} on AutoTrader, please visit: ${url}`);
        } catch {
            toast.error('Could not fetch vehicle link.');
        }
    };

    const handleOpenMedia = async () => {
        if (!selectedLead?.stock?.stockId) return;
        setLoadingMedia(true);
        setShowMediaModal(true);
        setSelectedImages(new Set());
        try {
            const res = await fetch(`/api/vehicles/${selectedLead.stock.stockId}`);
            const data = await res.json();
            const imgs: string[] = data.vehicle?.images || [];
            setVehicleImages(imgs);
        } catch {
            toast.error('Could not load vehicle images.');
        } finally {
            setLoadingMedia(false);
        }
    };

    const handleSendMedia = () => {
        const urls = [...selectedImages].map(i => vehicleImages[i]).filter(Boolean);
        if (urls.length === 0) { toast.error('Select at least one image.'); return; }
        setNewMessage(urls.join('\n'));
        setShowMediaModal(false);
        setSelectedImages(new Set());
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
            setCreateLeadForm({ leadType: 'Enquiry', name: '', email: '', sms: '', phone: '', preferredMethod: 'Email', marketingConsent: 'No' });
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

    const getStatusBadge = (status: any) => {
        const s = (!status ? '' : typeof status === 'object' ? (status.name || status.value || '') : String(status)).toUpperCase();
        if (s === 'NEW_LEAD') return { label: 'New Message', cls: 'bg-emerald-500 text-white' };
        if (s === 'ACKNOWLEDGED') return { label: 'Acknowledged', cls: 'bg-[#3eb6cd] text-white' };
        if (s === 'IN_PROGRESS') return { label: 'In Progress', cls: 'bg-blue-500 text-white' };
        if (s === 'WON') return { label: 'Won', cls: 'bg-green-600 text-white' };
        if (s === 'LOST') return { label: 'Lost', cls: 'bg-slate-300 text-slate-600' };
        if (s === 'CLOSED') return { label: 'Closed', cls: 'bg-slate-300 text-slate-600' };
        return { label: s.replace(/_/g, ' ') || 'Enquiry', cls: 'bg-slate-200 text-slate-600' };
    };

    const getTimeAgo = (d?: string) => {
        if (!d) return '';
        const ms = Date.now() - new Date(d).getTime();
        const m = Math.floor(ms / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m} minutes ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
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

    const getCustomerPhone = (lead: Lead) => {
        const c = lead.customerId as Customer;
        return c?.phone || lead.customer?.phone || '';
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
            if (!getCustomerName(l).toLowerCase().includes(q) && !getCustomerEmail(l).toLowerCase().includes(q)) return false;
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
    const selectedName = selectedLead ? getCustomerName(selectedLead) : '';
    const selectedEmail = selectedLead ? getCustomerEmail(selectedLead) : '';
    const selectedPhone = selectedLead ? getCustomerPhone(selectedLead) : '';
    const selectedInitials = selectedLead ? getCustomerInitials(selectedLead) : '';
    const selectedAvatarColor = selectedName && selectedName !== 'Unknown Lead' ? getAvatarColor(selectedName) : '#9ca3af';

    const filterControls = [
        { label: 'Updated In', val: filterUpdatedIn, set: setFilterUpdatedIn, opts: ['Last 7 Days', 'Last 30 Days', 'All Time'] },
        { label: 'Type', val: filterType, set: setFilterType, opts: ['All', 'Enquiry', 'Callback', 'Chat', 'Walk-in', 'Test Drive', 'Finance', 'Deal Builder'] },
        { label: 'Channel', val: filterChannel, set: setFilterChannel, opts: ['All', 'AutoTrader', 'Chat', 'Website', 'Email', 'SMS', 'Phone', 'WhatsApp', 'Facebook', 'Manual'] },
        { label: 'Status', val: filterStatus, set: setFilterStatus, opts: ['All', 'New Lead', 'Acknowledged', 'In Progress', 'Won', 'Lost', 'Closed'] },
        { label: 'Assigned To', val: filterAssignedTo, set: setFilterAssignedTo, opts: ['All', 'Not Assigned', 'Me'] },
    ];

    // ── Shared: Narrow lead list rows (used in lead-selected state) ──────────────
    const NarrowLeadList = () => (
        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100">
            {loading ? (
                <div className="flex justify-center p-6"><div className="w-5 h-5 border-4 border-slate-100 border-t-[#3eb6cd] rounded-full animate-spin" /></div>
            ) : filteredLeads.map((lead, idx) => {
                const isSelected = selectedLead?.dealId === lead.dealId || (selectedLead?._id && selectedLead._id === lead._id);
                const name = getCustomerName(lead);
                const initials = getCustomerInitials(lead);
                const badge = getStatusBadge(lead.status);
                const avatarColor = name === 'Unknown Lead' ? '#9ca3af' : getAvatarColor(name);
                const isNew = (lead.status || '').toUpperCase().includes('NEW');
                return (
                    <div
                        key={lead._id || lead.dealId || idx}
                        onClick={() => openChat(lead)}
                        className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer border-l-[3px] transition-colors ${isSelected ? 'bg-slate-50 border-[#3eb6cd]' : 'border-transparent hover:bg-slate-50/60'}`}
                    >
                        <div style={{ backgroundColor: avatarColor }} className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0 mt-0.5">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 text-[12px] truncate">{name === 'Unknown Lead' ? `Lead #${(lead._id || lead.dealId || '').slice(-3)}` : name}</p>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                <span className="text-[9px] text-slate-400">{lead.platform || lead.source}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>
                                    {badge.label.length > 5 ? badge.label.slice(0, 5) + '...' : badge.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isNew ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <span className="text-[9px] text-slate-400">{getTimeAgo(lead.lastUpdated || lead.createdAt || lead.created)}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="w-full h-[calc(100vh-60px)] bg-white flex flex-col font-sans -mt-8 pt-8 overflow-hidden">
            <div className="flex-1 flex overflow-hidden min-h-0">

                {!selectedLead ? (
                    // ══ NO LEAD SELECTED: Wide list + Filters sidebar ══════════════════
                    <>
                        {/* Wide Leads List */}
                        <div className="flex-1 flex flex-col min-h-0 border-r border-slate-200">
                            {/* Header */}
                            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                                <span className="font-bold text-slate-800 text-[16px]">Leads & Chat</span>
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-1.5 border border-slate-200 px-3 py-1.5 rounded-lg text-[12px] text-slate-500 hover:bg-slate-50 font-semibold">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" /></svg>
                                        Help
                                    </button>
                                    <button className="flex items-center gap-1.5 border border-slate-200 px-3 py-1.5 rounded-lg text-[12px] text-slate-500 hover:bg-slate-50 font-semibold">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeWidth="2" /></svg>
                                        Settings
                                    </button>
                                </div>
                            </div>

                            {/* Lead Rows */}
                            <div className="flex-1 overflow-y-auto min-h-0">
                                {loading ? (
                                    <div className="flex justify-center items-center h-32">
                                        <div className="w-6 h-6 border-4 border-slate-100 border-t-[#3eb6cd] rounded-full animate-spin" />
                                    </div>
                                ) : filteredLeads.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                        <p className="text-[13px]">No leads found</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {filteredLeads.map((lead, idx) => {
                                            const name = getCustomerName(lead);
                                            const initials = getCustomerInitials(lead);
                                            const badge = getStatusBadge(lead.status);
                                            const avatarColor = name === 'Unknown Lead' ? '#9ca3af' : getAvatarColor(name);
                                            const isNew = (lead.status || '').toUpperCase().includes('NEW');
                                            const displayName = name === 'Unknown Lead' ? `Lead #${(lead._id || lead.dealId || '').slice(-3)}` : name;
                                            const leadType = lead.advertiserDealStatus ? 'Enquiry' : (lead.platform || lead.source || 'Enquiry');

                                            return (
                                                <div
                                                    key={lead._id || lead.dealId || idx}
                                                    onClick={() => openChat(lead)}
                                                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer group"
                                                >
                                                    {/* Avatar */}
                                                    <div style={{ backgroundColor: avatarColor }} className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[13px] shrink-0">
                                                        {initials}
                                                    </div>
                                                    {/* Name + Type */}
                                                    <div className="w-40 shrink-0">
                                                        <p className="text-[13px] font-semibold text-slate-800 truncate">{displayName}</p>
                                                        <p className="text-[11px] text-slate-400">{leadType}</p>
                                                    </div>
                                                    {/* Status Badge */}
                                                    <div className="w-32 shrink-0">
                                                        <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold ${badge.cls}`}>
                                                            {badge.label}
                                                        </span>
                                                    </div>
                                                    {/* Dot + Time */}
                                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${isNew ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                        <span className="text-[12px] text-slate-500 truncate">{getTimeAgo(lead.lastUpdated || lead.createdAt || lead.created)}</span>
                                                    </div>
                                                    {/* Assign */}
                                                    <select
                                                        onClick={e => e.stopPropagation()}
                                                        className="border border-slate-200 rounded px-2 py-1.5 text-[11px] text-slate-500 bg-white focus:outline-none shrink-0"
                                                    >
                                                        <option>Assign</option>
                                                        <option>Me</option>
                                                    </select>
                                                    {/* Acknowledge (new leads only) */}
                                                    {isNew && (
                                                        <button
                                                            onClick={e => handleAcknowledge(e, lead)}
                                                            className="border border-slate-200 px-3 py-1.5 rounded text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                                                        >
                                                            Acknowledge
                                                        </button>
                                                    )}
                                                    {/* Close */}
                                                    <button
                                                        onClick={e => handleCloseDeal(e, lead)}
                                                        className="border border-slate-200 px-3 py-1.5 rounded text-[11px] font-semibold text-slate-600 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors shrink-0"
                                                    >
                                                        Close
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Bottom bar */}
                            <div className="px-5 py-3 border-t border-slate-200 flex items-center gap-3 shrink-0">
                                <button onClick={() => setShowCreateLead(true)} className="px-5 py-2 bg-[#3eb6cd] text-white text-[13px] font-bold rounded-lg hover:bg-[#37a3b8] transition-colors">
                                    Create New Lead
                                </button>
                                <button onClick={() => setShowAcknowledgeNew(true)} className="px-5 py-2 border border-slate-300 text-slate-600 text-[13px] font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                                    Acknowledge New
                                </button>
                                <button className="ml-auto text-slate-400 hover:text-slate-600 p-1">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 14M12 6a7 7 0 000 14m0-14v14" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Filters Sidebar */}
                        <div className="w-[280px] border-l border-slate-200 flex flex-col shrink-0">
                            <div className="px-5 py-3 border-b border-slate-200 shrink-0">
                                <span className="font-bold text-slate-800 text-[16px]">Filters</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {filterControls.map(f => (
                                    <div key={f.label}>
                                        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">{f.label}</label>
                                        <select value={f.val} onChange={e => f.set(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-700 bg-white focus:outline-none focus:border-[#3eb6cd] appearance-none">
                                            {f.opts.map(o => <option key={o}>{o}</option>)}
                                        </select>
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Tags</label>
                                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-400 bg-white focus:outline-none focus:border-[#3eb6cd] appearance-none">
                                        <option>Nothing selected</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Name, Email or Phone</label>
                                    <input type="text" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-[#3eb6cd]" />
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    // ══ LEAD SELECTED: 4-column layout ═══════════════════════════════
                    <>
                        {/* COL 1: Narrow list */}
                        <div className="w-[220px] flex flex-col border-r border-slate-200 shrink-0 min-h-0 bg-white">
                            <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0">
                                <span className="font-bold text-slate-800 text-[14px]">Leads & Chat</span>
                                <button onClick={() => setSelectedLead(null)} className="flex items-center gap-1 border border-slate-200 px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-50">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                                    Filter
                                </button>
                            </div>
                            <NarrowLeadList />
                            <div className="p-3 border-t border-slate-200 shrink-0">
                                <button onClick={() => setShowCreateLead(true)} className="w-full py-2 bg-[#3eb6cd] text-white text-[12px] font-bold rounded-lg hover:bg-[#37a3b8]">
                                    Create New Lead
                                </button>
                            </div>
                        </div>

                        {/* COL 2: Chat / Enquiry */}
                        <div className="flex-1 flex flex-col border-r border-slate-200 min-w-0 min-h-0 bg-white">
                            {/* Header */}
                            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0">
                                <h2 className="text-[15px] font-bold text-slate-800">Enquiry</h2>
                                <div className="flex items-center gap-2">
                                    {selectedLead.source === 'AutoTrader' && (
                                        <span className="flex items-center gap-1.5 bg-[#3eb6cd]/10 text-[#3eb6cd] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#3eb6cd]/20">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                                            AutoTrader
                                        </span>
                                    )}
                                    <button className="flex items-center gap-1.5 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                        New Message
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto min-h-0 p-4">
                                {chatLoading ? (
                                    <div className="flex justify-center py-10">
                                        <div className="w-6 h-6 border-4 border-slate-200 border-t-[#3eb6cd] rounded-full animate-spin" />
                                    </div>
                                ) : chatHistory.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mb-3">
                                            <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                        </div>
                                        <p className="text-slate-400 text-[13px]">No messages yet.</p>
                                        {noMessages && <p className="text-slate-300 text-[11px] mt-1">Consumer has not started a conversation.</p>}
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-w-2xl">
                                        {chatHistory.map((msg, idx) => (
                                            <div key={idx} className={`border rounded-xl overflow-hidden ${msg.sender === 'dealer' ? 'border-[#3eb6cd]/30' : 'border-slate-200'}`}>
                                                <div className={`px-4 py-2 flex items-center justify-between border-b ${msg.sender === 'dealer' ? 'bg-[#3eb6cd]/5 border-[#3eb6cd]/20' : 'bg-slate-50 border-slate-100'}`}>
                                                    <div className="flex items-center gap-2">
                                                        <div style={{ backgroundColor: msg.sender === 'dealer' ? '#3eb6cd' : selectedAvatarColor }} className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[8px] shrink-0">
                                                            {msg.sender === 'dealer' ? 'ME' : selectedInitials}
                                                        </div>
                                                        <span className="text-[12px] font-semibold text-slate-700">{msg.sender === 'dealer' ? 'You' : selectedName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <span className="text-[11px]">{getTimeAgo(msg.timestamp)}</span>
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                    </div>
                                                </div>
                                                <div className="px-4 py-3">
                                                    <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Reply area */}
                            {isClosed ? (
                                <div className="p-3 border-t border-slate-200 text-center text-[12px] text-slate-400 bg-slate-50 shrink-0">
                                    Deal is {selectedLead.advertiserDealStatus} — messaging disabled.
                                </div>
                            ) : (
                                <div className="border-t border-slate-200 shrink-0">
                                    <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between">
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
                                                        <button onClick={e => { handleAcknowledge(e, selectedLead!); setShowActions(false); }} className="w-full text-left px-4 py-2.5 text-[12px] text-slate-700 hover:bg-slate-50 border-b border-slate-50">Acknowledge</button>
                                                        <button onClick={e => { handleCloseDeal(e, selectedLead!); setShowActions(false); }} className="w-full text-left px-4 py-2.5 text-[12px] text-red-500 hover:bg-red-50">Close Lead</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-4 pb-1">
                                        <textarea
                                            rows={4} value={newMessage} maxLength={1500}
                                            onChange={e => setNewMessage(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                                            placeholder="Type a message…"
                                            className="w-full border border-slate-200 rounded-lg p-3 text-[13px] resize-none outline-none text-slate-800 placeholder:text-slate-300 focus:border-[#3eb6cd] focus:ring-1 focus:ring-[#3eb6cd]/20"
                                        />
                                    </div>
                                    <div className="px-4 pb-3 flex items-center gap-2">
                                        <button onClick={sendReply} disabled={!newMessage.trim()} className="px-4 py-1.5 bg-[#3eb6cd] text-white font-bold text-[13px] rounded-lg hover:bg-[#37a3b8] disabled:opacity-40 transition-colors">Send</button>
                                        <button className="p-1.5 border border-slate-200 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                        </button>
                                        <span className="text-[11px] text-slate-400">via</span>
                                        <select value={sendVia} onChange={e => setSendVia(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-600 focus:outline-none focus:border-[#3eb6cd] bg-white">
                                            <option>Email Templ</option>
                                            <option>Chat</option>
                                            <option>SMS</option>
                                        </select>
                                        <button className="ml-auto border border-slate-200 text-slate-600 text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">Preview</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* COL 3: Visitor panel */}
                        <div className="w-[240px] flex flex-col border-r border-slate-200 shrink-0 overflow-y-auto min-h-0 bg-white hidden lg:flex">
                            {/* Visitor */}
                            <div className="p-4 border-b border-slate-200">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-bold text-slate-800 text-[13px]">Visitor</span>
                                    <button className="flex items-center gap-1 text-[10px] border border-slate-200 px-2 py-1 rounded text-slate-500 hover:bg-slate-50"><EditIcon /> Edit</button>
                                </div>
                                <div className="flex flex-col items-center mb-4">
                                    <div style={{ backgroundColor: selectedAvatarColor }} className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2">
                                        {selectedInitials}
                                    </div>
                                    <p className="font-semibold text-slate-800 text-[13px] text-center">{selectedName}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 text-center">
                                        {[selectedEmail && 'Email', selectedPhone && 'SMS', selectedPhone && 'Phone', selectedLead.source === 'AutoTrader' && 'AutoTrader'].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <span className="text-slate-400 w-20 shrink-0">Customer:</span>
                                        <button
                                            onClick={async () => {
                                                setIsCreatingContact(true);
                                                try {
                                                    const [fn, ...rest] = (selectedName === 'Unknown Lead' ? 'Unknown' : selectedName).split(' ');
                                                    const res = await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: fn, lastName: rest.join(' ') || '', email: selectedEmail, source: selectedLead.source, status: 'Active' }) });
                                                    const d = await res.json();
                                                    if (d.ok) toast.success('Contact saved!'); else toast.error(d.error || 'Failed');
                                                } catch { toast.error('Connection error'); }
                                                finally { setIsCreatingContact(false); }
                                            }}
                                            disabled={isCreatingContact}
                                            className="text-[#3eb6cd] hover:underline font-semibold disabled:opacity-50"
                                        >
                                            {isCreatingContact ? 'Saving…' : 'View Profile'}
                                        </button>
                                    </div>
                                    {selectedEmail && (
                                        <div className="flex items-start gap-2 text-[11px]">
                                            <span className="text-slate-400 w-20 shrink-0">Email:</span>
                                            <a href={`mailto:${selectedEmail}`} className="text-[#3eb6cd] hover:underline break-all leading-snug">{selectedEmail}</a>
                                        </div>
                                    )}
                                    {selectedPhone && (
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <span className="text-slate-400 w-20 shrink-0">SMS:</span>
                                            <a href={`tel:${selectedPhone}`} className="text-[#3eb6cd] hover:underline">{selectedPhone}</a>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <span className="text-slate-400 w-20 shrink-0">Preferred:</span>
                                        <span className="text-slate-700">Email</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <span className="text-slate-400 w-20 shrink-0">Source:</span>
                                        <span className="text-slate-700">{selectedLead.source}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Vehicles of Interest */}
                            <div className="p-4 border-b border-slate-200">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-bold text-slate-800 text-[13px]">Vehicles of Interest</span>
                                    <button className="flex items-center gap-1 text-[10px] border border-slate-200 px-2 py-1 rounded text-slate-500 hover:bg-slate-50"><EditIcon /> Edit</button>
                                </div>
                                {selectedLead.stock ? (
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                                {selectedLead.stock.vrm || 'No VRM'}
                                            </span>
                                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">For Sale</span>
                                        </div>
                                        <p className="text-[12px] font-semibold text-slate-700 mb-0.5">
                                            {selectedLead.stock.make || ''} {selectedLead.stock.model || ''}
                                        </p>
                                        {selectedLead.price && (
                                            <p className="text-[12px] font-bold text-[#3eb6cd] mb-2">
                                                £{(selectedLead.price.totalPrice?.amountGBP || selectedLead.price.suppliedPrice?.amountGBP || 0).toLocaleString()}
                                            </p>
                                        )}
                                        <div className="flex gap-1 mb-1 flex-wrap">
                                            <Link href={`/app/vehicles/${selectedLead.stock.stockId}`} className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded hover:bg-slate-50 text-slate-600">View</Link>
                                            <button onClick={handleSendLink} className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded hover:bg-slate-50 text-slate-600">Send Link</button>
                                            <button onClick={handleOpenMedia} className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded hover:bg-slate-50 text-slate-600">Media</button>
                                        </div>
                                        <div className="flex gap-1 flex-wrap">
                                            <Link href={`/app/sales/orders/create?stockId=${selectedLead.stock.stockId}`} className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded hover:bg-slate-50 text-slate-600">Create Order</Link>
                                            <Link href={`/app/vehicles/${selectedLead.stock.stockId}`} className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded hover:bg-slate-50 text-slate-600">Sell Vehicle</Link>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[12px] text-slate-400 italic">No vehicles</p>
                                )}
                            </div>

                            {/* Deals (AT leads only) */}
                            {selectedLead.dealId && (
                                <div className="p-4 border-b border-slate-200">
                                    <span className="font-bold text-slate-800 text-[13px] block mb-2">Deals</span>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <Link href={`/app/deals/${selectedLead.dealId}`} className="text-[12px] font-bold text-[#3eb6cd] hover:underline">
                                                #{selectedLead.dealId.slice(-6).toUpperCase()}
                                            </Link>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{selectedLead.source}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] font-semibold text-slate-600">{selectedLead.advertiserDealStatus || 'Begin'}</p>
                                            <p className="text-[10px] text-slate-400">{getTimeAgo(selectedLead.lastUpdated || selectedLead.created)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tags */}
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-slate-800 text-[13px]">Tags</span>
                                    <button className="flex items-center gap-1 text-[10px] border border-slate-200 px-2 py-1 rounded text-slate-500 hover:bg-slate-50"><EditIcon /> Edit</button>
                                </div>
                                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-400 focus:outline-none focus:border-[#3eb6cd] bg-white">
                                    <option>Select Tags</option>
                                </select>
                            </div>
                        </div>

                        {/* COL 4: Appointments + Notes */}
                        <div className="w-[220px] flex flex-col shrink-0 overflow-y-auto min-h-0 bg-white hidden xl:flex">
                            <div className="p-4 border-b border-slate-200">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-bold text-slate-800 text-[13px]">Appointments</span>
                                    <select value={appointmentReminder} onChange={e => setAppointmentReminder(e.target.value)} className="text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none text-slate-500">
                                        <option>Reminder</option>
                                        <option>No Reminder</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Booking Type</label>
                                        <select value={appointmentType} onChange={e => setAppointmentType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-[12px] bg-white focus:outline-none focus:border-[#3eb6cd]">
                                            <option>Appointment</option>
                                            <option>Test Drive</option>
                                            <option>Viewing</option>
                                            <option>Callback</option>
                                            <option>Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[10px] font-semibold text-slate-500">Calendar</label>
                                            <button className="text-[10px] text-[#3eb6cd] flex items-center gap-0.5 hover:underline">
                                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                Manage
                                            </button>
                                        </div>
                                        <select className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-[12px] bg-white focus:outline-none focus:border-[#3eb6cd]">
                                            <option>Primary Calendar</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Date & Time</label>
                                        <div className="flex gap-1">
                                            <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:border-[#3eb6cd] min-w-0" />
                                            <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} className="w-[68px] border border-slate-200 rounded-lg px-1 py-1.5 text-[10px] focus:outline-none focus:border-[#3eb6cd]" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Purpose</label>
                                        <input type="text" value={appointmentPurpose} onChange={e => setAppointmentPurpose(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-[#3eb6cd]" />
                                    </div>
                                    <button className="w-full py-2 bg-[#3eb6cd] text-white font-bold text-[12px] rounded-lg hover:bg-[#37a3b8] transition-colors">
                                        Next
                                    </button>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="p-4 flex-1 flex flex-col">
                                <span className="font-bold text-slate-800 text-[13px] mb-3 block">Notes</span>
                                <textarea
                                    value={noteText} onChange={e => setNoteText(e.target.value)}
                                    placeholder="Add a note…"
                                    className="flex-1 border border-slate-200 rounded-lg p-3 text-[11px] resize-none focus:outline-none focus:border-[#3eb6cd] text-slate-700 placeholder:text-slate-300 min-h-[80px]"
                                />
                                <button className="mt-2 w-full py-2 bg-[#3eb6cd] text-white font-bold text-[12px] rounded-lg hover:bg-[#37a3b8] transition-colors">
                                    Add Note
                                </button>
                            </div>
                        </div>
                    </>
                )}
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
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Lead Type</label>
                                <select value={createLeadForm.leadType} onChange={e => setCreateLeadForm(p => ({ ...p, leadType: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#3eb6cd]">
                                    {['Enquiry', 'Callback', 'Walk-in', 'Chat', 'Test Drive', 'Other'].map(o => <option key={o}>{o}</option>)}
                                </select>
                            </div>
                            {[
                                { label: 'Name', key: 'name', type: 'text', ph: 'Full name' },
                                { label: 'Email', key: 'email', type: 'email', ph: 'email@example.com' },
                                { label: 'Phone', key: 'phone', type: 'tel', ph: 'Phone number' },
                                { label: 'SMS', key: 'sms', type: 'tel', ph: 'SMS number' },
                            ].map(f => (
                                <div key={f.key}>
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
                                    {['No', 'Yes'].map(o => (
                                        <button key={o} type="button" onClick={() => setCreateLeadForm(p => ({ ...p, marketingConsent: o }))} className={`flex-1 py-2 text-[12px] font-semibold rounded-lg border transition-colors ${createLeadForm.marketingConsent === o ? 'bg-[#3eb6cd] text-white border-[#3eb6cd]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{o}</button>
                                    ))}
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

            {/* ── Media Modal ── */}
            {showMediaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-[680px] max-h-[80vh] flex flex-col">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <h2 className="text-[15px] font-bold text-slate-800">Select Media To Send</h2>
                            <button onClick={() => setShowMediaModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {loadingMedia ? (
                                <div className="flex justify-center items-center h-40">
                                    <div className="w-8 h-8 border-4 border-slate-100 border-t-[#3eb6cd] rounded-full animate-spin" />
                                </div>
                            ) : vehicleImages.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-[13px]">No images available for this vehicle.</div>
                            ) : (
                                <div className="grid grid-cols-5 gap-2">
                                    {vehicleImages.map((url, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedImages(prev => {
                                                const next = new Set(prev);
                                                next.has(i) ? next.delete(i) : next.add(i);
                                                return next;
                                            })}
                                            className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedImages.has(i) ? 'border-[#3eb6cd] ring-2 ring-[#3eb6cd]/30' : 'border-transparent hover:border-slate-300'}`}
                                        >
                                            <img src={url} alt={`Vehicle ${i + 1}`} className="w-full h-20 object-cover" />
                                            {selectedImages.has(i) && (
                                                <div className="absolute top-1 right-1 w-5 h-5 bg-[#3eb6cd] rounded-full flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex gap-2">
                                <button onClick={() => setSelectedImages(new Set(vehicleImages.map((_, i) => i)))} className="px-4 py-2 border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-50">Select All</button>
                                <button onClick={() => setSelectedImages(new Set())} className="px-4 py-2 border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-50">None</button>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowMediaModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-50">Close</button>
                                <button onClick={handleSendMedia} disabled={selectedImages.size === 0} className="px-5 py-2 bg-[#3eb6cd] text-white rounded-lg text-[12px] font-bold hover:bg-[#37a3b8] disabled:opacity-40 transition-colors">
                                    Send via Email Template
                                </button>
                            </div>
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
