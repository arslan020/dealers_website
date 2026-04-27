'use client';

import { useCallback, useEffect, useState } from 'react';

type ChecklistTask = {
    _id: string;
    name: string;
    done: boolean;
    notes: string;
    order: number;
};

type Checklist = {
    _id: string;
    templateId: string | null;
    templateName: string;
    notes: string;
    tasks: ChecklistTask[];
};

type Template = {
    _id: string;
    name: string;
    tasks: { _id: string; name: string }[];
};

export function VehicleChecklistTab({ vehicleId }: { vehicleId: string }) {
    const [checklist, setChecklist] = useState<Checklist | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');
    const [addingTask, setAddingTask] = useState(false);
    const [overallNotes, setOverallNotes] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [taskNoteOpen, setTaskNoteOpen] = useState<string | null>(null);
    const [taskNoteText, setTaskNoteText] = useState('');
    const [savingTaskNote, setSavingTaskNote] = useState(false);
    const [removing, setRemoving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [clRes, tplRes] = await Promise.all([
                fetch(`/api/vehicles/${vehicleId}/checklist`),
                fetch('/api/checklist-templates'),
            ]);
            const clData = await clRes.json();
            const tplData = await tplRes.json();
            if (clData.ok) {
                setChecklist(clData.checklist);
                setOverallNotes(clData.checklist?.notes || '');
            }
            if (tplData.ok) setTemplates(tplData.templates || []);
        } finally {
            setLoading(false);
        }
    }, [vehicleId]);

    useEffect(() => { load(); }, [load]);

    const handleAssign = async () => {
        if (!selectedTemplateId) return;
        setAssigning(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/checklist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId: selectedTemplateId }),
            });
            const data = await res.json();
            if (data.ok) {
                setChecklist(data.checklist);
                setOverallNotes(data.checklist?.notes || '');
                setSelectedTemplateId('');
            }
        } finally {
            setAssigning(false);
        }
    };

    const handleRemove = async () => {
        if (!confirm('Remove this checklist from the vehicle?')) return;
        setRemoving(true);
        try {
            await fetch(`/api/vehicles/${vehicleId}/checklist`, { method: 'DELETE' });
            setChecklist(null);
            setOverallNotes('');
        } finally {
            setRemoving(false);
        }
    };

    const handleToggle = async (task: ChecklistTask) => {
        setTogglingId(task._id);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/checklist/tasks/${task._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ done: !task.done }),
            });
            const data = await res.json();
            if (data.ok) {
                setChecklist(prev => prev ? {
                    ...prev,
                    tasks: prev.tasks.map(t => t._id === task._id ? { ...t, done: !t.done } : t),
                } : prev);
            }
        } finally {
            setTogglingId(null);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        setDeletingId(taskId);
        try {
            await fetch(`/api/vehicles/${vehicleId}/checklist/tasks/${taskId}`, { method: 'DELETE' });
            setChecklist(prev => prev ? { ...prev, tasks: prev.tasks.filter(t => t._id !== taskId) } : prev);
        } finally {
            setDeletingId(null);
        }
    };

    const handleAddTask = async () => {
        const name = newTaskName.trim();
        if (!name) return;
        setAddingTask(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/checklist/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            if (data.ok) {
                setChecklist(prev => {
                    if (!prev) return prev;
                    return { ...prev, tasks: [...prev.tasks, data.task] };
                });
                setNewTaskName('');
            }
        } finally {
            setAddingTask(false);
        }
    };

    const openTaskNote = (task: ChecklistTask) => {
        setTaskNoteOpen(task._id);
        setTaskNoteText(task.notes);
    };

    const handleSaveTaskNote = async () => {
        if (!taskNoteOpen) return;
        setSavingTaskNote(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/checklist/tasks/${taskNoteOpen}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: taskNoteText }),
            });
            const data = await res.json();
            if (data.ok) {
                setChecklist(prev => prev ? {
                    ...prev,
                    tasks: prev.tasks.map(t => t._id === taskNoteOpen ? { ...t, notes: taskNoteText } : t),
                } : prev);
                setTaskNoteOpen(null);
            }
        } finally {
            setSavingTaskNote(false);
        }
    };

    const handleSaveOverallNotes = async () => {
        setSavingNotes(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/checklist`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: overallNotes }),
            });
            const data = await res.json();
            if (data.ok) setChecklist(prev => prev ? { ...prev, notes: overallNotes } : prev);
        } finally {
            setSavingNotes(false);
        }
    };

    const [showHelp, setShowHelp] = useState(false);

    const doneCount = checklist?.tasks.filter(t => t.done).length ?? 0;
    const totalCount = checklist?.tasks.length ?? 0;
    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-10 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <>
        <div className="space-y-4 w-full">
            {/* Header card */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-3">
                        <h2 className="text-[15px] font-bold text-slate-800">Checklist</h2>
                        {checklist && (
                            <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold rounded-full">
                                {checklist.templateName}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowHelp(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                            title="How to use Checklists"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/>
                            </svg>
                            Help
                        </button>
                        {checklist && (
                            <button
                                type="button"
                                onClick={handleRemove}
                                disabled={removing}
                                className="text-[12px] font-semibold text-rose-500 hover:text-rose-700 disabled:opacity-50"
                            >
                                {removing ? 'Removing…' : 'Remove Checklist'}
                            </button>
                        )}
                    </div>
                </div>

                {!checklist ? (
                    /* ── Assign panel ── */
                    <div className="px-5 py-6 space-y-4">
                        <p className="text-[13px] text-slate-600">
                            Select a checklist template to assign to this vehicle.
                        </p>
                        {templates.length === 0 ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
                                No checklist templates yet.{' '}
                                <a href="/app/vehicles/checklists" className="font-bold underline hover:no-underline">
                                    Create one here →
                                </a>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 max-w-lg">
                                <select
                                    value={selectedTemplateId}
                                    onChange={e => setSelectedTemplateId(e.target.value)}
                                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                                >
                                    <option value="">No Checklist</option>
                                    {templates.map(t => (
                                        <option key={t._id} value={t._id}>{t.name}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleAssign}
                                    disabled={!selectedTemplateId || assigning}
                                    className="px-4 py-2.5 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    {assigning ? 'Assigning…' : 'Select Checklist'}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── Checklist content ── */
                    <div className="px-5 py-4 space-y-5">
                        {/* Progress bar */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[12px] font-semibold text-slate-600">{doneCount} of {totalCount} tasks complete</span>
                                <span className="text-[12px] font-bold text-slate-700">{progress}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Tasks list */}
                        <div className="space-y-1">
                            {checklist.tasks.map(task => (
                                <div key={task._id} className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${task.done ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}>
                                    <button
                                        type="button"
                                        onClick={() => handleToggle(task)}
                                        disabled={togglingId === task._id}
                                        className={`mt-0.5 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors disabled:opacity-60 ${
                                            task.done
                                                ? 'bg-emerald-500 border-emerald-500'
                                                : 'border-slate-300 hover:border-[#4D7CFF]'
                                        }`}
                                    >
                                        {task.done && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <span className={`text-[13px] ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                            {task.name}
                                        </span>
                                        {task.notes && (
                                            <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{task.notes}</p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            type="button"
                                            onClick={() => openTaskNote(task)}
                                            className="p-1 rounded text-slate-400 hover:text-[#4D7CFF] hover:bg-blue-50 transition-colors"
                                            title="Add note"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteTask(task._id)}
                                            disabled={deletingId === task._id}
                                            className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
                                            title="Delete task"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Task note modal */}
                        {taskNoteOpen && (
                            <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
                                <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={() => setTaskNoteOpen(null)} />
                                <div className="relative z-10 w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl p-5 space-y-4">
                                    <h3 className="text-[15px] font-bold text-slate-800">Task Note</h3>
                                    <textarea
                                        rows={3}
                                        value={taskNoteText}
                                        onChange={e => setTaskNoteText(e.target.value)}
                                        placeholder="Add a note for this task…"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] outline-none resize-y focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button type="button" onClick={() => setTaskNoteOpen(null)}
                                            className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50">
                                            Cancel
                                        </button>
                                        <button type="button" onClick={handleSaveTaskNote} disabled={savingTaskNote}
                                            className="px-4 py-2 rounded-lg bg-[#4D7CFF] text-white text-[12px] font-bold hover:bg-blue-600 disabled:opacity-60">
                                            {savingTaskNote ? 'Saving…' : 'Save Note'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Add custom task */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                            <input
                                type="text"
                                placeholder="Add a task…"
                                value={newTaskName}
                                onChange={e => setNewTaskName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); }}
                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                            />
                            <button
                                type="button"
                                onClick={handleAddTask}
                                disabled={!newTaskName.trim() || addingTask}
                                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-[12px] font-bold hover:bg-slate-900 disabled:opacity-50"
                            >
                                {addingTask ? '…' : 'Add Task'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Overall notes (only when checklist assigned) */}
            {checklist && (
                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#E2E8F0]">
                        <h3 className="text-[13px] font-bold text-slate-700">Checklist Notes</h3>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        <textarea
                            rows={4}
                            value={overallNotes}
                            onChange={e => setOverallNotes(e.target.value)}
                            placeholder="Add overall notes for this checklist…"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-700 outline-none resize-y focus:border-[#4D7CFF] focus:ring-2 focus:ring-[#4D7CFF]/20"
                        />
                        {overallNotes !== (checklist.notes || '') && (
                            <div className="flex gap-2">
                                <button type="button" onClick={handleSaveOverallNotes} disabled={savingNotes}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[12px] font-bold hover:bg-emerald-700 disabled:opacity-60">
                                    {savingNotes ? 'Saving…' : 'Save Notes'}
                                </button>
                                <button type="button" onClick={() => setOverallNotes(checklist.notes || '')}
                                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-[12px] font-bold hover:bg-slate-50">
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

            {showHelp && (
                <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300" onClick={() => setShowHelp(false)}>
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 ease-out"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 bg-[#4D7CFF] text-white shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                </div>
                                <div>
                                    <div className="text-[15px] font-bold leading-tight">Checklists</div>
                                    <div className="text-[11px] text-white/70 font-medium">Help Guide</div>
                                </div>
                            </div>
                            <button type="button" onClick={() => setShowHelp(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white text-[14px]">✕</button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">

                            <div>
                                <h3 className="text-[13px] font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-blue-500 rounded-full" />
                                    Overview
                                </h3>
                                <p className="text-[12px] text-slate-600 leading-relaxed">
                                    Checklists let you track preparation and handover tasks for each vehicle. Create reusable templates and assign them to individual vehicles to keep your workflow consistent.
                                </p>
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm space-y-4">
                                <h3 className="text-[13px] font-bold text-blue-900 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    How it works
                                </h3>
                                {[
                                    { n: 1, title: 'Create a Template', body: 'Go to Vehicles → Checklists in the top nav. Click "Add Checklist", give it a name (e.g. Vehicle Preparation), add your tasks, then click "Save Checklist".' },
                                    { n: 2, title: 'Assign to This Vehicle', body: 'Select your template from the dropdown and click "Select Checklist". All tasks from the template are copied to this vehicle.' },
                                    { n: 3, title: 'Complete Tasks', body: 'Tick the checkbox next to each task as it is done. The progress bar updates automatically. Completed tasks show a green tick.' },
                                    { n: 4, title: 'Add Task Notes', body: 'Hover over a task and click the pencil icon to add a note (e.g. "Replaced front pads only"). Notes appear beneath the task name.' },
                                    { n: 5, title: 'Add Extra Tasks', body: 'Use the "Add a task…" input at the bottom to add custom tasks specific to this vehicle that are not in the template.' },
                                    { n: 6, title: 'Checklist Notes', body: 'The Checklist Notes section lets you add general notes for the whole checklist — e.g. overall condition or handover instructions.' },
                                    { n: 7, title: 'Checklist Overview', body: 'Go to Vehicles → Checklists → Checklist Overview to see all vehicles assigned to a checklist in one table, with task status per vehicle.' },
                                ].map(({ n, title, body }) => (
                                    <div key={n} className="flex gap-3">
                                        <div className="mt-0.5 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">{n}</div>
                                        <div>
                                            <p className="text-[12px] font-bold text-slate-800">{title}</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{body}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                <p className="text-[12px] font-bold text-amber-800 mb-1">💡 Tip</p>
                                <p className="text-[11px] text-amber-700 leading-relaxed">
                                    Create different templates for different workflows — e.g. one for <em>Vehicle Preparation</em>, one for <em>Vehicle Handover</em>, one for <em>Part-Exchange Intake</em>.
                                </p>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

