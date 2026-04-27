'use client';

import { useState, useEffect } from 'react';

type AutoTraderConfig = {
    apiKey?: string;
    apiSecret?: string;
    dealerId?: string;
    postcode?: string;
};

type Tenant = {
    _id: string;
    name: string;
    status: 'active' | 'suspended';
    plan: string;
    createdAt: string;
    autoTraderConfig?: AutoTraderConfig;
};

export default function AdminPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', plan: '' });
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', plan: 'trial', adminName: '', adminEmail: '', adminPassword: '', atDealerId: '' });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    // AutoTrader integration modal state
    const [integrationTenant, setIntegrationTenant] = useState<Tenant | null>(null);
    const [atConfig, setAtConfig] = useState<AutoTraderConfig>({ apiKey: '', apiSecret: '', dealerId: '', postcode: '' });
    const [atSaving, setAtSaving] = useState(false);
    const [atMessage, setAtMessage] = useState({ text: '', type: '' });

    async function fetchTenants() {
        const res = await fetch('/api/tenants');
        const data = await res.json();
        if (data.ok) setTenants(data.tenants);
        setLoading(false);
    }

    useEffect(() => { fetchTenants(); }, []);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setFormError('');
        setFormSuccess('');
        const res = await fetch('/api/tenants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!data.ok) { setFormError(data.error?.message || 'Failed.'); }
        else {
            setFormSuccess(`Dealership "${form.name}" created! Admin: ${form.adminEmail}`);
            setForm({ name: '', plan: 'trial', adminName: '', adminEmail: '', adminPassword: '', atDealerId: '' });
            fetchTenants();
        }
        setSubmitting(false);
    }

    async function toggleStatus(id: string, currentStatus: string) {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        await fetch(`/api/tenants/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        fetchTenants();
    }

    async function handleSaveEdit(id: string) {
        setLoading(true);
        await fetch(`/api/tenants/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: editForm.name, plan: editForm.plan }),
        });
        setEditingId(null);
        fetchTenants();
    }

    function startEditing(tenant: Tenant) {
        setEditingId(tenant._id);
        setEditForm({ name: tenant.name, plan: tenant.plan });
    }

    async function handleDelete(tenant: Tenant) {
        const confirmed = confirm(`DELETE "${tenant.name}"?\n\nThis will permanently delete the dealership, all users, vehicles, customers, leads, and every other record. This CANNOT be undone.\n\nType OK to confirm.`);
        if (!confirmed) return;
        const res = await fetch(`/api/tenants/${tenant._id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) fetchTenants();
        else alert(data.error?.message || 'Delete failed.');
    }

    async function handleResetPassword(tenantId: string) {
        if (!confirm('Are you sure you want to reset the password for this dealership\'s admin?')) return;
        alert('Password reset link sent to admin email (mock).');
    }

    function openIntegrationModal(tenant: Tenant) {
        setIntegrationTenant(tenant);
        setAtConfig({
            apiKey: tenant.autoTraderConfig?.apiKey || '',
            apiSecret: tenant.autoTraderConfig?.apiSecret || '',
            dealerId: tenant.autoTraderConfig?.dealerId || '',
            postcode: tenant.autoTraderConfig?.postcode || '',
        });
        setAtMessage({ text: '', type: '' });
    }

    async function handleSaveAtConfig(e: React.FormEvent) {
        e.preventDefault();
        if (!integrationTenant) return;
        setAtSaving(true);
        setAtMessage({ text: '', type: '' });
        try {
            const res = await fetch(`/api/tenants/${integrationTenant._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoTraderConfig: atConfig }),
            });
            const data = await res.json();
            if (data.ok) {
                setAtMessage({ text: 'AutoTrader configuration saved!', type: 'success' });
                fetchTenants();
            } else {
                setAtMessage({ text: data.error?.message || 'Failed to save.', type: 'error' });
            }
        } catch {
            setAtMessage({ text: 'Network error.', type: 'error' });
        } finally {
            setAtSaving(false);
        }
    }

    const filteredTenants = tenants.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.plan.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = {
        total: tenants.length,
        active: tenants.filter(t => t.status === 'active').length,
        trials: tenants.filter(t => t.plan === 'trial').length
    };

    return (
        <div className="w-full space-y-6 px-4 sm:px-10 pb-10">
            <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Super Admin Panel</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage all dealerships on the platform.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    + New Dealership
                </button>
            </div>

            {/* Create Dealership Form */}
            {showForm && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-base font-semibold text-slate-900 mb-4">Create New Dealership</h2>
                    {formError && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{formError}</div>}
                    {formSuccess && <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{formSuccess}</div>}
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Dealership Name</label>
                            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
                            <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="trial">Trial</option>
                                <option value="basic">Basic</option>
                                <option value="pro">Pro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Admin Name</label>
                            <input required value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Admin Email</label>
                            <input required type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Admin Password</label>
                            <input required type="password" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">AutoTrader Advertiser ID (Optional)</label>
                            <input value={form.atDealerId} onChange={e => setForm({ ...form, atDealerId: e.target.value })}
                                placeholder="e.g. 123456"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                        </div>
                        <div className="flex items-end">
                            <button type="submit" disabled={submitting}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                                {submitting ? 'Creating...' : 'Create Dealership'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border md:col-span-1 border-slate-200 shadow-sm rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase">Total Dealerships</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white border md:col-span-1 border-slate-200 shadow-sm rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase">Active Dealerships</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
                    </div>
                </div>
                <div className="bg-white border md:col-span-1 border-slate-200 shadow-sm rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase">Currently on Trial</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{stats.trials}</p>
                    </div>
                </div>
            </div>

            {/* Tenants Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-sm font-semibold text-slate-700">Dealership Directory</h2>
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Search name, plan or status..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
                {loading ? (
                    <div className="py-12 text-center text-slate-500 text-sm">Loading...</div>
                ) : tenants.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">No dealerships yet. Create one above.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">NAME</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">PLAN</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">STATUS</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">AUTOTRADER</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">CREATED</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTenants.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                                        No dealerships found matching &quot;{searchQuery}&quot;
                                    </td>
                                </tr>
                            ) : filteredTenants.map(t => (
                                <tr key={t._id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">
                                        {editingId === t._id ? (
                                            <input
                                                value={editForm.name}
                                                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                            />
                                        ) : t.name}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {editingId === t._id ? (
                                            <select
                                                value={editForm.plan}
                                                onChange={e => setEditForm(prev => ({ ...prev, plan: e.target.value }))}
                                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500 capitalize"
                                            >
                                                <option value="trial">Trial</option>
                                                <option value="basic">Basic</option>
                                                <option value="pro">Pro</option>
                                            </select>
                                        ) : <span className="capitalize">{t.plan}</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {t.autoTraderConfig?.apiKey ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                                Connected
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                                Not set
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {editingId === t._id ? (
                                                <>
                                                    <button onClick={() => handleSaveEdit(t._id)} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md font-medium transition-colors">Save</button>
                                                    <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md font-medium transition-colors">Cancel</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEditing(t)} className="text-xs px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md font-medium transition-colors">Edit</button>
                                                    <button
                                                        onClick={() => openIntegrationModal(t)}
                                                        className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md font-medium transition-colors flex items-center gap-1"
                                                        title="Configure AutoTrader Integration"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                        AT Keys
                                                    </button>
                                                    <button onClick={() => handleResetPassword(t._id)} className="text-xs px-2 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-md font-medium transition-colors" title="Reset Admin Password">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                                    </button>
                                                    <button onClick={() => toggleStatus(t._id, t.status)}
                                                        className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${t.status === 'active'
                                                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                            : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                                                        {t.status === 'active' ? 'Suspend' : 'Activate'}
                                                    </button>
                                                    <button onClick={() => handleDelete(t)}
                                                        className="text-xs px-2 py-1 bg-red-600 text-white hover:bg-red-700 rounded-md font-medium transition-colors"
                                                        title="Delete dealership and all data">
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* AutoTrader Integration Modal */}
            {integrationTenant && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">AutoTrader Integration</h3>
                                <p className="text-xs text-slate-500 mt-0.5">{integrationTenant.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Configure AutoTrader settings for {integrationTenant.name}</p>
                            </div>
                            <button onClick={() => setIntegrationTenant(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveAtConfig} className="p-6 space-y-4">
                            {atMessage.text && (
                                <div className={`p-3 rounded-lg text-sm font-medium ${atMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {atMessage.text}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Advertiser ID</label>
                                <input
                                    type="text"
                                    value={atConfig.dealerId}
                                    onChange={e => setAtConfig({ ...atConfig, dealerId: e.target.value })}
                                    placeholder="e.g. 123456"
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm font-mono"
                                />
                                <p className="text-[10px] text-slate-400 mt-1.5">Found in the dealer&apos;s AutoTrader portal under Account Settings.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Dealership Postcode</label>
                                <input
                                    type="text"
                                    value={atConfig.postcode || ''}
                                    onChange={e => setAtConfig({ ...atConfig, postcode: e.target.value })}
                                    placeholder="e.g. NN7 3AB"
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm font-mono uppercase"
                                />
                                <p className="text-[10px] text-slate-400 mt-1.5">Used to calculate competitor distances and Avg. Distance.</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={atSaving}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {atSaving ? 'Saving...' : 'Save Configuration'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIntegrationTenant(null)}
                                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
