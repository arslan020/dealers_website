'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface SalesDoc {
    _id: string;
    name: string;
    group?: string;
}

function SendDocumentsForm() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [docs, setDocs] = useState<SalesDoc[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(true);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [customer, setCustomer] = useState<any | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [sentType, setSentType] = useState<'esign' | 'email'>('esign');

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        async function load() {
            setLoadingDocs(true);
            const res = await fetch('/api/sales-documents');
            const data = await res.json();
            if (data.ok) {
                setDocs(data.documents || []);
                const preselect = searchParams.get('docs');
                if (preselect) {
                    const ids = preselect.split(',').filter(Boolean);
                    setSelectedIds(new Set(ids));
                }
            }
            setLoadingDocs(false);
        }
        load();
    }, [searchParams]);

    useEffect(() => {
        if (!query.trim()) { setResults([]); return; }
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            const res = await fetch(`/api/crm/customers?q=${encodeURIComponent(query)}&limit=8`);
            const data = await res.json();
            setResults(data.customers ?? []);
        }, 250);
    }, [query]);

    function toggleDoc(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function toggleGroup(groupDocs: SalesDoc[], checked: boolean) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            groupDocs.forEach(d => checked ? next.add(d._id) : next.delete(d._id));
            return next;
        });
    }

    async function handleSend(type: 'esign' | 'email') {
        if (!customer) { toast.error('Please select a customer'); return; }
        if (!selectedIds.size) { toast.error('Select at least one document'); return; }
        setSending(true);
        setSentType(type);
        try {
            const res = await fetch('/api/sales-documents/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: customer._id, documentIds: [...selectedIds], type }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            setSent(true);
        } catch (err: any) {
            toast.error(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    }

    const grouped = docs.reduce<Record<string, SalesDoc[]>>((acc, d) => {
        const g = d.group || 'No Group';
        (acc[g] = acc[g] || []).push(d);
        return acc;
    }, {});

    if (sent) {
        return (
            <div className="max-w-lg mx-auto mt-12">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-8 py-10 flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                        <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <p className="text-[16px] font-bold text-slate-800">Documents Sent!</p>
                    <p className="text-[13px] text-slate-500 text-center">
                        {sentType === 'esign'
                            ? `An eSign request was sent to ${customer?.email || customer?.firstName}.`
                            : `Documents were emailed to ${customer?.email || customer?.firstName}.`
                        }
                    </p>
                    <p className="text-[13px] text-slate-500 text-center">
                        Once the customer receives the email they will be directed to view and{sentType === 'esign' ? ' sign' : ' download'} the documents.
                    </p>
                    <div className="flex gap-3 mt-2">
                        <Link href="/app/sales/signatures"
                            className="px-4 py-2 text-[13px] font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                            View Signatures
                        </Link>
                        <button onClick={() => { setSent(false); setCustomer(null); setQuery(''); setSelectedIds(new Set()); }}
                            className="px-4 py-2 text-[13px] font-semibold bg-[#4D7CFF] text-white rounded-lg hover:bg-[#3a6ae0]">
                            Send More
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                    <h1 className="text-[15px] font-bold text-slate-800">Send Documents</h1>
                </div>

                <div className="px-6 py-5 space-y-6">
                    {/* Customer */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[13px] font-semibold text-slate-700">Customer</label>
                            <Link href="/app/sales/contacts?new=1"
                                className="flex items-center gap-1 text-[12px] font-semibold text-[#4D7CFF] border border-[#4D7CFF] rounded-lg px-3 py-1 hover:bg-blue-50">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                New Contact
                            </Link>
                        </div>
                        {customer ? (
                            <div className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3 bg-slate-50/50">
                                <div>
                                    <p className="text-[13px] font-semibold text-slate-800">
                                        {customer.businessName || `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()}
                                    </p>
                                    {customer.email && <p className="text-[12px] text-slate-400">{customer.email}</p>}
                                </div>
                                <button onClick={() => { setCustomer(null); setQuery(''); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text" value={query} onChange={e => setQuery(e.target.value)}
                                    placeholder="Start typing to search…"
                                    className="w-full border border-slate-200 rounded-lg px-4 py-3 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                />
                                {results.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 mt-1 max-h-56 overflow-y-auto">
                                        {results.map((c: any) => (
                                            <button key={c._id} onClick={() => { setCustomer(c); setQuery(''); setResults([]); }}
                                                className="w-full text-left px-4 py-3 text-[13px] hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                                <span className="font-semibold text-slate-800">
                                                    {c.businessName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()}
                                                </span>
                                                {c.email && <span className="text-slate-400 ml-2 text-[12px]">{c.email}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Documents */}
                    <div>
                        <label className="text-[13px] font-semibold text-slate-700 block mb-2">Documents</label>
                        {loadingDocs ? (
                            <div className="border border-slate-200 rounded-lg p-4 text-center text-[13px] text-slate-400">Loading documents…</div>
                        ) : docs.length === 0 ? (
                            <div className="border border-slate-200 rounded-lg p-6 text-center">
                                <p className="text-[13px] text-slate-400">No documents in library.</p>
                                <Link href="/app/sales/documents" className="text-[13px] text-[#4D7CFF] font-semibold hover:underline mt-1 block">
                                    Add documents →
                                </Link>
                            </div>
                        ) : (
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                {Object.entries(grouped).map(([grp, grpDocs]) => {
                                    const allChecked = grpDocs.every(d => selectedIds.has(d._id));
                                    const someChecked = grpDocs.some(d => selectedIds.has(d._id));
                                    return (
                                        <div key={grp}>
                                            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                                                <label className="flex items-center gap-2.5 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={allChecked}
                                                        ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                                                        onChange={e => toggleGroup(grpDocs, e.target.checked)}
                                                        className="rounded border-slate-300"
                                                    />
                                                    <span className="text-[12px] font-bold text-slate-700">{grp}</span>
                                                </label>
                                            </div>
                                            {grpDocs.map(d => (
                                                <label key={d._id} className="flex items-center gap-2.5 px-6 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(d._id)}
                                                        onChange={() => toggleDoc(d._id)}
                                                        className="rounded border-slate-300"
                                                    />
                                                    <span className="text-[13px] text-slate-700">{d.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3">
                    <button
                        onClick={() => handleSend('esign')}
                        disabled={sending || !customer || !selectedIds.size}
                        className="px-5 py-2.5 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae0] disabled:opacity-50 transition-colors"
                    >
                        {sending && sentType === 'esign' ? 'Sending…' : 'Request eSign'}
                    </button>
                    <button
                        onClick={() => handleSend('email')}
                        disabled={sending || !customer || !selectedIds.size}
                        className="px-5 py-2.5 text-[13px] font-semibold text-white bg-slate-500 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
                    >
                        {sending && sentType === 'email' ? 'Sending…' : 'Email Without eSign'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SendPage() {
    return (
        <Suspense fallback={<div className="text-slate-400 text-[13px] p-6">Loading…</div>}>
            <SendDocumentsForm />
        </Suspense>
    );
}
