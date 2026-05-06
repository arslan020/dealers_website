'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinanceApplication {
    applicationId: string;
    status: string;
    applicant: {
        title?: string; firstName?: string; lastName?: string; email?: string;
        mobile?: string; dateOfBirth?: string; gender?: string;
        nationalityCode?: string; maritalStatus?: string; drivingLicenceType?: string;
        numberOfDependants?: number | null;
        monthlyChildcare?: { amountGBP: number | null };
        monthlyRentOrMortgage?: { amountGBP: number | null };
        bankAccountHolderName?: string | null; bankAccountNumber?: string | null;
        monthsAtBank?: number | null; replacingExistingLoan?: boolean;
        currentAddress?: {
            buildingNameOrNumber: string; street: string; town: string;
            county: string; postcode: string; months: number; status: string;
        } | null;
        currentEmployment?: {
            employerName: string; status: string; jobTitle?: string;
            monthlyIncome?: { amountGBP: number }; months: number;
        } | null;
    };
    financeTerms: {
        productType?: string; termMonths?: number; estimatedAnnualMileage?: number;
        cashPrice?: { amountGBP: number }; deposit?: { amountGBP: number };
        partExchange?: { amountGBP: number }; outstandingFinance?: { amountGBP: number };
    };
    consent?: { softCheck?: string | null };
}

interface Quote {
    quoteId: string;
    lender: string;
    lenderLogoUrl?: string;
    productType: string;
    productName?: string;
    eligible: boolean;
    apr: number;
    termMonths: number;
    monthlyRepayment?: { amountGBP: number };
    totalAmountPayable?: { amountGBP: number };
    deposit?: { amountGBP: number };
    proposalRequirements?: { message: string }[];
    quoteRequirements?: { message: string }[];
}

interface Proposal {
    proposalId: string;
    status: string;
    lender: string;
    productType: string;
    termMonths: number;
    apr?: number;
    monthlyRepayment?: { amountGBP: number };
    totalAmountPayable?: { amountGBP: number };
    cashPrice?: { amountGBP: number };
    deposit?: { amountGBP: number };
    paidOutDate?: string | null;
    active?: boolean;
    allowsResend?: boolean;
    lastUpdated: string;
    created: string;
}

// ─── Status colour helper ─────────────────────────────────────────────────────
function statusBadge(status: string) {
    const map: Record<string, string> = {
        'Approved': 'bg-emerald-100 text-emerald-700',
        'Broker Approved': 'bg-emerald-50 text-emerald-600',
        'Paid Out': 'bg-emerald-700 text-white',
        'Conditionally Approved': 'bg-amber-100 text-amber-700',
        'In progress': 'bg-blue-100 text-blue-700',
        'Quoted': 'bg-blue-50 text-blue-600',
        'Declined': 'bg-red-100 text-red-600',
        'Pending': 'bg-amber-50 text-amber-600',
        'Not Proposed': 'bg-slate-100 text-slate-500',
    };
    const cls = map[status] ?? 'bg-slate-100 text-slate-500';
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    dealId: string;
    existingApplicationId?: string | null;
    dealPrice?: number;
    consumerFirstName?: string;
    consumerLastName?: string;
    consumerEmail?: string;
}

const TITLES = ['MR', 'MRS', 'MISS', 'MS', 'DOCTOR', 'OTHER'];
const PRODUCT_TYPES = ['HP', 'PCP'];
const ANNUAL_MILEAGES = [6000, 8000, 10000, 12000, 15000, 20000, 25000, 30000];
const TERM_MONTHS = [12, 24, 36, 48, 60];

