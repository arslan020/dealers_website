'use client';

import { useState, useEffect } from 'react';

type Employee = {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
    permissions: {
        vehicles: boolean;
        sales: boolean;
        tasks: boolean;
        analytics: boolean;
        advertising: boolean;
        inventory: boolean;
        addVehicle: boolean;
        quickCheck: boolean;
    };
    createdAt: string;
};

export default function TeamPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
    const [editingPermsEmp, setEditingPermsEmp] = useState<Employee | null>(null);
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        permissions: {
            vehicles: true,
            sales: true,
            tasks: true,
            analytics: true,
            advertising: true,
            inventory: true,
            addVehicle: true,
            quickCheck: true,
        }
    });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    async function fetchEmployees() {
        setLoading(true);
        const res = await fetch('/api/users');
        const data = await res.json();
        if (data.ok) setEmployees(data.users);
        setLoading(false);
    }

    useEffect(() => { fetchEmployees(); }, []);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setFormError('');
        setFormSuccess('');
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!data.ok) { setFormError(data.error?.message || 'Failed.'); }
        else {
            setFormSuccess(`Employee "${form.name}" created!`);
            setForm({
                name: '',
                email: '',
                phone: '',
                password: '',
                permissions: {
                    vehicles: true,
                    sales: true,
                    tasks: true,
                    analytics: true,
                    advertising: true,
                    inventory: true,
                    addVehicle: true,
                    quickCheck: true,
                }
            });
            fetchEmployees();
        }
        setSubmitting(false);
    }

    async function toggleActive(id: string, current: boolean) {
        await fetch(`/api/users/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !current }),
        });
        fetchEmployees();
    }


    async function handleUpdatePermissions(id: string, permissions: any) {
        // Optimistic update
        const originalEmployees = [...employees];
        setEmployees(employees.map(emp =>
            emp._id === id ? { ...emp, permissions } : emp
        ));

        try {
            const res = await fetch(`/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions }),
            });

            const data = await res.json();
            if (!data.ok) {
                alert(data.error?.message || 'Failed to update permissions');
                setEmployees(originalEmployees);
            }
        } catch (err) {
            console.error(err);
            alert('Connection error. Please try again.');
            setEmployees(originalEmployees);
        }
    }

    return (
        <div className="w-full p-4 sm:p-10 pb-24">
            <PermissionsModal
                employee={editingPermsEmp}
                onClose={() => setEditingPermsEmp(null)}
                onSave={async (id, perms) => {
                    await handleUpdatePermissions(id, perms);
                    setEditingPermsEmp(null);
                }}
            />
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage employees and their permissions.</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors">
                    + Add Employee
                </button>
            </div>

            {/* Create Employee Form */}
            {showForm && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-base font-semibold text-slate-900 mb-4">Add New Employee</h2>
                    {formError && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{formError}</div>}
                    {formSuccess && <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">{formSuccess}</div>}
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
                                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-r border-slate-300 shrink-0">
                                        <svg width="20" height="15" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg" className="rounded-sm shadow-sm">
                                            <clipPath id="s">
                                                <path d="M0,0 v30 h60 v-30 z" />
                                            </clipPath>
                                            <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
                                            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
                                            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
                                            <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
                                            <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
                                        </svg>
                                        <span className="text-sm font-bold text-slate-700">+44</span>
                                    </div>
                                    <input
                                        type="tel"
                                        value={form.phone}
                                        onChange={e => setForm({ ...form, phone: e.target.value })}
                                        placeholder="7700 900 000"
                                        className="w-full px-3 py-2 text-sm focus:outline-none placeholder:text-slate-400"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                                <input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <h3 className="text-sm font-semibold text-slate-900 mb-3">Feature Access</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6">
                                {Object.keys(form.permissions).map((key) => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative inline-flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={(form.permissions as any)[key]}
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    permissions: { ...form.permissions, [key]: e.target.checked }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </div>
                                        <span className="text-[12px] font-bold text-slate-600 group-hover:text-slate-900 capitalize leading-none">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button type="submit" disabled={submitting}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                                {submitting ? 'Adding...' : 'Add Employee'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Employees Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="text-sm font-semibold text-slate-700">Employees ({employees.length})</h2>
                </div>
                {loading ? (
                    <div className="py-12 text-center text-slate-500 text-sm">Loading...</div>
                ) : employees.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">No employees yet. Add your first employee above.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[800px]">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">NAME</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">EMAIL</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-64">PERMISSIONS</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">STATUS</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">JOINED</th>
                                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 text-right">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {employees.map(emp => (
                                    <tr key={emp._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="font-semibold text-slate-900">{emp.name}</div>
                                        </td>
                                        <td className="px-4 py-4 text-slate-600">
                                            <div>{emp.email}</div>
                                            {emp.phone && <div className="text-[11px] text-slate-400 mt-0.5">{emp.phone}</div>}
                                        </td>
                                        <td className="px-4 py-4">
                                            <button
                                                onClick={() => setEditingPermsEmp(emp)}
                                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[11px] font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm flex items-center gap-2 group"
                                            >
                                                <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                                </svg>
                                                Manage
                                            </button>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${emp.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${emp.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                {emp.isActive ? 'Active' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-slate-500 text-[13px]">{new Date(emp.createdAt).toLocaleDateString()}</td>
                                        <td className="px-4 py-4 text-right">
                                            <button onClick={() => toggleActive(emp._id, emp.isActive)}
                                                className={`text-[12px] px-4 py-1.5 rounded-lg font-bold transition-all border ${emp.isActive
                                                    ? 'bg-white text-red-600 border-red-100 hover:bg-red-50 hover:border-red-200'
                                                    : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'}`}>
                                                {emp.isActive ? 'Disable' : 'Enable'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function PermissionsModal({ employee, onClose, onSave }: { employee: Employee | null, onClose: () => void, onSave: (id: string, perms: any) => void }) {
    const [perms, setPerms] = useState<any>(null);

    useEffect(() => {
        if (employee) setPerms(employee.permissions);
        else setPerms(null);
    }, [employee]);

    if (!employee || !perms) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 leading-tight">Manage Permissions</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{employee.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg>
                    </button>
                </div>

                <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
                    {Object.keys(perms).map((key) => (
                        <label key={key} className="flex items-center gap-3 p-4 rounded-2xl border border-slate-50 hover:border-blue-100 hover:bg-blue-50/30 transition-all cursor-pointer group">
                            <div className="relative inline-flex items-center">
                                <input
                                    type="checkbox"
                                    checked={perms[key]}
                                    onChange={(e) => setPerms({ ...perms, [key]: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </div>
                            <span className="text-[13px] font-bold text-slate-600 group-hover:text-blue-700 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                        </label>
                    ))}
                </div>

                <div className="p-6 sm:p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                    <button onClick={onClose} className="w-full sm:flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all">Cancel</button>
                    <button onClick={() => onSave(employee._id, perms)} className="w-full sm:flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 hover:shadow-blue-200 transition-all order-first sm:order-last">Save Changes</button>
                </div>
            </div>
        </div>
    );
}
