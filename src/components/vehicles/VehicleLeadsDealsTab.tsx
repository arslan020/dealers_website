'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface CustomerRef {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
}

interface Lead {
    _id: string;
    customerId: CustomerRef;
    platform: 'AutoTrader' | 'Website' | 'Manual';
    status: 'NEW_LEAD' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'WON' | 'LOST' | 'CLOSED';
    message?: string;
    createdAt: string;
}

interface Deal {
    dealId: string;
    created?: string;
    advertiserDealStatus?: string;
    consumer: { firstName: string; lastName: string; email: string; phone?: string; type?: string };
    price?: {
        totalPrice?: { amountGBP?: number };
        suppliedPrice?: { amountGBP?: number };
        adminFee?: { amountGBP?: number };
    };
    buyingSignals?: { intent?: string; dealIntentScore?: number };
    messages?: { id: string; lastUpdated?: string } | null;
}

interface Props {
    vehicleId: string;
    stockId?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function initials(first?: string, last?: string) {
    return `${first?.charAt(0) ?? ''}${last?.charAt(0) ?? ''}`.toUpperCase();
}

function ago(iso?: string) {
    if (!iso) return '—';
    try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
    catch { return '—'; }
}

function fmtDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtCurrency(amount?: number) {
    if (amount == null) return '—';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

const STATUS_STYLES: Record<string, string> = {
    NEW_LEAD: 'bg-emerald-500 text-white',
    ACKNOWLEDGED: 'bg-blue-500 text-white',
    IN_PROGRESS: 'bg-amber-500 text-white',
    WON: 'bg-green-600 text-white',
    LOST: 'bg-red-500 text-white',
    CLOSED: 'bg-slate-400 text-white',
};

const STATUS_LABELS: Record<string, string> = {
    NEW_LEAD: 'New Lead',
    ACKNOWLEDGED: 'Acknowledged',
    IN_PROGRESS: 'In Progress',
    WON: 'Won',
    LOST: 'Lost',
    CLOSED: 'Closed',
};

const DEAL_STATUS_STYLES: Record<string, string> = {
    Completed: 'bg-green-100 text-green-700',
    Cancelled: 'bg-red-100 text-red-700',
    'In progress': 'bg-blue-100 text-blue-700',
};

/* ─── Create Lead Modal ──────────────────────────────────────────────────────── */
function CreateLeadModal({ vehicleId, onCreated, onClose }: {
    vehicleId: string;
    onCreated: (lead: Lead) => void;
    onClose: () => void;
}) {
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', platform: 'Manual', message: '' });
    const [saving, setSaving] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.firstName.trim() || !form.lastName.trim()) {
            toast.error('First and last name are required');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerDetails: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined },
                    platform: form.platform,
                    message: form.message.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed');
            toast.success('Lead created');
            onCreated(data.lead);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-bold text-slate-800">Create Lead</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                </div>
                <form onSubmit={submit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">First Name *</label>
                            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Last Name *</label>
                            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Email</label>
                        <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Phone</label>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Type</label>
                        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                            <option value="Manual">Walk-in / Callback</option>
                            <option value="Website">Website</option>
                            <option value="AutoTrader">AutoTrader</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Message</label>
                        <textarea rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 border border-slate-200 rounded-lg py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 bg-[#4D7CFF] text-white rounded-lg py-2 text-[13px] font-semibold hover:bg-[#3a6ae0] disabled:opacity-60">
                            {saving ? 'Creating…' : 'Create Lead'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */
export function VehicleLeadsDealsTab({ vehicleId, stockId }: Props) {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [leadsLoading, setLeadsLoading] = useState(true);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [dealsLoading, setDealsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    const fetchLeads = useCallback(async () => {
        setLeadsLoading(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/leads`);
            const data = await res.json();
            if (data.ok) setLeads(data.leads || []);
        } catch { /* silent */ } finally {
            setLeadsLoading(false);
        }
    }, [vehicleId]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    useEffect(() => {
        if (!stockId) return;
        setDealsLoading(true);
        fetch(`/api/deals/stock/${stockId}`)
            .then(r => r.json())
            .then(d => { if (d.ok) setDeals(d.deals || []); })
            .catch(() => { })
            .finally(() => setDealsLoading(false));
    }, [stockId]);

    const filteredLeads = leads.filter(l => {
        if (!search) return true;
        const q = search.toLowerCase();
        const c = l.customerId;
        return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    });

    const filteredDeals = deals.filter(d => {
        if (!search) return true;
        const q = search.toLowerCase();
        return `${d.consumer.firstName} ${d.consumer.lastName}`.toLowerCase().includes(q) || d.consumer.email?.toLowerCase().includes(q);
    });

    return (
        <div className="space-y-6 w-full">

            {/* ── Leads Section ── */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Leads</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1.5 border border-emerald-500 text-emerald-600 text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Create Lead
                        </button>
                        <input
                            type="text"
                            placeholder="Search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] w-40 focus:outline-none focus:border-[#4D7CFF]"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lead</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Time</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {leadsLoading && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-10 text-center">
                                        <div className="w-7 h-7 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-[12px] text-slate-400">Loading leads…</p>
                                    </td>
                                </tr>
                            )}
                            {!leadsLoading && filteredLeads.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-12 text-center">
                                        <div className="text-slate-300 mb-2">
                                            <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-[13px] font-semibold text-slate-500">No leads found for this vehicle.</p>
                                        <button onClick={() => setShowCreate(true)} className="mt-2 text-[12px] text-[#4D7CFF] hover:underline font-semibold">Create the first lead</button>
                                    </td>
                                </tr>
                            )}
                            {!leadsLoading && filteredLeads.map(lead => {
                                const c = lead.customerId;
                                return (
                                    <tr key={lead._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        {/* Lead column */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-[#4D7CFF] flex items-center justify-center text-white font-bold text-[12px] flex-shrink-0">
                                                    {initials(c.firstName, c.lastName)}
                                                </div>
                                                <div>
                                                    <div className="text-[13px] font-bold text-[#4D7CFF]">{c.firstName} {c.lastName}</div>
                                                    {c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        {/* Type */}
                                        <td className="px-4 py-3.5 text-[13px] text-slate-600 font-medium">{lead.platform === 'Manual' ? 'Callback' : lead.platform}</td>
                                        {/* Status */}
                                        <td className="px-4 py-3.5">
                                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${STATUS_STYLES[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                                                {STATUS_LABELS[lead.status] || lead.status}
                                            </span>
                                        </td>
                                        {/* Time */}
                                        <td className="px-4 py-3.5 text-[12px] text-slate-500">{ago(lead.createdAt)}</td>
                                        {/* Actions */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2 justify-end">
                                                <a href="/app/crm" className="flex items-center gap-1.5 bg-[#4D7CFF] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#3a6ae0] transition-colors whitespace-nowrap">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                    </svg>
                                                    View Lead
                                                </a>
                                                <button className="flex items-center gap-1.5 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors whitespace-nowrap">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                    Create Order
                                                </button>
                                                <button className="flex items-center gap-1.5 border border-emerald-500 text-emerald-600 text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors whitespace-nowrap">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    Create Invoice
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination row */}
                {!leadsLoading && filteredLeads.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                        <div className="flex items-center gap-2 text-[12px] text-slate-500">
                            Show
                            <select className="border border-slate-200 rounded px-2 py-0.5 text-[12px] focus:outline-none">
                                <option>10</option>
                                <option>25</option>
                                <option>50</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-1 text-[12px] text-slate-500">
                            <span>Previous</span>
                            <span className="w-7 h-7 flex items-center justify-center bg-[#4D7CFF] text-white rounded font-bold">1</span>
                            <span>Next</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Deals / Orders Section ── */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Orders</h2>
                    {stockId && (
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-3 py-1 border border-slate-100 rounded-md">
                            Stock ID: {stockId.substring(0, 8)}
                        </span>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Order</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Issued</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {!stockId && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center">
                                        <div className="text-slate-300 mb-2">
                                            <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                        </div>
                                        <p className="text-[13px] font-semibold text-slate-500">This vehicle is not linked to AutoTrader stock.</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Sync to AutoTrader to see live orders and deals.</p>
                                    </td>
                                </tr>
                            )}
                            {stockId && dealsLoading && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-10 text-center">
                                        <div className="w-7 h-7 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-[12px] text-slate-400">Fetching orders from AutoTrader…</p>
                                    </td>
                                </tr>
                            )}
                            {stockId && !dealsLoading && filteredDeals.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center">
                                        <div className="text-slate-300 mb-2">
                                            <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-[13px] font-semibold text-slate-500">No orders found for this vehicle.</p>
                                    </td>
                                </tr>
                            )}
                            {stockId && !dealsLoading && filteredDeals.map((deal, idx) => (
                                <tr key={deal.dealId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    {/* Order # */}
                                    <td className="px-5 py-3.5">
                                        <span className="text-[13px] font-bold text-[#4D7CFF]">
                                            {String(idx + 1).padStart(6, '0')}
                                        </span>
                                    </td>
                                    {/* Customer */}
                                    <td className="px-4 py-3.5">
                                        <span className="text-[13px] font-semibold text-slate-700">
                                            {deal.consumer.firstName} {deal.consumer.lastName}
                                        </span>
                                    </td>
                                    {/* Status */}
                                    <td className="px-4 py-3.5">
                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${DEAL_STATUS_STYLES[deal.advertiserDealStatus || ''] || 'bg-slate-100 text-slate-600'}`}>
                                            {deal.advertiserDealStatus || 'In progress'}
                                        </span>
                                    </td>
                                    {/* Type */}
                                    <td className="px-4 py-3.5 text-[13px] text-slate-600 font-medium">
                                        {deal.consumer.type || 'Private'}
                                    </td>
                                    {/* Total */}
                                    <td className="px-4 py-3.5 text-[13px] font-semibold text-slate-800">
                                        {fmtCurrency(deal.price?.totalPrice?.amountGBP)}
                                    </td>
                                    {/* Issued */}
                                    <td className="px-4 py-3.5 text-[12px] text-slate-500">
                                        {fmtDate(deal.created)}
                                    </td>
                                    {/* Actions */}
                                    <td className="px-4 py-3.5">
                                        <a href={`/app/deals/${deal.dealId}`} className="flex items-center gap-1.5 bg-[#4D7CFF] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#3a6ae0] transition-colors whitespace-nowrap">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            View
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {stockId && !dealsLoading && filteredDeals.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                        <div className="flex items-center gap-2 text-[12px] text-slate-500">
                            Show
                            <select className="border border-slate-200 rounded px-2 py-0.5 text-[12px] focus:outline-none">
                                <option>5</option>
                                <option>10</option>
                                <option>25</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-1 text-[12px] text-slate-500">
                            <span>Previous</span>
                            <span className="w-7 h-7 flex items-center justify-center bg-[#4D7CFF] text-white rounded font-bold">1</span>
                            <span>Next</span>
                        </div>
                    </div>
                )}
            </div>

            {showCreate && (
                <CreateLeadModal
                    vehicleId={vehicleId}
                    onCreated={lead => { setLeads(p => [lead, ...p]); setShowCreate(false); }}
                    onClose={() => setShowCreate(false)}
                />
            )}
        </div>
    );
}