export default function FinanceTab({ dealId, existingApplicationId, dealPrice, consumerFirstName, consumerLastName, consumerEmail }: Props) {
    const [application, setApplication] = useState<FinanceApplication | null>(null);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [proposals, setProposals] = useState<Proposal[]>([]);

    const [loadingApp, setLoadingApp] = useState(false);
    const [loadingQuotes, setLoadingQuotes] = useState(false);
    const [loadingProposals, setLoadingProposals] = useState(false);
    const [savingProposal, setSavingProposal] = useState<string | null>(null);
    const [patchingProposal, setPatchingProposal] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState('');
    const [toastType, setToastType] = useState<'ok' | 'err'>('ok');
    const [showQuotes, setShowQuotes] = useState(false);

    // ── Create form state ─────────────────────────────────────────────────────
    const [title, setTitle] = useState('MR');
    const [firstName, setFirstName] = useState(consumerFirstName ?? '');
    const [lastName, setLastName] = useState(consumerLastName ?? '');
    const [email, setEmail] = useState(consumerEmail ?? '');
    const [productType, setProductType] = useState('HP');
    const [termMonths, setTermMonths] = useState(36);
    const [annualMileage, setAnnualMileage] = useState(10000);
    const [cashPrice, setCashPrice] = useState(String(dealPrice ?? ''));
    const [deposit, setDeposit] = useState('');

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast(msg); setToastType(type);
        setTimeout(() => setToast(''), 3500);
    };

    // ── Fetch existing application ────────────────────────────────────────────
    const fetchApplication = useCallback(async (appId: string) => {
        setLoadingApp(true);
        try {
            const res = await fetch(`/api/deals/${dealId}/finance?applicationId=${appId}`);
            const data = await res.json();
            if (data.ok) setApplication(data.application);
            else showToast(data.error || 'Failed to load application.', 'err');
        } finally { setLoadingApp(false); }
    }, [dealId]);

    const fetchProposals = useCallback(async (appId: string) => {
        setLoadingProposals(true);
        try {
            const res = await fetch(`/api/deals/${dealId}/finance/proposals?applicationId=${appId}`);
            const data = await res.json();
            if (data.ok) setProposals(data.proposals ?? []);
        } finally { setLoadingProposals(false); }
    }, [dealId]);

    useEffect(() => {
        if (existingApplicationId) {
            fetchApplication(existingApplicationId);
            fetchProposals(existingApplicationId);
        }
    }, [existingApplicationId, fetchApplication, fetchProposals]);

    // ── Create application ────────────────────────────────────────────────────
    const handleCreate = async () => {
        if (!cashPrice || !deposit) { showToast('Cash price and deposit are required.', 'err'); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`/api/deals/${dealId}/finance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicant: { title, firstName, lastName, email },
                    financeTerms: {
                        productType, termMonths, estimatedAnnualMileage: annualMileage,
                        cashPrice: { amountGBP: Number(cashPrice) },
                        deposit: { amountGBP: Number(deposit) },
                    },
                }),
            });
            const data = await res.json();
            if (data.ok) { setApplication(data.application); showToast('Finance application created.'); }
            else showToast(data.error || 'Failed to create application.', 'err');
        } finally { setSubmitting(false); }
    };

    // ── Generate quotes ───────────────────────────────────────────────────────
    const handleGetQuotes = async () => {
        if (!application?.applicationId) return;
        setLoadingQuotes(true); setShowQuotes(true);
        try {
            const res = await fetch(`/api/deals/${dealId}/finance/quotes?applicationId=${application.applicationId}`, { method: 'POST' });
            const data = await res.json();
            if (data.ok) { setQuotes(data.quotes ?? []); showToast(`${data.quotes?.length ?? 0} quote(s) received.`); }
            else showToast(data.error || 'Could not generate quotes.', 'err');
        } finally { setLoadingQuotes(false); }
    };

    // ── Send proposal ─────────────────────────────────────────────────────────
    const handleSendProposal = async (quoteId: string) => {
        if (!application?.applicationId) return;
        setSavingProposal(quoteId);
        try {
            const res = await fetch(`/api/deals/${dealId}/finance/proposals?applicationId=${application.applicationId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quoteId }),
            });
            const data = await res.json();
            if (data.ok) {
                showToast('Proposal sent to lender.');
                fetchProposals(application.applicationId);
                setShowQuotes(false);
            } else showToast(data.error || 'Failed to send proposal.', 'err');
        } finally { setSavingProposal(null); }
    };

    // ── Mark active / paid out ────────────────────────────────────────────────
    const patchProposal = async (proposalId: string, patch: Record<string, any>, successMsg: string) => {
        if (!application?.applicationId) return;
        setPatchingProposal(proposalId);
        try {
            const res = await fetch(
                `/api/deals/${dealId}/finance/proposals/${proposalId}?applicationId=${application.applicationId}`,
                { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }
            );
            const data = await res.json();
            if (data.ok) { showToast(successMsg); fetchProposals(application.applicationId); fetchApplication(application.applicationId); }
            else showToast(data.error || 'Failed.', 'err');
        } finally { setPatchingProposal(null); }
    };

    // ── Render: No application yet ────────────────────────────────────────────
    if (!existingApplicationId && !application) {
        return (
            <div className="p-5">
                {toast && (
                    <div className={`mb-4 px-4 py-2.5 rounded-lg text-[12px] font-semibold ${toastType === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {toast}
                    </div>
                )}
                <div className="max-w-xl mx-auto">
                    <h3 className="text-[14px] font-bold text-slate-800 mb-1">New Finance Application</h3>
                    <p className="text-[12px] text-slate-500 mb-5">
                        Create a finance application to generate quotes from your lender panel.
                    </p>

                    <div className="space-y-5">
                        {/* Applicant */}
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Applicant</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Title</label>
                                    <select value={title} onChange={e => setTitle(e.target.value)} className="input">
                                        {TITLES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">First Name *</label>
                                    <input value={firstName} onChange={e => setFirstName(e.target.value)} className="input" placeholder="James" />
                                </div>
                                <div>
                                    <label className="label">Last Name *</label>
                                    <input value={lastName} onChange={e => setLastName(e.target.value)} className="input" placeholder="Smith" />
                                </div>
                                <div>
                                    <label className="label">Email *</label>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="james@example.com" />
                                </div>
                            </div>
                        </div>

                        {/* Finance Terms */}
                        <div>
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Finance Terms</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Product Type *</label>
                                    <select value={productType} onChange={e => setProductType(e.target.value)} className="input">
                                        {PRODUCT_TYPES.map(p => <option key={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Term (months) *</label>
                                    <select value={termMonths} onChange={e => setTermMonths(Number(e.target.value))} className="input">
                                        {TERM_MONTHS.map(t => <option key={t} value={t}>{t} months</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Annual Mileage *</label>
                                    <select value={annualMileage} onChange={e => setAnnualMileage(Number(e.target.value))} className="input">
                                        {ANNUAL_MILEAGES.map(m => <option key={m} value={m}>{m.toLocaleString()} mi/yr</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Cash Price (£) *</label>
                                    <input type="number" value={cashPrice} onChange={e => setCashPrice(e.target.value)} className="input" placeholder="20000" />
                                </div>
                                <div>
                                    <label className="label">Deposit (£) *</label>
                                    <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} className="input" placeholder="3000" />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={submitting || !firstName || !lastName || !email || !cashPrice}
                            className="w-full py-2.5 bg-[#4D7CFF] text-white font-bold text-[13px] rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {submitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</> : 'Create Finance Application'}
                        </button>
                    </div>
                </div>

                <style>{`.label{display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px}.input{width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;background:white}.input:focus{border-color:#4D7CFF}`}</style>
            </div>
        );
    }

    // ── Render: Loading application ───────────────────────────────────────────
    if (loadingApp) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-4 border-slate-100 border-t-[#4D7CFF] rounded-full animate-spin" />
            </div>
        );
    }

    // ── Render: Application exists ────────────────────────────────────────────
    return (
        <div className="p-5 space-y-5">
            {toast && (
                <div className={`px-4 py-2.5 rounded-lg text-[12px] font-semibold ${toastType === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                    {toast}
                </div>
            )}

            {/* ── Application Summary ── */}
            {application && (
                <div className="border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[12px] font-bold text-slate-700">Finance Application</h3>
                        <div className="flex items-center gap-2">
                            {statusBadge(application.status)}
                            <span className="text-[10px] font-mono text-slate-400">{application.applicationId?.slice(0, 8)}…</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                        <div>
                            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Applicant</p>
                            <p className="font-semibold text-slate-700">{application.applicant?.firstName} {application.applicant?.lastName}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Product</p>
                            <p className="font-semibold text-slate-700">{application.financeTerms?.productType} · {application.financeTerms?.termMonths}mo</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Cash Price</p>
                            <p className="font-semibold text-slate-700">£{application.financeTerms?.cashPrice?.amountGBP?.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] uppercase tracking-wider">Deposit</p>
                            <p className="font-semibold text-slate-700">£{application.financeTerms?.deposit?.amountGBP?.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Generate Quotes button — only show when no proposals yet and status allows */}
                    {!['Paid Out'].includes(application.status) && proposals.length === 0 && (
                        <div className="mt-4 flex items-center gap-3">
                            <button
                                onClick={handleGetQuotes}
                                disabled={loadingQuotes}
                                className="flex items-center gap-2 px-4 py-2 bg-[#4D7CFF] text-white text-[12px] font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                            >
                                {loadingQuotes
                                    ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Getting Quotes…</>
                                    : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>Generate Finance Quotes</>
                                }
                            </button>
                            {application.status !== 'Quoted' && (
                                <p className="text-[11px] text-slate-400">Ensure soft credit check is completed before generating quotes.</p>
                            )}
                        </div>
                    )}
                    {proposals.length > 0 && !showQuotes && (
                        <button
                            onClick={() => { setShowQuotes(true); handleGetQuotes(); }}
                            className="mt-3 text-[12px] font-semibold text-[#4D7CFF] hover:underline"
                        >
                            Generate new quotes
                        </button>
                    )}
                </div>
            )}

            {/* ── Quotes ── */}
            {showQuotes && (
                <div>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Lender Quotes</h3>
                    {loadingQuotes ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-6 h-6 border-4 border-slate-100 border-t-[#4D7CFF] rounded-full animate-spin" />
                        </div>
                    ) : quotes.length === 0 ? (
                        <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-[12px] text-slate-400">
                            No eligible quotes returned. Check application completeness and try again.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {quotes.map(q => (
                                <div key={q.quoteId} className={`border rounded-xl p-4 ${q.eligible ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-[13px] font-bold text-slate-800">{q.lender}</p>
                                            <p className="text-[11px] text-slate-500">{q.productName || q.productType}</p>
                                        </div>
                                        {q.eligible
                                            ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Eligible</span>
                                            : <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Not Eligible</span>
                                        }
                                    </div>
                                    <div className="space-y-1.5 text-[12px] mb-4">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">APR</span>
                                            <span className="font-bold text-slate-800">{q.apr}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Monthly</span>
                                            <span className="font-bold text-slate-800">£{q.monthlyRepayment?.amountGBP?.toLocaleString() ?? '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Total Payable</span>
                                            <span className="font-semibold text-slate-700">£{q.totalAmountPayable?.amountGBP?.toLocaleString() ?? '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Term</span>
                                            <span className="font-semibold text-slate-700">{q.termMonths} months</span>
                                        </div>
                                    </div>
                                    {q.proposalRequirements && q.proposalRequirements.length > 0 && (
                                        <div className="mb-3 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                                            <p className="text-[10px] font-bold text-amber-700 mb-1">Requirements:</p>
                                            {q.proposalRequirements.map((r, i) => (
                                                <p key={i} className="text-[10px] text-amber-600">{r.message}</p>
                                            ))}
                                        </div>
                                    )}
                                    {q.eligible && (
                                        <button
                                            onClick={() => handleSendProposal(q.quoteId)}
                                            disabled={!!savingProposal}
                                            className="w-full py-2 bg-[#4D7CFF] text-white text-[12px] font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                                        >
                                            {savingProposal === q.quoteId
                                                ? <span className="flex items-center justify-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</span>
                                                : 'Send Proposal'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Proposals ── */}
            {(loadingProposals || proposals.length > 0) && (
                <div>
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Proposals</h3>
                    {loadingProposals ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-4 border-slate-100 border-t-[#4D7CFF] rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {proposals.map(p => {
                                const isApproved = ['Approved', 'Broker Approved', 'Conditionally Approved'].includes(p.status);
                                const isPaidOut = p.status === 'Paid Out';
                                const canMarkActive = isApproved && !p.active && !isPaidOut;
                                const canMarkPaidOut = (isApproved || p.active) && !isPaidOut && p.status !== 'Broker Approved';
                                const today = new Date().toISOString().split('T')[0];

                                return (
                                    <div key={p.proposalId} className={`border rounded-xl p-4 ${p.active ? 'border-[#4D7CFF] bg-blue-50/30' : isPaidOut ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-[13px] font-bold text-slate-800">{p.lender}</p>
                                                    {statusBadge(p.status)}
                                                    {p.active && <span className="text-[10px] font-bold bg-[#4D7CFF] text-white px-2 py-0.5 rounded">Active</span>}
                                                    {isPaidOut && <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">Paid Out</span>}
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-0.5">{p.productType} · {p.termMonths} months</p>
                                            </div>
                                            <p className="text-[11px] text-slate-400 shrink-0">{new Date(p.lastUpdated).toLocaleDateString('en-GB')}</p>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px] mb-4">
                                            <div>
                                                <p className="text-slate-400 text-[10px]">APR</p>
                                                <p className="font-bold text-slate-800">{p.apr ?? '—'}%</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 text-[10px]">Monthly</p>
                                                <p className="font-bold text-slate-800">£{p.monthlyRepayment?.amountGBP?.toLocaleString() ?? '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 text-[10px]">Total Payable</p>
                                                <p className="font-semibold text-slate-700">£{p.totalAmountPayable?.amountGBP?.toLocaleString() ?? '—'}</p>
                                            </div>
                                            {p.paidOutDate && (
                                                <div>
                                                    <p className="text-slate-400 text-[10px]">Paid Out Date</p>
                                                    <p className="font-semibold text-emerald-700">{p.paidOutDate}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 flex-wrap">
                                            {canMarkActive && (
                                                <button
                                                    onClick={() => patchProposal(p.proposalId, { active: true }, 'Proposal set as active.')}
                                                    disabled={patchingProposal === p.proposalId}
                                                    className="px-3 py-1.5 text-[12px] font-bold border border-[#4D7CFF] text-[#4D7CFF] rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                                                >
                                                    {patchingProposal === p.proposalId ? 'Setting…' : 'Set Active'}
                                                </button>
                                            )}
                                            {canMarkPaidOut && (
                                                <button
                                                    onClick={() => patchProposal(p.proposalId, { paidOutDate: today }, 'Marked as paid out!')}
                                                    disabled={patchingProposal === p.proposalId}
                                                    className="px-3 py-1.5 text-[12px] font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                                >
                                                    {patchingProposal === p.proposalId
                                                        ? <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing…</span>
                                                        : '✓ Mark as Paid Out'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
