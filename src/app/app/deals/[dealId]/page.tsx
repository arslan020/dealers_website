'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Message {
    author: string;
    body: string;
    createdAt: string;
    type?: string;
}

interface Deal {
    dealId: string;
    created: string;
    lastUpdated: string;
    advertiserDealStatus: string;
    consumerDealStatus: string;
    consumer: { firstName: string; lastName: string; email: string; phone: string | null };
    stock: { stockId: string; searchId: string; vrm?: string; make?: string; model?: string; year?: number; mileage?: number };
    price: { suppliedPrice?: { amountGBP: number }; totalPrice?: { amountGBP: number } };
    reservation?: { status: string | null; fee?: { amountGBP: number; status: string } };
    buyingSignals?: {
        dealIntentScore: number;
        intent: string;
        localConsumer: boolean;
        advertSaved: boolean;
        preferences?: {
            makeModels?: { make: string; model: string; rating: string }[];
            mileages?: { from: number; to: number };
            years?: { from: number; to: number };
        };
    };
    messages?: { id: string; lastUpdated: string } | null;
    financeApplication?: { id: string } | null;
    partExchange?: {
        partExchangeId?: string;
        vrm?: string; make?: string; model?: string;
        offerPrice?: { amountGBP: number };
        consumerValuation?: { amountGBP: number; expires?: string };
        consumerCondition?: string;
        advertiserCondition?: string;
        odometerReadingMiles?: number;
        colour?: string;
        firstRegistrationDate?: string;
        outstandingFinance?: { lender: string; amountGBP: number };
        features?: { name: string }[];
    } | null;
    delivery?: { type: string; date?: string } | null;
    products?: { name: string; price: { amountGBP: number } }[];
}

type Tab = 'deal' | 'finance' | 'confirm' | 'share';

