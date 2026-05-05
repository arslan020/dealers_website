'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const ALL_STATUSES = ['Draft', 'For Sale', 'Reserved', 'Sold', 'Complete', 'Deleted'];
const ALL_SALE_TYPES = ['Margin Scheme', 'VAT Qualifying', 'Not Sold'];

interface StockRow {
    _id: string;
    vrm: string;
    make: string;
    model: string;
    derivative: string;
    primaryImage?: string;
    status: string;
    purchaseDate: string | null;
    siv: number;
    invoiceDate: string | null;
    invoiceType: string | null;
    saleTotal: number | null;
    paidDate: string | null;
    profit: number | null;
}

interface Totals {
    count: number;
    totalSiv: number;
    totalSale: number;
    totalProfit: number;
}

function fmt(n: number) {
    return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string | null) {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        'For Sale': 'bg-blue-600 text-white',
        'Draft': 'bg-teal-500 text-white',
        'Reserved': 'bg-green-500 text-white',
        'Sold': 'bg-slate-500 text-white',
        'Complete': 'bg-slate-400 text-white',
        'Deleted': 'bg-red-400 text-white',
    };
    return (
        <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${map[status] || 'bg-slate-200 text-slate-600'}`}>
            {status}
        </span>
    );
}

function MultiSelect({ label, options, selected, onChange }: {
    label: string;
    options: string[];
    selected: string[];
    onChange: (v: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const toggle = (o: string) => {
        onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]);
    };
    const displayVal = selected.length === options.length || selected.length === 0
        ? options.join(', ')
        : selected.join(', ');

    return (
        <div className="relative">
            <label className="block text-[12px] font-semibold text-slate-600 mb-1">{label}</label>
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 text-left flex items-center justify-between bg-white hover:border-slate-300"
            >
                <span className="truncate pr-2">{displayVal}</span>
                <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && (
                <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {options.map(o => (
                        <label key={o} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selected.includes(o)}
                                onChange={() => toggle(o)}
                                className="rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-[13px] text-slate-700">{o}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function StockBookPage() {
    const [rows, setRows] = useState<StockRow[]>([]);
    const [totals, setTotals] = useState<Totals>({ count: 0, totalSiv: 0, totalSale: 0, totalProfit: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Filters
    const [statuses, setStatuses] = useState<string[]>([...ALL_STATUSES]);
    const [saleTypes, setSaleTypes] = useState<string[]>([...ALL_SALE_TYPES]);
    const [purchaseFrom, setPurchaseFrom] = useState('');
    const [purchaseTo, setPurchaseTo] = useState('');
    const [invoiceFrom, setInvoiceFrom] = useState('');
    const [invoiceTo, setInvoiceTo] = useState('');
    const [paidFrom, setPaidFrom] = useState('');
    const [paidTo, setPaidTo] = useState('');
    const [saleOrReturn, setSaleOrReturn] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const p = new URLSearchParams();
            if (statuses.length && statuses.length < ALL_STATUSES.length)
                p.set('statuses', statuses.join(','));
            if (saleTypes.length && saleTypes.length < ALL_SALE_TYPES.length)
                p.set('saleTypes', saleTypes.join(','));
            if (purchaseFrom) p.set('purchaseFrom', purchaseFrom);
            if (purchaseTo)   p.set('purchaseTo', purchaseTo);
            if (invoiceFrom)  p.set('invoiceFrom', invoiceFrom);
            if (invoiceTo)    p.set('invoiceTo', invoiceTo);
            if (paidFrom)     p.set('paidFrom', paidFrom);
            if (paidTo)       p.set('paidTo', paidTo);
            if (saleOrReturn) p.set('saleOrReturn', 'true');
            if (search)       p.set('search', search);

            const res = await fetch(`/api/vehicles/stock-book?${p}`);
            const data = await res.json();
            if (data.ok) {
                setRows(data.rows);
                setTotals(data.totals);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [statuses, saleTypes, purchaseFrom, purchaseTo, invoiceFrom, invoiceTo, paidFrom, paidTo, saleOrReturn, search]);

    useEffect(() => { fetchData(); }, [fetchData]);

    return (
        <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/app/vehicles" className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-[18px] font-bold text-slate-900">Stock Book</h1>
                </div>
                <input
                    type="text"
                    placeholder="Search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-64 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400 bg-white"
                />
            </div>

            {/* Filters */}
            <div className="bg-white border-b border-slate-200 px-6 py-5">
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                    {/* Row 1 */}
                    <MultiSelect label="Status" options={ALL_STATUSES} selected={statuses} onChange={setStatuses} />
                    <MultiSelect label="Sale Type" options={ALL_SALE_TYPES} selected={saleTypes} onChange={setSaleTypes} />

                    {/* Row 2 */}
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Purchase From</label>
                        <input type="date" value={purchaseFrom} onChange={e => setPurchaseFrom(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">Purchase To</label>
                        <input type="date" value={purchaseTo} onChange={e => setPurchaseTo(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400" />
                    </div>

                    {/* Row 3 */}
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">
                            Invoice From <span className="text-slate-400 font-normal text-[11px]">[?]</span>
                        </label>
                        <input type="date" value={invoiceFrom} onChange={e => setInvoiceFrom(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">
                            Invoice To <span className="text-slate-400 font-normal text-[11px]">[?]</span>
                        </label>
                        <input type="date" value={invoiceTo} onChange={e => setInvoiceTo(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400" />
                    </div>

                    {/* Row 4 */}
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">
                            Paid From <span className="text-slate-400 font-normal text-[11px]">[?]</span>
                        </label>
                        <input type="date" value={paidFrom} onChange={e => setPaidFrom(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400" />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-600 mb-1">
                            Paid To <span className="text-slate-400 font-normal text-[11px]">[?]</span>
                        </label>
                        <input type="date" value={paidTo} onChange={e => setPaidTo(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400" />
                    </div>
                </div>

                {/* Only Show */}
                <div className="mt-5">
                    <p className="text-[12px] font-semibold text-slate-600 mb-2">Only Show</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={saleOrReturn} onChange={e => setSaleOrReturn(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600" />
                        <span className="text-[13px] text-slate-700">Sale or Return</span>
                    </label>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">Vehicle</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-28">Status</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-32">Purchase Date</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-36">SIV Cost</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-32">Invoice Date</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-36">Sale Price</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-32">Paid Date</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-36">Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={8} className="py-20 text-center text-slate-400 animate-pulse text-[13px]">Loading…</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={8} className="py-20 text-center text-slate-300 text-[13px]">No vehicles found</td></tr>
                            ) : rows.map(row => (
                                <tr key={row._id} className="hover:bg-slate-50/60 transition-colors">
                                    {/* Vehicle */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-14 h-10 bg-slate-100 rounded overflow-hidden shrink-0 border border-slate-200">
                                                {row.primaryImage
                                                    ? <img src={row.primaryImage} alt="" className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full flex items-center justify-center text-slate-300 text-[9px] font-bold">No img</div>
                                                }
                                            </div>
                                            <div>
                                                <Link href={`/app/vehicles/${row._id}`}
                                                    className="text-[13px] font-semibold text-blue-600 hover:underline">
                                                    {row.make} {row.model}
                                                    {row.derivative ? ` ${row.derivative.length > 35 ? row.derivative.slice(0, 35) + '…' : row.derivative}` : ''}
                                                </Link>
                                                <p className="text-[11px] text-slate-500 font-bold">{row.vrm}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center"><StatusBadge status={row.status} /></td>
                                    <td className="px-4 py-3 text-center text-[12px] text-slate-600">{fmtDate(row.purchaseDate)}</td>
                                    <td className="px-4 py-3 text-center text-[13px] font-semibold text-slate-700">
                                        {row.siv ? fmt(row.siv) : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center text-[12px] text-slate-600">{fmtDate(row.invoiceDate)}</td>
                                    <td className="px-4 py-3 text-center text-[13px] font-semibold text-slate-700">
                                        {row.saleTotal !== null ? fmt(row.saleTotal) : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center text-[12px] text-slate-600">{fmtDate(row.paidDate)}</td>
                                    <td className="px-4 py-3 text-center">
                                        {row.profit !== null ? (
                                            <span className={`text-[13px] font-bold ${row.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {fmt(row.profit)}
                                            </span>
                                        ) : <span className="text-slate-300">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Totals */}
            <div className="bg-white border-t-2 border-slate-200 px-6 py-4">
                <div className="flex items-center gap-8 flex-wrap">
                    <div className="text-[13px] text-slate-500">
                        <span className="font-bold text-slate-800">{totals.count}</span> vehicles
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[12px] text-slate-500">Total SIV:</span>
                        <span className="text-[13px] font-bold text-slate-800">{fmt(totals.totalSiv)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[12px] text-slate-500">Total Sale:</span>
                        <span className="text-[13px] font-bold text-slate-800">{fmt(totals.totalSale)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[12px] text-slate-500">Total Profit:</span>
                        <span className={`text-[13px] font-bold ${totals.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmt(totals.totalProfit)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
