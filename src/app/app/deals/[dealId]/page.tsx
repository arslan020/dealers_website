'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import FinanceTab from '@/components/deals/FinanceTab';

interface Message {
    from: 'Consumer' | 'Advertiser';
    at: string;
    message: string;
}

interface Deal {
    dealId: string;
    created: string;
    lastUpdated: string;
    advertiserDealStatus: string;
    consumerDealStatus: string;
    consumer: { firstName: string; lastName: string; email: string; phone: string | null };
    stock: { stockId: string; searchId: string; vrm?: string; make?: string; model?: string; year?: number; mileage?: number; image?: string | null };
    price: { suppliedPrice?: { amountGBP: number }; totalPrice?: { amountGBP: number }; adminFee?: { amountGBP: number } };
    reservation?: { status: string | null; fee?: { amountGBP: number; status: string } };
    buyingSignals?: { dealIntentScore: number; intent: string; localConsumer: boolean; advertSaved: boolean };
    messages?: { id: string; lastUpdated: string } | null;
    financeApplication?: { id: string } | null;
    partExchange?: {
        partExchangeId?: string;
        vrm?: string; make?: string; model?: string;
        offerPrice?: { amountGBP: number };
        consumerValuation?: { amountGBP: number };
        odometerReadingMiles?: number;
        outstandingFinance?: { lender: string; amountGBP: number };
    } | null;
    delivery?: { type: string; date?: string } | null;
    products?: { name: string; price: { amountGBP: number } }[];
}

type Tab = 'deal' | 'finance' | 'confirm' | 'share';

const CANCELLATION_REASONS = [
    'Different Vehicle', 'Unaffordable', 'Not Interested',
    'Went Elsewhere', 'Not Available', 'Condition', 'Poor Customer Service', 'Other',
];

