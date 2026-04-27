'use client';

import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface ContactTag {
    _id?: string;
    name: string;
    type: 'Default' | 'Checkbox';
    isDefault: boolean;
    color: string;
}

interface Customer {
    _id: string;
    firstName: string;
    lastName?: string;
    businessName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    vatNumber?: string;
    address?: { line1?: string; city?: string; postcode?: string; country?: string };
    avatarColor?: string;
    contactTypes?: string[];
    source?: string;
    status?: string;
    loginEnabled?: boolean;
    marketingConsent?: boolean;
    stopFollowUps?: { oncePaysInvoice?: boolean; vehicleReservedEmail?: boolean };
    tags?: string[];
    totalDeals?: number;
    createdAt: string;
}

const AVATAR_COLORS = ['#4D7CFF', '#6B7280', '#10B981', '#EF4444', '#F59E0B', '#06B6D4', '#F3F4F6', '#1E293B'];
const CONTACT_TYPE_OPTIONS = ['Customer', 'Supplier', 'Service Provider', 'Partner', 'VIP'];
const TAG_COLOR_OPTIONS = ['#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#06B6D4', '#1E293B', '#6B7280'];

const EMPTY_FORM: Partial<Customer> = {
    firstName: '', lastName: '', businessName: '', email: '', phone: '', mobile: '',
    vatNumber: '', avatarColor: '#4D7CFF', contactTypes: ['Customer'],
    loginEnabled: false, marketingConsent: false,
    stopFollowUps: { oncePaysInvoice: false, vehicleReservedEmail: false },
    tags: [],
    address: { line1: '', city: '', postcode: '', country: 'United Kingdom' },
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function getInitials(c: Customer) {
    return `${c.firstName?.[0] || ''}${c.lastName?.[0] || ''}`.toUpperCase() || '?';
}

function ContactAvatar({ c, size = 'md' }: { c: Customer; size?: 'sm' | 'md' | 'lg' }) {
    const sz = size === 'sm' ? 'w-8 h-8 text-[12px]' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-[13px]';
    return (
        <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
            style={{ backgroundColor: c.avatarColor || '#4D7CFF' }}>
            {getInitials(c)}
        </div>
    );
}

/* ─── Contact Form Modal ─────────────────────────────────────────────────────── */
function ContactFormModal({ open, onClose, initial, onSaved, tags, onOpenManageTags }: {
    open: boolean;
    onClose: () => void;
    initial?: Partial<Customer>;
    onSaved: (c: Customer) => void;
    tags: ContactTag[];
    onOpenManageTags?: () => void;
}) {
    const [form, setForm] = useState<Partial<Customer>>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        const base = initial ? { ...EMPTY_FORM, ...initial } : { ...EMPTY_FORM };
        const first = (base.contactTypes || []).find(t => CONTACT_TYPE_OPTIONS.includes(t as any));
        setForm({ ...base, contactTypes: [first || 'Customer'] });
    }, [open, initial]);

    const set = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));
    const setAddr = (key: string, val: string) => setForm(p => ({ ...p, address: { ...p.address, [key]: val } }));
    const setFollowUp = (key: string, val: boolean) => setForm(p => ({ ...p, stopFollowUps: { ...p.stopFollowUps, [key]: val } }));
    const setContactType = (t: string) => setForm(p => ({ ...p, contactTypes: [t] }));
    const toggleTag = (name: string) => {
        const curr = form.tags || [];
        setForm(p => ({ ...p, tags: curr.includes(name) ? curr.filter(x => x !== name) : [...curr, name] }));
    };

    const handleSave = async () => {
        if (!form.firstName?.trim()) return toast.error('First name is required');
        setSaving(true);
        try {
            const isEdit = !!(form as any)._id;
            const url = isEdit ? `/api/crm/customers/${(form as any)._id}` : '/api/crm/customers';
            const method = isEdit ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.ok) {
                onSaved(data.customer);
                toast.success(isEdit ? 'Contact updated' : 'Contact added');
                onClose();
            } else {
                toast.error(data.error || 'Save failed');
            }
        } catch {
            toast.error('Network error');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
            <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <h2 className="text-[15px] font-bold text-slate-800">
                        {(form as any)._id ? 'Edit Contact' : 'Add Contact'}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Name row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[12px] font-semibold text-slate-600 mb-1 block">First Name <span className="text-red-500">*</span></label>
                            <input value={form.firstName || ''} onChange={e => set('firstName', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Last Name</label>
                            <input value={form.lastName || ''} onChange={e => set('lastName', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>

                    {/* Business / VAT */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Business Name</label>
                            <input value={form.businessName || ''} onChange={e => set('businessName', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-slate-600 mb-1 block">VAT Number</label>
                            <input value={form.vatNumber || ''} onChange={e => set('vatNumber', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Email</label>
                        <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                    </div>

                    {/* Telephone */}
                    <div>
                        <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Telephone</label>
                        <div className="flex gap-2">
                            <select className="border border-slate-200 rounded-lg px-2 py-2 text-[12px] text-slate-600 focus:outline-none focus:border-[#4D7CFF] bg-slate-50">
                                <option>+44 United Kingdom</option>
                            </select>
                            <input value={form.phone || ''} onChange={e => set('phone', e.target.value)}
                                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>

                    {/* Mobile */}
                    <div>
                        <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Mobile</label>
                        <div className="flex gap-2">
                            <select className="border border-slate-200 rounded-lg px-2 py-2 text-[12px] text-slate-600 focus:outline-none focus:border-[#4D7CFF] bg-slate-50">
                                <option>+44 United Kingdom</option>
                            </select>
                            <input value={form.mobile || ''} onChange={e => set('mobile', e.target.value)}
                                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                    </div>

                    {/* Avatar */}
                    <div>
                        <label className="text-[12px] font-semibold text-slate-600 mb-2 block">Avatar</label>
                        <div className="flex items-center gap-2">
                            {AVATAR_COLORS.map(c => (
                                <button key={c} onClick={() => set('avatarColor', c)}
                                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.avatarColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>

                    {/* Contact Type (single select) */}
                    <div>
                        <label className="text-[12px] font-semibold text-slate-600 mb-2 block">Contact Type</label>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5" role="radiogroup" aria-label="Contact type">
                            {CONTACT_TYPE_OPTIONS.map(t => (
                                <label key={t} className="flex items-center gap-1.5 text-[13px] text-slate-700 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="contactType"
                                        checked={((form.contactTypes || ['Customer'])[0] || 'Customer') === t}
                                        onChange={() => setContactType(t)}
                                        className="accent-[#4D7CFF]"
                                    />
                                    {t}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Tags — assign when adding or editing */}
                    <div>
                        <label className="text-[12px] font-semibold text-slate-600 mb-0.5 block">Tags</label>
                        <p className="text-[11px] text-slate-500 mb-2">Optional — select which tag(s) this contact belongs to. You can pick more than one.</p>
                        {tags.length > 0 ? (
                            <div>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map(tag => {
                                        const selected = (form.tags || []).includes(tag.name);
                                        return (
                                            <button type="button" key={tag.name} onClick={() => toggleTag(tag.name)}
                                                className={`px-3 py-1 rounded-full text-[12px] font-semibold border-2 transition-all ${selected ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600'}`}
                                                style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}>
                                                {tag.name}
                                            </button>
                                        );
                                    })}
                                </div>
                                {onOpenManageTags && (
                                    <button type="button" onClick={onOpenManageTags}
                                        className="mt-2 text-[11px] font-semibold text-slate-500 hover:text-[#4D7CFF]">
                                        Manage tag list
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-[12px] text-slate-600">
                                <p className="mb-2">No tags defined yet. Create tags first, then you can assign them to this contact.</p>
                                {onOpenManageTags && (
                                    <button type="button" onClick={onOpenManageTags}
                                        className="text-[12px] font-semibold text-[#4D7CFF] hover:underline">
                                        Open Manage Tags
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Address */}
                    <div className="space-y-3">
                        <label className="text-[12px] font-semibold text-slate-600 block">Address</label>
                        <input placeholder="Address Line 1" value={form.address?.line1 || ''} onChange={e => setAddr('line1', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        <div className="grid grid-cols-2 gap-3">
                            <input placeholder="City" value={form.address?.city || ''} onChange={e => setAddr('city', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                            <input placeholder="Postcode" value={form.address?.postcode || ''} onChange={e => setAddr('postcode', e.target.value.toUpperCase())}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                        </div>
                        <div>
                            <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Country</label>
                            <select value={form.address?.country || 'United Kingdom'} onChange={e => setAddr('country', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF]">
                                <option>United Kingdom</option>
                                <option>Ireland</option>
                                <option>Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Enable Log-In */}
                    <div>
                        <label className="text-[12px] font-semibold text-slate-600 mb-2 block">Enable Log-In</label>
                        <div className="flex gap-5">
                            {[true, false].map(v => (
                                <label key={String(v)} className="flex items-center gap-1.5 text-[13px] text-slate-700 cursor-pointer">
                                    <input type="radio" checked={form.loginEnabled === v} onChange={() => set('loginEnabled', v)} className="accent-[#4D7CFF]" />
                                    {v ? 'Yes' : 'No'}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Marketing Consent */}
                    <div>
                        <p className="text-[12px] font-semibold text-slate-600 mb-2">Contact consents to receive marketing communications about our products and services.</p>
                        <div className="flex gap-5">
                            {[true, false].map(v => (
                                <label key={String(v)} className="flex items-center gap-1.5 text-[13px] text-slate-700 cursor-pointer">
                                    <input type="radio" checked={form.marketingConsent === v} onChange={() => set('marketingConsent', v)} className="accent-[#4D7CFF]" />
                                    {v ? 'Yes' : 'No'}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Stop Follow-Ups */}
                    <div>
                        <label className="text-[12px] font-semibold text-slate-600 mb-2 block">Stop Follow-Ups</label>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                                <input type="checkbox" checked={!!form.stopFollowUps?.oncePaysInvoice} onChange={e => setFollowUp('oncePaysInvoice', e.target.checked)} className="accent-[#4D7CFF]" />
                                Once Customer Pays Invoice
                            </label>
                            <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                                <input type="checkbox" checked={!!form.stopFollowUps?.vehicleReservedEmail} onChange={e => setFollowUp('vehicleReservedEmail', e.target.checked)} className="accent-[#4D7CFF]" />
                                Vehicle Reserved (Email)
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="px-6 py-2 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae8] disabled:opacity-60">
                        {saving ? 'Saving…' : (form as any)._id ? 'Save Changes' : 'Add Contact'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Manage Tags Modal ──────────────────────────────────────────────────────── */
function ManageTagsModal({ open, onClose, tags, onSaved }: {
    open: boolean; onClose: () => void; tags: ContactTag[]; onSaved: (t: ContactTag[]) => void;
}) {
    const [rows, setRows] = useState<ContactTag[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setRows(tags.length > 0 ? [...tags] : [{ name: '', type: 'Default', isDefault: false, color: '#10B981' }]);
    }, [open, tags]);

    const update = (i: number, k: keyof ContactTag, v: any) =>
        setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

    const addRow = () => setRows(r => [...r, { name: '', type: 'Default', isDefault: false, color: '#10B981' }]);

    const remove = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));

    const handleSave = async () => {
        const valid = rows.filter(r => r.name.trim());
        setSaving(true);
        try {
            const res = await fetch('/api/crm/tags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: valid }),
            });
            const data = await res.json();
            if (data.ok) { onSaved(data.tags); toast.success('Tags saved'); onClose(); }
            else toast.error(data.error || 'Save failed');
        } catch { toast.error('Network error'); }
        finally { setSaving(false); }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-[15px] font-bold text-slate-800">Manage Leads & Contacts Tags</h3>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-slate-100 bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tag Name</th>
                                <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Default</th>
                                <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Colour</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {rows.map((row, i) => (
                                <tr key={i}>
                                    <td className="px-6 py-3">
                                        <input value={row.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Tag name"
                                            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                    </td>
                                    <td className="px-6 py-3">
                                        <select value={row.type} onChange={e => update(i, 'type', e.target.value)}
                                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF]">
                                            <option value="Default">Default</option>
                                            <option value="Checkbox">Checkbox</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-3">
                                        <label className="flex items-center gap-1.5 text-[13px] text-slate-700 cursor-pointer">
                                            <input type="checkbox" checked={row.isDefault} onChange={e => update(i, 'isDefault', e.target.checked)} className="accent-[#4D7CFF]" />
                                            Enable
                                        </label>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-1.5">
                                            {TAG_COLOR_OPTIONS.map(c => (
                                                <button key={c} onClick={() => update(i, 'color', c)}
                                                    className={`w-5 h-5 rounded border-2 transition-all ${row.color === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                                                    style={{ backgroundColor: c }} />
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => remove(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-6 py-3">
                        <button onClick={addRow} className="text-[#4D7CFF] text-[13px] font-semibold hover:underline flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Add Tag
                        </button>
                    </div>
                </div>
                <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[11px] text-slate-400">These tags are for Leads &amp; Contacts only.</p>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 bg-slate-600 text-white rounded-lg text-[13px] font-semibold hover:bg-slate-700">Cancel</button>
                        <button onClick={handleSave} disabled={saving}
                            className="px-5 py-2 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae8] disabled:opacity-60">
                            {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function ContactsPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [tags, setTags] = useState<ContactTag[]>([]);

    // Filters
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('All Types');
    const [filterLogin, setFilterLogin] = useState('All Logins');
    const [filterTag, setFilterTag] = useState('');
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);

    // Modals
    const [showForm, setShowForm] = useState(false);
    const [editContact, setEditContact] = useState<Customer | undefined>();
    const [showTagsModal, setShowTagsModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Checkbox selection
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchCustomers();
        fetchTags();
    }, []);

    // Auto-open Add Contact form when ?new=1
    useEffect(() => {
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1') {
            setEditContact(undefined);
            setShowForm(true);
        }
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/crm/customers');
            const data = await res.json();
            if (data.ok) {
                setCustomers(data.customers || []);
                const openId = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('id');
                if (openId) {
                    const match = (data.customers || []).find((c: Customer) => c._id === openId);
                    if (match) { setEditContact(match); setShowForm(true); }
                }
            }
        } catch { toast.error('Failed to load contacts'); }
        finally { setLoading(false); }
    };

    const fetchTags = async () => {
        try {
            const res = await fetch('/api/crm/tags');
            const data = await res.json();
            if (data.ok) setTags(data.tags || []);
        } catch { }
    };

    const handleSaved = (c: Customer) => {
        setCustomers(prev => {
            const idx = prev.findIndex(x => x._id === c._id);
            return idx >= 0 ? prev.map(x => x._id === c._id ? c : x) : [c, ...prev];
        });
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/crm/customers/${deleteConfirm._id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.ok) {
                setCustomers(prev => prev.filter(x => x._id !== deleteConfirm._id));
                toast.success('Contact deleted');
            } else toast.error(data.error || 'Delete failed');
        } catch { toast.error('Network error'); }
        finally { setDeleting(false); setDeleteConfirm(null); }
    };

    const filtered = useMemo(() => {
        return customers.filter(c => {
            if (search) {
                const q = search.toLowerCase();
                const name = `${c.firstName} ${c.lastName || ''} ${c.businessName || ''}`.toLowerCase();
                if (!name.includes(q) && !c.email?.toLowerCase().includes(q) && !c.phone?.includes(q) && !c.mobile?.includes(q)) return false;
            }
            if (filterType !== 'All Types') {
                if (filterType === 'Customer' && !(c.contactTypes || []).includes('Customer')) return false;
                if (filterType === 'Supplier' && !(c.contactTypes || []).includes('Supplier')) return false;
                if (filterType === 'Service Provider' && !(c.contactTypes || []).includes('Service Provider')) return false;
            }
            if (filterLogin !== 'All Logins') {
                if (filterLogin === 'Enabled' && !c.loginEnabled) return false;
                if (filterLogin === 'Disabled' && c.loginEnabled) return false;
            }
            if (filterTag) {
                if (!(c.tags || []).includes(filterTag)) return false;
            }
            return true;
        });
    }, [customers, search, filterType, filterLogin, filterTag]);

    const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

    const toggleSelect = (id: string) => setSelected(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });
    const toggleAll = () => {
        if (selected.size === paginated.length) setSelected(new Set());
        else setSelected(new Set(paginated.map(c => c._id)));
    };

    const getTypeLabel = (c: Customer) => {
        const types = c.contactTypes || ['Customer'];
        return types[0] || 'Customer';
    };

    const exportCSV = () => {
        const rows = [
            ['Name', 'Business', 'Type', 'Email', 'Phone', 'Mobile', 'Login', 'Tags'],
            ...filtered.map(c => [
                `${c.firstName} ${c.lastName || ''}`.trim(),
                c.businessName || '',
                (c.contactTypes || []).join(', '),
                c.email || '',
                c.phone || '',
                c.mobile || '',
                c.loginEnabled ? 'Enabled' : 'Disabled',
                (c.tags || []).join(', '),
            ]),
        ];
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'contacts.csv'; a.click();
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-[20px] font-bold text-slate-800">Contacts</h1>
                <button onClick={() => { setEditContact(undefined); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#4D7CFF] text-white text-[13px] font-semibold rounded-lg hover:bg-[#3a6ae8] shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                    Add Contact
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap items-center gap-2">
                <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF]">
                    <option>All Types</option>
                    <option>Customer</option>
                    <option>Supplier</option>
                    <option>Service Provider</option>
                </select>
                <select value={filterLogin} onChange={e => { setFilterLogin(e.target.value); setPage(1); }}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF]">
                    <option>All Logins</option>
                    <option>Enabled</option>
                    <option>Disabled</option>
                </select>
                <select value={filterTag} onChange={e => { setFilterTag(e.target.value); setPage(1); }}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF]">
                    <option value="">No Filters</option>
                    {tags.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
                <select value={filterTag} onChange={e => { setFilterTag(e.target.value); setPage(1); }}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF]">
                    <option value="">Select Tags</option>
                    {tags.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
                <div className="flex-1 min-w-[180px]">
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="px-4 py-3 w-10">
                                    <input type="checkbox" checked={paginated.length > 0 && selected.size === paginated.length} onChange={toggleAll} className="accent-[#4D7CFF]" />
                                </th>
                                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <button className="flex items-center gap-1 hover:text-slate-700">
                                        Name
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5-5 5 5H7zm0 4l5 5 5-5H7z" /></svg>
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Business</th>
                                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Login</th>
                                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Address</th>
                                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tags</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={8} className="py-12 text-center">
                                    <div className="w-7 h-7 border-2 border-slate-100 border-t-[#4D7CFF] rounded-full animate-spin mx-auto" />
                                    <p className="text-slate-400 text-[13px] mt-3">Loading contacts…</p>
                                </td></tr>
                            ) : paginated.length === 0 ? (
                                <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-[13px]">No contacts found.</td></tr>
                            ) : paginated.map(c => (
                                <tr key={c._id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-4 py-3">
                                        <input type="checkbox" checked={selected.has(c._id)} onChange={() => toggleSelect(c._id)} className="accent-[#4D7CFF]" />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <ContactAvatar c={c} size="md" />
                                            <span className="font-semibold text-[#4D7CFF] hover:underline cursor-pointer"
                                                onClick={() => { setEditContact(c); setShowForm(true); }}>
                                                {c.firstName} {c.lastName || ''}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{c.businessName || ''}</td>
                                    <td className="px-4 py-3 text-slate-600">{getTypeLabel(c)}</td>
                                    <td className="px-4 py-3 text-slate-500">{c.loginEnabled ? 'Enabled' : 'Disabled'}</td>
                                    <td className="px-4 py-3 text-slate-600">{c.email || ''}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {(c.tags || []).map(tagName => {
                                                const tag = tags.find(t => t.name === tagName);
                                                if (!tag) return null;
                                                if (tag.type === 'Checkbox') {
                                                    return (
                                                        <label key={tagName} className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                                                            style={{ color: tag.color }}>
                                                            <input type="checkbox" className="w-3 h-3" style={{ accentColor: tag.color }} />
                                                            {tagName}
                                                        </label>
                                                    );
                                                }
                                                return (
                                                    <span key={tagName} className="px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                                                        style={{ backgroundColor: tag.color }}>
                                                        {tagName}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => { setEditContact(c); setShowForm(true); }}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-[#4D7CFF] text-white text-[12px] font-semibold rounded-lg hover:bg-[#3a6ae8] transition-colors">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                Edit
                                            </button>
                                            <button onClick={() => setDeleteConfirm(c)}
                                                className="w-8 h-8 flex items-center justify-center bg-[#EF4444] text-white rounded-lg hover:bg-red-600 transition-colors">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[13px] text-slate-600">
                            Show
                            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                                className="border border-slate-200 rounded px-2 py-1 text-[13px] focus:outline-none">
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <button onClick={exportCSV} className="px-3 py-1.5 border border-slate-200 rounded text-[12px] font-semibold text-slate-600 hover:bg-slate-50">CSV</button>
                        <button className="px-3 py-1.5 border border-slate-200 rounded text-[12px] font-semibold text-slate-600 hover:bg-slate-50">Excel</button>
                        <button onClick={() => setShowTagsModal(true)}
                            className="px-3 py-1.5 border border-slate-200 rounded text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
                            Manage Tags
                        </button>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="px-3 py-1.5 border border-slate-200 rounded text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                            Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => setPage(p)}
                                className={`w-8 h-8 rounded text-[12px] font-semibold ${page === p ? 'bg-[#4D7CFF] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                {p}
                            </button>
                        ))}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="px-3 py-1.5 border border-slate-200 rounded text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <ContactFormModal
                open={showForm}
                onClose={() => { setShowForm(false); setEditContact(undefined); }}
                initial={editContact}
                onSaved={handleSaved}
                tags={tags}
                onOpenManageTags={() => setShowTagsModal(true)}
            />
            <ManageTagsModal
                open={showTagsModal}
                onClose={() => setShowTagsModal(false)}
                tags={tags}
                onSaved={t => { setTags(t); fetchTags(); }}
            />

            {/* Delete confirm */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
                    <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                        <h3 className="text-[15px] font-bold text-slate-800 mb-2">Delete Contact</h3>
                        <p className="text-[13px] text-slate-600 mb-5">
                            Are you sure you want to delete <span className="font-semibold">{deleteConfirm.firstName} {deleteConfirm.lastName}</span>? This cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteConfirm(null)}
                                className="px-5 py-2 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button onClick={handleDelete} disabled={deleting}
                                className="px-5 py-2 bg-red-500 text-white rounded-lg text-[13px] font-semibold hover:bg-red-600 disabled:opacity-60">
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
