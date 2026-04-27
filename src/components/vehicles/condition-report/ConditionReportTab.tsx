'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import ExteriorMap, { FaultPoint } from './ExteriorMap';
import ExteriorInspectionReadonly from './ExteriorInspectionReadonly';
import InteriorInspectionReadonly from './InteriorInspectionReadonly';
import { MotorDeskInventoryEditor, MotorDeskInventoryReadonly } from './MotorDeskInventoryChecklist';
import TyresInspectionReadonly from './TyresInspectionReadonly';
import { emptyInventoryRecord, normalizeInventory } from '@/lib/conditionReportInventory';
import InteriorMap from './InteriorMap';
import TyreOverlaySVG from './TyreOverlaySVG';
import { namaGradeFromFaults, NAMA_GRADE_INFO, type NAMAGrade } from '@/lib/namaGrading';
import { generateConditionReportPDF, type ConditionReportPDFData } from '@/lib/generateConditionReportPDF';
import { fileToDataUrl } from '@/lib/fileToDataUrl';
import { openMediaInNewTab } from '@/lib/openMediaInNewTab';

interface ConditionReportTabProps {
    vehicleId: string;
    vehicleMileage?: number;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleVRM?: string;
    vehicleMotExpiry?: string;
    // Vehicle detail fields for PDF
    vehicleColour?: string;
    vehicleFuelType?: string;
    vehicleTransmission?: string;
    vehicleEngineSize?: string;
    vehicleYear?: string | number;
    vehicleBodyType?: string;
    vehicleDoors?: number;
    vehicleSeats?: number;
}

interface Report {
    _id: string;
    reportType: string;
    staffMember: string;
    mileage: string;
    status: 'draft' | 'completed';
    overallGrade?: string;
    createdAt: string;
    faults: { exterior: FaultPoint[]; interior: FaultPoint[] };
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const TYRE_POSITIONS = ['front-left', 'front-right', 'rear-left', 'rear-right', 'spare'] as const;
const TYRE_LABELS: Record<string, string> = {
    'front-left': 'Front Left', 'front-right': 'Front Right',
    'rear-left': 'Rear Left', 'rear-right': 'Rear Right', spare: 'Spare',
};

const GRADE_COLORS: Record<string, string> = {
    '1': '#4CAF50', '2': '#8BC34A', '3': '#FFC107', '4': '#FF9800', '5': '#B71C1C', 'U': '#9E9E9E',
};

function normalizeFaultsFromApi(raw: unknown): FaultPoint[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((f: Record<string, unknown>, i: number) => {
        const c = f.coords as { x?: number; y?: number } | undefined;
        return {
            idx: typeof f.idx === 'number' ? f.idx : i + 1,
            part: (f.part as string) ?? '',
            damage: (f.damage as string) ?? '',
            detail: (f.detail as string) ?? '',
            note: (f.note as string) ?? '',
            coords: c && typeof c.x === 'number' && typeof c.y === 'number' ? { x: c.x, y: c.y } : { x: 0, y: 0 },
            photoUrl: f.photoUrl as string | undefined,
            sectionId: f.sectionId as string | undefined,
            fromPrevious: f.fromPrevious as boolean | undefined,
        };
    });
}

const TYRE_POS_ALIASES: Record<string, (typeof TYRE_POSITIONS)[number]> = {
    'Front Left': 'front-left',
    'Front Right': 'front-right',
    'Rear Left': 'rear-left',
    'Rear Right': 'rear-right',
    Spare: 'spare',
};

function normalizeTyreApiPosition(raw: string | undefined): (typeof TYRE_POSITIONS)[number] | undefined {
    if (!raw) return undefined;
    if ((TYRE_POSITIONS as readonly string[]).includes(raw)) return raw as (typeof TYRE_POSITIONS)[number];
    return TYRE_POS_ALIASES[raw];
}

function normalizeTyresFromApi(raw: unknown): { position: typeof TYRE_POSITIONS[number]; treadDepth: string; condition: string; psi: string; photo: string }[] {
    const list = Array.isArray(raw) ? raw as { position?: string; treadDepth?: string; condition?: string; psi?: string; photo?: string }[] : [];
    return TYRE_POSITIONS.map(pos => {
        const found = list.find(t => normalizeTyreApiPosition(t.position) === pos);
        return {
            position: pos,
            treadDepth: found?.treadDepth != null ? String(found.treadDepth) : '',
            condition: found?.condition != null ? String(found.condition) : '',
            psi: found?.psi != null ? String(found.psi) : '',
            photo: found?.photo != null ? String(found.photo) : '',
        };
    });
}

function emptyWalkaround(): Record<string, string> {
    return {
        front: '', offside: '', rear: '', nearside: '',
        nsFrontWheel: '', nsRearWheel: '', osFrontWheel: '', osRearWheel: '', video: '',
        frontDesc: '', offsideDesc: '', rearDesc: '', nearsideDesc: '',
        nsFrontWheelDesc: '', nsRearWheelDesc: '', osFrontWheelDesc: '', osRearWheelDesc: '', videoDesc: '',
    };
}

const sectionLabel = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1';
const inputCls = 'w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-blue-100';
const selectCls = inputCls;
const checkRow = 'flex items-center justify-between py-2.5 border-b border-[#E2E8F0] last:border-0';
const checkLabel = 'text-[13px] text-slate-700';

const mechSelectStyle: React.CSSProperties = {
    flex: 1, padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '10px',
    fontSize: '13px', color: '#334155', outline: 'none', background: '#fff', width: '100%',
};

function MechCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
    return (
        <div style={{ background: '#F8FAFC', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '18px' }}>{icon}</span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{title}</span>
            </div>
            {children}
        </div>
    );
}

function BoolCheck({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className={checkRow}>
            <span className={checkLabel}>{label}</span>
            <div className="flex gap-2">
                {[true, false].map(v => (
                    <button key={String(v)} onClick={() => onChange(v)}
                        className={`px-3 py-1 rounded text-[12px] font-semibold border transition-colors ${value === v ? (v ? 'bg-green-600 border-green-600 text-white' : 'bg-red-500 border-red-500 text-white') : 'bg-white border-[#E2E8F0] text-slate-500 hover:border-slate-300'}`}>
                        {v ? 'Pass' : 'Fail'}
                    </button>
                ))}
            </div>
        </div>
    );
}

function OptionBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${active ? 'bg-[#4D7CFF] border-[#4D7CFF] text-white' : 'bg-white border-[#E2E8F0] text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
            {label}
        </button>
    );
}

function ConditionReportHelpIcon() {
    return (
        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
        </svg>
    );
}

function ConditionReportHelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 bg-[#4D7CFF] text-white shrink-0">
                    <div className="flex items-center gap-2">
                        <ConditionReportHelpIcon />
                        <div>
                            <div className="text-[14px] font-bold">Condition Reports — Help</div>
                            <div className="text-[11px] font-medium text-white/80">How to use this section</div>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors text-white text-[12px]" aria-label="Close help">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-700">
                    <div>
                        <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">What this is for</h2>
                        <p className="text-[12px] leading-relaxed text-slate-600">
                            <strong>Condition reports</strong> record the state of a vehicle at a specific moment—for appraisals, PDIs, collections, test drives, or handovers. You build a structured inspection, mark exterior and interior faults on diagrams, capture walk-around photos, note mechanical checks, and get an automatic <strong>NAMA-style grade</strong> (1–5 or U) from the faults you log. Reports are saved on this vehicle so you can open, edit, print, or export them later.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">Report list</h2>
                        <ul className="space-y-2 text-[12px] text-slate-600">
                            <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span>Each row is one report. The <strong>coloured circle</strong> is the overall grade when the report has been completed with enough data.</span></li>
                            <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Completed</strong> vs <strong>Draft</strong> shows whether the report was finished or saved part-way.</span></li>
                            <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span>The line under the title shows <strong>staff</strong>, <strong>date</strong>, and how many <strong>exterior / interior</strong> faults are recorded.</span></li>
                            <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Click anywhere</strong> on a row (except action buttons) to open the full report view.</span></li>
                            <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>View</strong> opens the same detail screen. <strong>Edit</strong> loads the wizard with saved answers. <strong>PDF</strong> downloads a formatted report. <strong>Delete</strong> removes the report permanently.</span></li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">Starting a new report</h2>
                        <p className="text-[12px] leading-relaxed text-slate-600 mb-2">Click <strong>New Report</strong> and work through the steps. Use <strong>Save Draft</strong> at any time to keep progress without marking the report complete. Finish on the last step to save as completed (you can still edit later).</p>
                        <ul className="space-y-2 text-[12px] text-slate-600">
                            <li className="flex gap-2"><span className="text-green-600 font-bold">1</span><span><strong>Setup</strong> — Report type (Initial, Appraisal, PDI, etc.), staff name (often filled from your login), <strong>postcode lookup</strong> to help fill location, free-text <strong>location</strong>, and current <strong>mileage</strong>.</span></li>
                            <li className="flex gap-2"><span className="text-green-600 font-bold">2</span><span><strong>Walk-around</strong> — Optional photos (front, sides, rear, each wheel) and a walk-around <strong>video</strong>. These appear on the report view and can be opened in a new tab.</span></li>
                            <li className="flex gap-2"><span className="text-green-600 font-bold">3</span><span><strong>Exterior</strong> — Tap the vehicle diagram to choose a panel/part, then condition and severity. Add an optional <strong>photo per fault</strong>; a numbered pin appears on the diagram.</span></li>
                            <li className="flex gap-2"><span className="text-green-600 font-bold">4</span><span><strong>Interior</strong> — Same idea for the interior diagram (trim, seats, boot, etc.).</span></li>
                            <li className="flex gap-2"><span className="text-green-600 font-bold">5</span><span><strong>Mechanical</strong> — Use the tyre diagram for tread/condition. Open the <strong>bonnet</strong> area for oils, coolant, brakes, warnings, battery, and exhaust—same style as a full appraisal flow.</span></li>
                            <li className="flex gap-2"><span className="text-green-600 font-bold">6</span><span><strong>Service / history</strong> — Pop-up cards for details and service/MOT. <strong>Inventory</strong> is grouped into <strong>Cabin</strong>, <strong>Boot</strong>, and <strong>Exterior</strong> with checkboxes, plus <strong>Select All / None</strong> per group.</span></li>
                            <li className="flex gap-2"><span className="text-green-600 font-bold">7</span><span><strong>Summary</strong> — Review notes; the <strong>grade updates automatically</strong> from exterior and interior faults. Save as draft or complete.</span></li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">Reading a saved report</h2>
                        <ul className="space-y-2 text-[12px] text-slate-600">
                            <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span>The top <strong>summary</strong> shows report type, who carried it out, location, and mileage.</span></li>
                            <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Print Report</strong> uses your browser print dialog. <strong>Edit Report</strong> returns you to the wizard with all answers loaded.</span></li>
                            <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Walk-Around</strong> shows uploaded photos/video; click a thumbnail to view full size in a new tab.</span></li>
                            <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Exterior Inspection</strong> and <strong>Interior Inspection</strong> show the diagrams with numbered pins and, under each fault, any <strong>photos</strong> you attached.</span></li>
                            <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Inventory</strong> (under interior) shows the full Cabin, Boot, and Exterior lists with a tick for each item that is present.</span></li>
                        </ul>
                    </div>

                    <div>
                        <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">PDF export</h2>
                        <p className="text-[12px] leading-relaxed text-slate-600">From the list or detail view, use the PDF action to download a printable report that includes vehicle details, diagrams, fault lists, walk-around and fault photos where available, tyres, mechanical checks, and history sections—aligned with a professional appraisal-style layout.</p>
                    </div>

                    <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                        <div className="text-[12px] font-bold text-amber-800 mb-1">Tips</div>
                        <ul className="space-y-1.5 text-[11px] text-amber-900 leading-relaxed">
                            <li>• Accurate fault tagging improves the <strong>auto grade</strong> and the PDF.</li>
                            <li>• <strong>Photos</strong> on faults help buyers, workshops, and your records.</li>
                            <li>• Long <strong>data-URL</strong> images open reliably via the app&apos;s “open in new tab” action (blob URL), so use that for full-screen viewing.</li>
                        </ul>
                    </div>
                </div>

                <div className="shrink-0 p-4 border-t border-slate-100 bg-slate-50">
                    <button type="button" onClick={onClose} className="w-full py-2.5 rounded-lg bg-[#4D7CFF] text-white text-[13px] font-bold hover:bg-[#3d6ce0] transition-colors">
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ConditionReportTab({ vehicleId, vehicleMileage, vehicleMake, vehicleModel, vehicleVRM, vehicleMotExpiry, vehicleColour, vehicleFuelType, vehicleTransmission, vehicleEngineSize, vehicleYear, vehicleBodyType, vehicleDoors, vehicleSeats }: ConditionReportTabProps) {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'create' | 'view'>('list');
    const [currentReport, setCurrentReport] = useState<Partial<Report> | null>(null);
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [saving, setSaving] = useState(false);
    const [postcode, setPostcode] = useState('');
    const [postcodeLoading, setPostcodeLoading] = useState(false);
    const [postcodeResult, setPostcodeResult] = useState<{ display: string; postcode: string } | null>(null);
    const [postcodeError, setPostcodeError] = useState('');
    const [showMechanical, setShowMechanical] = useState(false);
    const [showDetailsPopup, setShowDetailsPopup] = useState(false);
    const [showServicePopup, setShowServicePopup] = useState(false);
    const [showConditionHelp, setShowConditionHelp] = useState(false);

    const [form, setForm] = useState({
        reportType: 'Initial',
        staffMember: '',
        location: '',
        mileage: vehicleMileage?.toString() ?? '',
        walkaround: emptyWalkaround(),
        exteriorFaults: [] as FaultPoint[],
        interiorFaults: [] as FaultPoint[],
        lightsCheck: undefined as boolean | undefined,
        mirrorsCheck: undefined as boolean | undefined,
        wipersCheck: undefined as boolean | undefined,
        engineStartSmooth: undefined as boolean | undefined,
        steeringAlignment: undefined as boolean | undefined,
        brakePerformance: undefined as boolean | undefined,
        gearShiftQuality: undefined as boolean | undefined,
        testDriveNotes: '',
        oilLeakage: '',
        oilColor: '',
        oilLevel: 50,
        coolantLevel: '',
        coolantColor: '',
        coolantLevelPercent: 75,
        brakeFluidLevel: '',
        warningLights: '',
        batteryCondition: '',
        exhaustCondition: '',
        mechanicalNotes: '',
        tyres: TYRE_POSITIONS.map(pos => ({ position: pos, treadDepth: '', condition: '', psi: '', photo: '' })),
        hasV5Document: '',
        mileageModifications: '',
        firstRegisteredUK: '',
        numberOfOwners: '',
        numberOfKeys: '',
        insuranceWriteOff: '',
        insuranceWriteOffType: '',
        serviceHistoryType: '',
        serviceHistoryCount: '',
        mainDealer: '',
        vehicleUsageHistory: '',
        motExpiryDate: vehicleMotExpiry ? vehicleMotExpiry.split('T')[0] : '',
        inventory: emptyInventoryRecord(),
        overallGrade: '',
        additionalNotes: '',
    });

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/condition-reports`);
            const data = await res.json();
            if (data.ok) setReports(data.reports);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [vehicleId]);

    useEffect(() => {
        fetchReports();
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(data => {
                if (data.ok && data.session?.name) {
                    setForm(f => ({ ...f, staffMember: data.session.name }));
                }
            })
            .catch(() => {});
    }, [fetchReports]);

    // Auto-calculate NAMA grade whenever faults change
    useEffect(() => {
        const grade = namaGradeFromFaults(form.exteriorFaults, form.interiorFaults);
        setForm(f => ({ ...f, overallGrade: grade }));
    }, [form.exteriorFaults, form.interiorFaults]);

    const setF = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }));

    const addExteriorFault = (fault: Partial<FaultPoint>) => {
        setForm(f => {
            const faults = [...f.exteriorFaults];
            faults.push({
                idx: faults.length + 1,
                part: fault.part ?? '',
                damage: fault.damage ?? '',
                detail: fault.detail ?? '',
                note: fault.note ?? '',
                coords: fault.coords ?? { x: 0, y: 0 },
                photoUrl: fault.photoUrl,
                sectionId: fault.sectionId,
                fromPrevious: fault.fromPrevious,
            });
            return { ...f, exteriorFaults: faults };
        });
    };

    const removeExteriorFault = (index: number) => setForm(f => ({ ...f, exteriorFaults: f.exteriorFaults.filter((_, i) => i !== index) }));
    const updateExteriorCoords = (index: number, coords: { x: number; y: number }) => setForm(f => { const faults = [...f.exteriorFaults]; faults[index] = { ...faults[index], coords }; return { ...f, exteriorFaults: faults }; });

    const addInteriorFault = (fault: Partial<FaultPoint>) => {
        setForm(f => {
            const faults = [...f.interiorFaults];
            faults.push({
                idx: faults.length + 1,
                part: fault.part ?? '',
                damage: fault.damage ?? '',
                detail: fault.detail ?? '',
                note: fault.note ?? '',
                coords: fault.coords ?? { x: 0, y: 0 },
                photoUrl: fault.photoUrl,
                sectionId: fault.sectionId,
                fromPrevious: fault.fromPrevious,
            });
            return { ...f, interiorFaults: faults };
        });
    };

    const removeInteriorFault = (index: number) => setForm(f => ({ ...f, interiorFaults: f.interiorFaults.filter((_, i) => i !== index) }));
    const updateInteriorCoords = (index: number, coords: { x: number; y: number }) => setForm(f => { const faults = [...f.interiorFaults]; faults[index] = { ...faults[index], coords }; return { ...f, interiorFaults: faults }; });

    const lookupPostcode = async () => {
        const pc = postcode.trim().replace(/\s+/g, '').toUpperCase();
        if (!pc) return;
        setPostcodeLoading(true);
        setPostcodeError('');
        setPostcodeResult(null);
        try {
            const res = await fetch(`https://api.postcodes.io/postcodes/${pc}`);
            const data = await res.json();
            if (data.status === 200 && data.result) {
                const r = data.result;
                const parts = [r.parish !== r.admin_district ? r.parish : null, r.admin_district, r.region].filter(Boolean);
                const display = `${r.postcode}, ${parts.join(', ')}`;
                setPostcodeResult({ display, postcode: r.postcode });
            } else {
                setPostcodeError('Postcode not found. Please check and try again.');
            }
        } catch {
            setPostcodeError('Could not reach postcode service. Check your connection.');
        } finally {
            setPostcodeLoading(false);
        }
    };

    const saveReport = async (status: 'draft' | 'completed') => {
        setSaving(true);
        try {
            const payload = {
                reportType: form.reportType,
                staffMember: form.staffMember,
                location: form.location,
                mileage: form.mileage,
                walkaround: form.walkaround,
                faults: { exterior: form.exteriorFaults, interior: form.interiorFaults },
                tyres: form.tyres,
                lightsCheck: form.lightsCheck,
                mirrorsCheck: form.mirrorsCheck,
                wipersCheck: form.wipersCheck,
                engineStartSmooth: form.engineStartSmooth,
                steeringAlignment: form.steeringAlignment,
                brakePerformance: form.brakePerformance,
                gearShiftQuality: form.gearShiftQuality,
                testDriveNotes: form.testDriveNotes,
                oilLeakage: form.oilLeakage,
                oilColor: form.oilColor,
                oilLevel: form.oilLevel,
                coolantLevel: form.coolantLevel,
                coolantColor: form.coolantColor,
                coolantLevelPercent: form.coolantLevelPercent,
                brakeFluidLevel: form.brakeFluidLevel,
                warningLights: form.warningLights,
                batteryCondition: form.batteryCondition,
                exhaustCondition: form.exhaustCondition,
                mechanicalNotes: form.mechanicalNotes,
                hasV5Document: form.hasV5Document,
                mileageModifications: form.mileageModifications,
                firstRegisteredUK: form.firstRegisteredUK,
                numberOfOwners: form.numberOfOwners,
                numberOfKeys: form.numberOfKeys,
                insuranceWriteOff: form.insuranceWriteOff,
                insuranceWriteOffType: form.insuranceWriteOffType,
                serviceHistoryType: form.serviceHistoryType,
                serviceHistoryCount: form.serviceHistoryCount,
                mainDealer: form.mainDealer,
                vehicleUsageHistory: form.vehicleUsageHistory,
                motExpiryDate: form.motExpiryDate,
                inventory: form.inventory,
                overallGrade: form.overallGrade,
                additionalNotes: form.additionalNotes,
                status,
            };

            const isEdit = !!currentReport?._id;
            const url = isEdit ? `/api/vehicles/${vehicleId}/condition-reports/${currentReport!._id}` : `/api/vehicles/${vehicleId}/condition-reports`;
            const method = isEdit ? 'PATCH' : 'POST';

            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);

            if (status === 'completed') {
                toast.success(isEdit ? 'Report updated' : 'Report completed!');
            } else {
                toast.success(isEdit ? 'Draft updated' : 'Draft saved');
            }
            if (data.report) setCurrentReport(data.report);
            await fetchReports();
            if (status === 'completed') setView('list');
        } catch (e: any) {
            toast.error(e.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const deleteReport = async (reportId: string) => {
        if (!confirm('Are you sure you want to delete this report? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/vehicles/${vehicleId}/condition-reports/${reportId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success('Report deleted');
            setView('list');
            setCurrentReport(null);
            await fetchReports();
        } catch (e: any) {
            toast.error(e.message || 'Failed to delete');
        }
    };

    const downloadPDF = async (r: Partial<Report>) => {
        try {
            const pdfData: ConditionReportPDFData = {
                reportType: r.reportType,
                staffMember: r.staffMember,
                location: (r as any).location,
                mileage: (r as any).mileage,
                createdAt: r.createdAt,
                status: r.status,
                overallGrade: r.overallGrade,
                vehicleVRM,
                vehicleMake,
                vehicleModel,
                vehicleColour,
                vehicleFuelType,
                vehicleTransmission,
                vehicleEngineSize,
                vehicleYear: vehicleYear ? String(vehicleYear) : undefined,
                vehicleBodyType,
                vehicleDoors,
                vehicleSeats,
                faults: r.faults as any,
                tyres: (r as any).tyres,
                oilLeakage: (r as any).oilLeakage,
                oilColor: (r as any).oilColor,
                oilLevel: (r as any).oilLevel,
                coolantLevel: (r as any).coolantLevel,
                coolantColor: (r as any).coolantColor,
                coolantLevelPercent: (r as any).coolantLevelPercent,
                brakeFluidLevel: (r as any).brakeFluidLevel,
                warningLights: (r as any).warningLights,
                batteryCondition: (r as any).batteryCondition,
                exhaustCondition: (r as any).exhaustCondition,
                mechanicalNotes: (r as any).mechanicalNotes,
                lightsCheck: (r as any).lightsCheck,
                mirrorsCheck: (r as any).mirrorsCheck,
                wipersCheck: (r as any).wipersCheck,
                engineStartSmooth: (r as any).engineStartSmooth,
                steeringAlignment: (r as any).steeringAlignment,
                brakePerformance: (r as any).brakePerformance,
                gearShiftQuality: (r as any).gearShiftQuality,
                vehicleMileage: (r as any).vehicleMileage,
                mileageModifications: (r as any).mileageModifications,
                hasV5Document: (r as any).hasV5Document,
                numberOfOwners: (r as any).numberOfOwners,
                numberOfKeys: (r as any).numberOfKeys,
                firstRegisteredUK: (r as any).firstRegisteredUK,
                insuranceWriteOff: (r as any).insuranceWriteOff,
                insuranceWriteOffType: (r as any).insuranceWriteOffType,
                serviceHistoryType: (r as any).serviceHistoryType,
                serviceHistoryCount: (r as any).serviceHistoryCount,
                mainDealer: (r as any).mainDealer,
                vehicleUsageHistory: (r as any).vehicleUsageHistory,
                motExpiryDate: (r as any).motExpiryDate,
                additionalNotes: (r as any).additionalNotes,
            };
            await generateConditionReportPDF(pdfData);
            toast.success('PDF downloaded successfully');
        } catch (e: any) {
            toast.error('Failed to generate PDF');
            console.error(e);
        }
    };

    const startNewReport = () => {
        setForm(prev => ({
            reportType: 'Initial',
            staffMember: prev.staffMember,
            location: '',
            mileage: vehicleMileage?.toString() ?? '',
            walkaround: emptyWalkaround(),
            exteriorFaults: [], interiorFaults: [],
            lightsCheck: undefined, mirrorsCheck: undefined, wipersCheck: undefined,
            engineStartSmooth: undefined, steeringAlignment: undefined, brakePerformance: undefined, gearShiftQuality: undefined,
            testDriveNotes: '', oilLeakage: '', oilColor: '', oilLevel: 50, coolantLevel: '', coolantColor: '', coolantLevelPercent: 75, brakeFluidLevel: '',
            warningLights: '', batteryCondition: '', exhaustCondition: '', mechanicalNotes: '',
            tyres: TYRE_POSITIONS.map(pos => ({ position: pos, treadDepth: '', condition: '', psi: '', photo: '' })),
            hasV5Document: '', mileageModifications: '', firstRegisteredUK: '',
            numberOfOwners: '', numberOfKeys: '', insuranceWriteOff: '', insuranceWriteOffType: '',
            serviceHistoryType: '', serviceHistoryCount: '', mainDealer: '', vehicleUsageHistory: '',
            motExpiryDate: vehicleMotExpiry ? vehicleMotExpiry.split('T')[0] : '', inventory: emptyInventoryRecord(), overallGrade: '', additionalNotes: '',
        }));
        setCurrentReport(null);
        setCurrentStep(1);
        setView('create');
    };

    /** Load an existing report (draft or completed) into the wizard — same idea as appraisal website re-open / edit. */
    const openReportForEdit = (r: any) => {
        setCurrentReport(r);
        setPostcode('');
        setPostcodeResult(null);
        setPostcodeError('');
        setShowMechanical(false);
        setShowDetailsPopup(false);
        setShowServicePopup(false);
        setForm({
            reportType: r.reportType ?? 'Initial',
            staffMember: r.staffMember ?? '',
            location: r.location ?? '',
            mileage: r.mileage != null && r.mileage !== '' ? String(r.mileage) : (vehicleMileage?.toString() ?? ''),
            walkaround: { ...emptyWalkaround(), ...(r.walkaround ?? {}) },
            exteriorFaults: normalizeFaultsFromApi(r.faults?.exterior),
            interiorFaults: normalizeFaultsFromApi(r.faults?.interior),
            lightsCheck: r.lightsCheck,
            mirrorsCheck: r.mirrorsCheck,
            wipersCheck: r.wipersCheck,
            engineStartSmooth: r.engineStartSmooth,
            steeringAlignment: r.steeringAlignment,
            brakePerformance: r.brakePerformance,
            gearShiftQuality: r.gearShiftQuality,
            testDriveNotes: r.testDriveNotes ?? '',
            oilLeakage: r.oilLeakage ?? '',
            oilColor: r.oilColor ?? '',
            oilLevel: typeof r.oilLevel === 'number' ? r.oilLevel : (r.oilLevel != null ? Number(r.oilLevel) : 50),
            coolantLevel: r.coolantLevel ?? '',
            coolantColor: r.coolantColor ?? '',
            coolantLevelPercent: typeof r.coolantLevelPercent === 'number' ? r.coolantLevelPercent : (r.coolantLevelPercent != null ? Number(r.coolantLevelPercent) : 75),
            brakeFluidLevel: r.brakeFluidLevel ?? '',
            warningLights: r.warningLights ?? '',
            batteryCondition: r.batteryCondition ?? '',
            exhaustCondition: r.exhaustCondition ?? '',
            mechanicalNotes: r.mechanicalNotes ?? '',
            tyres: normalizeTyresFromApi(r.tyres),
            hasV5Document: r.hasV5Document ?? '',
            mileageModifications: r.mileageModifications ?? '',
            firstRegisteredUK: r.firstRegisteredUK ?? '',
            numberOfOwners: r.numberOfOwners ?? '',
            numberOfKeys: r.numberOfKeys ?? '',
            insuranceWriteOff: r.insuranceWriteOff ?? '',
            insuranceWriteOffType: r.insuranceWriteOffType ?? '',
            serviceHistoryType: r.serviceHistoryType ?? '',
            serviceHistoryCount: r.serviceHistoryCount ?? '',
            mainDealer: r.mainDealer ?? '',
            vehicleUsageHistory: r.vehicleUsageHistory ?? '',
            motExpiryDate: r.motExpiryDate ?? (vehicleMotExpiry ? vehicleMotExpiry.split('T')[0] : ''),
            inventory: normalizeInventory(r.inventory),
            overallGrade: r.overallGrade ?? '',
            additionalNotes: r.additionalNotes ?? '',
        });
        setCurrentStep(1);
        setView('create');
    };

    const STEPS = [
        { n: 1, label: 'Setup' },
        { n: 2, label: 'Walk-Around' },
        { n: 3, label: 'Exterior' },
        { n: 4, label: 'Interior' },
        { n: 5, label: 'Mechanical' },
        { n: 6, label: 'Service' },
        { n: 7, label: 'Summary' },
    ];

    // ── LIST VIEW ──────────────────────────────────────────────────────────────
    if (view === 'list') {
        return (
            <>
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-6">
                <div className="flex items-center justify-between mb-5 border-b border-slate-50 pb-4">
                    <div>
                        <h2 className="text-[15px] font-semibold text-slate-800 tracking-tight">Condition Reports</h2>
                        <p className="text-[12px] text-slate-400 mt-0.5">{vehicleVRM} · {vehicleMake} {vehicleModel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowConditionHelp(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors bg-white shadow-sm"
                        >
                            <ConditionReportHelpIcon />
                            Help
                        </button>
                        <button onClick={startNewReport} className="flex items-center gap-2 bg-[#4D7CFF] hover:bg-[#3d6ce0] text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            New Report
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin" /></div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        </div>
                        <p className="text-slate-600 text-[14px] font-medium mb-1">No reports yet</p>
                        <p className="text-slate-400 text-[12px]">Create the first condition report for this vehicle</p>
                        <button onClick={startNewReport} className="mt-4 bg-[#4D7CFF] hover:bg-[#3d6ce0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg transition-colors">Create First Report</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {reports.map(r => (
                            <div
                                key={r._id}
                                role="button"
                                tabIndex={0}
                                onClick={() => { setCurrentReport(r); setView('view'); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setCurrentReport(r);
                                        setView('view');
                                    }
                                }}
                                className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-between hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                                <div className="flex items-center gap-4">
                                    {r.overallGrade && (
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[18px] font-bold text-white shrink-0" style={{ background: GRADE_COLORS[r.overallGrade] ?? '#64748b' }}>
                                            {r.overallGrade}
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] font-semibold text-slate-800">{r.reportType}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {r.status === 'completed' ? 'Completed' : 'Draft'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {r.staffMember && <span>{r.staffMember} · </span>}
                                            {new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {r.faults?.exterior?.length ?? 0} exterior · {r.faults?.interior?.length ?? 0} interior faults
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setCurrentReport(r); setView('view'); }}
                                        className="text-[12px] text-[#4D7CFF] hover:text-[#3d6ce0] font-semibold"
                                    >
                                        View →
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); openReportForEdit(r); }}
                                        className="text-[12px] text-slate-600 hover:text-[#4D7CFF] font-semibold px-2 py-1 rounded-lg hover:bg-slate-50 border border-transparent hover:border-[#E2E8F0]"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); downloadPDF(r); }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#4D7CFF] hover:bg-blue-50 transition-colors"
                                        title="Download PDF"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); deleteReport(r._id); }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Delete report"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <ConditionReportHelpDrawer open={showConditionHelp} onClose={() => setShowConditionHelp(false)} />
            </>
        );
    }

    // ── VIEW REPORT ────────────────────────────────────────────────────────────
    if (view === 'view' && currentReport) {
        const r = currentReport as Report;
        const created = r.createdAt ? new Date(r.createdAt) : null;
        const viewLocation = ((r as any).location ?? '').trim() || 'Unknown';
        const viewMileage = ((r as any).mileage ?? r.mileage ?? '').toString().trim();

        return (
            <>
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5 border-b border-slate-50 pb-4">
                    <button type="button" onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h3 className="text-[15px] font-semibold text-slate-800">
                            Condition Report: {created ? created.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                            {created ? ` ${created.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </h3>
                        <p className="text-[12px] text-slate-400">{vehicleVRM ? vehicleVRM : ''}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                        <button
                            type="button"
                            onClick={() => setShowConditionHelp(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors bg-white shadow-sm"
                        >
                            <ConditionReportHelpIcon />
                            Help
                        </button>
                        {r.overallGrade && <div className="w-10 h-10 rounded-full flex items-center justify-center text-[18px] font-bold text-white" style={{ background: GRADE_COLORS[r.overallGrade] ?? '#64748b' }}>{r.overallGrade}</div>}
                    </div>
                </div>

                {/* MotorDesk-style summary block */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 p-5">
                        <div>
                            <p className={sectionLabel}>Report Type</p>
                            <p className="text-[13px] font-semibold text-slate-800">{r.reportType || 'Initial'}</p>
                        </div>
                        <div>
                            <p className={sectionLabel}>Report By</p>
                            <p className="text-[13px] font-semibold text-slate-800">{r.staffMember || '—'}</p>
                        </div>
                        <div>
                            <p className={sectionLabel}>Report Location</p>
                            <p className="text-[13px] font-semibold text-slate-800">{viewLocation}</p>
                        </div>
                        <div>
                            <p className={sectionLabel}>Vehicle Mileage</p>
                            <p className="text-[13px] font-semibold text-slate-800">{viewMileage || '—'}</p>
                        </div>
                    </div>
                    <div className="px-5 pb-5">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => downloadPDF(r)}
                                className="bg-[#4D7CFF] hover:bg-[#3d6ce0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg transition-colors"
                            >
                                Print Report
                            </button>
                            <button
                                type="button"
                                onClick={() => openReportForEdit(r)}
                                className="bg-[#4D7CFF] hover:bg-[#3d6ce0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg transition-colors"
                            >
                                Edit Report
                            </button>
                        </div>
                    </div>
                </div>

                {/* Walk-Around Uploads (show what was uploaded in Step 2) */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl mt-5 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                        <p className="text-[13px] font-semibold text-slate-800">Walk-Around</p>
                    </div>
                    <div className="px-5 py-4">
                        {(() => {
                            const wa = ((r as any).walkaround ?? {}) as Record<string, string>;
                            const items: { key: string; label: string; kind: 'image' | 'video' }[] = [
                                { key: 'front', label: 'Photo of Front', kind: 'image' },
                                { key: 'offside', label: 'Photo of Offside', kind: 'image' },
                                { key: 'rear', label: 'Photo of Rear', kind: 'image' },
                                { key: 'nearside', label: 'Photo of Nearside', kind: 'image' },
                                { key: 'nsFrontWheel', label: 'Photo of N/S Front Wheel', kind: 'image' },
                                { key: 'nsRearWheel', label: 'Photo of N/S Rear Wheel', kind: 'image' },
                                { key: 'osRearWheel', label: 'Photo of O/S Rear Wheel', kind: 'image' },
                                { key: 'osFrontWheel', label: 'Photo of O/S Front Wheel', kind: 'image' },
                                { key: 'video', label: 'Video of Walkaround', kind: 'video' },
                            ];

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                                    {items.map((it) => {
                                        const val = (wa[it.key] ?? '').toString().trim();
                                        const descKey = `${it.key}Desc`;
                                        const desc = (wa[descKey] ?? '').toString().trim();
                                        return (
                                            <div key={it.key}>
                                                <p className={sectionLabel}>{it.label}</p>
                                                {!val ? (
                                                    <p className="text-[12px] text-slate-400 italic">No upload.</p>
                                                ) : it.kind === 'video' ? (
                                                    <div className="mt-2 w-full max-w-[360px] space-y-1">
                                                        <video src={val} controls className="h-24 w-full rounded-lg border border-[#E2E8F0] bg-black" />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openMediaInNewTab(val);
                                                            }}
                                                            className="text-[12px] font-semibold text-[#4D7CFF] hover:underline"
                                                        >
                                                            Open in new tab
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        className="block mt-2 w-full max-w-[360px] cursor-zoom-in rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D7CFF]"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openMediaInNewTab(val);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                openMediaInNewTab(val);
                                                            }
                                                        }}
                                                    >
                                                        <img src={val} alt="" className="h-24 w-full rounded-lg border border-[#E2E8F0] object-cover pointer-events-none" />
                                                    </div>
                                                )}
                                                {desc ? (
                                                    <p className="text-[12px] text-slate-600 mt-2 leading-snug whitespace-pre-wrap border-l-2 border-slate-200 pl-3">{desc}</p>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                <ExteriorInspectionReadonly faults={normalizeFaultsFromApi(r.faults?.exterior)} />

                <InteriorInspectionReadonly faults={normalizeFaultsFromApi(r.faults?.interior)} />

                <MotorDeskInventoryReadonly value={normalizeInventory((r as { inventory?: Record<string, boolean> }).inventory)} />

                <TyresInspectionReadonly tyres={normalizeTyresFromApi((r as { tyres?: unknown }).tyres)} />
            </div>
            <ConditionReportHelpDrawer open={showConditionHelp} onClose={() => setShowConditionHelp(false)} />
            </>
        );
    }

    // ── CREATE / EDIT FORM ─────────────────────────────────────────────────────
    return (
        <>
        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm flex flex-col">
            {/* Step bar */}
            <div className="flex items-center gap-0 border-b border-[#E2E8F0] px-4 pt-4 pb-0 shrink-0 overflow-x-auto">
                {STEPS.map((s) => (
                    <button key={s.n} onClick={() => setCurrentStep(s.n as Step)}
                        className={`flex items-center gap-1.5 px-3 pb-3 border-b-2 text-[12px] font-medium transition-colors whitespace-nowrap ${currentStep === s.n ? 'border-[#4D7CFF] text-[#4D7CFF]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStep === s.n ? 'bg-[#4D7CFF] text-white' : currentStep > s.n ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{currentStep > s.n ? '✓' : s.n}</span>
                        {s.label}
                    </button>
                ))}
                <div className="ml-auto flex items-center gap-2 pb-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => setShowConditionHelp(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors bg-white shadow-sm"
                    >
                        <ConditionReportHelpIcon />
                        Help
                    </button>
                    {currentReport?._id && (
                        <span className="hidden sm:inline text-[11px] text-slate-400 max-w-[140px] truncate" title={currentReport.status === 'completed' ? 'This report was completed; you can change it and save again.' : ''}>
                            {currentReport.status === 'completed' ? 'Editing completed report' : 'Editing draft'}
                        </span>
                    )}
                    <button type="button" onClick={() => { setCurrentReport(null); setView('list'); }} className="text-[12px] text-slate-400 hover:text-slate-600 px-2">Cancel</button>
                    <button type="button" onClick={() => saveReport('draft')} disabled={saving} className="text-[12px] border border-[#E2E8F0] text-slate-600 hover:border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors">Save Draft</button>
                    {currentReport?._id ? (
                        <button
                            type="button"
                            onClick={() => saveReport('completed')}
                            disabled={saving}
                            className="text-[12px] bg-[#4D7CFF] hover:bg-[#3d6ce0] disabled:opacity-60 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Save
                        </button>
                    ) : null}
                </div>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto p-6">

                {/* STEP 1 - Setup */}
                {currentStep === 1 && (
                    <div className="max-w-lg space-y-5">
                        <h3 className="text-[15px] font-semibold text-slate-800">Report Setup</h3>
                        <div>
                            <p className={sectionLabel}>Report Type</p>
                            <select className={selectCls} value={form.reportType} onChange={e => setF('reportType', e.target.value)}>
                                {['Initial', 'Appraisal', 'PDI', 'Drop-Off', 'Collection', 'Test Drive', 'Pre-Delivery', 'Delivery', 'Return', 'Service Check', 'Other'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <p className={sectionLabel}>Staff Member</p>
                            <input className={inputCls} placeholder="Name of inspector" value={form.staffMember} onChange={e => setF('staffMember', e.target.value)} />
                        </div>
                        <div>
                            <p className={sectionLabel}>Postcode Lookup</p>
                            <div className="flex gap-2">
                                <input
                                    className={inputCls}
                                    placeholder="e.g. SW1A 1AA"
                                    value={postcode}
                                    onChange={e => { setPostcode(e.target.value); setPostcodeError(''); setPostcodeResult(null); }}
                                    onKeyDown={e => e.key === 'Enter' && lookupPostcode()}
                                    maxLength={8}
                                />
                                <button
                                    onClick={lookupPostcode}
                                    disabled={postcodeLoading || !postcode.trim()}
                                    className="shrink-0 px-4 py-2 bg-[#4D7CFF] hover:bg-[#3d6ce0] disabled:opacity-50 text-white text-[12px] font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                                    {postcodeLoading
                                        ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
                                    }
                                    Search
                                </button>
                            </div>
                            {postcodeError && (
                                <p className="text-[11px] text-red-500 mt-1.5">{postcodeError}</p>
                            )}
                            {postcodeResult && (
                                <div className="mt-2 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <span className="text-[12px] text-blue-800 font-medium">{postcodeResult.display}</span>
                                    </div>
                                    <button
                                        onClick={() => { setF('location', postcodeResult.display); setPostcodeResult(null); setPostcode(''); }}
                                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors shrink-0 ml-2">
                                        Use →
                                    </button>
                                </div>
                            )}
                        </div>
                        <div>
                            <p className={sectionLabel}>Location</p>
                            <input className={inputCls} placeholder="e.g. Workshop, Forecourt, or paste postcode result" value={form.location} onChange={e => setF('location', e.target.value)} />
                        </div>
                        <div>
                            <p className={sectionLabel}>Current Mileage</p>
                            <input className={inputCls} type="number" placeholder="Miles" value={form.mileage} onChange={e => setF('mileage', e.target.value)} />
                        </div>
                    </div>
                )}

                {/* STEP 2 - Walk-Around (photos/videos) */}
                {currentStep === 2 && (
                    <div className="space-y-5">
                        <div>
                            <h3 className="text-[15px] font-semibold text-slate-800">Inspection</h3>
                            <p className="text-[12px] text-slate-500 mt-1">Walk-Around</p>
                            <div className="h-0.5 bg-[#4D7CFF] w-24 mt-2 rounded-full" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {([
                                { key: 'front', label: 'Photo of Front', accept: 'image/*' },
                                { key: 'offside', label: 'Photo of Offside', accept: 'image/*' },
                                { key: 'rear', label: 'Photo of Rear', accept: 'image/*' },
                                { key: 'nearside', label: 'Photo of Nearside', accept: 'image/*' },
                                { key: 'nsFrontWheel', label: 'Photo of N/S Front Wheel', accept: 'image/*' },
                                { key: 'nsRearWheel', label: 'Photo of N/S Rear Wheel', accept: 'image/*' },
                                { key: 'osRearWheel', label: 'Photo of O/S Rear Wheel', accept: 'image/*' },
                                { key: 'osFrontWheel', label: 'Photo of O/S Front Wheel', accept: 'image/*' },
                            ] as const).map(({ key, label, accept }) => (
                                <div key={key}>
                                    <p className={sectionLabel}>{label}</p>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="file"
                                            accept={accept}
                                            className="block w-full text-[12px] text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-[12px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                try {
                                                    const dataUrl = await fileToDataUrl(file);
                                                    setForm(f => ({ ...f, walkaround: { ...f.walkaround, [key]: dataUrl } }));
                                                } catch {
                                                    toast.error('Failed to read file');
                                                }
                                            }}
                                        />
                                        {(form.walkaround as Record<string, string | undefined>)?.[key] ? (
                                            <button
                                                type="button"
                                                onClick={() => setForm(f => ({
                                                    ...f,
                                                    walkaround: { ...f.walkaround, [key]: '', [`${key}Desc`]: '' },
                                                }))}
                                                className="text-[12px] font-semibold text-red-500 hover:text-red-700"
                                            >
                                                Remove
                                            </button>
                                        ) : null}
                                    </div>
                                    {(form.walkaround as Record<string, string | undefined>)?.[key] ? (
                                        <div className="mt-2">
                                            <img src={(form.walkaround as Record<string, string>)[key]} alt="" className="h-20 w-full max-w-[260px] rounded-lg border border-[#E2E8F0] object-cover" />
                                        </div>
                                    ) : null}
                                    <p className={`${sectionLabel} mt-3`}>Description (optional)</p>
                                    <textarea
                                        className={inputCls}
                                        rows={2}
                                        placeholder="Notes for this photo..."
                                        value={(form.walkaround as Record<string, string>)[`${key}Desc`] ?? ''}
                                        onChange={e => setForm(f => ({
                                            ...f,
                                            walkaround: { ...f.walkaround, [`${key}Desc`]: e.target.value },
                                        }))}
                                    />
                                </div>
                            ))}

                            <div className="md:col-span-1">
                                <p className={sectionLabel}>Video of Walkaround</p>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="file"
                                        accept="video/*"
                                        className="block w-full text-[12px] text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-[12px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            try {
                                                const dataUrl = await fileToDataUrl(file);
                                                setForm(f => ({ ...f, walkaround: { ...f.walkaround, video: dataUrl } }));
                                            } catch {
                                                toast.error('Failed to read file');
                                            }
                                        }}
                                    />
                                    {form.walkaround?.video ? (
                                        <button
                                            type="button"
                                            onClick={() => setForm(f => ({
                                                ...f,
                                                walkaround: { ...f.walkaround, video: '', videoDesc: '' },
                                            }))}
                                            className="text-[12px] font-semibold text-red-500 hover:text-red-700"
                                        >
                                            Remove
                                        </button>
                                    ) : null}
                                </div>
                                {form.walkaround?.video ? (
                                    <div className="mt-2">
                                        <video src={form.walkaround.video} controls className="h-24 w-full max-w-[320px] rounded-lg border border-[#E2E8F0] bg-black" />
                                    </div>
                                ) : null}
                                <p className={`${sectionLabel} mt-3`}>Description (optional)</p>
                                <textarea
                                    className={inputCls}
                                    rows={2}
                                    placeholder="Notes for this video..."
                                    value={(form.walkaround as Record<string, string>).videoDesc ?? ''}
                                    onChange={e => setForm(f => ({
                                        ...f,
                                        walkaround: { ...f.walkaround, videoDesc: e.target.value },
                                    }))}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3 - Exterior */}
                {currentStep === 3 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[15px] font-semibold text-slate-800">Exterior Inspection</h3>
                            <span className="text-[12px] text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{form.exteriorFaults.length} fault{form.exteriorFaults.length !== 1 ? 's' : ''}</span>
                        </div>
                        <p className="text-[12px] text-slate-500 mb-4">Click on any area of the vehicle to mark a damage point.</p>
                        <ExteriorMap
                            onPartSelect={addExteriorFault}
                            faults={form.exteriorFaults}
                            onFaultPointDelete={removeExteriorFault}
                            onFaultUpdate={updateExteriorCoords}
                        />
                        {form.exteriorFaults.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className={sectionLabel}>Marked Faults</p>
                                {form.exteriorFaults.map((f, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2">
                                        <span className="w-5 h-5 rounded bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                                        {f.photoUrl ? <img src={f.photoUrl} alt="" className="h-10 w-10 rounded object-cover border border-[#E2E8F0] shrink-0" /> : null}
                                        <span className="text-[12px] text-slate-700 font-medium flex-1">{f.part} — <span className="text-slate-500 font-normal">{f.damage}{f.detail ? ` (${f.detail})` : ''}</span></span>
                                        {f.note && <span className="text-[11px] text-slate-400 italic">"{f.note}"</span>}
                                        <button onClick={() => removeExteriorFault(i)} className="text-red-500 hover:text-red-700 text-[11px] font-medium">Remove</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 4 - Interior */}
                {currentStep === 4 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[15px] font-semibold text-slate-800">Interior Inspection</h3>
                            <span className="text-[12px] text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{form.interiorFaults.length} fault{form.interiorFaults.length !== 1 ? 's' : ''}</span>
                        </div>
                        <p className="text-[12px] text-slate-500 mb-4">Click on any area of the interior to mark a damage point.</p>
                        <InteriorMap
                            onPartSelect={addInteriorFault}
                            faults={form.interiorFaults}
                            onFaultPointDelete={removeInteriorFault}
                            onFaultUpdate={updateInteriorCoords}
                        />
                        {form.interiorFaults.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className={sectionLabel}>Marked Faults</p>
                                {form.interiorFaults.map((f, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2">
                                        <span className="w-5 h-5 rounded bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                                        {f.photoUrl ? <img src={f.photoUrl} alt="" className="h-10 w-10 rounded object-cover border border-[#E2E8F0] shrink-0" /> : null}
                                        <span className="text-[12px] text-slate-700 font-medium flex-1">{f.part} — <span className="text-slate-500 font-normal">{f.damage}{f.detail ? ` (${f.detail})` : ''}</span></span>
                                        {f.note && <span className="text-[11px] text-slate-400 italic">"{f.note}"</span>}
                                        <button onClick={() => removeInteriorFault(i)} className="text-red-500 hover:text-red-700 text-[11px] font-medium">Remove</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 5 - Mechanical */}
                {currentStep === 5 && (
                    <div className="space-y-4">
                        <h3 className="text-[15px] font-semibold text-slate-800">Tyres, Wheels & Mechanical Check</h3>
                        <p className="text-[12px] text-slate-500 -mt-2">Click a tyre to fill details. Click the red bonnet area for mechanical & fluid checks.</p>
                        <TyreOverlaySVG
                            tyres={form.tyres}
                            onChange={updated => setF('tyres', updated)}
                            onBonnetClick={() => setShowMechanical(true)}
                        />
                    </div>
                )}

                {/* STEP 6 - Service, MOT & Additional Info */}
                {currentStep === 6 && (
                    <div className="space-y-5">
                        <h3 className="text-[15px] font-semibold text-slate-800">Service, MOT & Additional Info</h3>

                        {/* Two clickable cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Details card */}
                            <button type="button" onClick={() => setShowDetailsPopup(true)}
                                className="text-left bg-white border border-[#E2E8F0] rounded-xl p-4 hover:border-[#4D7CFF] hover:shadow-sm transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">📋</span>
                                        <span className="text-[14px] font-semibold text-slate-800">Details</span>
                                    </div>
                                    <span className="text-slate-400 group-hover:text-[#4D7CFF] transition-colors text-[18px]">→</span>
                                </div>
                                <p className="text-[12px] text-slate-500 mb-3">Owners, keys, V5 document, mileage & write-off info</p>
                                {(form.numberOfOwners || form.numberOfKeys || form.hasV5Document) ? (
                                    <span className="text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Partially Filled</span>
                                ) : (
                                    <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠️ Not Started</span>
                                )}
                            </button>

                            {/* Service & MOT card */}
                            <button type="button" onClick={() => setShowServicePopup(true)}
                                className="text-left bg-white border border-[#E2E8F0] rounded-xl p-4 hover:border-[#4D7CFF] hover:shadow-sm transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🔧</span>
                                        <span className="text-[14px] font-semibold text-slate-800">Service, MOT & Additional Info</span>
                                    </div>
                                    <span className="text-slate-400 group-hover:text-[#4D7CFF] transition-colors text-[18px]">→</span>
                                </div>
                                <p className="text-[12px] text-slate-500 mb-3">Service history, MOT status, usage history & notes</p>
                                {(form.serviceHistoryType || form.motExpiryDate || form.additionalNotes) ? (
                                    <span className="text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Partially Filled</span>
                                ) : (
                                    <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠️ Not Started</span>
                                )}
                            </button>
                        </div>

                        {/* Inventory — MotorDesk-style (Cabin / Boot / Exterior) */}
                        <MotorDeskInventoryEditor
                            value={normalizeInventory(form.inventory)}
                            onChange={inv => setF('inventory', inv)}
                        />
                    </div>
                )}

                {/* STEP 7 - Summary */}
                {currentStep === 7 && (() => {
                    const grade = (form.overallGrade || '1') as NAMAGrade;
                    const gradeInfo = NAMA_GRADE_INFO[grade] ?? NAMA_GRADE_INFO['1'];
                    const tyresChecked = (form.tyres ?? []).filter((t: { treadDepth?: string; condition?: string; psi?: string; photo?: string }) =>
                        t.treadDepth || t.condition || (t.psi && String(t.psi).trim()) || (t.photo && String(t.photo).trim())
                    ).length;
                    return (
                    <div className="max-w-lg space-y-5">
                        <h3 className="text-[15px] font-semibold text-slate-800">Summary & Grade</h3>

                        {/* Fault summary stats */}
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 grid grid-cols-4 gap-3 text-center">
                            <div><p className="text-[10px] text-slate-500 mb-1">Exterior Faults</p><p className="text-[20px] font-bold text-slate-800">{form.exteriorFaults.length}</p></div>
                            <div><p className="text-[10px] text-slate-500 mb-1">Interior Faults</p><p className="text-[20px] font-bold text-slate-800">{form.interiorFaults.length}</p></div>
                            <div><p className="text-[10px] text-slate-500 mb-1">Tyre Checks</p><p className="text-[20px] font-bold text-slate-800">{tyresChecked}/5</p></div>
                            <div><p className="text-[10px] text-slate-500 mb-1">Total Faults</p><p className="text-[20px] font-bold text-[#4D7CFF]">{form.exteriorFaults.length + form.interiorFaults.length}</p></div>
                        </div>

                        {/* Auto-calculated NAMA Grade */}
                        <div className="rounded-xl border-2 p-5 flex items-center gap-5" style={{ borderColor: gradeInfo.color, background: gradeInfo.bg }}>
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-[32px] font-black text-white shrink-0" style={{ background: gradeInfo.color }}>
                                {grade}
                            </div>
                            <div className="flex-1">
                                <p className="text-[13px] font-bold mb-0.5" style={{ color: gradeInfo.color }}>
                                    NAMA Grade {grade} — {gradeInfo.label}
                                </p>
                                <p className="text-[12px] text-slate-500 leading-snug">
                                    Auto-calculated from {form.exteriorFaults.length + form.interiorFaults.length} fault{form.exteriorFaults.length + form.interiorFaults.length !== 1 ? 's' : ''} recorded
                                </p>
                                <p className="text-[11px] mt-1.5 font-medium" style={{ color: gradeInfo.color }}>
                                    1 = Excellent · 2 = Good · 3 = Average · 4 = Poor · 5 = Very Poor · U = Uneconomical
                                </p>
                            </div>
                        </div>

                        <div>
                            <p className={sectionLabel}>Additional Notes</p>
                            <textarea className={inputCls} rows={4} placeholder="Any additional comments or observations..." value={form.additionalNotes} onChange={e => setF('additionalNotes', e.target.value)} />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => saveReport('draft')} disabled={saving}
                                className="flex-1 border border-[#E2E8F0] text-slate-600 hover:bg-slate-50 text-[13px] font-medium py-2.5 rounded-xl transition-colors">
                                Save as Draft
                            </button>
                            <button onClick={() => saveReport('completed')} disabled={saving}
                                className="flex-1 bg-[#4D7CFF] hover:bg-[#3d6ce0] text-white text-[13px] font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                                {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                                Complete Report
                            </button>
                        </div>
                    </div>
                    );
                })()}
            </div>

            {/* Bottom nav */}
            <div className="shrink-0 border-t border-[#E2E8F0] px-6 py-3 flex items-center justify-between bg-[#F8FAFC] rounded-b-lg">
                <button onClick={() => setCurrentStep(s => Math.max(1, s - 1) as Step)} disabled={currentStep === 1}
                    className="flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    Previous
                </button>
                <span className="text-[12px] text-slate-400">Step {currentStep} of {STEPS.length}</span>
                {currentStep < STEPS.length ? (
                    <button onClick={() => setCurrentStep(s => Math.min(STEPS.length, s + 1) as Step)}
                        className="flex items-center gap-1.5 text-[13px] text-[#4D7CFF] hover:text-[#3d6ce0] font-semibold transition-colors">
                        Next
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                ) : (
                    <span />
                )}
            </div>

            {/* ── Details Popup Modal ──────────────────────────────────────── */}
            {showDetailsPopup && typeof document !== 'undefined' && createPortal(
                <div onClick={() => setShowDetailsPopup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '520px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,0.35)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>📋</span>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Details</h3>
                            </div>
                            <button onClick={() => setShowDetailsPopup(false)} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px', lineHeight: 1 }}>✕</button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            <MechCard icon="⚠️" title="Is the customer aware of any mileage modifications?">
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {['yes', 'no'].map(v => (
                                        <button key={v} type="button" onClick={() => setF('mileageModifications', v)}
                                            style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: form.mileageModifications === v ? '#4D7CFF' : '#fff', color: form.mileageModifications === v ? '#fff' : '#475569', borderColor: form.mileageModifications === v ? '#4D7CFF' : '#E2E8F0' }}>
                                            {v === 'yes' ? 'Yes' : 'No'}
                                        </button>
                                    ))}
                                </div>
                            </MechCard>

                            <MechCard icon="⚠️" title="Does the customer have the V5 document?">
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {['yes', 'no'].map(v => (
                                        <button key={v} type="button" onClick={() => setF('hasV5Document', v)}
                                            style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: form.hasV5Document === v ? '#4D7CFF' : '#fff', color: form.hasV5Document === v ? '#fff' : '#475569', borderColor: form.hasV5Document === v ? '#4D7CFF' : '#E2E8F0' }}>
                                            {v === 'yes' ? 'Yes' : 'No'}
                                        </button>
                                    ))}
                                </div>
                            </MechCard>

                            <MechCard icon="⚠️" title="Number of owners">
                                <select value={form.numberOfOwners} onChange={e => setF('numberOfOwners', e.target.value)} style={mechSelectStyle}>
                                    <option value="">Select Owners</option>
                                    <option value="1">1 Owner</option>
                                    <option value="2">2 Owners</option>
                                    <option value="3">3 Owners</option>
                                    <option value="4">4 Owners</option>
                                    <option value="5+">5+ Owners</option>
                                </select>
                            </MechCard>

                            <MechCard icon="⚠️" title="Number of keys">
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[{ v: '1', label: '1' }, { v: '2', label: '2' }, { v: '3+', label: '3 or More' }].map(({ v, label }) => (
                                        <button key={v} type="button" onClick={() => setF('numberOfKeys', v)}
                                            style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: form.numberOfKeys === v ? '#4D7CFF' : '#fff', color: form.numberOfKeys === v ? '#fff' : '#475569', borderColor: form.numberOfKeys === v ? '#4D7CFF' : '#E2E8F0' }}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </MechCard>

                            <MechCard icon="⚠️" title="Was the vehicle first registered in the UK?">
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {['yes', 'no'].map(v => (
                                        <button key={v} type="button" onClick={() => setF('firstRegisteredUK', v)}
                                            style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: form.firstRegisteredUK === v ? '#4D7CFF' : '#fff', color: form.firstRegisteredUK === v ? '#fff' : '#475569', borderColor: form.firstRegisteredUK === v ? '#4D7CFF' : '#E2E8F0' }}>
                                            {v === 'yes' ? 'Yes' : 'No'}
                                        </button>
                                    ))}
                                </div>
                            </MechCard>

                            <MechCard icon="⚠️" title="Has the vehicle been an insurance write off?">
                                <div style={{ display: 'flex', gap: '8px', marginBottom: form.insuranceWriteOff === 'yes' ? '12px' : 0 }}>
                                    {['yes', 'no'].map(v => (
                                        <button key={v} type="button" onClick={() => setF('insuranceWriteOff', v)}
                                            style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: form.insuranceWriteOff === v ? '#4D7CFF' : '#fff', color: form.insuranceWriteOff === v ? '#fff' : '#475569', borderColor: form.insuranceWriteOff === v ? '#4D7CFF' : '#E2E8F0' }}>
                                            {v === 'yes' ? 'Yes' : 'No'}
                                        </button>
                                    ))}
                                </div>
                                {form.insuranceWriteOff === 'yes' && (
                                    <select value={form.insuranceWriteOffType} onChange={e => setF('insuranceWriteOffType', e.target.value)} style={mechSelectStyle}>
                                        <option value="">Select Category</option>
                                        <option value="Cat A">Category A</option>
                                        <option value="Cat B">Category B</option>
                                        <option value="Cat C">Category C</option>
                                        <option value="Cat D">Category D</option>
                                        <option value="Cat S">Category S</option>
                                        <option value="Cat N">Category N</option>
                                    </select>
                                )}
                            </MechCard>

                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexShrink: 0 }}>
                            <button onClick={() => setShowDetailsPopup(false)} style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => { setShowDetailsPopup(false); toast.success('Details saved'); }} style={{ padding: '10px 28px', borderRadius: '10px', border: 'none', background: '#4D7CFF', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Save Details</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Service, MOT & Info Popup Modal ──────────────────────────── */}
            {showServicePopup && typeof document !== 'undefined' && createPortal(
                <div onClick={() => setShowServicePopup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '520px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,0.35)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>🔧</span>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Service, MOT & Additional Info</h3>
                            </div>
                            <button onClick={() => setShowServicePopup(false)} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px', lineHeight: 1 }}>✕</button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            <MechCard icon="⚠️" title="Vehicle Service History?">
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <select value={form.serviceHistoryType} onChange={e => setF('serviceHistoryType', e.target.value)} style={{ ...mechSelectStyle, minWidth: '140px' }}>
                                        <option value="">What Type?</option>
                                        <option value="Full">Full Service History</option>
                                        <option value="Partial">Partial Service History</option>
                                        <option value="None">No Service History</option>
                                    </select>
                                    <select value={form.serviceHistoryCount} onChange={e => setF('serviceHistoryCount', e.target.value)}
                                        disabled={!form.serviceHistoryType || form.serviceHistoryType === 'None'}
                                        style={{ ...mechSelectStyle, minWidth: '120px', background: (!form.serviceHistoryType || form.serviceHistoryType === 'None') ? '#e5e7eb' : '#fff', cursor: (!form.serviceHistoryType || form.serviceHistoryType === 'None') ? 'not-allowed' : 'pointer' }}>
                                        <option value="">How many?</option>
                                        {Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1} Records</option>)}
                                    </select>
                                    <select value={form.mainDealer} onChange={e => setF('mainDealer', e.target.value)}
                                        disabled={!form.serviceHistoryType || form.serviceHistoryType === 'None'}
                                        style={{ ...mechSelectStyle, minWidth: '120px', background: (!form.serviceHistoryType || form.serviceHistoryType === 'None') ? '#e5e7eb' : '#fff', cursor: (!form.serviceHistoryType || form.serviceHistoryType === 'None') ? 'not-allowed' : 'pointer' }}>
                                        <option value="">Main Dealer?</option>
                                        <option value="yes">Yes - Main Dealer</option>
                                        <option value="no">No - Independent</option>
                                    </select>
                                </div>
                            </MechCard>

                            <MechCard icon="⚠️" title="Has this vehicle ever been used for private hire, taxi, police vehicle, or daily rental?">
                                <select value={form.vehicleUsageHistory} onChange={e => setF('vehicleUsageHistory', e.target.value)} style={mechSelectStyle}>
                                    <option value="">Please select</option>
                                    <option value="None">No - Private Use Only</option>
                                    <option value="Private Hire">Yes - Private Hire</option>
                                    <option value="Taxi">Yes - Taxi</option>
                                    <option value="Police">Yes - Police Vehicle</option>
                                    <option value="Daily Rental">Yes - Daily Rental</option>
                                </select>
                            </MechCard>

                            <MechCard icon="🔍" title="MOT Status">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                        Expires on: {form.motExpiryDate ? new Date(form.motExpiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                    </p>
                                    {vehicleMotExpiry && (
                                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#4D7CFF', background: '#EEF2FF', padding: '2px 8px', borderRadius: '20px' }}>
                                            Auto-filled from vehicle
                                        </span>
                                    )}
                                </div>
                                <input type="date" value={form.motExpiryDate} onChange={e => setF('motExpiryDate', e.target.value)} style={mechSelectStyle} />
                            </MechCard>

                            <MechCard icon="📝" title="Additional Notes">
                                <textarea value={form.additionalNotes} onChange={e => setF('additionalNotes', e.target.value)}
                                    placeholder="Add any additional notes..."
                                    rows={4}
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', color: '#334155', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                />
                            </MechCard>

                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexShrink: 0 }}>
                            <button onClick={() => setShowServicePopup(false)} style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => { setShowServicePopup(false); toast.success('Service info saved'); }} style={{ padding: '10px 28px', borderRadius: '10px', border: 'none', background: '#4D7CFF', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Save Info</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── Mechanical & Fluid Checks Modal ──────────────────────────── */}
            {showMechanical && typeof document !== 'undefined' && createPortal(
                <div
                    onClick={() => setShowMechanical(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '520px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,0.35)' }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>🔧</span>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Mechanical & Fluid Checks</h3>
                            </div>
                            <button onClick={() => setShowMechanical(false)} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', borderRadius: '8px', fontSize: '18px', lineHeight: 1 }}>✕</button>
                        </div>

                        {/* Scrollable body */}
                        <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                            {/* Safety Checks */}
                            <MechCard icon="🔍" title="Safety Checks">
                                {[
                                    { label: 'Lights', key: 'lightsCheck' },
                                    { label: 'Mirrors', key: 'mirrorsCheck' },
                                    { label: 'Wipers', key: 'wipersCheck' },
                                    { label: 'Engine Start (Smooth)', key: 'engineStartSmooth' },
                                    { label: 'Steering Alignment', key: 'steeringAlignment' },
                                    { label: 'Brake Performance', key: 'brakePerformance' },
                                    { label: 'Gear Shift Quality', key: 'gearShiftQuality' },
                                ].map(({ label, key }) => (
                                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                                        <span style={{ fontSize: '13px', color: '#334155' }}>{label}</span>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {[true, false].map(v => (
                                                <button key={String(v)} type="button" onClick={() => setF(key, v)}
                                                    style={{
                                                        padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                                                        background: (form as any)[key] === v ? (v ? '#16a34a' : '#ef4444') : '#fff',
                                                        color: (form as any)[key] === v ? '#fff' : '#64748b',
                                                        borderColor: (form as any)[key] === v ? (v ? '#16a34a' : '#ef4444') : '#E2E8F0',
                                                    }}>
                                                    {v ? 'Pass' : 'Fail'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </MechCard>

                            {/* Oil */}
                            <MechCard icon="🛢️" title="Oil">
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                    <select value={form.oilLeakage} onChange={e => setF('oilLeakage', e.target.value)} style={{ ...mechSelectStyle, minWidth: '140px' }}>
                                        <option value="">Not Checked</option>
                                        <option value="none">✓ No Leakage</option>
                                        <option value="minor">⚠️ Minor Seepage</option>
                                        <option value="severe">❌ Severe Leak</option>
                                    </select>
                                    <select value={form.oilColor ?? ''} onChange={e => setF('oilColor', e.target.value)} style={{ ...mechSelectStyle, minWidth: '140px' }}>
                                        <option value="">Color - Not Checked</option>
                                        <option value="amber">🟡 Amber (Good)</option>
                                        <option value="dark-brown">🟤 Dark Brown (Due Change)</option>
                                        <option value="black">⚫ Black (Change Now)</option>
                                        <option value="dirty">⚠️ Dirty/Cloudy</option>
                                        <option value="faded">⚠️ Faded/Discolored</option>
                                        <option value="unknown">❓ Unknown/Other</option>
                                    </select>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                        <span>Oil Level:</span>
                                        <span style={{ fontWeight: '600', color: (form.oilLevel ?? 0) >= 75 ? '#16a34a' : (form.oilLevel ?? 0) >= 25 ? '#f59e0b' : '#ef4444' }}>{form.oilLevel != null ? `${form.oilLevel}%` : 'Not Checked'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>Empty</span>
                                        <input type="range" min={0} max={100} step={5} value={form.oilLevel ?? 0} onChange={e => setF('oilLevel', Number(e.target.value))}
                                            style={{ flex: 1, height: '8px', borderRadius: '4px', cursor: 'pointer', accentColor: (form.oilLevel ?? 0) >= 75 ? '#16a34a' : (form.oilLevel ?? 0) >= 25 ? '#f59e0b' : '#ef4444' }} />
                                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>Full</span>
                                    </div>
                                </div>
                            </MechCard>

                            {/* Coolant */}
                            <MechCard icon="🌡️" title="Coolant">
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                    <select value={form.coolantLevel} onChange={e => setF('coolantLevel', e.target.value)} style={{ ...mechSelectStyle, minWidth: '140px' }}>
                                        <option value="">Not Checked</option>
                                        <option value="good">✓ Good/Full</option>
                                        <option value="low">⚠️ Low</option>
                                        <option value="empty">❌ Empty</option>
                                    </select>
                                    <select value={form.coolantColor ?? ''} onChange={e => setF('coolantColor', e.target.value)} style={{ ...mechSelectStyle, minWidth: '140px' }}>
                                        <option value="">Color - Not Checked</option>
                                        <option value="green">🟢 Green (Good)</option>
                                        <option value="blue">🔵 Blue (Good)</option>
                                        <option value="pink">🩷 Pink/Red (Good)</option>
                                        <option value="orange">🟠 Orange (Good)</option>
                                        <option value="rusty">🟤 Rusty (Contaminated)</option>
                                        <option value="dirty">⚠️ Dirty/Cloudy</option>
                                        <option value="faded">⚠️ Faded/Discolored</option>
                                        <option value="unknown">❓ Unknown/Other</option>
                                    </select>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                                        <span>Coolant Level:</span>
                                        <span style={{ fontWeight: '600', color: (form.coolantLevelPercent ?? 0) >= 75 ? '#16a34a' : (form.coolantLevelPercent ?? 0) >= 25 ? '#f59e0b' : '#ef4444' }}>{form.coolantLevelPercent != null ? `${form.coolantLevelPercent}%` : 'Not Checked'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>Empty</span>
                                        <input type="range" min={0} max={100} step={5} value={form.coolantLevelPercent ?? 0} onChange={e => setF('coolantLevelPercent', Number(e.target.value))}
                                            style={{ flex: 1, height: '8px', borderRadius: '4px', cursor: 'pointer', accentColor: (form.coolantLevelPercent ?? 0) >= 75 ? '#16a34a' : (form.coolantLevelPercent ?? 0) >= 25 ? '#f59e0b' : '#ef4444' }} />
                                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>Full</span>
                                    </div>
                                </div>
                            </MechCard>

                            {/* Brake Fluid */}
                            <MechCard icon="🛑" title="Brake Fluid Level">
                                <select value={form.brakeFluidLevel} onChange={e => setF('brakeFluidLevel', e.target.value)} style={{ ...mechSelectStyle, maxWidth: '220px' }}>
                                    <option value="">Not Checked</option>
                                    <option value="good">✓ Good</option>
                                    <option value="low">⚠️ Low</option>
                                </select>
                            </MechCard>

                            {/* Warning Lights */}
                            <MechCard icon="⚠️" title="Any Warning Lights / Messages">
                                <input value={form.warningLights} onChange={e => setF('warningLights', e.target.value)}
                                    placeholder="e.g., Check Engine Light, ABS Warning, etc."
                                    style={{ ...mechSelectStyle, maxWidth: '100%' }} />
                            </MechCard>

                            {/* Battery */}
                            <MechCard icon="🔋" title="Battery Condition">
                                <select value={form.batteryCondition} onChange={e => setF('batteryCondition', e.target.value)} style={{ ...mechSelectStyle, maxWidth: '220px' }}>
                                    <option value="">Not Checked</option>
                                    <option value="good">✓ Good</option>
                                    <option value="weak">⚠️ Weak</option>
                                    <option value="replace">❌ Needs Replacement</option>
                                </select>
                            </MechCard>

                            {/* Exhaust */}
                            <MechCard icon="💨" title="Exhaust Condition">
                                <select value={form.exhaustCondition} onChange={e => setF('exhaustCondition', e.target.value)} style={{ ...mechSelectStyle, maxWidth: '220px' }}>
                                    <option value="">Not Checked</option>
                                    <option value="good">✓ Good</option>
                                    <option value="rust">⚠️ Surface Rust</option>
                                    <option value="damaged">❌ Damaged/Corroded</option>
                                </select>
                            </MechCard>

                            {/* Notes */}
                            <MechCard icon="📝" title="Additional Mechanical Notes">
                                <textarea value={form.mechanicalNotes} onChange={e => setF('mechanicalNotes', e.target.value)}
                                    placeholder="Any other mechanical observations, issues, or comments..."
                                    rows={3}
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', color: '#334155', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                />
                            </MechCard>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexShrink: 0 }}>
                            <button onClick={() => setShowMechanical(false)} style={{ padding: '10px 24px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={() => { setShowMechanical(false); toast.success('Checks saved'); }} style={{ padding: '10px 28px', borderRadius: '10px', border: 'none', background: '#4D7CFF', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                                Save Checks
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
        <ConditionReportHelpDrawer open={showConditionHelp} onClose={() => setShowConditionHelp(false)} />
        </>
    );
}