export default function DealDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const dealId = params.dealId as string;

    const [deal, setDeal] = useState<Deal | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingDeal, setLoadingDeal] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>(
        (['deal', 'finance', 'confirm', 'share'].includes(searchParams.get('tab') ?? '')
            ? searchParams.get('tab') as Tab : 'deal')
    );
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const [submitting, setSubmitting] = useState(false);
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [declineReason, setDeclineReason] = useState('Different Vehicle');
    const [declineNotes, setDeclineNotes] = useState('');
    const [showCosts, setShowCosts] = useState(false);
    const [deliveryTab, setDeliveryTab] = useState<'delivery' | 'collection'>('delivery');

    // Part Exchange state
    const [pxVrm, setPxVrm] = useState('');
    const [pxLookupName, setPxLookupName] = useState('');
    const [pxMileage, setPxMileage] = useState('');
    const [pxModified, setPxModified] = useState<'yes' | 'no' | ''>('');
    const [pxTaxiHire, setPxTaxiHire] = useState<'yes' | 'no' | ''>('');
    const [pxServiceHistory, setPxServiceHistory] = useState<'Full' | 'Partial' | 'None' | ''>('');
    const [pxOfferPrice, setPxOfferPrice] = useState('');
    const [pxCondition, setPxCondition] = useState<'Excellent' | 'Good' | 'Average' | 'Poor' | ''>('');
    const [pxOutstandingFinance, setPxOutstandingFinance] = useState<'yes' | 'no' | ''>('');
    const [pxVatStatus, setPxVatStatus] = useState<'Marginal' | 'VAT Qualifying' | 'No VAT'>('Marginal');
    const [pxLooking, setPxLooking] = useState(false);
    const [pxSaving, setPxSaving] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast(msg); setToastType(type);
        setTimeout(() => setToast(''), 3500);
    };

    const fetchDeal = useCallback(async () => {
        try {
            const res = await fetch(`/api/deals/${dealId}`);
            const data = await res.json();
            if (data.ok) {
                setDeal(data.deal);
                const px = data.deal?.partExchange;
                if (px) {
                    setPxVrm(px.vrm || '');
                    setPxLookupName([px.make, px.model].filter(Boolean).join(' '));
                    setPxMileage(px.odometerReadingMiles ? String(px.odometerReadingMiles) : '');
                    setPxOfferPrice(px.offerPrice?.amountGBP ? String(px.offerPrice.amountGBP) : '');
                    if (px.advertiserCondition) {
                        const map: Record<string, 'Excellent' | 'Good' | 'Average' | 'Poor'> = {
                            Excellent: 'Excellent', Great: 'Excellent', Good: 'Good', Fair: 'Average', Poor: 'Poor'
                        };
                        setPxCondition(map[px.advertiserCondition] || '');
                    }
                    setPxOutstandingFinance(px.outstandingFinance ? 'yes' : 'no');
                }
            }
        } finally { setLoadingDeal(false); }
    }, [dealId]);

    const fetchMessages = useCallback(async () => {
        if (!deal) return;
        setLoadingMessages(true);
        const messagesId = deal.messages?.id;
        try {
            const url = messagesId
                ? `/api/deals/${dealId}/messages?messagesId=${messagesId}`
                : `/api/deals/${dealId}/messages`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.ok) {
                setMessages(data.messages?.messages || []);
                if (messagesId) {
                    await fetch(`/api/deals/${dealId}/messages?messagesId=${messagesId}`, { method: 'PATCH' });
                }
            }
        } finally {
            setLoadingMessages(false);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    }, [dealId, deal]);

    useEffect(() => { fetchDeal(); }, [fetchDeal]);
    useEffect(() => { if (activeTab === 'confirm' && deal) fetchMessages(); }, [activeTab, deal, fetchMessages]);

    const sendMessage = async () => {
        if (!replyText.trim() || sending) return;
        setSending(true);
        try {
            const res = await fetch(`/api/deals/${dealId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: replyText.trim(), messagesId: deal?.messages?.id }),
            });
            const data = await res.json();
            if (data.ok) { setReplyText(''); showToast('Message sent.'); fetchMessages(); }
            else showToast(data.error?.message || 'Failed.', 'error');
        } catch { showToast('Network error.', 'error'); }
        finally { setSending(false); }
    };

    const lookupPxVrm = async () => {
        if (!pxVrm.trim()) return;
        setPxLooking(true);
        setPxLookupName('');
        try {
            const res = await fetch(`/api/vehicles/lookup?vrm=${encodeURIComponent(pxVrm.trim())}`);
            const data = await res.json();
            if (data.ok && data.vehicle) {
                const v = data.vehicle;
                const name = [v.make, v.vehicleModel, v.derivative].filter(Boolean).join(' ');
                setPxLookupName(name);
                showToast('Vehicle found.');
            } else {
                showToast(data.error?.message || 'Vehicle not found.', 'error');
            }
        } catch { showToast('Lookup failed.', 'error'); }
        finally { setPxLooking(false); }
    };

    const conditionToAT = (c: string) => {
        if (c === 'Excellent') return 'Excellent';
        if (c === 'Good') return 'Good';
        if (c === 'Average') return 'Fair';
        if (c === 'Poor') return 'Poor';
        return undefined;
    };

    const savePx = async () => {
        if (!pxVrm.trim() || !pxMileage.trim()) {
            showToast('Registration and mileage are required.', 'error');
            return;
        }
        setPxSaving(true);
        try {
            const px = deal?.partExchange;
            const partExchangeId = px?.partExchangeId;

            const advertiser: any = {};
            if (pxCondition) advertiser.conditionRating = conditionToAT(pxCondition);
            if (pxOfferPrice) advertiser.offer = { amountGBP: parseFloat(pxOfferPrice) };

            if (partExchangeId) {
                const res = await fetch(`/api/deals/${dealId}/part-exchange`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ partExchangeId, advertiser }),
                });
                const data = await res.json();
                if (data.ok) { showToast('Part Exchange updated.'); fetchDeal(); }
                else showToast(data.error || 'Failed.', 'error');
            } else {
                const res = await fetch(`/api/deals/${dealId}/part-exchange`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vehicle: { registration: pxVrm.trim().toUpperCase(), odometerReadingMiles: parseInt(pxMileage) },
                        advertiser,
                    }),
                });
                const data = await res.json();
                if (data.ok) { showToast('Part Exchange added.'); fetchDeal(); }
                else showToast(data.error || 'Failed.', 'error');
            }
        } catch { showToast('Network error.', 'error'); }
        finally { setPxSaving(false); }
    };

    const handleAccept = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ advertiserDealStatus: 'Complete' }),
            });
            const data = await res.json();
            if (data.ok) { showToast('Deal accepted!'); fetchDeal(); }
            else showToast(data.error?.message || 'Failed.', 'error');
        } catch { showToast('Network error.', 'error'); }
        finally { setSubmitting(false); }
    };

    const handleDecline = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    advertiserDealStatus: 'Cancelled',
                    advertiserCancellationReason: declineReason,
                    advertiserCancellationNotes: declineNotes,
                }),
            });
            const data = await res.json();
            if (data.ok) { showToast('Deal declined.'); setShowDeclineModal(false); fetchDeal(); }
            else showToast(data.error?.message || 'Failed.', 'error');
        } catch { showToast('Network error.', 'error'); }
        finally { setSubmitting(false); }
    };

    if (loadingDeal) return (
        <div className="flex items-center justify-center h-96">
            <div className="w-8 h-8 border-4 border-slate-100 border-t-[#3eb6cd] rounded-full animate-spin" />
        </div>
    );
    if (!deal) return <div className="p-10 text-center text-slate-400 text-sm">Deal not found.</div>;

    const suppliedPrice = deal.price?.suppliedPrice?.amountGBP || deal.price?.totalPrice?.amountGBP || 0;
    const vrm = deal.stock?.vrm || deal.stock?.stockId?.slice(0, 8) || '—';
    const isCompleted = deal.advertiserDealStatus === 'Complete' || deal.advertiserDealStatus === 'Completed';
    const isCancelled = deal.advertiserDealStatus === 'Cancelled';
    const isActive = !isCompleted && !isCancelled;
    const isLocked = deal.reservation?.fee?.status === 'Held' && isActive;
    const customerIsActive = !!deal.messages?.lastUpdated &&
        Date.now() - new Date(deal.messages.lastUpdated).getTime() < 30 * 60 * 1000;
    const dealNum = dealId.slice(-6).toUpperCase();
    const shareUrl = `https://checkout.example.com/deal/${dealId}`;
    const pinCode = dealId.slice(-4).toUpperCase();

    const vehicleDescription = [deal.stock?.make, deal.stock?.model].filter(Boolean).join(' ') || '—';
    const pxOfferTotal = deal.partExchange?.offerPrice?.amountGBP || 0;
    const totalDue = suppliedPrice - pxOfferTotal;

    const TABS: { key: Tab; label: string }[] = [
        { key: 'deal', label: 'Deal' },
        { key: 'finance', label: 'Finance' },
        { key: 'confirm', label: 'Confirm' },
        { key: 'share', label: 'Share' },
    ];

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all ${toastType === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                    {toast}
                </div>
            )}

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400 px-6 pt-5 pb-3">
                <Link href="/app/sales/deals" className="hover:text-slate-600 font-medium">Sales</Link>
                <span>/</span>
                <Link href="/app/sales/deals" className="hover:text-slate-600 font-medium">Deals</Link>
                <span>/</span>
                <span className="text-slate-700 font-semibold">#{dealNum}</span>
            </div>

            {/* Banners */}
            <div className="px-6 space-y-2 mb-4">
                {customerIsActive && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="relative flex-shrink-0">
                            <span className="block w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                            <span className="absolute inset-0 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
                        </span>
                        <p className="text-[12px] font-bold text-emerald-800">Customer Is Active</p>
                        <button className="ml-auto text-[11px] font-semibold border border-emerald-300 text-emerald-700 px-2.5 py-1 rounded hover:bg-emerald-100 transition-colors">
                            Refresh Deal
                        </button>
                    </div>
                )}
                {isLocked && (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[12px] text-amber-800 font-medium">
                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1C8.676 1 6 3.676 6 7v1H4a1 1 0 00-1 1v13a1 1 0 001 1h16a1 1 0 001-1V9a1 1 0 00-1-1h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v1H8V7c0-2.276 1.724-4 4-4zm0 9a2 2 0 110 4 2 2 0 010-4z"/></svg>
                        Locked Deal — Payment of £{deal.reservation?.fee?.amountGBP?.toLocaleString()} is held. Decline to make changes.
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-0">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors -mb-px ${
                                activeTab === tab.key
                                    ? 'border-[#3eb6cd] text-[#3eb6cd]'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── DEAL TAB ── */}
            {activeTab === 'deal' && (
                <div className="flex gap-5 px-6 pt-5 pb-8 items-start">
                    {/* Left — editable form */}
                    <div className="flex-1 min-w-0 space-y-4">

                        {/* Customer */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <h2 className="text-[14px] font-bold text-slate-800 mb-4">Customer</h2>
                            <div className="flex items-center justify-between">
                                <span className="text-[14px] text-slate-700">
                                    {deal.consumer.firstName} {deal.consumer.lastName}
                                </span>
                                <div className="flex gap-1.5">
                                    <button className="w-8 h-8 flex items-center justify-center bg-[#3eb6cd] text-white rounded-lg hover:bg-[#37a3b8] transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                    </button>
                                    <button className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Vehicle */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <h2 className="text-[14px] font-bold text-slate-800 mb-4">Vehicle</h2>
                            <div className="flex gap-6">
                                <div className="flex-1 space-y-4">
                                    {/* Identifier */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Identifier</p>
                                            <span className="text-[14px] font-bold text-[#3eb6cd]">{vrm}</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button className="w-8 h-8 flex items-center justify-center bg-[#3eb6cd] text-white rounded-lg hover:bg-[#37a3b8] transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                            </button>
                                            <button className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Price */}
                                    <div>
                                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Price</p>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="price" defaultChecked className="accent-[#3eb6cd]" />
                                                <span className="text-[13px] text-slate-700">£{suppliedPrice.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="price" className="accent-[#3eb6cd]" />
                                                <span className="flex items-center gap-1 text-[13px] text-slate-500">
                                                    <span className="w-6 h-8 border border-slate-300 rounded flex items-center justify-center text-slate-400 text-[12px]">£</span>
                                                    <input
                                                        type="number"
                                                        defaultValue={suppliedPrice}
                                                        className="w-28 h-8 border border-slate-300 rounded px-2 text-[13px] focus:outline-none focus:border-[#3eb6cd]"
                                                    />
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Mileage */}
                                    <div>
                                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Mileage</p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                defaultValue={deal.stock?.mileage || ''}
                                                placeholder="0"
                                                className="w-32 h-9 border border-slate-300 rounded-lg px-3 text-[13px] focus:outline-none focus:border-[#3eb6cd]"
                                            />
                                            <span className="text-[12px] text-slate-400">miles</span>
                                        </div>
                                    </div>

                                    {/* VAT Status */}
                                    <div>
                                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">VAT Status</p>
                                        <div className="flex items-center gap-4">
                                            {['Marginal', 'VAT Qualifying', 'No VAT'].map(opt => (
                                                <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                                                    <input type="radio" name="vat" defaultChecked={opt === 'Marginal'} className="accent-[#3eb6cd]" />
                                                    <span className="text-[12px] text-slate-600">{opt}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Show Vehicle Costs */}
                                    <button
                                        onClick={() => setShowCosts(c => !c)}
                                        className="flex items-center gap-1 text-[12px] font-semibold text-[#3eb6cd] hover:underline"
                                    >
                                        <svg className={`w-3 h-3 transition-transform ${showCosts ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                                        {showCosts ? 'Hide' : 'Show'} Vehicle Costs
                                    </button>
                                    {showCosts && (
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-[12px] text-slate-600">
                                            <div className="flex justify-between">
                                                <span>Supplied Price</span>
                                                <span className="font-semibold">£{suppliedPrice.toLocaleString()}</span>
                                            </div>
                                            {deal.price?.adminFee && (
                                                <div className="flex justify-between">
                                                    <span>Admin Fee</span>
                                                    <span className="font-semibold">£{deal.price.adminFee.amountGBP.toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Vehicle image */}
                                <div className="w-48 h-36 bg-slate-100 rounded-xl border border-slate-200 flex-shrink-0 overflow-hidden">
                                    {deal.stock?.image ? (
                                        <img src={deal.stock.image} alt={vehicleDescription} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8l2-2zM13 6l3.586 3.586A2 2 0 0117 11v5h2a2 2 0 002-2v-2.586a2 2 0 00-.586-1.414L18 8H13z"/></svg>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Part Exchange */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <h2 className="text-[14px] font-bold text-slate-800 mb-4">Part Exchange</h2>
                            <div className="space-y-4">
                                {/* Registration row */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Registration</label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            value={pxVrm}
                                            onChange={e => setPxVrm(e.target.value.toUpperCase())}
                                            onKeyDown={e => e.key === 'Enter' && lookupPxVrm()}
                                            placeholder="e.g. AB12CDE"
                                            className="w-44 h-9 border border-slate-300 rounded-lg px-3 text-[13px] font-mono focus:outline-none focus:border-[#3eb6cd]"
                                        />
                                        <button
                                            onClick={lookupPxVrm}
                                            disabled={pxLooking || !pxVrm.trim()}
                                            className="h-9 px-3 border border-slate-300 text-slate-700 text-[12px] font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                                        >
                                            {pxLooking ? 'Checking…' : 'Quick Check Vehicle'}
                                        </button>
                                        {(pxVrm || deal.partExchange) && (
                                            <button
                                                onClick={() => { setPxVrm(''); setPxLookupName(''); setPxMileage(''); setPxOfferPrice(''); setPxCondition(''); setPxOutstandingFinance(''); setPxModified(''); setPxTaxiHire(''); setPxServiceHistory(''); }}
                                                className="w-9 h-9 flex items-center justify-center bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Vehicle name */}
                                {pxLookupName && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Vehicle</label>
                                        <p className="text-[13px] font-semibold text-slate-800">{pxLookupName}</p>
                                    </div>
                                )}

                                {/* Two-col grid of fields */}
                                {(pxVrm || deal.partExchange) && (
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                        {/* Mileage */}
                                        <div>
                                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Mileage</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={pxMileage}
                                                    onChange={e => setPxMileage(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full h-9 border border-slate-300 rounded-lg px-3 text-[13px] focus:outline-none focus:border-[#3eb6cd]"
                                                />
                                                <span className="text-[12px] text-slate-400 shrink-0">miles</span>
                                            </div>
                                        </div>

                                        {/* Condition */}
                                        <div>
                                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">What condition is the vehicle exterior and interior in?</label>
                                            <div className="flex flex-wrap gap-3">
                                                {(['Excellent', 'Good', 'Average', 'Poor'] as const).map(c => (
                                                    <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input type="radio" name="pxCondition" checked={pxCondition === c} onChange={() => setPxCondition(c)} className="accent-[#3eb6cd]" />
                                                        <span className="text-[12px] text-slate-700">{c}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Modified */}
                                        <div>
                                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Has the vehicle been modified (inc. bodywork, mechanical, electrical and software)?</label>
                                            <div className="flex gap-4">
                                                {(['yes', 'no'] as const).map(v => (
                                                    <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input type="radio" name="pxModified" checked={pxModified === v} onChange={() => setPxModified(v)} className="accent-[#3eb6cd]" />
                                                        <span className="text-[12px] text-slate-700 capitalize">{v}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Outstanding Finance */}
                                        <div>
                                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Does the vehicle have any outstanding finance?</label>
                                            <div className="flex gap-4">
                                                {(['yes', 'no'] as const).map(v => (
                                                    <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input type="radio" name="pxFinance" checked={pxOutstandingFinance === v} onChange={() => setPxOutstandingFinance(v)} className="accent-[#3eb6cd]" />
                                                        <span className="text-[12px] text-slate-700 capitalize">{v}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Taxi / Hire */}
                                        <div>
                                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Has your vehicle been used as a taxi or for hire, or does it have any liens (legal claims) against it?</label>
                                            <div className="flex gap-4">
                                                {(['yes', 'no'] as const).map(v => (
                                                    <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input type="radio" name="pxTaxi" checked={pxTaxiHire === v} onChange={() => setPxTaxiHire(v)} className="accent-[#3eb6cd]" />
                                                        <span className="text-[12px] text-slate-700 capitalize">{v}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* VAT Status */}
                                        <div>
                                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">VAT Status</label>
                                            <div className="flex flex-wrap gap-3">
                                                {(['Marginal', 'VAT Qualifying', 'No VAT'] as const).map(v => (
                                                    <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input type="radio" name="pxVat" checked={pxVatStatus === v} onChange={() => setPxVatStatus(v)} className="accent-[#3eb6cd]" />
                                                        <span className="text-[12px] text-slate-700">{v}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Service History */}
                                        <div>
                                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">What service history does the vehicle have?</label>
                                            <div className="flex gap-4">
                                                {(['Full', 'Partial', 'None'] as const).map(v => (
                                                    <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input type="radio" name="pxService" checked={pxServiceHistory === v} onChange={() => setPxServiceHistory(v)} className="accent-[#3eb6cd]" />
                                                        <span className="text-[12px] text-slate-700">{v}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Price Offered */}
                                        <div>
                                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Price Offered</label>
                                            <div className="flex items-center gap-1">
                                                <span className="w-8 h-9 border border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-[13px]">£</span>
                                                <input
                                                    type="number"
                                                    value={pxOfferPrice}
                                                    onChange={e => setPxOfferPrice(e.target.value)}
                                                    placeholder="0.00"
                                                    className="flex-1 h-9 border border-slate-300 rounded-lg px-3 text-[13px] focus:outline-none focus:border-[#3eb6cd]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Save PX button */}
                                {(pxVrm || deal.partExchange) && (
                                    <button
                                        onClick={savePx}
                                        disabled={pxSaving}
                                        className="h-9 px-4 bg-[#3eb6cd] text-white text-[12px] font-bold rounded-lg hover:bg-[#37a3b8] disabled:opacity-40 transition-colors"
                                    >
                                        {pxSaving ? 'Saving…' : deal.partExchange?.partExchangeId ? 'Update Part Exchange' : 'Add Part Exchange'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Delivery / Collection */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <h2 className="text-[14px] font-bold text-slate-800 mb-4">Delivery/Collection</h2>
                            {/* Sub-tabs */}
                            <div className="flex border-b border-slate-200 mb-4">
                                {(['delivery', 'collection'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setDeliveryTab(t)}
                                        className={`px-5 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors capitalize ${
                                            deliveryTab === t ? 'border-[#3eb6cd] text-[#3eb6cd]' : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                        {deliveryTab === 'delivery' ? 'Delivery Date' : 'Collection Date'}
                                    </p>
                                    <select className="w-full h-9 border border-slate-300 rounded-lg px-3 text-[13px] text-slate-500 focus:outline-none focus:border-[#3eb6cd]">
                                        <option>Select {deliveryTab === 'delivery' ? 'Delivery' : 'Collection'} Date</option>
                                    </select>
                                </div>
                                {deliveryTab === 'delivery' && (
                                    <div>
                                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Delivery Cost</p>
                                        <div className="flex items-center gap-2">
                                            <span className="w-8 h-9 border border-slate-300 rounded-lg flex items-center justify-center text-slate-400 text-[13px]">£</span>
                                            <input type="number" placeholder="0.00" className="flex-1 h-9 border border-slate-300 rounded-lg px-3 text-[13px] focus:outline-none focus:border-[#3eb6cd]" />
                                        </div>
                                    </div>
                                )}
                                {deal.delivery && (
                                    <div className="p-3 bg-[#f0f9fa] rounded-lg border border-[#d0edf2] grid grid-cols-3 gap-3 text-[12px]">
                                        <div><p className="text-slate-400 mb-0.5">Preference</p><p className="font-bold text-[#3eb6cd]">{deal.delivery.type}</p></div>
                                        {deal.delivery.date && <div><p className="text-slate-400 mb-0.5">Date</p><p className="font-bold text-slate-700">{new Date(deal.delivery.date).toLocaleDateString('en-GB')}</p></div>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom action buttons */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={() => showToast('Changes saved.')}
                                className="px-5 py-2.5 bg-[#3eb6cd] text-white text-[13px] font-bold rounded-lg hover:bg-[#37a3b8] transition-colors"
                            >
                                Save Changes
                            </button>
                            <button
                                onClick={() => setActiveTab('confirm')}
                                className="px-5 py-2.5 border border-slate-300 text-slate-700 text-[13px] font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Save & Confirm
                            </button>
                            <button
                                onClick={() => setActiveTab('share')}
                                className="px-5 py-2.5 border border-slate-300 text-slate-700 text-[13px] font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Save & Share
                            </button>
                        </div>
                    </div>

                    {/* Right — sidebar */}
                    <div className="w-72 shrink-0 space-y-4 sticky top-5">
                        {/* Customer Has Lead */}
                        {deal.buyingSignals && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-[#3eb6cd]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                                        <span className="text-[12px] font-bold text-[#3eb6cd]">Customer Has Lead</span>
                                    </div>
                                    <button className="text-[11px] font-semibold border border-slate-200 text-slate-600 px-2.5 py-1 rounded hover:bg-slate-50 transition-colors">
                                        View Lead
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Vehicle Details */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <h3 className="text-[13px] font-bold text-slate-800 mb-3">Vehicle Details</h3>
                            <div className="space-y-2 text-[12px]">
                                <div className="flex justify-between gap-2">
                                    <span className="text-slate-400 shrink-0">Vehicle:</span>
                                    <span className="font-medium text-slate-700 text-right">{vehicleDescription}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Registration:</span>
                                    <span className="font-bold text-slate-800">{vrm}</span>
                                </div>
                                {deal.stock?.year && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Registration Year:</span>
                                        <span className="font-medium text-slate-700">{deal.stock.year}</span>
                                    </div>
                                )}
                                {deal.stock?.mileage && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Mileage:</span>
                                        <span className="font-medium text-slate-700">{deal.stock.mileage.toLocaleString()} miles</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Total Price:</span>
                                    <span className="font-bold text-slate-800">£{suppliedPrice.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <h3 className="text-[13px] font-bold text-slate-800 mb-3">Summary</h3>
                            <div className="space-y-2 text-[12px]">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Vehicle</span>
                                    <span className="font-medium text-slate-700">£{suppliedPrice.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {pxOfferTotal > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Part Exchange</span>
                                        <span className="font-medium text-amber-600">-£{pxOfferTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-100 pt-2 flex justify-between">
                                    <span className="font-semibold text-slate-700">Total Due:</span>
                                    <span className="font-bold text-slate-900">£{totalDue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isCompleted ? 'bg-emerald-100 text-emerald-700' : isCancelled ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                    {deal.advertiserDealStatus}
                                </span>
                            </div>
                            {isActive && (
                                <div className="space-y-1.5 mt-3">
                                    <button onClick={handleAccept} disabled={submitting} className="w-full py-2 bg-emerald-500 text-white text-[12px] font-bold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50">
                                        Accept Deal
                                    </button>
                                    <button onClick={() => setShowDeclineModal(true)} className="w-full py-2 border border-red-200 text-red-500 text-[12px] font-semibold rounded-lg hover:bg-red-50 transition-colors">
                                        Decline Deal
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── FINANCE TAB ── */}
            {activeTab === 'finance' && (
                <div className="px-6 pt-5">
                    <FinanceTab
                        dealId={dealId}
                        existingApplicationId={deal.financeApplication?.id ?? null}
                        dealPrice={suppliedPrice}
                        consumerFirstName={deal.consumer.firstName}
                        consumerLastName={deal.consumer.lastName}
                        consumerEmail={deal.consumer.email}
                    />
                </div>
            )}

            {/* ── CONFIRM TAB ── */}
            {activeTab === 'confirm' && (
                <div className="px-6 pt-5 grid grid-cols-1 lg:grid-cols-2 gap-5 pb-8">
                    <div className="space-y-4">
                        {/* Deal Status */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Deal Status</h3>
                            <div className="flex items-center gap-3 mb-4">
                                <span className={`text-[12px] font-bold px-3 py-1.5 rounded-full ${isCompleted ? 'bg-emerald-100 text-emerald-700' : isCancelled ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                    {deal.advertiserDealStatus}
                                </span>
                            </div>
                            {isActive && (
                                <div className="space-y-2">
                                    <button onClick={handleAccept} disabled={submitting} className="w-full py-2.5 bg-emerald-500 text-white font-bold text-[13px] rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50">
                                        Accept Deal
                                    </button>
                                    <button onClick={() => setShowDeclineModal(true)} className="w-full py-2.5 border border-red-200 text-red-500 font-bold text-[13px] rounded-lg hover:bg-red-50 transition-colors">
                                        Decline Deal
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Record Payment */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Record Payment</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Amount</label>
                                    <input type="number" placeholder="£0.00" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#3eb6cd]" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Method</label>
                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#3eb6cd]">
                                        {['Cash', 'Bank Transfer', 'Card', 'Finance', 'Cheque'].map(m => <option key={m}>{m}</option>)}
                                    </select>
                                </div>
                                <button disabled={!paymentAmount} className="w-full py-2.5 bg-[#3eb6cd] text-white font-bold text-[13px] rounded-lg hover:bg-[#37a3b8] transition-colors disabled:opacity-40">
                                    Record Payment
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col" style={{ minHeight: 420 }}>
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Messages</h3>
                            <button onClick={fetchMessages} className="text-[11px] text-slate-400 hover:text-slate-600">Refresh</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {loadingMessages ? (
                                <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-slate-100 border-t-[#3eb6cd] rounded-full animate-spin" /></div>
                            ) : messages.length === 0 ? (
                                <div className="text-center py-8 text-[12px] text-slate-400">No messages yet.</div>
                            ) : messages.map((msg, i) => {
                                const isDealer = msg.from === 'Advertiser';
                                return (
                                    <div key={i} className={`flex ${isDealer ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-[13px] ${isDealer ? 'bg-[#3eb6cd] text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                                            <p>{msg.message}</p>
                                            <p className={`text-[10px] mt-1 ${isDealer ? 'text-white/70' : 'text-slate-400'}`}>
                                                {new Date(msg.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="p-3 border-t border-slate-100 flex gap-2">
                            <textarea
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                placeholder="Type a message…"
                                rows={2}
                                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:border-[#3eb6cd]"
                            />
                            <button onClick={sendMessage} disabled={!replyText.trim() || sending} className="px-4 bg-[#3eb6cd] text-white rounded-lg text-[13px] font-bold hover:bg-[#37a3b8] disabled:opacity-40 transition-colors">
                                {sending ? '…' : 'Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SHARE TAB ── */}
            {activeTab === 'share' && (
                <div className="px-6 pt-5 max-w-lg pb-8">
                    <h3 className="text-[14px] font-bold text-slate-800 mb-1">Share Deal with Customer</h3>
                    <p className="text-[12px] text-slate-500 mb-5">Send the customer a link to view and complete their deal online.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Send Customer To</label>
                            <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#3eb6cd]">
                                {['Deal Summary', 'Part Exchange', 'Products', 'Delivery / Collection', 'Finance', 'Payment'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Deal URL</label>
                                <div className="flex gap-2">
                                    <input readOnly value={shareUrl} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-mono bg-slate-50 text-slate-600 focus:outline-none" />
                                    <button onClick={() => { navigator.clipboard.writeText(shareUrl); showToast('URL copied!'); }} className="px-3 py-2 border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-50">Copy</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">PIN Code</label>
                                <div className="flex gap-2 items-center">
                                    {pinCode.split('').map((c, i) => (
                                        <div key={i} className="w-10 h-10 border-2 border-[#3eb6cd] rounded-lg flex items-center justify-center font-black text-[#3eb6cd] text-lg">{c}</div>
                                    ))}
                                    <span className="text-[11px] text-slate-400 ml-2">Customer PIN</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                            <h4 className="text-[12px] font-bold text-slate-700">Email Customer</h4>
                            <input readOnly value={deal.consumer.email} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] bg-slate-50 focus:outline-none" />
                            <textarea rows={3} defaultValue={`Hi ${deal.consumer.firstName},\n\nPlease find your deal at: ${shareUrl}\n\nYour PIN: ${pinCode}`} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:border-[#3eb6cd]" />
                            <button className="w-full py-2.5 bg-[#3eb6cd] text-white font-bold text-[13px] rounded-lg hover:bg-[#37a3b8] transition-colors">Send Email</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Decline Modal */}
            {showDeclineModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-[400px] p-6">
                        <h2 className="text-[15px] font-bold text-slate-800 mb-1">Decline Deal</h2>
                        <p className="text-[12px] text-slate-500 mb-4">Select a reason for declining this deal.</p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Reason *</label>
                                <select value={declineReason} onChange={e => setDeclineReason(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-red-400">
                                    {CANCELLATION_REASONS.map(r => <option key={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Notes</label>
                                <textarea value={declineNotes} onChange={e => setDeclineNotes(e.target.value)} rows={2} placeholder="Optional notes..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:border-red-400" />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end mt-5">
                            <button onClick={() => setShowDeclineModal(false)} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button onClick={handleDecline} disabled={submitting} className="px-4 py-2 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg min-w-[90px] flex items-center justify-center">
                                {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Decline'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
