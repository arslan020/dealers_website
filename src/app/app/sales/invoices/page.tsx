'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Invoice {
    _id: string;
    invoiceNumber: string;
    status: 'draft' | 'issued' | 'paid' | 'credited' | 'cancelled' | 'void';
    invoiceType: 'VAT Invoice' | 'Margin Scheme';
    invoiceCategory: 'sale' | 'aftersale' | 'finance_provider';
    invoiceDate: string;
    paidAt?: string;
    customerId: { firstName: string; lastName: string; businessName?: string; email?: string } | null;
    vehicleId: { vrm: string; make: string; model: string; derivative: string; stockId?: string } | null;
    vehicleVrm?: string;
    lineItems: { priceExcVat: number; vatRate: string; isVehicle?: boolean }[];
    partExchanges: { price: number; vatRate: string }[];
    finance?: { amount: number; customerDeposit: number };
    payments: { amount: number }[];
    credits: { amount: number; vatRate: string }[];
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const GBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

function vatAmt(price: number, rate: string) {
    if (rate === '5%') return price * 0.05;
    if (rate === '20%') return price * 0.2;
    return 0;
}

function calcInvoice(inv: Invoice) {
    let subtotal = 0;
    (inv.lineItems ?? []).forEach(i => { subtotal += i.priceExcVat; });
    const pxTotal = (inv.partExchanges ?? []).reduce((s, p) => s + p.price, 0);
    const finance = inv.finance?.amount ?? 0;
    const deposit = inv.finance?.customerDeposit ?? 0;
    const totalPaid = (inv.payments ?? []).reduce((s, p) => s + p.amount, 0);
    const total = subtotal - pxTotal;
    const balance = total - totalPaid;
    const creditSubtotal = (inv.credits ?? []).reduce((s, c) => s + c.amount, 0);
    const creditVat = (inv.credits ?? []).reduce((s, c) => s + vatAmt(c.amount, c.vatRate), 0);
    return { subtotal, pxTotal, total, finance, deposit, totalPaid, balance, creditSubtotal, creditVat };
}

function contactName(c: Invoice['customerId']) {
    if (!c) return '—';
    if (c.businessName) return c.businessName;
    return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—';
}

function vehicleLabel(inv: Invoice) {
    if (inv.vehicleId) return inv.vehicleId.vrm;
    if (inv.vehicleVrm) return inv.vehicleVrm;
    return null;
}

/* ─── Status Badge ───────────────────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-[#14b8a6] text-white',
    issued: 'bg-[#4D7CFF] text-white',
    paid: 'bg-[#10b981] text-white',
    credited: 'bg-[#f59e0b] text-white',
    cancelled: 'bg-slate-400 text-white',
    void: 'bg-slate-300 text-slate-600',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex px-3 py-1 rounded-md text-[12px] font-semibold capitalize ${STATUS_STYLES[status] ?? 'bg-slate-200 text-slate-700'}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}

/* ─── Filter Panel ───────────────────────────────────────────────────────────── */
const ALL_STATUSES = ['draft', 'issued', 'paid', 'credited', 'cancelled'];

