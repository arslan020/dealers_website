'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Order {
    _id: string;
    invoiceNumber: string;
    status: 'draft' | 'issued' | 'paid' | 'credited' | 'cancelled' | 'void';
    invoiceType: 'VAT Invoice' | 'Margin Scheme';
    invoiceDate: string;
    customerId: { firstName: string; lastName: string; businessName?: string } | null;
    vehicleId: { vrm: string } | null;
    vehicleVrm?: string;
    lineItems: { priceExcVat: number; vatRate: string }[];
    partExchanges: { price: number }[];
    finance?: { amount: number; customerDeposit: number };
    payments: { amount: number }[];
}

const GBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

function contactName(c: Order['customerId']) {
    if (!c) return '—';
    if (c.businessName) return c.businessName;
    return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—';
}

function calcOrder(o: Order) {
    const subtotal = o.lineItems.reduce((s, i) => s + i.priceExcVat, 0);
    const pxTotal = o.partExchanges.reduce((s, p) => s + p.price, 0);
    const finance = o.finance?.amount ?? 0;
    const deposit = o.finance?.customerDeposit ?? 0;
    const totalPaid = o.payments.reduce((s, p) => s + p.amount, 0);
    const total = subtotal - pxTotal;
    const balance = total - totalPaid;
    return { subtotal, pxTotal, total, finance, deposit, totalPaid, balance };
}

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-[#14b8a6] text-white',
    issued: 'bg-[#4D7CFF] text-white',
    paid: 'bg-[#10b981] text-white',
    credited: 'bg-[#f59e0b] text-white',
    cancelled: 'bg-slate-400 text-white',
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

function FilterPanel({ statuses, onChange, onClose }: {
    statuses: string[];
    onChange: (s: string[]) => void;
    onClose: () => void;
}) {
    const [local, setLocal] = useState(statuses);
    function toggle(s: string) {
        setLocal(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    }
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-5 mt-2 w-full">
            <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Status</label>
                <div className="flex flex-wrap gap-2">
                    {ALL_STATUSES.map(s => (
                        <button key={s} onClick={() => toggle(s)}
                            className={`px-3 py-1 rounded-md text-[12px] font-semibold border transition-colors ${local.includes(s) ? 'bg-[#4D7CFF] text-white border-[#4D7CFF]' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => setLocal(ALL_STATUSES)}
                    className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Reset</button>
                <button onClick={() => { onChange(local); onClose(); }}
                    className="px-4 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae0]">Apply</button>
            </div>
        </div>
    );
}

/* ─── Export helpers ─────────────────────────────────────────────────────────── */
const HEADERS = ['Order', 'Contact', 'Vehicle', 'Status', 'Type', 'Sub-Total', 'Part Exchanges', 'Total', 'Deposits', 'Finance', 'Total Paid', 'Balance To Pay', 'Order Date'];

function rowValues(o: Order) {
    const t = calcOrder(o);
    return [
        o.invoiceNumber,
        contactName(o.customerId),
        o.vehicleId?.vrm ?? o.vehicleVrm ?? '',
        o.status,
        o.invoiceType === 'Margin Scheme' ? 'Marginal' : 'VAT',
        t.subtotal.toFixed(2),
        t.pxTotal.toFixed(2),
        t.total.toFixed(2),
        t.deposit.toFixed(2),
        t.finance.toFixed(2),
        t.totalPaid.toFixed(2),
        t.balance.toFixed(2),
        o.invoiceDate,
    ];
}

function downloadCSV(rows: Order[]) {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [HEADERS.map(esc).join(',')];
    rows.forEach(o => lines.push(rowValues(o).map(v => esc(String(v))).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
}

function downloadExcel(rows: Order[]) {
    let html = '<table><tr>' + HEADERS.map(h => `<th>${h}</th>`).join('') + '</tr>';
    rows.forEach(o => { html += '<tr>' + rowValues(o).map(v => `<td>${v}</td>`).join('') + '</tr>'; });
    html += '</table>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.xls`; a.click();
    URL.revokeObjectURL(url);
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [showFilter, setShowFilter] = useState(false);
    const [statuses, setStatuses] = useState<string[]>(ALL_STATUSES);

    const limit = 25;

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit), search, status: statuses.join(',') });
            const res = await fetch(`/api/orders?${params}`);
            const data = await res.json();
            if (data.ok) { setOrders(data.orders || []); setTotal(data.total || 0); }
        } catch { } finally { setLoading(false); }
    }, [page, search, statuses]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    async function exportAll(format: 'csv' | 'excel') {
        setExporting(true);
        try {
            const params = new URLSearchParams({ page: '1', limit: '5000', search, status: statuses.join(',') });
            const res = await fetch(`/api/orders?${params}`);
            const data = await res.json();
            const rows: Order[] = data.orders ?? [];
            if (format === 'csv') downloadCSV(rows);
            else downloadExcel(rows);
        } catch { } finally { setExporting(false); }
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">Orders</h1>
                    <div className="flex items-center gap-2">
                        <Link href="/app/sales/orders/create"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#4D7CFF] text-[#4D7CFF] rounded-lg text-[13px] font-semibold hover:bg-blue-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            Create Order
                        </Link>
                        <button onClick={() => setShowFilter(p => !p)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[13px] font-semibold transition-colors ${showFilter ? 'bg-[#4D7CFF] text-white border-[#4D7CFF]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                            Filter
                        </button>
                        <input type="text" placeholder="Search"
                            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] w-40 focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                </div>

                {/* Filter panel */}
                {showFilter && (
                    <div className="px-5 pb-2">
                        <FilterPanel
                            statuses={statuses}
                            onChange={s => { setStatuses(s); setPage(1); }}
                            onClose={() => setShowFilter(false)}
                        />
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="px-4 py-3 text-left w-8"><input type="checkbox" className="rounded border-slate-300" /></th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px] whitespace-nowrap">Order ↓</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Contact</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Vehicle</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Status</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Type</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px] whitespace-nowrap">Sub-Total</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide text-[11px] whitespace-nowrap">Part Exchanges</th>
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
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        {Array.from({ length: 14 }).map((__, j) => (
                                            <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-16" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr><td colSpan={14} className="px-4 py-12 text-center text-slate-400 text-[13px]">No orders found</td></tr>
                            ) : orders.map(o => {
                                const { subtotal, pxTotal, total, finance, deposit, totalPaid, balance } = calcOrder(o);
                                const vrm = o.vehicleId?.vrm ?? o.vehicleVrm ?? null;
                                return (
                                    <tr key={o._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3"><input type="checkbox" className="rounded border-slate-300" /></td>
                                        <td className="px-4 py-3">
                                            <Link href={`/app/sales/invoices/${o._id}`} className="text-[#4D7CFF] font-semibold hover:underline">{o.invoiceNumber}</Link>
                                        </td>
                                        <td className="px-4 py-3 text-[#4D7CFF] hover:underline cursor-pointer">{contactName(o.customerId)}</td>
                                        <td className="px-4 py-3">
                                            {vrm ? (
                                                <span className="text-[#4D7CFF] font-medium">{vrm}</span>
                                            ) : <span className="text-slate-400 italic text-[12px]">None</span>}
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                                        <td className="px-4 py-3 text-slate-700">{o.invoiceType === 'Margin Scheme' ? 'Marginal' : 'VAT'}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700">{GBP(subtotal)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{GBP(pxTotal)}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700">{GBP(total)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{GBP(deposit)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{GBP(finance)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{GBP(totalPaid)}</td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700">{GBP(balance)}</td>
                                        <td className="px-4 py-3">
                                            <Link href={`/app/sales/invoices/${o._id}`}
                                                className="w-7 h-7 rounded-md bg-[#4D7CFF] text-white flex items-center justify-center hover:bg-[#3a6ae0] ml-auto">
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
                        <select className="border border-slate-200 rounded px-2 py-0.5 text-[13px]" disabled><option>25</option></select>
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
                        <span className="text-slate-500 mr-2">{total === 0 ? '0' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)}`} of {total}</span>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-[12px]">Previous</button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                            <button key={n} onClick={() => setPage(n)}
                                className={`w-7 h-7 rounded text-[12px] font-semibold ${n === page ? 'bg-[#4D7CFF] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{n}</button>
                        ))}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                            className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 text-[12px]">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
