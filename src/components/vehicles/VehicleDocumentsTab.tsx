'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

interface Doc {
    _id: string;
    name: string;
    description?: string;
    mimeType: string;
    size: number;
    status: 'private' | 'public';
    createdAt: string;
}

interface Props { vehicleId: string; }

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    return '📎';
}

function EditModal({ doc, onSave, onClose }: { doc: Doc; onSave: (d: Partial<Doc>) => Promise<void>; onClose: () => void }) {
    const [name, setName] = useState(doc.name);
    const [description, setDescription] = useState(doc.description || '');
    const [status, setStatus] = useState<'private' | 'public'>(doc.status);
    const [saving, setSaving] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-[480px] p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-semibold text-slate-800">Edit Document</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-[12px] font-medium text-slate-600 block mb-1">Document Name</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>
                    <div>
                        <label className="text-[12px] font-medium text-slate-600 block mb-1">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF] resize-none" placeholder="Optional description…" />
                    </div>
                    <div>
                        <label className="text-[12px] font-medium text-slate-600 block mb-2">Status</label>
                        <div className="flex gap-6">
                            {(['private', 'public'] as const).map(s => (
                                <label key={s} className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-700 capitalize">
                                    <input type="radio" checked={status === s} onChange={() => setStatus(s)} className="accent-[#4D7CFF]" />
                                    {s}
                                </label>
                            ))}
                        </div>
                        {status === 'public' && (
                            <p className="text-[12px] text-blue-600 mt-1.5">Public documents can be shared on the vehicle website page.</p>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-[13px] text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button
                        onClick={async () => { setSaving(true); await onSave({ name, description, status }); setSaving(false); }}
                        disabled={saving}
                        className="px-5 py-2 text-[13px] font-semibold text-white bg-[#4D7CFF] rounded-lg hover:bg-[#3a6ae8] disabled:opacity-60"
                    >
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function VehicleDocumentsTab({ vehicleId }: Props) {
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/documents`);
            const data = await res.json();
            setDocs(data.ok ? data.documents : []);
        } catch { setDocs([]); }
        finally { setLoading(false); }
    }, [vehicleId]);

    useEffect(() => { load(); }, [load]);

    const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) { toast.error('File too large (max 20MB)'); return; }
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await fetch(`/api/vehicles/${vehicleId}/documents`, { method: 'POST', body: form });
            const data = await res.json();
            if (data.ok) { toast.success('Document uploaded'); load(); }
            else toast.error(data.error || 'Upload failed');
        } catch { toast.error('Upload failed'); }
        finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
    }, [vehicleId, load]);

    const handleEdit = useCallback(async (docId: string, updates: Partial<Doc>) => {
        const res = await fetch(`/api/vehicles/${vehicleId}/documents/${docId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (data.ok) {
            setDocs(prev => prev.map(d => d._id === docId ? { ...d, ...updates } : d));
            setEditingDoc(null);
            toast.success('Document updated');
        } else toast.error('Update failed');
    }, [vehicleId]);

    const handleDelete = useCallback(async (docId: string, name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        const res = await fetch(`/api/vehicles/${vehicleId}/documents/${docId}`, { method: 'DELETE' });
        if ((await res.json()).ok) { setDocs(prev => prev.filter(d => d._id !== docId)); toast.success('Deleted'); }
        else toast.error('Delete failed');
    }, [vehicleId]);

    const handleDownload = (docId: string) => {
        window.open(`/api/vehicles/${vehicleId}/documents/${docId}`, '_blank');
    };

    return (
        <div className="space-y-4 w-full">
            {/* Header card */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-6 py-4 flex items-center justify-between">
                <div>
                    <h3 className="text-[14px] font-semibold text-slate-800">Vehicle Documents</h3>
                    <p className="text-[12px] text-slate-500 mt-0.5">Upload documents related to this vehicle. Public documents can be shared on the website.</p>
                </div>
                <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 bg-[#4D7CFF] text-white px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae8] disabled:opacity-60"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    {uploading ? 'Uploading…' : 'Upload Document'}
                </button>
                <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv" />
            </div>

            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 text-[12px] text-blue-800">
                <strong>Publishing Documents:</strong> By default all documents are <span className="font-semibold">Private</span>. Click <span className="font-semibold">Edit</span> on any document to add a description and change its status to <span className="font-semibold">Public</span> to make it available on your website.
            </div>

            {/* Document list */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                {loading ? (
                    <div className="px-6 py-12 text-center text-[13px] text-slate-400">Loading…</div>
                ) : docs.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <div className="text-4xl mb-3">📁</div>
                        <p className="text-[14px] font-medium text-slate-600">No documents yet</p>
                        <p className="text-[12px] text-slate-400 mt-1">Upload a document to get started</p>
                        <button onClick={() => fileRef.current?.click()} className="mt-4 text-[13px] text-[#4D7CFF] font-semibold hover:underline">Upload Document</button>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Document</th>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Size</th>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Uploaded</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {docs.map(doc => (
                                <tr key={doc._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-lg">{fileIcon(doc.mimeType)}</span>
                                            <span className="text-[13px] font-medium text-slate-800 max-w-[200px] truncate">{doc.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="text-[12px] text-slate-500 max-w-[180px] truncate block">{doc.description || '—'}</span>
                                    </td>
                                    <td className="px-5 py-3 text-[12px] text-slate-500">{formatSize(doc.size)}</td>
                                    <td className="px-5 py-3">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${doc.status === 'public' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {doc.status === 'public' ? '● Public' : '○ Private'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-[12px] text-slate-500">
                                        {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button onClick={() => handleDownload(doc._id)} className="text-[12px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100" title="Download">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                            </button>
                                            <button onClick={() => setEditingDoc(doc)} className="text-[12px] text-[#4D7CFF] hover:underline px-2 py-1">Edit</button>
                                            <button onClick={() => handleDelete(doc._id, doc.name)} className="text-[12px] text-red-500 hover:text-red-700 px-2 py-1">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {editingDoc && (
                <EditModal
                    doc={editingDoc}
                    onSave={updates => handleEdit(editingDoc._id, updates)}
                    onClose={() => setEditingDoc(null)}
                />
            )}
        </div>
    );
}