function FilterPanel({ filters, onChange, onClose }: {
    filters: { statuses: string[]; issuedFrom: string; issuedTo: string; paidFrom: string; paidTo: string };
    onChange: (f: typeof filters) => void;
    onClose: () => void;
}) {
    const [local, setLocal] = useState(filters);
    function toggle(s: string) {
        setLocal(prev => ({
            ...prev,
            statuses: prev.statuses.includes(s) ? prev.statuses.filter(x => x !== s) : [...prev.statuses, s],
        }));
    }
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-5 mt-2 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Status */}
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Status</label>
                    <div className="flex flex-wrap gap-2">
                        {ALL_STATUSES.map(s => (
                            <button key={s} onClick={() => toggle(s)}
                                className={`px-3 py-1 rounded-md text-[12px] font-semibold border transition-colors ${local.statuses.includes(s) ? 'bg-[#4D7CFF] text-white border-[#4D7CFF]' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Date ranges */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Issued From</label>
                        <input type="date" value={local.issuedFrom} onChange={e => setLocal(p => ({ ...p, issuedFrom: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Issued To</label>
                        <input type="date" value={local.issuedTo} onChange={e => setLocal(p => ({ ...p, issuedTo: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Paid From</label>
                        <input type="date" value={local.paidFrom} onChange={e => setLocal(p => ({ ...p, paidFrom: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Paid To</label>
                        <input type="date" value={local.paidTo} onChange={e => setLocal(p => ({ ...p, paidTo: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => { setLocal({ statuses: ALL_STATUSES, issuedFrom: '', issuedTo: '', paidFrom: '', paidTo: '' }); }}
                    className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Reset</button>
                <button onClick={() => { onChange(local); onClose(); }}
                    className="px-4 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae0]">Apply</button>
            </div>
        </div>
    );
}

/* ─── Export helpers ─────────────────────────────────────────────────────────── */
const EXPORT_HEADERS = ['Invoice', 'Contact', 'Vehicle', 'Status', 'Type', 'Sub-Total', 'Total', 'Deposits', 'Finance', 'Total Paid', 'Balance To Pay', 'Invoice Date'];

function rowValues(inv: Invoice) {
    const t = calcInvoice(inv);
    return [
        inv.invoiceNumber,
        contactName(inv.customerId),
        vehicleLabel(inv) ?? '',
        inv.status,
        inv.invoiceType === 'Margin Scheme' ? 'Marginal' : 'VAT',
        t.subtotal.toFixed(2),
        t.total.toFixed(2),
        t.deposit.toFixed(2),
        t.finance.toFixed(2),
        t.totalPaid.toFixed(2),
        t.balance.toFixed(2),
        inv.invoiceDate,
    ];
}

function downloadCSV(rows: Invoice[]) {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [EXPORT_HEADERS.map(escape).join(',')];
    rows.forEach(inv => lines.push(rowValues(inv).map(v => escape(String(v))).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
}

function downloadExcel(rows: Invoice[]) {
    let html = '<table><tr>' + EXPORT_HEADERS.map(h => `<th>${h}</th>`).join('') + '</tr>';
    rows.forEach(inv => { html += '<tr>' + rowValues(inv).map(v => `<td>${v}</td>`).join('') + '</tr>'; });
    html += '</table>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `invoices-${new Date().toISOString().slice(0, 10)}.xls`; a.click();
    URL.revokeObjectURL(url);
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [filters, setFilters] = useState({
        statuses: ALL_STATUSES,
        issuedFrom: '',
        issuedTo: '',
        paidFrom: '',
        paidTo: '',
    });

    const limit = 25;

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                search,
                status: filters.statuses.join(','),
                ...(filters.issuedFrom && { issuedFrom: filters.issuedFrom }),
                ...(filters.issuedTo && { issuedTo: filters.issuedTo }),
                ...(filters.paidFrom && { paidFrom: filters.paidFrom }),
                ...(filters.paidTo && { paidTo: filters.paidTo }),
            });
            const res = await fetch(`/api/invoices?${params}`);
            const data = await res.json();
            if (data.ok) { setInvoices(data.invoices || []); setTotal(data.total || 0); }
        } catch { /* silent */ } finally { setLoading(false); }
    }, [page, search, filters]);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    async function exportAll(format: 'csv' | 'excel') {
        setExporting(true);
        try {
            const params = new URLSearchParams({
                page: '1', limit: '5000', search,
                status: filters.statuses.join(','),
                ...(filters.issuedFrom && { issuedFrom: filters.issuedFrom }),
                ...(filters.issuedTo && { issuedTo: filters.issuedTo }),
                ...(filters.paidFrom && { paidFrom: filters.paidFrom }),
                ...(filters.paidTo && { paidTo: filters.paidTo }),
            });
            const res = await fetch(`/api/invoices?${params}`);
            const data = await res.json();
            const rows: Invoice[] = data.invoices ?? [];
            if (format === 'csv') downloadCSV(rows);
            else downloadExcel(rows);
        } catch { /* silent */ } finally { setExporting(false); }
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const filterActive = showFilter;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">Invoices</h1>
                    <div className="flex items-center gap-2">
                        <Link href="/app/sales/invoices/create"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#4D7CFF] text-[#4D7CFF] rounded-lg text-[13px] font-semibold hover:bg-blue-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            Create Invoice
                        </Link>
                        <Link href="/app/sales/invoices/batch"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#4D7CFF] text-[#4D7CFF] rounded-lg text-[13px] font-semibold hover:bg-blue-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414A1 1 0 0120 8.414V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                            Batch Invoice
                        </Link>
                        <button onClick={() => setShowFilter(p => !p)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[13px] font-semibold transition-colors ${filterActive ? 'bg-[#4D7CFF] text-white border-[#4D7CFF]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                            Filter
                        </button>
                        <input
                            type="text"
                            placeholder="Search"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] w-40 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF]/20"
                        />
                    </div>
                </div>

                {/* Filter panel */}
                {showFilter && (
                    <div className="px-5 pb-2">
                        <FilterPanel filters={filters} onChange={f => { setFilters(f); setPage(1); }} onClose={() => setShowFilter(false)} />
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="px-4 py-3 text-left w-8">
                                    <input type="checkbox" className="rounded border-slate-300" />
                                </th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px] whitespace-nowrap">Invoice ↓</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Contact</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Vehicle</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Status</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Assigned</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Type</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Credits</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px] whitespace-nowrap">Sub-Total</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Total</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Deposits</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Finance</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px] whitespace-nowrap">Total Paid</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px] whitespace-nowrap">Balance To Pay</th>
                                <th className="px-4 py-3 w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        {Array.from({ length: 15 }).map((__, j) => (
                                            <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-16" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={15} className="px-4 py-12 text-center text-slate-400 text-[13px]">No invoices found</td>
                                </tr>
                            ) : invoices.map(inv => {
                                const { subtotal, pxTotal, total, finance, deposit, totalPaid, balance, creditSubtotal } = calcInvoice(inv);
                                const vrm = vehicleLabel(inv);
                                const isAftersale = inv.invoiceCategory === 'aftersale';
                                return (
                                    <tr key={inv._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-4 py-3">
                                            <input type="checkbox" className="rounded border-slate-300" />
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link href={`/app/sales/invoices/${inv._id}`} className="text-[#4D7CFF] font-semibold hover:underline">
                                                {inv.invoiceNumber}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[#4D7CFF] hover:underline cursor-pointer">
                                                {contactName(inv.customerId)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {vrm ? (
                                                <span className="inline-flex items-center gap-1 text-[#4D7CFF] font-medium hover:underline cursor-pointer">
                                                    {vrm}
                                                    {isAftersale ? (
                                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    ) : (
                                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 italic text-[12px]">None</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                                        <td className="px-4 py-3 text-slate-400 text-[12px] italic">No data.</td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {inv.invoiceType === 'Margin Scheme' ? 'Marginal' : 'VAT'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-700">{(inv.credits ?? []).length}</td>
                                        <td className="px-4 py-3 text-right text-slate-700 font-medium">{GBP(subtotal)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700 font-medium">{GBP(total)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{GBP(deposit)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{GBP(finance)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{GBP(totalPaid)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700 font-medium">{GBP(balance)}</td>
                                        <td className="px-4 py-3">
                                            <Link href={`/app/sales/invoices/${inv._id}`}
                                                className="w-7 h-7 rounded-md bg-[#4D7CFF] text-white flex items-center justify-center hover:bg-[#3a6ae0] transition-colors">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[13px] text-slate-500">
                        <span>Show</span>
                        <select className="border border-slate-200 rounded px-2 py-0.5 text-[13px]" value={limit} disabled>
                            <option>25</option>
                        </select>
                        <button onClick={() => exportAll('csv')} disabled={exporting}
                            className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-[12px] disabled:opacity-50">
                            {exporting ? '…' : 'CSV'}
                        </button>
                        <button onClick={() => exportAll('excel')} disabled={exporting}
                            className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-[12px] disabled:opacity-50">
                            {exporting ? '…' : 'Excel'}
                        </button>
                    </div>
                    <div className="flex items-center gap-1 text-[13px]">
                        <span className="text-slate-500 mr-2">
                            {total === 0 ? '0' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)}`} of {total}
                        </span>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-[12px]">Previous</button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                            <button key={n} onClick={() => setPage(n)}
                                className={`w-7 h-7 rounded text-[12px] font-semibold ${n === page ? 'bg-[#4D7CFF] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                {n}
                            </button>
                        ))}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                            className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-[12px]">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
