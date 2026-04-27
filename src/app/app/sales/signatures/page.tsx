'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface DocItem {
    documentId: string;
    documentName: string;
}

interface Signature {
    _id: string;
    customerName?: string;
    customerEmail?: string;
    invoiceNumber?: string;
    documents: DocItem[];
    type: 'esign' | 'email';
    status: 'requested' | 'signed' | 'declined';
    sentAt: string;
    signedAt?: string;
    declinedAt?: string;
    createdAt: string;
}

function fmtDateTime(s?: string) {
    if (!s) return '—';
    try { return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return s; }
}

function timeAgo(s: string) {
    const diff = Date.now() - new Date(s).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '(just now)';
    if (mins < 60) return `(${mins} min${mins === 1 ? '' : 's'} ago)`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `(${hrs} hr${hrs === 1 ? '' : 's'} ago)`;
    return '';
}

const STATUS_STYLES: Record<string, string> = {
    requested: 'bg-teal-50 text-teal-700 border border-teal-200',
    signed:    'bg-green-50 text-green-700 border border-green-200',
    declined:  'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
    requested: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    signed:    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
    declined:  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
};

/* ─── Detail Slide-over ──────────────────────────────────────────────────────── */
function SignatureDetail({ sig, onClose }: { sig: Signature; onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Signature Request</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div className="bg-slate-50 rounded-lg divide-y divide-slate-100">
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">Customer</span>
                            <span className="text-[13px] text-slate-700 font-semibold">
                                {sig.customerName || '—'}
                                {sig.customerEmail && <span className="text-slate-400 font-normal ml-2">{sig.customerEmail}</span>}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">Type</span>
                            <span className="text-[13px] text-slate-700 capitalize">{sig.type === 'esign' ? 'eSign Request' : 'Email (no eSign)'}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">Request Sent</span>
                            <span className="text-[13px] text-slate-700">{fmtDateTime(sig.sentAt)} <span className="text-slate-400">{timeAgo(sig.sentAt)}</span></span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">Status</span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-semibold capitalize ${STATUS_STYLES[sig.status]}`}>
                                {STATUS_ICONS[sig.status]}
                                {sig.status.charAt(0).toUpperCase() + sig.status.slice(1)}
                            </span>
                        </div>
                        {sig.invoiceNumber && (
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">Invoice</span>
                                <span className="text-[13px] text-[#4D7CFF] font-semibold">{sig.invoiceNumber}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        {sig.documents.map((d, i) => (
                            <div key={d.documentId} className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3">
                                    <span className="text-[13px] font-bold text-slate-800">{i + 1}. {d.documentName}</span>
                                    <div className="flex items-center gap-2">
                                        <a href={`/api/sales-documents/${d.documentId}/file`} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            View
                                        </a>
                                        <a href={`/api/sales-documents/${d.documentId}/file?download=1`}
                                            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            Download
                                        </a>
                                    </div>
                                </div>
                                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                                    <p className="text-[12px] text-slate-400 italic">
                                        {sig.status === 'signed' ? 'Signed.' : sig.status === 'declined' ? 'Declined.' : 'Awaiting signature.'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function SignaturesPage() {
    const [sigs, setSigs] = useState<Signature[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [viewSig, setViewSig] = useState<Signature | null>(null);
    const limit = 25;

    const fetchSigs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit), search });
            if (statusFilter) params.set('status', statusFilter);
            const res = await fetch(`/api/document-signatures?${params}`);
            const data = await res.json();
            if (data.ok) { setSigs(data.signatures || []); setTotal(data.total || 0); }
        } catch { } finally { setLoading(false); }
    }, [page, search, statusFilter]);

    useEffect(() => { fetchSigs(); }, [fetchSigs]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">Signatures</h1>
                    <div className="flex items-center gap-2">
                        <select
                            value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                            <option value="">All Statuses</option>
                            <option value="requested">Requested</option>
                            <option value="signed">Signed</option>
                            <option value="declined">Declined</option>
                        </select>
                        <input
                            type="text" placeholder="Search" value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] w-40 focus:outline-none focus:border-[#4D7CFF]"
                        />
                        <Link href="/app/sales/send"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#4D7CFF] text-[#4D7CFF] rounded-lg text-[13px] font-semibold hover:bg-blue-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            Send Documents
                        </Link>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Customer</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Documents</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Type</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Status</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">Sent</th>
                                <th className="px-4 py-3 w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        {[1, 2, 3, 4, 5, 6].map(j => (
                                            <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-20" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : sigs.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-[13px]">No signature requests found</td></tr>
                            ) : sigs.map(s => (
                                <tr key={s._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setViewSig(s)}>
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-800">{s.customerName || '—'}</p>
                                        {s.customerEmail && <p className="text-[12px] text-slate-400">{s.customerEmail}</p>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-0.5">
                                            {s.documents.slice(0, 2).map(d => (
                                                <p key={d.documentId} className="text-slate-600">{d.documentName}</p>
                                            ))}
                                            {s.documents.length > 2 && (
                                                <p className="text-slate-400 italic text-[12px]">+{s.documents.length - 2} more</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 capitalize">{s.type === 'esign' ? 'eSign' : 'Email'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-semibold ${STATUS_STYLES[s.status]}`}>
                                            {STATUS_ICONS[s.status]}
                                            {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 text-[12px] whitespace-nowrap">{fmtDateTime(s.sentAt)}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={e => { e.stopPropagation(); setViewSig(s); }}
                                            className="w-7 h-7 rounded-md bg-[#4D7CFF] text-white flex items-center justify-center hover:bg-[#3a6ae0] ml-auto">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[13px] text-slate-500">
                        <span>Show</span>
                        <select className="border border-slate-200 rounded px-2 py-0.5 text-[13px]" disabled><option>25</option></select>
                        <button className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-[12px]">CSV</button>
                        <button className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-[12px]">Excel</button>
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

            {viewSig && <SignatureDetail sig={viewSig} onClose={() => setViewSig(null)} />}
        </div>
    );
}
