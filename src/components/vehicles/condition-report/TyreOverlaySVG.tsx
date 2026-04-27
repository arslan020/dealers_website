'use client';
import { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

/** Canonical keys match API / `TYRE_POSITIONS` in ConditionReportTab */
export type TyrePositionKey = 'front-left' | 'front-right' | 'rear-left' | 'rear-right' | 'spare';

export interface TyreData {
    position: TyrePositionKey | string;
    treadDepth: string;
    condition: string;
    psi?: string;
    photo?: string;
}

interface TyreOverlaySVGProps {
    tyres: TyreData[];
    onChange: (tyres: TyreData[]) => void;
    onBonnetClick?: () => void;
}

/** idx maps to tyre array order — position saved as API key (0–3 road wheels, 4 spare) */
const INDEX_POSITION: TyrePositionKey[] = ['front-left', 'front-right', 'rear-left', 'rear-right', 'spare'];

const HOTSPOTS = {
    nsf: { x: 340, y: 100, w: 86, h: 165, label: 'Near-Side Front (NSF)', idx: 0, pos: 'Front Left' },
    osf: { x: 740, y: 100, w: 86, h: 165, label: 'Off-Side Front (OSF)', idx: 1, pos: 'Front Right' },
    nsr: { x: 340, y: 450, w: 86, h: 165, label: 'Near-Side Rear (NSR)', idx: 2, pos: 'Rear Left' },
    osr: { x: 740, y: 450, w: 86, h: 165, label: 'Off-Side Rear (OSR)', idx: 3, pos: 'Rear Right' },
    spare: { x: 530, y: 705, r: 58, label: 'Spare Tyre', idx: 4, pos: 'Spare' },
    bonnet: { x: 445, y: 40, w: 275, h: 340, label: '🔧 Mechanical Checks' },
} as const;

type HotspotKey = 'nsf' | 'osf' | 'nsr' | 'osr' | 'spare';

const TREAD_OPTIONS = [
    { value: '', label: 'Select' },
    { value: '1.6', label: '1.6mm (Legal Min)' },
    { value: '2', label: '2mm' },
    { value: '3', label: '3mm' },
    { value: '4', label: '4mm' },
    { value: '5', label: '5mm' },
    { value: '6', label: '6mm' },
    { value: '7', label: '7mm' },
    { value: '8', label: '8mm (New)' },
];

const CONDITION_OPTIONS = ['Good', 'Fair', 'Scuffed', 'Kerbed', 'Cracked', 'Replace'];

export default function TyreOverlaySVG({ tyres, onChange, onBonnetClick }: TyreOverlaySVGProps) {
    const [active, setActive] = useState<HotspotKey | null>(null);
    const [popupDepth, setPopupDepth] = useState('');
    const [popupCond, setPopupCond] = useState('');
    const [popupPsi, setPopupPsi] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const tyresMap = useMemo(() => {
        const map: Record<number, TyreData> = {};
        tyres.forEach((t, i) => { map[i] = t; });
        return map;
    }, [tyres]);

    const hasTyreData = (idx: number) => {
        const t = tyresMap[idx];
        return !!(t?.treadDepth || t?.condition || (t?.psi && String(t.psi).trim()) || (t?.photo && String(t.photo).trim()));
    };

    const openPopup = (key: HotspotKey) => {
        const h = HOTSPOTS[key];
        if (!('idx' in h) || typeof h.idx !== 'number' || h.idx < 0) return;
        const existing = tyresMap[h.idx];
        setPopupDepth(existing?.treadDepth ?? '');
        setPopupCond(existing?.condition ?? '');
        setPopupPsi(existing?.psi ?? '');
        setActive(key);
    };

    const savePopup = () => {
        if (!active) return;
        const h = HOTSPOTS[active];
        if (!('idx' in h) || typeof h.idx !== 'number' || h.idx < 0) return;
        const updated = [...tyres];
        if (updated.length <= h.idx) updated.length = h.idx + 1;
        updated[h.idx] = {
            ...(updated[h.idx] ?? { treadDepth: '', condition: '', psi: '', photo: '' }),
            position: INDEX_POSITION[h.idx],
            treadDepth: popupDepth,
            condition: popupCond,
            psi: popupPsi.trim(),
        };
        onChange(updated);
        setActive(null);
    };

    const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!active) return;
        const h = HOTSPOTS[active];
        if (!('idx' in h) || typeof h.idx !== 'number' || h.idx < 0) return;
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const updated = [...tyres];
            if (updated.length <= h.idx) updated.length = h.idx + 1;
            updated[h.idx as number] = {
                ...(updated[h.idx as number] ?? { treadDepth: '', condition: '', psi: '', photo: '' }),
                position: INDEX_POSITION[h.idx],
                photo: reader.result as string,
            };
            onChange(updated);
        };
        reader.readAsDataURL(file);
    };

    const activeHotspot = active ? HOTSPOTS[active] : null;
    const activeIdx = activeHotspot && 'idx' in activeHotspot ? (activeHotspot as any).idx as number : -1;

    const popup = active && activeIdx >= 0 && typeof document !== 'undefined' ? createPortal(
        <div
            onClick={() => setActive(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                        {activeHotspot && 'label' in activeHotspot ? (activeHotspot as any).label : ''}
                    </h3>
                    <button onClick={() => setActive(null)} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '8px' }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Tread depth (mm)</label>
                    <select
                        value={popupDepth}
                        onChange={e => setPopupDepth(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#334155', outline: 'none', background: '#fff' }}
                    >
                        {TREAD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Pressure (PSI)</label>
                    <input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 32"
                        value={popupPsi}
                        onChange={e => setPopupPsi(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#334155', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Wheel Condition</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {CONDITION_OPTIONS.map(c => (
                            <button key={c} type="button" onClick={() => setPopupCond(c)}
                                style={{
                                    padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: '1px solid',
                                    background: popupCond === c ? '#4D7CFF' : '#fff',
                                    color: popupCond === c ? '#fff' : '#475569',
                                    borderColor: popupCond === c ? '#4D7CFF' : '#E2E8F0',
                                    transition: 'all 0.15s',
                                }}>
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Photo (optional)</label>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                        style={{ width: '100%', padding: '10px', border: '2px dashed #E2E8F0', borderRadius: '10px', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                        {tyresMap[activeIdx]?.photo ? 'Change Photo' : 'Add Photo'}
                    </button>
                    {tyresMap[activeIdx]?.photo && (
                        <img src={tyresMap[activeIdx].photo} alt="Tyre" style={{ marginTop: '8px', width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                    )}
                </div>

                <button type="button" onClick={savePopup}
                    style={{ width: '100%', padding: '12px', background: '#4D7CFF', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                    Save Tyre Data
                </button>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <div style={{ width: '100%', maxWidth: 'min(920px, 100%)', margin: '0 auto' }}>
                <svg viewBox="0 0 1210 828" role="img" aria-label="Tyre diagram" style={{ width: '100%', height: 'auto', display: 'block' }}>
                    <image href="/tyre-board-car.svg" x="0" y="0" width="1210" height="828" />

                    {/* Guide overlays for tyres */}
                    {(['nsf', 'osf', 'nsr', 'osr'] as HotspotKey[]).map(id => {
                        const h = HOTSPOTS[id] as typeof HOTSPOTS.nsf;
                        const done = hasTyreData(h.idx);
                        return (
                            <g key={id} pointerEvents="none">
                                <rect x={h.x} y={h.y} width={h.w} height={h.h} rx="10" ry="10"
                                    style={{ fill: done ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.1)', stroke: done ? '#22c55e' : '#3b82f6', strokeWidth: 3 }} />
                                <text x={h.x + h.w / 2} y={h.y - 8} textAnchor="middle"
                                    style={{ fill: done ? '#22c55e' : '#3b82f6', fontWeight: 'bold', fontSize: '22px', fontFamily: 'sans-serif' }}>
                                    {id.toUpperCase()}{done ? ' ✓' : ''}
                                </text>
                            </g>
                        );
                    })}

                    {/* Spare circle guide */}
                    <g pointerEvents="none">
                        {(() => {
                            const s = HOTSPOTS.spare;
                            const cx = s.x + s.r;
                            const cy = s.y + s.r;
                            const done = hasTyreData(s.idx);
                            return (
                                <>
                                    <circle cx={cx} cy={cy} r={s.r}
                                        style={{ fill: done ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.1)', stroke: done ? '#22c55e' : '#3b82f6', strokeWidth: 3 }} />
                                    <text x={cx} y={s.y - 6} textAnchor="middle"
                                        style={{ fill: done ? '#22c55e' : '#3b82f6', fontWeight: 'bold', fontSize: '20px', fontFamily: 'sans-serif' }}>
                                        SPARE{done ? ' ✓' : ''}
                                    </text>
                                </>
                            );
                        })()}
                    </g>

                    {/* Bonnet / Mechanical guide */}
                    <g pointerEvents="none">
                        <rect x={HOTSPOTS.bonnet.x} y={HOTSPOTS.bonnet.y} width={HOTSPOTS.bonnet.w} height={HOTSPOTS.bonnet.h} rx="10" ry="10"
                            style={{ fill: 'rgba(239,68,68,0.1)', stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '8 4' }} />
                        <text x={HOTSPOTS.bonnet.x + HOTSPOTS.bonnet.w / 2} y={HOTSPOTS.bonnet.y + HOTSPOTS.bonnet.h / 2} textAnchor="middle"
                            style={{ fill: '#ef4444', fontWeight: 'bold', fontSize: '18px', fontFamily: 'sans-serif' }}>
                            {HOTSPOTS.bonnet.label}
                        </text>
                    </g>

                    {/* Clickable hotspots */}
                    <rect x={HOTSPOTS.nsf.x} y={HOTSPOTS.nsf.y} width={HOTSPOTS.nsf.w} height={HOTSPOTS.nsf.h} rx="10" fill="transparent" style={{ cursor: 'pointer' }} onClick={() => openPopup('nsf')} />
                    <rect x={HOTSPOTS.osf.x} y={HOTSPOTS.osf.y} width={HOTSPOTS.osf.w} height={HOTSPOTS.osf.h} rx="10" fill="transparent" style={{ cursor: 'pointer' }} onClick={() => openPopup('osf')} />
                    <rect x={HOTSPOTS.nsr.x} y={HOTSPOTS.nsr.y} width={HOTSPOTS.nsr.w} height={HOTSPOTS.nsr.h} rx="10" fill="transparent" style={{ cursor: 'pointer' }} onClick={() => openPopup('nsr')} />
                    <rect x={HOTSPOTS.osr.x} y={HOTSPOTS.osr.y} width={HOTSPOTS.osr.w} height={HOTSPOTS.osr.h} rx="10" fill="transparent" style={{ cursor: 'pointer' }} onClick={() => openPopup('osr')} />
                    <circle cx={HOTSPOTS.spare.x + HOTSPOTS.spare.r} cy={HOTSPOTS.spare.y + HOTSPOTS.spare.r} r={HOTSPOTS.spare.r} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => openPopup('spare')} />
                    <rect x={HOTSPOTS.bonnet.x} y={HOTSPOTS.bonnet.y} width={HOTSPOTS.bonnet.w} height={HOTSPOTS.bonnet.h} rx="10" fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onBonnetClick?.()} />
                </svg>
            </div>

            {popup}
        </>
    );
}
