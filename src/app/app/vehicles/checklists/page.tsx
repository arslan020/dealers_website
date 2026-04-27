'use client';

import { useCallback, useEffect, useState } from 'react';

type TemplateTask = { _id: string; name: string; order: number };
type Template = { _id: string; name: string; tasks: TemplateTask[] };

type VehicleRow = {
    _id: string;
    vrm: string;
    make: string;
    model: string;
    status: string;
    checklist: {
        _id: string;
        templateName: string;
        tasks: { _id: string; name: string; done: boolean }[];
        notes: string;
    } | null;
};

export default function ChecklistsPage() {
    const [tab, setTab] = useState<'templates' | 'overview'>('templates');

    /* ── Templates state ── */
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [creatingTemplate, setCreatingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [editName, setEditName] = useState('');
    const [editTasks, setEditTasks] = useState<string[]>([]);
    const [newTaskInput, setNewTaskInput] = useState('');
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    /* ── Overview state ── */
    const [overviewTemplateId, setOverviewTemplateId] = useState('');
    const [overviewVehicles, setOverviewVehicles] = useState<VehicleRow[]>([]);
    const [loadingOverview, setLoadingOverview] = useState(false);

    const loadTemplates = useCallback(async () => {
        setLoadingTemplates(true);
        try {
            const res = await fetch('/api/checklist-templates');
            const data = await res.json();
            if (data.ok) setTemplates(data.templates || []);
        } finally {
            setLoadingTemplates(false);
        }
    }, []);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    const handleCreateTemplate = async () => {
        const name = newTemplateName.trim();
        if (!name) return;
        setCreatingTemplate(true);
        try {
            const res = await fetch('/api/checklist-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            if (data.ok) {
                setTemplates(prev => [...prev, data.template]);
                setNewTemplateName('');
            }
        } finally {
            setCreatingTemplate(false);
        }
    };

    const openEdit = (t: Template) => {
        setEditingTemplate(t);
        setEditName(t.name);
        setEditTasks(t.tasks.map(task => task.name));
        setNewTaskInput('');
    };

    const handleSaveTemplate = async () => {
        if (!editingTemplate) return;
        setSavingTemplate(true);
        try {
            const tasks = editTasks.map((name, i) => ({ name, order: i }));
            const res = await fetch(`/api/checklist-templates/${editingTemplate._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, tasks }),
            });
            const data = await res.json();
            if (data.ok) {
                setTemplates(prev => prev.map(t => t._id === editingTemplate._id ? data.template : t));
                setEditingTemplate(null);
            }
        } finally {
            setSavingTemplate(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Delete this checklist template?')) return;
        setDeletingId(id);
        try {
            await fetch(`/api/checklist-templates/${id}`, { method: 'DELETE' });
            setTemplates(prev => prev.filter(t => t._id !== id));
        } finally {
            setDeletingId(null);
        }
    };

    const loadOverview = useCallback(async (templateId: string) => {
        if (!templateId) { setOverviewVehicles([]); return; }
        setLoadingOverview(true);
        try {
            const res = await fetch(`/api/checklist-overview?templateId=${templateId}`);
            const data = await res.json();
            if (data.ok) setOverviewVehicles(data.vehicles || []);
            else setOverviewVehicles([]);
        } finally {
            setLoadingOverview(false);
        }
    }, []);

    useEffect(() => {
        if (tab === 'overview') loadOverview(overviewTemplateId);
    }, [tab, overviewTemplateId, loadOverview]);

    const overviewTemplate = templates.find(t => t._id === overviewTemplateId);

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                {/* Page header */}
                <div>
                    <h1 className="text-[22px] font-bold text-slate-900">Checklists</h1>
                    <p className="text-[13px] text-slate-500 mt-1">Create checklist templates and assign them to vehicles.</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-slate-200">
                    {(['templates', 'overview'] as const).map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTab(t)}
                            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors capitalize ${
                                tab === t
                                    ? 'border-[#4D7CFF] text-[#4D7CFF]'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {t === 'templates' ? 'Checklist Templates' : 'Checklist Overview'}
                        </button>
                    ))}
                </div>

                {/* ── TEMPLATES TAB ── */}
                {tab === 'templates' && (
                    <div className="space-y-4">
                        {/* Create new */}
                        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                            <h2 className="text-[14px] font-bold text-slate-700 mb-3">New Checklist Template</h2>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="e.g. Vehicle Preparation"
                                    value={newTemplateName}
                                    onChange={e => setNewTemplateName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleCreateTemplate(); }}
                                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateTemplate}
                                    disabled={!newTemplateName.trim() || creatingTemplate}
                                    className="px-4 py-2.5 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-bold hover:bg-blue-600 disabled:opacity-50"
                                >
                                    {creatingTemplate ? 'Adding…' : 'Add Checklist'}
                                </button>
                            </div>
                        </div>

                        {/* Templates list */}
                        {loadingTemplates ? (
                            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-10 text-center text-slate-400 text-[13px]">Loading…</div>
                        ) : templates.length === 0 ? (
                            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-10 text-center">
                                <p className="text-[14px] font-semibold text-slate-700">No templates yet</p>
                                <p className="text-[12px] text-slate-400 mt-1">Create your first checklist template above.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {templates.map(t => (
                                    <div key={t._id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                                            <div>
                                                <span className="text-[14px] font-bold text-slate-800">{t.name}</span>
                                                <span className="ml-2 text-[11px] text-slate-400">{t.tasks.length} tasks</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(t)}
                                                    className="px-3 py-1.5 text-[12px] font-bold text-[#4D7CFF] border border-[#4D7CFF] rounded-lg hover:bg-blue-50"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteTemplate(t._id)}
                                                    disabled={deletingId === t._id}
                                                    className="px-3 py-1.5 text-[12px] font-bold text-rose-500 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                                                >
                                                    {deletingId === t._id ? '…' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>
                                        {t.tasks.length > 0 && (
                                            <div className="px-5 py-3 space-y-1.5">
                                                {t.tasks.map((task, i) => (
                                                    <div key={task._id} className="flex items-center gap-2 text-[12px] text-slate-600">
                                                        <span className="text-slate-300 font-mono">{i + 1}.</span>
                                                        {task.name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── OVERVIEW TAB ── */}
                {tab === 'overview' && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                            <label className="block text-[13px] font-bold text-slate-700 mb-2">Select Checklist</label>
                            <select
                                value={overviewTemplateId}
                                onChange={e => setOverviewTemplateId(e.target.value)}
                                className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                            >
                                <option value="">— Select a checklist —</option>
                                {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                        </div>

                        {overviewTemplateId && (
                            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-[#E2E8F0]">
                                    <h2 className="text-[14px] font-bold text-slate-800">
                                        {overviewTemplate?.name} — Vehicle Overview
                                    </h2>
                                </div>
                                {loadingOverview ? (
                                    <div className="p-10 text-center text-slate-400 text-[13px]">Loading…</div>
                                ) : overviewVehicles.length === 0 ? (
                                    <div className="p-10 text-center">
                                        <p className="text-[13px] text-slate-500">No vehicles assigned to this checklist yet.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-[12px]">
                                            <thead>
                                                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                                                    <th className="px-5 py-3">Vehicle</th>
                                                    <th className="px-3 py-3">Status</th>
                                                    {overviewTemplate?.tasks.map(task => (
                                                        <th key={task._id} className="px-3 py-3 max-w-[120px] truncate" title={task.name}>
                                                            {task.name}
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-3">Progress</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {overviewVehicles.map(v => {
                                                    const tasks = v.checklist?.tasks || [];
                                                    const done = tasks.filter(t => t.done).length;
                                                    const total = tasks.length;
                                                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                                                    return (
                                                        <tr key={v._id} className="hover:bg-slate-50/60 transition-colors align-middle">
                                                            <td className="px-5 py-3">
                                                                <a
                                                                    href={`/app/vehicles/${v._id}`}
                                                                    className="font-mono text-[11px] font-black bg-[#FFD200] border-2 border-amber-400 px-2 py-0.5 rounded text-black hover:brightness-95"
                                                                >
                                                                    {v.vrm}
                                                                </a>
                                                                <span className="ml-2 text-slate-600 text-[12px]">{v.make} {v.model}</span>
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <span className="text-[11px] font-semibold text-slate-600 border border-slate-200 rounded px-2 py-0.5">
                                                                    {v.status}
                                                                </span>
                                                            </td>
                                                            {overviewTemplate?.tasks.map(tplTask => {
                                                                const vehicleTask = tasks.find(t => t.name === tplTask.name);
                                                                return (
                                                                    <td key={tplTask._id} className="px-3 py-3 text-center">
                                                                        {vehicleTask ? (
                                                                            vehicleTask.done ? (
                                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500">
                                                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                                    </svg>
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-block w-5 h-5 rounded-full border-2 border-slate-300" />
                                                                            )
                                                                        ) : (
                                                                            <span className="text-slate-300 text-[10px]">—</span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="px-3 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                                                                        <div
                                                                            className="h-full rounded-full bg-emerald-500"
                                                                            style={{ width: `${pct}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-[11px] font-bold text-slate-600 tabular-nums">{pct}%</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Edit Template Modal ── */}
            {editingTemplate && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
                    <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => setEditingTemplate(null)} />
                    <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <h2 className="text-[16px] font-bold text-slate-800">Edit Checklist Template</h2>
                            <button type="button" onClick={() => setEditingTemplate(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="px-5 py-5 space-y-4">
                            <div>
                                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Template Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                                />
                            </div>

                            <div>
                                <label className="block text-[12px] font-bold text-slate-600 mb-2">Tasks</label>
                                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                    {editTasks.map((taskName, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-400 font-mono w-5 text-right shrink-0">{i + 1}.</span>
                                            <input
                                                type="text"
                                                value={taskName}
                                                onChange={e => {
                                                    const updated = [...editTasks];
                                                    updated[i] = e.target.value;
                                                    setEditTasks(updated);
                                                }}
                                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setEditTasks(prev => prev.filter((_, idx) => idx !== i))}
                                                className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add task to template */}
                                <div className="flex items-center gap-2 mt-2">
                                    <input
                                        type="text"
                                        placeholder="New task name…"
                                        value={newTaskInput}
                                        onChange={e => setNewTaskInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newTaskInput.trim()) {
                                                setEditTasks(prev => [...prev, newTaskInput.trim()]);
                                                setNewTaskInput('');
                                            }
                                        }}
                                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                                    />
                                    <button
                                        type="button"
                                        disabled={!newTaskInput.trim()}
                                        onClick={() => {
                                            if (newTaskInput.trim()) {
                                                setEditTasks(prev => [...prev, newTaskInput.trim()]);
                                                setNewTaskInput('');
                                            }
                                        }}
                                        className="px-3 py-2 bg-slate-800 text-white rounded-lg text-[12px] font-bold hover:bg-slate-900 disabled:opacity-50"
                                    >
                                        Add Task
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
                            <button type="button" onClick={() => setEditingTemplate(null)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button type="button" onClick={handleSaveTemplate} disabled={savingTemplate || !editName.trim()}
                                className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-[13px] font-bold hover:bg-emerald-700 disabled:opacity-60">
                                {savingTemplate ? 'Saving…' : 'Save Checklist'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