export default function DealDetailPage() {
    const params = useParams();
    const dealId = params.dealId as string;

    const [deal, setDeal] = useState<Deal | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingDeal, setLoadingDeal] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('deal');
    const [toastMsg, setToastMsg] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [paymentNote, setPaymentNote] = useState('');
    const [addingPayment, setAddingPayment] = useState(false);
    const [declineReason, setDeclineReason] = useState('Different Vehicle');
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMsg(text); setToastType(type);
        setTimeout(() => setToastMsg(''), 3500);
    };

    const fetchDeal = useCallback(async () => {
        try {
            const res = await fetch(`/api/deals/${dealId}`);
            const data = await res.json();
            if (data.ok) setDeal(data.deal);
        } finally { setLoadingDeal(false); }
    }, [dealId]);

    const getMessagesId = useCallback(() => {
        return (deal as any)?.messages?.messagesId ?? (deal as any)?.messages?.id ?? null;
    }, [deal]);

    const fetchMessages = useCallback(async () => {
        setLoadingMessages(true);
        const messagesId = (deal as any)?.messages?.messagesId ?? (deal as any)?.messages?.id;
        try {
            const url = messagesId
                ? `/api/deals/${dealId}/messages?messagesId=${messagesId}`
                : `/api/deals/${dealId}/messages`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.ok) {
                const msgs = data.messages?.messages || data.messages?.results || [];
                setMessages(msgs);
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

    useEffect(() => {
        if (activeTab === 'confirm' && deal) fetchMessages();
    }, [activeTab, deal, fetchMessages]);

    const sendMessage = async () => {
        if (!replyText.trim() || sending) return;
        setSending(true);
        const messagesId = getMessagesId();
        try {
            const res = await fetch(`/api/deals/${dealId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: replyText.trim(), messagesId }),
            });
            const data = await res.json();
            if (data.ok) { setReplyText(''); showToast('Message sent.'); await fetchMessages(); }
            else showToast(data.error?.message || 'Failed to send.', 'error');
        } catch { showToast('Network error.', 'error'); }
        finally { setSending(false); }
    };

    const handleAccept = async () => {
        setUpdatingStatus(true);
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
        finally { setUpdatingStatus(false); }
    };

    const handleDecline = async () => {
        setUpdatingStatus(true);
        try {
            const res = await fetch(`/api/deals/${dealId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ advertiserDealStatus: 'Cancelled', advertiserCancellationReason: declineReason }),
            });
            const data = await res.json();
            if (data.ok) { showToast('Deal declined.'); setShowDeclineModal(false); fetchDeal(); }
            else showToast(data.error?.message || 'Failed.', 'error');
        } catch { showToast('Network error.', 'error'); }
        finally { setUpdatingStatus(false); }
    };

    if (loadingDeal) return (
        <div className="flex items-center justify-center h-96">
            <div className="w-8 h-8 border-4 border-slate-100 border-t-[#4D7CFF] rounded-full animate-spin" />
        </div>
    );

    if (!deal) return (
        <div className="p-10 text-center text-slate-400 text-sm font-semibold">Deal not found.</div>
    );

    const totalPrice = deal.price?.totalPrice?.amountGBP || deal.price?.suppliedPrice?.amountGBP || 0;
    const isActive = deal.advertiserDealStatus === 'In Progress';
    const isCompleted =
        deal.advertiserDealStatus === 'Complete' || deal.advertiserDealStatus === 'Completed';
    const isCancelled = deal.advertiserDealStatus === 'Cancelled';
    const statusColor = isCompleted ? 'bg-emerald-100 text-emerald-700' : isCancelled ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700';
    const vrm = deal.stock?.vrm || deal.stock?.stockId?.slice(0, 8) || '—';
    const shareUrl = `https://checkout.autodesk.com/deal/${dealId}`;
    const pinCode = dealId.slice(-4).toUpperCase();

    const TABS: { key: Tab; label: string }[] = [
        { key: 'deal', label: 'Deal' },
        { key: 'finance', label: 'Finance' },
        { key: 'confirm', label: 'Confirm' },
        { key: 'share', label: 'Share' },
    ];

    return (
        <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
                <Link href="/app/sales/deals" className="font-semibold hover:text-slate-600">Sales</Link>
                <span>/</span>
                <Link href="/app/sales/deals" className="font-semibold hover:text-slate-600">Deals</Link>
                <span>/</span>
                <span className="text-slate-600 font-semibold">{dealId.slice(-6).toUpperCase()}</span>
            </div>

            {/* Toast */}
            {toastMsg && (
                <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${toastType === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                    {toastMsg}
                </div>
            )}

            {/* Header */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <Link href="/app/sales/deals" className="text-slate-400 hover:text-slate-700">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </Link>
                        <div>
                            <h1 className="text-[15px] font-bold text-slate-900">
                                Deal #{dealId.slice(-6).toUpperCase()}
                            </h1>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                {deal.consumer.firstName} {deal.consumer.lastName} · {vrm} · Created {new Date(deal.created).toLocaleDateString('en-GB')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${statusColor}`}>
                            {deal.advertiserDealStatus}
                        </span>
                        {isActive && (
                            <>
                                <button
                                    onClick={handleAccept}
                                    disabled={updatingStatus}
                                    className="flex items-center gap-1.5 bg-emerald-500 text-white text-[12px] font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                    Accept Deal
                                </button>
                                <button
                                    onClick={() => setShowDeclineModal(true)}
                                    className="flex items-center gap-1.5 border border-red-200 text-red-500 text-[12px] font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    Decline
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 px-5">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors -mb-px ${activeTab === tab.key
                                ? 'border-[#4D7CFF] text-[#4D7CFF]'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── DEAL TAB ── */}
                {activeTab === 'deal' && (
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Left col */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Vehicle */}
                            <div className="border border-slate-100 rounded-xl p-4">
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vehicle</h3>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1 1h1m0-5h10m0 5h1l1-1v-3.65a1 1 0 00-.22-.624l-3.48-4.35A1 1 0 0014.52 8H13"/></svg>
                                    </div>
                                    <div>
                                        <p className="text-[14px] font-bold text-slate-800">{deal.stock?.make} {deal.stock?.model}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">{vrm}</span>
                                            {deal.stock?.year && <span className="text-[11px] text-slate-400">{deal.stock.year}</span>}
                                            {deal.stock?.mileage && <span className="text-[11px] text-slate-400">{deal.stock.mileage.toLocaleString()} mi</span>}
                                        </div>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <p className="text-[18px] font-black text-slate-800">£{totalPrice.toLocaleString()}</p>
                                        <p className="text-[11px] text-slate-400">Vehicle Price</p>
                                    </div>
                                </div>
                            </div>

                            {/* Customer */}
                            <div className="border border-slate-100 rounded-xl p-4">
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Customer</h3>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#4D7CFF]/10 flex items-center justify-center text-[#4D7CFF] font-bold text-sm">
                                        {deal.consumer.firstName?.[0]}{deal.consumer.lastName?.[0]}
                                    </div>
                                    <div>
                                        <p className="text-[14px] font-bold text-slate-800">{deal.consumer.firstName} {deal.consumer.lastName}</p>
                                        <p className="text-[12px] text-slate-400">{deal.consumer.email}</p>
                                        {deal.consumer.phone && <p className="text-[12px] text-slate-400">{deal.consumer.phone}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Part Exchange */}
                            {deal.partExchange ? (
                                <div className="border border-slate-100 rounded-xl p-4">
                                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Part Exchange</h3>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[14px] font-bold text-slate-800">{deal.partExchange.make} {deal.partExchange.model}</p>
                                            {deal.partExchange.vrm && <span className="text-[11px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded">{deal.partExchange.vrm}</span>}
                                        </div>
                                        {deal.partExchange.offerPrice && (
                                            <p className="text-[16px] font-black text-amber-600">£{deal.partExchange.offerPrice.amountGBP.toLocaleString()}</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center">
                                    <p className="text-[12px] text-slate-400">No part exchange</p>
                                </div>
                            )}

                            {/* Products */}
                            {deal.products && deal.products.length > 0 && (
                                <div className="border border-slate-100 rounded-xl p-4">
                                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Products</h3>
                                    <div className="space-y-2">
                                        {deal.products.map((p, i) => (
                                            <div key={i} className="flex items-center justify-between text-[13px]">
                                                <span className="text-slate-700">{p.name}</span>
                                                <span className="font-semibold text-slate-800">£{p.price.amountGBP.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Delivery */}
                            {deal.delivery && (
                                <div className="border border-slate-100 rounded-xl p-4">
                                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Delivery / Collection</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[13px] font-semibold text-slate-700">{deal.delivery.type}</span>
                                        {deal.delivery.date && <span className="text-[12px] text-slate-400">· {new Date(deal.delivery.date).toLocaleDateString('en-GB')}</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right col — Summary */}
                        <div className="space-y-4">
                            <div className="border border-slate-100 rounded-xl p-4">
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Summary</h3>
                                <div className="space-y-2 text-[13px]">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Vehicle</span>
                                        <span className="font-semibold text-slate-800">£{totalPrice.toLocaleString()}</span>
                                    </div>
                                    {deal.partExchange?.offerPrice && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Part Exchange</span>
                                            <span className="font-semibold text-amber-600">-£{deal.partExchange.offerPrice.amountGBP.toLocaleString()}</span>
                                        </div>
                                    )}
                                    {deal.products?.map((p, i) => (
                                        <div key={i} className="flex justify-between">
                                            <span className="text-slate-500">{p.name}</span>
                                            <span className="font-semibold">£{p.price.amountGBP.toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-slate-100 pt-2 mt-2 flex justify-between">
                                        <span className="font-bold text-slate-700">Total</span>
                                        <span className="font-black text-slate-900">
                                            £{(totalPrice - (deal.partExchange?.offerPrice?.amountGBP || 0) + (deal.products?.reduce((s, p) => s + p.price.amountGBP, 0) || 0)).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Buying Signals */}
                            {deal.buyingSignals && (
                                <div className="border border-slate-100 rounded-xl p-4">
                                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Buying Intent</h3>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0 ${deal.buyingSignals.dealIntentScore >= 70 ? 'bg-emerald-500' : deal.buyingSignals.dealIntentScore >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}>
                                            {deal.buyingSignals.dealIntentScore}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-bold text-slate-700">{deal.buyingSignals.intent} Intent</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {deal.buyingSignals.localConsumer && <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded">Local</span>}
                                                {deal.buyingSignals.advertSaved && <span className="text-[9px] bg-purple-50 text-purple-600 font-bold px-1.5 py-0.5 rounded">Saved</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Reservation */}
                            {deal.reservation?.status && (
                                <div className="border border-slate-100 rounded-xl p-4">
                                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Reservation</h3>
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-500">Status</span>
                                        <span className="font-semibold">{deal.reservation.status}</span>
                                    </div>
                                    {deal.reservation.fee && (
                                        <div className="flex justify-between text-[13px] mt-1">
                                            <span className="text-slate-500">Fee</span>
                                            <span className="font-semibold">£{deal.reservation.fee.amountGBP} · {deal.reservation.fee.status}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── FINANCE TAB ── */}
                {activeTab === 'finance' && (
                    <div className="p-5">
                        {deal.financeApplication ? (
                            <div className="border border-slate-100 rounded-xl p-5">
                                <h3 className="text-[13px] font-bold text-slate-800 mb-2">Finance Application</h3>
                                <p className="text-[12px] text-slate-500 mb-4">Application ID: <span className="font-mono font-semibold">{deal.financeApplication.id}</span></p>
                                <div className="flex gap-2">
                                    <span className="text-[11px] bg-blue-50 text-blue-600 font-bold px-3 py-1.5 rounded-lg">Submitted</span>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-xl mx-auto">
                                <h3 className="text-[14px] font-bold text-slate-800 mb-1">Finance Application</h3>
                                <p className="text-[12px] text-slate-500 mb-5">Generate finance quotes and submit an application for this deal.</p>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Annual Income</label>
                                            <input type="number" placeholder="£35,000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Employment Status</label>
                                            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                <option>Employed Full Time</option>
                                                <option>Employed Part Time</option>
                                                <option>Self Employed</option>
                                                <option>Retired</option>
                                                <option>Unemployed</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Deposit</label>
                                            <input type="number" placeholder="£1,000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Term (months)</label>
                                            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                <option>24</option>
                                                <option>36</option>
                                                <option>48</option>
                                                <option>60</option>
                                                <option>72</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Finance Type</label>
                                            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                <option>Hire Purchase (HP)</option>
                                                <option>Personal Contract Purchase (PCP)</option>
                                                <option>Personal Loan</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Annual Mileage</label>
                                            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                <option>6,000</option>
                                                <option>8,000</option>
                                                <option>10,000</option>
                                                <option>12,000</option>
                                                <option>15,000</option>
                                                <option>20,000</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button className="w-full py-2.5 bg-[#4D7CFF] text-white text-[13px] font-bold rounded-lg hover:bg-blue-600 transition-colors">
                                        Generate Finance Quotes
                                    </button>
                                </div>

                                <div className="mt-6 p-4 bg-slate-50 rounded-xl text-center text-[12px] text-slate-400">
                                    Finance quotes will appear here after generating.
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── CONFIRM TAB ── */}
                {activeTab === 'confirm' && (
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Status + Actions */}
                        <div className="space-y-4">
                            <div className="border border-slate-100 rounded-xl p-4">
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Deal Status</h3>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className={`text-[12px] font-bold px-3 py-1.5 rounded-full ${statusColor}`}>
                                        {deal.advertiserDealStatus}
                                    </span>
                                    {isCompleted && <span className="text-[11px] text-slate-400">✓ This deal has been accepted</span>}
                                    {isCancelled && <span className="text-[11px] text-slate-400">✕ This deal was declined</span>}
                                </div>

                                {isActive && (
                                    <div className="space-y-2">
                                        <button onClick={handleAccept} disabled={updatingStatus} className="w-full py-2.5 bg-emerald-500 text-white font-bold text-[13px] rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                            Accept Deal
                                        </button>
                                        <button onClick={() => setShowDeclineModal(true)} className="w-full py-2.5 border border-red-200 text-red-500 font-bold text-[13px] rounded-lg hover:bg-red-50 transition-colors">
                                            Decline Deal
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Add Payment */}
                            <div className="border border-slate-100 rounded-xl p-4">
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Record Payment</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Amount</label>
                                        <input
                                            type="number"
                                            placeholder="£0.00"
                                            value={paymentAmount}
                                            onChange={e => setPaymentAmount(e.target.value)}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Payment Method</label>
                                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                            <option>Cash</option>
                                            <option>Bank Transfer</option>
                                            <option>Card</option>
                                            <option>Finance</option>
                                            <option>Cheque</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Note</label>
                                        <input
                                            type="text"
                                            placeholder="Optional note"
                                            value={paymentNote}
                                            onChange={e => setPaymentNote(e.target.value)}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                        />
                                    </div>
                                    <button
                                        disabled={!paymentAmount || addingPayment}
                                        className="w-full py-2.5 bg-[#4D7CFF] text-white font-bold text-[13px] rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-40"
                                    >
                                        Record Payment
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="border border-slate-100 rounded-xl flex flex-col" style={{ minHeight: 420 }}>
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Messages</h3>
                                <button onClick={fetchMessages} className="text-[11px] text-slate-400 hover:text-slate-600">Refresh</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {loadingMessages ? (
                                    <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-slate-100 border-t-[#4D7CFF] rounded-full animate-spin" /></div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-8 text-[12px] text-slate-400">No messages yet.</div>
                                ) : messages.map((msg, i) => {
                                    const isDealer = msg.author !== deal.consumer?.email;
                                    return (
                                        <div key={i} className={`flex ${isDealer ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-[13px] ${isDealer ? 'bg-[#4D7CFF] text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                                                <p>{msg.body}</p>
                                                <p className={`text-[10px] mt-1 ${isDealer ? 'text-blue-200' : 'text-slate-400'}`}>
                                                    {new Date(msg.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
                                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:border-[#4D7CFF]"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!replyText.trim() || sending}
                                    className="px-4 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-bold hover:bg-blue-600 disabled:opacity-40 transition-colors"
                                >
                                    {sending ? '…' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SHARE TAB ── */}
                {activeTab === 'share' && (
                    <div className="p-5 max-w-lg">
                        <h3 className="text-[14px] font-bold text-slate-800 mb-1">Share Deal with Customer</h3>
                        <p className="text-[12px] text-slate-500 mb-5">Send the customer a link so they can view and complete their deal online.</p>

                        <div className="space-y-4">
                            {/* Stage selector */}
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Send Customer To</label>
                                <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                    <option>Deal Summary</option>
                                    <option>Part Exchange</option>
                                    <option>Products</option>
                                    <option>Delivery / Collection</option>
                                    <option>Finance</option>
                                    <option>Payment</option>
                                </select>
                            </div>

                            {/* URL + Pin */}
                            <div className="border border-slate-100 rounded-xl p-4 space-y-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Deal URL</label>
                                    <div className="flex gap-2">
                                        <input readOnly value={shareUrl} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-mono bg-slate-50 text-slate-600 focus:outline-none" />
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(shareUrl); showToast('URL copied!'); }}
                                            className="px-3 py-2 border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">PIN Code</label>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex gap-2">
                                            {pinCode.split('').map((c, i) => (
                                                <div key={i} className="w-10 h-10 border-2 border-[#4D7CFF] rounded-lg flex items-center justify-center font-black text-[#4D7CFF] text-lg">
                                                    {c}
                                                </div>
                                            ))}
                                        </div>
                                        <span className="text-[11px] text-slate-400 ml-2">Customer uses this to access their deal</span>
                                    </div>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="border border-slate-100 rounded-xl p-4 space-y-3">
                                <h4 className="text-[12px] font-bold text-slate-700">Email Customer</h4>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">To</label>
                                    <input readOnly value={deal.consumer.email} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] bg-slate-50 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Message</label>
                                    <textarea rows={3} defaultValue={`Hi ${deal.consumer.firstName},\n\nPlease find your deal at: ${shareUrl}\n\nYour PIN: ${pinCode}`} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:border-[#4D7CFF]" />
                                </div>
                                <button className="w-full py-2.5 bg-[#4D7CFF] text-white font-bold text-[13px] rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    Send Email
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Decline Modal */}
            {showDeclineModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-[380px] p-6">
                        <h2 className="text-[15px] font-bold text-slate-800 mb-1">Decline Deal</h2>
                        <p className="text-[12px] text-slate-500 mb-5">Please select the reason for declining this deal.</p>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Reason</label>
                        <select value={declineReason} onChange={e => setDeclineReason(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-red-400 mb-5">
                            <option>Different Vehicle</option>
                            <option>Unaffordable</option>
                            <option>Not Interested</option>
                            <option>Went Elsewhere</option>
                            <option>Not Available</option>
                            <option>Condition</option>
                            <option>Poor Customer Service</option>
                            <option>Other</option>
                        </select>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowDeclineModal(false)} className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
                                Cancel
                            </button>
                            <button onClick={handleDecline} disabled={updatingStatus} className="px-4 py-2 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg min-w-[90px] flex items-center justify-center">
                                {updatingStatus ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Decline'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
