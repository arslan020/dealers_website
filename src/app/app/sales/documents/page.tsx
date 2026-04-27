'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface SalesDoc {
    _id: string;
    name: string;
    group?: string;
    description?: string;
    mimeType: string;
    size: number;
    createdAt: string;
}

/* ─── Add / Edit Modal ───────────────────────────────────────────────────────── */
function DocFormModal({
    doc,
    allGroups,
    onSaved,
    onClose,
}: {
    doc: SalesDoc | null;
    allGroups: string[];
    onSaved: (d: SalesDoc) => void;
    onClose: () => void;
}) {
    const isEdit = !!doc;
    const [name, setName] = useState(doc?.name ?? '');
    const [group, setGroup] = useState(doc?.group ?? '');
    const [description, setDescription] = useState(doc?.description ?? '');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    async function handleSubmit() {
        if (!name.trim()) { toast.error('Name is required'); return; }
        if (!isEdit && !file) { toast.error('Please choose a PDF file'); return; }
        setSaving(true);
        try {
            if (isEdit) {
                const res = await fetch(`/api/sales-documents/${doc!._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name.trim(), group: group.trim() || undefined, description: description.trim() || undefined }),
                });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error);
                toast.success('Document updated');
                onSaved(data.document);
            } else {
                const fd = new FormData();
                fd.append('file', file!);
                fd.append('name', name.trim());
                if (group.trim()) fd.append('group', group.trim());
                if (description.trim()) fd.append('description', description.trim());
                const res = await fetch('/api/sales-documents', { method: 'POST', body: fd });
                const data = await res.json();
                if (!data.ok) throw new Error(data.error);
                toast.success('Document added');
                onSaved(data.document);
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">{isEdit ? 'Edit Document' : 'Add Document'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Name</label>
                        <input
                            type="text" value={name} onChange={e => setName(e.target.value)}
                            placeholder="e.g. Initial Disclosure Document"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Group</label>
                        <input
                            type="text" value={group} onChange={e => setGroup(e.target.value)}
                            list="group-options"
                            placeholder="Start typing group…"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                        />
                        <datalist id="group-options">
                            {allGroups.map(g => <option key={g} value={g} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Description</label>
                        <textarea
                            value={description} onChange={e => setDescription(e.target.value)}
                            rows={3}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none"
                        />
                    </div>
                    {!isEdit && (
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Upload PDF Document</label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className="px-3 py-1.5 border border-slate-300 rounded text-[13px] text-slate-700 hover:bg-slate-50"
                                >
                                    Choose file
                                </button>
                                <span className="text-[13px] text-slate-500">{file ? file.name : 'No file chosen'}</span>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit} disabled={saving}
                        className="px-4 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae0] disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Document'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Confirm Remove Modal ───────────────────────────────────────────────────── */
function ConfirmRemoveModal({ doc, onConfirm, onClose }: { doc: SalesDoc; onConfirm: () => void; onClose: () => void }) {
    const [removing, setRemoving] = useState(false);
    async function handleRemove() {
        setRemoving(true);
        try {
            await fetch(`/api/sales-documents/${doc._id}`, { method: 'DELETE' });
            toast.success('Document removed');
            onConfirm();
        } catch { toast.error('Failed to remove'); } finally { setRemoving(false); }
    }
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-5 space-y-3">
                    <h2 className="text-[15px] font-bold text-slate-800">Remove Document</h2>
                    <p className="text-[13px] text-slate-500">Remove <strong>{doc.name}</strong> from the library? This cannot be undone.</p>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                        <button onClick={handleRemove} disabled={removing}
                            className="px-4 py-2 text-[13px] font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50">
                            {removing ? 'Removing…' : 'Remove'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Send Row Modal ─────────────────────────────────────────────────────────── */
function SendRowModal({ doc, allDocs, onClose }: { doc: SalesDoc; allDocs: SalesDoc[]; onClose: () => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [customer, setCustomer] = useState<any | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([doc._id]));
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    async function handleSend(type: 'esign' | 'email') {
        if (!customer) { toast.error('Select a customer'); return; }
        if (!selectedIds.size) { toast.error('Select at least one document'); return; }
        setSending(true);
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

    const grouped = allDocs.reduce<Record<string, SalesDoc[]>>((acc, d) => {
        const g = d.group || 'No Group';
        (acc[g] = acc[g] || []).push(d);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-800">Send Documents</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
                </div>
                {sent ? (
                    <div className="px-6 py-8 flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <p className="text-[14px] font-semibold text-slate-800">Documents sent!</p>
                        <p className="text-[13px] text-slate-500 text-center">The request was sent to <strong>{customer?.email || customer?.firstName}</strong>.</p>
                        <button onClick={onClose} className="mt-2 px-4 py-2 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae0]">Close</button>
                    </div>
                ) : (
                    <div className="px-6 py-5 space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Customer</label>
                            {customer ? (
                                <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                                    <span className="text-[13px] font-semibold text-slate-800">
                                        {customer.businessName || `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()}
                                        {customer.email && <span className="text-slate-400 font-normal ml-2 text-[12px]">{customer.email}</span>}
                                    </span>
                                    <button onClick={() => { setCustomer(null); setQuery(''); }} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="text" value={query} onChange={e => setQuery(e.target.value)}
                                        placeholder="Start typing to search…"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                    />
                                    {results.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                                            {results.map((c: any) => (
                                                <button key={c._id} onClick={() => { setCustomer(c); setQuery(''); setResults([]); }}
                                                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                                    <span className="font-semibold text-slate-800">{c.businessName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()}</span>
                                                    {c.email && <span className="text-slate-400 ml-2">{c.email}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Documents</label>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                {Object.entries(grouped).map(([grp, docs]) => (
                                    <div key={grp}>
                                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox"
                                                    checked={docs.every(d => selectedIds.has(d._id))}
                                                    onChange={e => {
                                                        const next = new Set(selectedIds);
                                                        docs.forEach(d => e.target.checked ? next.add(d._id) : next.delete(d._id));
                                                        setSelectedIds(next);
                                                    }}
                                                    className="rounded border-slate-300"
                                                />
                                                <span className="text-[12px] font-bold text-slate-700">{grp}</span>
                                            </label>
                                        </div>
                                        {docs.map(d => (
                                            <label key={d._id} className="flex items-center gap-2 px-5 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
                                                <input type="checkbox"
                                                    checked={selectedIds.has(d._id)}
                                                    onChange={() => toggleDoc(d._id)}
                                                    className="rounded border-slate-300"
                                                />
                                                <span className="text-[13px] text-slate-700">{d.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                            <button onClick={() => handleSend('email')} disabled={sending || !customer}
                                className="px-4 py-2 text-[13px] font-semibold text-white bg-slate-500 rounded-lg hover:bg-slate-600 disabled:opacity-50">
                                {sending ? 'Sending…' : 'Email Without eSign'}
                            </button>
                            <button onClick={() => handleSend('esign')} disabled={sending || !customer}
                                className="px-4 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae0] disabled:opacity-50">
                                {sending ? 'Sending…' : 'Request eSign'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function DocumentsPage() {
    const router = useRouter();
    const [docs, setDocs] = useState<SalesDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [editDoc, setEditDoc] = useState<SalesDoc | null>(null);
    const [removeDoc, setRemoveDoc] = useState<SalesDoc | null>(null);
    const [sendDoc, setSendDoc] = useState<SalesDoc | null>(null);
    const [page, setPage] = useState(1);
    const limit = 25;

    const fetchDocs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sales-documents');
            const data = await res.json();
            if (data.ok) setDocs(data.documents || []);
        } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    const allGroups = [...new Set(docs.map(d => d.group).filter(Boolean))] as string[];

    const filtered = docs.filter(d => {
        if (!search) return true;
        const q = search.toLowerCase();
        return d.name.toLowerCase().includes(q) || (d.group ?? '').toLowerCase().includes(q);
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const paged = filtered.slice((page - 1) * limit, page * limit);

    function afterSave(saved: SalesDoc) {
        setDocs(prev => {
            const idx = prev.findIndex(d => d._id === saved._id);
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
            return [...prev, saved];
        });
        setShowAdd(false);
        setEditDoc(null);
    }

    function afterRemove(id: string) {
        setDocs(prev => prev.filter(d => d._id !== id));
        setRemoveDoc(null);
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">Documents</h1>
                    <div className="flex items-center gap-2">
                        <Link href="/app/sales/send"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-[13px] font-semibold hover:bg-slate-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            Send
                        </Link>
                        <Link href="/app/sales/signatures"
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-[13px] font-semibold hover:bg-slate-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            Signatures
                        </Link>
                        <button onClick={() => setShowAdd(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#4D7CFF] text-[#4D7CFF] rounded-lg text-[13px] font-semibold hover:bg-blue-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            Add Document
                        </button>
                        <input
                            type="text" placeholder="Search" value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] w-40 focus:outline-none focus:border-[#4D7CFF]"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="px-4 py-3 text-left w-8"><input type="checkbox" className="rounded border-slate-300" /></th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">
                                    Name ▲
                                </th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide text-[11px]">
                                    Group
                                    <span className="ml-1 inline-flex flex-col">
                                        <span className="text-[8px] leading-none">▲</span>
                                        <span className="text-[8px] leading-none">▼</span>
                                    </span>
                                </th>
                                <th className="px-4 py-3 w-44"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        {[1, 2, 3, 4].map(j => (
                                            <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse w-24" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : paged.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-[13px]">
                                        {docs.length === 0 ? 'No data available in table' : 'No results for your search'}
                                    </td>
                                </tr>
                            ) : paged.map(d => (
                                <tr key={d._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3"><input type="checkbox" className="rounded border-slate-300" /></td>
                                    <td className="px-4 py-3 font-semibold text-[#4D7CFF]">{d.name}</td>
                                    <td className="px-4 py-3 text-slate-400 italic text-[12px]">{d.group || 'No group'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            <button onClick={() => setSendDoc(d)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-[#10b981] text-white rounded-lg text-[12px] font-semibold hover:bg-[#059669]">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                Send
                                            </button>
                                            <button onClick={() => setEditDoc(d)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-[#4D7CFF] text-white rounded-lg text-[12px] font-semibold hover:bg-[#3a6ae0]">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                Edit
                                            </button>
                                            <button onClick={() => setRemoveDoc(d)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-[#f43f5e] text-white rounded-lg text-[12px] font-semibold hover:bg-[#e11d48]">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                Remove
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[13px] text-slate-500">
                        <span>Show</span>
                        <select className="border border-slate-200 rounded px-2 py-0.5 text-[13px]" disabled><option>25</option></select>
                        <button className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-[12px]">CSV</button>
                        <button className="px-3 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-[12px]">Excel</button>
                    </div>
                    <div className="flex items-center gap-1 text-[13px]">
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

            {/* Modals */}
            {showAdd && (
                <DocFormModal doc={null} allGroups={allGroups} onSaved={afterSave} onClose={() => setShowAdd(false)} />
            )}
            {editDoc && (
                <DocFormModal doc={editDoc} allGroups={allGroups} onSaved={afterSave} onClose={() => setEditDoc(null)} />
            )}
            {removeDoc && (
                <ConfirmRemoveModal doc={removeDoc} onConfirm={() => afterRemove(removeDoc._id)} onClose={() => setRemoveDoc(null)} />
            )}
            {sendDoc && (
                <SendRowModal doc={sendDoc} allDocs={docs} onClose={() => setSendDoc(null)} />
            )}
        </div>
    );
}
