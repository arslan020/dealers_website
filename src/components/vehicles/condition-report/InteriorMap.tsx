'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaultPoint } from './ExteriorMap';
import { fileToDataUrl } from '@/lib/fileToDataUrl';

/** Same rules as appraisal website `InteriorMap.js` getAutoSizeFromLabel */
function getInteriorAutoSizeFromLabel(label: string): string | null {
    const s = label.trim();
    if (s === 'UpTo3mm' || s === 'UpTo 3mm' || s === 'Upto 3mm') return 'Small';
    if (s === 'Over 3mm') return 'Small';
    if (s === 'Between 3mm + 10mm') return 'Small';
    if (s === 'Over 10mm') return 'Medium';
    if (s === 'UpTo 25mm' || s === 'Upto 25mm') return 'Medium';
    if (s === 'Over 25mm') return 'Large';
    if (s.includes('Over 25mm')) return 'Large';
    return null;
}

/** Appraisal uses empty sizeMap for interior — kept for parity if extended later */
const interiorSizeMap: Record<string, string[]> = {};

interface InteriorMapProps {
    onPartSelect: (fault: Partial<FaultPoint>) => void;
    faults?: FaultPoint[];
    onFaultPointClick?: (index: number) => void;
    onFaultPointDelete?: (index: number) => void;
    onFaultUpdate?: (index: number, coords: { x: number; y: number }) => void;
    imageBase64?: string | null;
    mobileRotated?: boolean;
}

const partsWithConditions = [
    "Air Vents nsf","Air Vents osf","Centre Console Front","Dash Warning Lights","Fascia Panel","Fascia Trim",
    "Glove Box Lid","In Car Entertainment","Steering Wheel","Switches And Controls","Door Pad osf","Handle Inner osf",
    "Door Pad osr","Handle Inner osr","Qtr Panel Trim os","Carpets Front","Carpets Rear","Jack","Load Area Carpet",
    "Rear Panel Trim Int","Shelfload Cover Rear","Tools","Tyre Inflation Kit","Wheel Brace","Tailgate Pad",
    "Roof Lining","Sunvisor ns","Sunvisor os","Door Pad nsf","Handle Inner nsf","Door Pad nsr","Handle Inner nsr",
    "Qtr Panel Trim ns","Headrest Assy nsf","Seat Back Cover nsf","Seat Base Cover nsf","Seat Belt nsf",
    "Headrest Assy osf","Seat Back Cover osf","Seat Base Cover osf","Seat Belt osf","Headrest Assy os",
    "Seat Back Cover osr","Seat Base Cover osr","Seat Belt osr","Headrest Assy Rear Seat Centr",
    "Headrest Assy Rear Seat ns","Seat Back Cover nsr","Seat Base Cover nsr","Seat Belt nsr","Seat Belt Rear Centre",
];

const conditionOptionsMap: Record<string, string[]> = {
    "Air Vents nsf": ["Damaged","Missing"], "Air Vents osf": ["Damaged","Missing"],
    "Centre Console Front": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Dash Warning Lights": ["Displayed"],
    "Fascia Panel": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Fascia Trim": ["Damaged","Missing"],
    "Glove Box Lid": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "In Car Entertainment": ["Broken","Missing"], "Steering Wheel": ["Damaged","Missing"],
    "Switches And Controls": ["Broken","Missing"],
    "Door Pad osf": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Handle Inner osf": ["Damaged","Missing"],
    "Door Pad osr": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Handle Inner osr": ["Damaged","Missing"],
    "Qtr Panel Trim os": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Carpets Front": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Carpets Rear": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Jack": ["Broken","Missing"], "Load Area Carpet": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Rear Panel Trim Int": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Shelfload Cover Rear": ["Damaged","Missing"], "Tools": ["Broken","Missing"],
    "Tyre Inflation Kit": ["Broken","Missing"], "Wheel Brace": ["Broken","Missing"],
    "Tailgate Pad": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Roof Lining": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Sunvisor ns": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Sunvisor os": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Door Pad nsf": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Handle Inner nsf": ["Damaged","Missing"],
    "Door Pad nsr": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Handle Inner nsr": ["Damaged","Missing"],
    "Qtr Panel Trim ns": ["Broken","Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Headrest Assy nsf": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Back Cover nsf": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Base Cover nsf": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Belt nsf": ["Broken","Missing"],
    "Headrest Assy osf": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Back Cover osf": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Base Cover osf": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Belt osf": ["Broken","Missing"],
    "Headrest Assy os": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Back Cover osr": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Base Cover osr": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Belt osr": ["Broken","Missing"],
    "Headrest Assy Rear Seat Centr": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Headrest Assy Rear Seat ns": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Back Cover nsr": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Base Cover nsr": ["Burn","Holed","Missing","Scuffed","Soiled","Torn"],
    "Seat Belt nsr": ["Broken","Missing"], "Seat Belt Rear Centre": ["Broken","Missing"],
};

const severityMap: Record<string, Record<string, string[]>> = {
    "Centre Console Front": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Fascia Panel": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Glove Box Lid": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Door Pad osf": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Door Pad osr": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Carpets Front": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Carpets Rear": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Load Area Carpet": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Tailgate Pad": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Roof Lining": { "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Door Pad nsf": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Door Pad nsr": { "Broken": ["Replace"], "Burn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"], "Holed": ["Over 3mm","Upto 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","Upto 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Between 3mm + 10mm","Over 10mm","UpTo3mm"] },
    "Headrest Assy nsf": { "Burn": ["Over 3mm","UpTo 3mm"], "Holed": ["Over 3mm","UpTo 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","UpTo 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Over 3mm","UpTo 3mm"] },
    "Seat Back Cover nsf": { "Burn": ["Over 3mm","UpTo 3mm"], "Holed": ["Over 3mm","UpTo 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","UpTo 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Over 3mm","UpTo 3mm"] },
    "Seat Base Cover nsf": { "Burn": ["Over 3mm","UpTo 3mm"], "Holed": ["Over 3mm","UpTo 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","UpTo 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Over 3mm","UpTo 3mm"] },
    "Headrest Assy osf": { "Burn": ["Over 3mm","UpTo 3mm"], "Holed": ["Over 3mm","UpTo 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","UpTo 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Over 3mm","UpTo 3mm"] },
    "Seat Back Cover osf": { "Burn": ["Over 3mm","UpTo 3mm"], "Holed": ["Over 3mm","UpTo 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","UpTo 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Over 3mm","UpTo 3mm"] },
    "Seat Base Cover osf": { "Burn": ["Over 3mm","UpTo 3mm"], "Holed": ["Over 3mm","UpTo 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","UpTo 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Over 3mm","UpTo 3mm"] },
    "Seat Back Cover osr": { "Burn": ["Over 3mm","UpTo 3mm"], "Holed": ["Over 3mm","UpTo 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","UpTo 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Over 3mm","UpTo 3mm"] },
    "Seat Base Cover osr": { "Burn": ["Over 3mm","UpTo 3mm"], "Holed": ["Over 3mm","UpTo 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","UpTo 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Over 3mm","UpTo 3mm"] },
    "Seat Back Cover nsr": { "Burn": ["Over 3mm","UpTo 3mm"], "Holed": ["Over 3mm","UpTo 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","UpTo 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Over 3mm","UpTo 3mm"] },
    "Seat Base Cover nsr": { "Burn": ["Over 3mm","UpTo 3mm"], "Holed": ["Over 3mm","UpTo 3mm"], "Missing": ["Replace"], "Scuffed": ["Over 25mm","UpTo 25mm"], "Soiled": ["Heavy","Light"], "Torn": ["Over 3mm","UpTo 3mm"] },
};

function Marker({ x, y, n, color = '#111' }: { x: number; y: number; n: number; color?: string }) {
    return (
        <g transform={`translate(${x} ${y})`}>
            <path d="M0,-16 C-9,-16 -16,-9 -16,0 C-16,9 0,24 0,24 C0,24 16,9 16,0 C16,-9 9,-16 0,-16Z" fill={color} opacity="0.95" />
            <circle cx="0" cy="-2" r="12" fill={color} />
            <text x="0" y="2" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">{n}</text>
        </g>
    );
}

const popupColStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 'min(280px, 86vw)' };
const popupBtnBase: React.CSSProperties = {
    background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '8px',
    padding: '10px 14px', cursor: 'pointer', textAlign: 'left', fontSize: '14px',
    transition: 'background 0.15s, border-color 0.15s',
};
const popupBtnActive: React.CSSProperties = { ...popupBtnBase, background: '#4D7CFF', color: '#fff', borderColor: '#4D7CFF' };

export default function InteriorMap({
    onPartSelect,
    faults = [],
    onFaultPointClick,
    onFaultPointDelete,
    onFaultUpdate,
    imageBase64 = null,
    mobileRotated = false,
}: InteriorMapProps) {
    const [showSubParts, setShowSubParts] = useState<string[] | null>(null);
    const [selectedSubPart, setSelectedSubPart] = useState<string | null>(null);
    const [showConditions, setShowConditions] = useState(false);
    const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
    const [selectedMainPart, setSelectedMainPart] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [pendingFault, setPendingFault] = useState<Partial<FaultPoint> | null>(null);
    const [clickedCoords, setClickedCoords] = useState<{ x: number; y: number } | null>(null);
    const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
    const [draggedFaultIndex, setDraggedFaultIndex] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    const [photo, setPhoto] = useState<File | null>(null);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const center = () => {
            el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
        };
        center();
        window.addEventListener('resize', center);
        return () => window.removeEventListener('resize', center);
    }, []);

    const resetAll = () => {
        setShowSubParts(null); setShowConditions(false); setSelectedCondition(null);
        setSelectedSubPart(null); setNote(''); setPendingFault(null);
        setClickedCoords(null); setSelectedSeverity(null); setSelectedSize(null); setPhoto(null);
    };

    const getSVGCoords = (event: React.MouseEvent<SVGElement>) => {
        const svg = (event.currentTarget as SVGElement).ownerSVGElement || event.currentTarget as SVGSVGElement;
        let clientX = event.clientX;
        let clientY = event.clientY;
        const ne = event.nativeEvent as MouseEvent & { changedTouches?: TouchList };
        if ((!clientX && !clientY) && ne.changedTouches?.length) {
            clientX = ne.changedTouches[0].clientX;
            clientY = ne.changedTouches[0].clientY;
        }
        const viewW = 1153;
        const viewH = 718;
        if (mobileRotated) {
            const rect = svg.getBoundingClientRect();
            const relX = clientX - rect.left;
            const relY = clientY - rect.top;
            return {
                x: (relY / rect.height) * viewW,
                y: ((rect.width - relX) / rect.width) * viewH,
            };
        }
        const ctm = (svg as SVGSVGElement).getScreenCTM();
        if (ctm) {
            const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
            return { x: pt.x, y: pt.y };
        }
        const rect = svg.getBoundingClientRect();
        return { x: ((clientX - rect.left) / rect.width) * viewW, y: ((clientY - rect.top) / rect.height) * viewH };
    };

    const subPartMap: Record<string, string[]> = {
        "steering wheel": ["Air Vents nsf","Air Vents osf","Centre Console Front","Dash Warning Lights","Fascia Panel","Fascia Trim","Glove Box Lid","In Car Entertainment","Steering Wheel","Switches And Controls"],
        "front right door panel": ["Door Pad osf","Handle Inner osf"],
        "back right back door": ["Door Pad osr","Handle Inner osr"],
        "right side rear": ["Qtr Panel Trim os"],
        "carpet front": ["Carpets Front"],
        "carpet front 2": ["Carpets Front"],
        "carpet rear": ["Carpets Rear"],
        "carpet rear 2": ["Carpets Rear"],
        "boot carpet": ["Jack","Load Area Carpet","Rear Panel Trim Int","Shelfload Cover Rear","Tools","Tyre Inflation Kit","Wheel Brace"],
        "iner tail": ["Tailgate Pad"],
        "iner roof": ["Roof Lining","Sunvisor ns","Sunvisor os"],
        "front left door panel": ["Door Pad nsf","Handle Inner nsf"],
        "back left door panel": ["Door Pad nsr","Handle Inner nsr"],
        "left side rear ": ["Qtr Panel Trim ns"],
        "head1": ["Headrest Assy nsf","Seat Back Cover nsf","Seat Base Cover nsf","Seat Belt nsf"],
        "head2": ["Headrest Assy osf","Seat Back Cover osf","Seat Base Cover osf","Seat Belt osf"],
        "head 3": ["Headrest Assy os","Seat Back Cover osr","Seat Base Cover osr","Seat Belt osr"],
        "head 4": ["Headrest Assy Rear Seat Centr","Headrest Assy Rear Seat ns","Seat Back Cover nsr","Seat Base Cover nsr","Seat Belt nsr","Seat Belt Rear Centre"],
    };

    const handleClick = (partName: string, event: React.MouseEvent<SVGElement>) => {
        const coords = getSVGCoords(event);
        setClickedCoords(coords);
        setSelectedMainPart(partName);

        if (subPartMap[partName]) {
            setShowSubParts(subPartMap[partName]);
        } else if (partsWithConditions.includes(partName)) {
            setSelectedSubPart(partName); setShowConditions(true);
        } else {
            onPartSelect({ part: partName, damage: '', detail: '', coords });
        }
    };

    const handleSubPartClick = (part: string) => {
        setSelectedSubPart(part); setShowConditions(partsWithConditions.includes(part));
    };

    const handleConditionSelect = (condition: string) => {
        setSelectedCondition(condition);
        setSelectedSeverity(null);
        setSelectedSize(null);
        if (!selectedSubPart) return;
        if (severityMap[selectedSubPart]?.[condition]) return;
        setPendingFault({ part: selectedSubPart, damage: condition, detail: '', coords: clickedCoords ?? undefined });
        setShowSubParts(null); setShowConditions(false); setSelectedSubPart(null); setSelectedMainPart(null); setClickedCoords(null);
    };

    const handleSeveritySelect = (severity: string) => {
        setSelectedSeverity(severity);
        if (interiorSizeMap[severity]) {
            setSelectedSize(null);
            return;
        }
        const auto = getInteriorAutoSizeFromLabel(severity);
        setPendingFault({
            part: selectedSubPart ?? '',
            damage: selectedCondition ?? '',
            detail: auto ? `${severity} (${auto})` : severity,
            coords: clickedCoords ?? undefined,
        });
        setShowSubParts(null);
        setShowConditions(false);
        setSelectedSubPart(null);
        setSelectedMainPart(null);
        setSelectedCondition(null);
        setSelectedSeverity(null);
        setClickedCoords(null);
    };

    const handleSizeSelect = (size: string) => {
        setPendingFault({
            part: selectedSubPart ?? '',
            damage: selectedCondition ?? '',
            detail: `${selectedSeverity ?? ''} - ${size}`,
            coords: clickedCoords ?? undefined,
        });
        setShowSubParts(null);
        setShowConditions(false);
        setSelectedSubPart(null);
        setSelectedMainPart(null);
        setSelectedCondition(null);
        setSelectedSeverity(null);
        setSelectedSize(null);
        setClickedCoords(null);
    };

    const handleFaultMouseDown = (index: number, event: React.MouseEvent) => {
        event.stopPropagation(); setDraggedFaultIndex(index); setDragStartPos({ x: event.clientX, y: event.clientY });
    };

    const handleFaultMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (draggedFaultIndex === null || !dragStartPos) return;
        if (Math.abs(event.clientX - dragStartPos.x) > 5 || Math.abs(event.clientY - dragStartPos.y) > 5) {
            setIsDragging(true);
            const ctm = event.currentTarget.getScreenCTM();
            if (ctm && onFaultUpdate) {
                const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
                onFaultUpdate(draggedFaultIndex, { x: pt.x, y: pt.y });
            }
        }
    };

    const handleFaultMouseUp = () => {
        if (draggedFaultIndex !== null && !isDragging) onFaultPointClick?.(draggedFaultIndex);
        setDraggedFaultIndex(null); setIsDragging(false); setDragStartPos(null);
    };

    const backdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const popupStyle: React.CSSProperties = {
        background: '#ffffff', borderRadius: '14px', padding: '28px 32px', display: 'flex', gap: '28px',
        minWidth: 'min(360px, 94vw)', maxWidth: 'min(960px, 96vw)', maxHeight: '85vh', overflow: 'auto',
        position: 'relative', border: '1px solid #e2e8f0', boxShadow: '0 20px 50px rgba(15, 23, 42, 0.12)',
    };

    const interiorSrc = imageBase64 ?? '/condition-report-interior.png';

    return (
        <>
            <div ref={wrapRef} style={{ position: 'relative', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                <svg viewBox="0 0 1153 718" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minWidth: 'min(100%, 1153px)' }}
                    onMouseMove={handleFaultMouseMove} onMouseUp={handleFaultMouseUp}>
                    <image href={interiorSrc} x="0" y="0" width="1153" height="718" />
                    <rect x="204" y="228" width="113" height="238" fill="transparent" onClick={(e) => handleClick("steering wheel", e)} style={{ cursor: "pointer" }} />
                    <polygon points="181,107 182,178 185,199 186,205 341,204 342,48 297,46 264,56 221,79" fill="transparent" onClick={(e) => handleClick("front right door panel", e)} style={{ cursor: "pointer" }} />
                    <polygon points="346,48 347,202 438,203 455,167 469,156 484,148 483,47" fill="transparent" onClick={(e) => handleClick("back right back door", e)} style={{ cursor: "pointer" }} />
                    <polygon points="491,47 489,148 518,152 534,162 543,171 549,174 586,174 635,174 635,49" fill="transparent" onClick={(e) => handleClick("right side rear", e)} style={{ cursor: "pointer" }} />
                    <polygon points="179,564 184,659 340,659 340,503 297,504 267,511" fill="transparent" onClick={(e) => handleClick("front left door panel", e)} style={{ cursor: "pointer" }} />
                    <polygon points="346,503 346,658 439,657 457,619 479,606 484,604 484,502" fill="transparent" onClick={(e) => handleClick("back left door panel", e)} style={{ cursor: "pointer" }} />
                    <polygon points="487,502 489,604 515,604 533,617 544,630 637,629 634,504" fill="transparent" onClick={(e) => handleClick("left side rear ", e)} style={{ cursor: "pointer" }} />
                    <rect x="355" y="247" width="186" height="95" fill="transparent" onClick={(e) => handleClick("carpet front", e)} style={{ cursor: "pointer" }} />
                    <rect x="354" y="347" width="185" height="102" fill="transparent" onClick={(e) => handleClick("carpet front 2", e)} style={{ cursor: "pointer" }} />
                    <rect x="544" y="248" width="152" height="94" fill="transparent" onClick={(e) => handleClick("carpet rear", e)} style={{ cursor: "pointer" }} />
                    <rect x="545" y="347" width="150" height="98" fill="transparent" onClick={(e) => handleClick("carpet rear 2", e)} style={{ cursor: "pointer" }} />
                    <rect x="699" y="248" width="106" height="199" fill="transparent" onClick={(e) => handleClick("boot carpet", e)} style={{ cursor: "pointer" }} />
                    <rect x="689" y="489" width="326" height="165" fill="transparent" onClick={(e) => handleClick("iner roof", e)} style={{ cursor: "pointer" }} />
                    <rect x="832" y="264" width="180" height="155" fill="transparent" onClick={(e) => handleClick("iner tail", e)} style={{ cursor: "pointer" }} />
                    <rect x="683" y="146" width="160" height="92" fill="transparent" onClick={(e) => handleClick("head1", e)} style={{ cursor: "pointer" }} />
                    <rect x="683" y="49" width="159" height="91" fill="transparent" onClick={(e) => handleClick("head2", e)} style={{ cursor: "pointer" }} />
                    <rect x="849" y="53" width="151" height="89" fill="transparent" onClick={(e) => handleClick("head 3", e)} style={{ cursor: "pointer" }} />
                    <rect x="849" y="145" width="147" height="90" fill="transparent" onClick={(e) => handleClick("head 4", e)} style={{ cursor: "pointer" }} />

                    {faults.map((f, i) => {
                        if (!f?.coords) return null;
                        return (
                            <g key={f.idx ?? i} onMouseDown={(e) => handleFaultMouseDown(i, e)} style={{ cursor: 'grab', pointerEvents: 'all' }}>
                                <Marker x={f.coords.x} y={f.coords.y} n={f.idx ?? (i + 1)} color={f.fromPrevious ? '#f97316' : '#111'} />
                                <g onClick={(e) => { e.stopPropagation(); onFaultPointDelete?.(i); }} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
                                    <rect x={f.coords.x + 10} y={f.coords.y - 24} width="16" height="16" rx="3" fill="#e11" />
                                    <text x={f.coords.x + 18} y={f.coords.y - 12} textAnchor="middle" fontSize="10" fill="#fff">×</text>
                                </g>
                            </g>
                        );
                    })}
                </svg>
            </div>

            {mounted && showSubParts && createPortal(
                <div style={backdropStyle} onClick={resetAll}>
                    <div style={popupStyle} onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={resetAll} aria-label="Close" style={{ position: 'absolute', top: 12, right: 14, background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
                        <div style={popupColStyle}>
                            <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Select Part</p>
                            {showSubParts.map(part => (
                                <button key={part} style={part === selectedSubPart ? popupBtnActive : popupBtnBase} onClick={() => handleSubPartClick(part)}>{part}</button>
                            ))}
                            <button type="button" onClick={() => { setPendingFault({ part: selectedMainPart ?? 'Custom', damage: 'Custom Modification', detail: '', coords: clickedCoords ?? undefined }); setShowSubParts(null); }} style={{ ...popupBtnBase, background: '#16a34a', color: '#fff', borderColor: '#16a34a', marginTop: 8 }}>➕ Any Modification</button>
                        </div>
                        {selectedSubPart && showConditions && conditionOptionsMap[selectedSubPart] && (
                            <div style={popupColStyle}>
                                <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Condition</p>
                                {conditionOptionsMap[selectedSubPart].map(cond => (
                                    <button key={cond} style={cond === selectedCondition ? popupBtnActive : popupBtnBase} onClick={() => handleConditionSelect(cond)}>{cond}</button>
                                ))}
                            </div>
                        )}
                        {selectedSubPart && selectedCondition && severityMap[selectedSubPart]?.[selectedCondition] && (
                            <div style={popupColStyle}>
                                <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Severity</p>
                                {severityMap[selectedSubPart][selectedCondition].map(sev => {
                                    const auto = getInteriorAutoSizeFromLabel(sev);
                                    const label = auto ? `${sev} (${auto})` : sev;
                                    return (
                                        <button key={sev} style={sev === selectedSeverity ? popupBtnActive : popupBtnBase} onClick={() => handleSeveritySelect(sev)}>{label}</button>
                                    );
                                })}
                            </div>
                        )}
                        {selectedSubPart && selectedCondition && selectedSeverity && interiorSizeMap[selectedSeverity] && (
                            <div style={popupColStyle}>
                                <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Size</p>
                                {interiorSizeMap[selectedSeverity].map(size => (
                                    <button key={size} style={size === selectedSize ? popupBtnActive : popupBtnBase} onClick={() => handleSizeSelect(size)}>{size}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {mounted && pendingFault && createPortal(
                <div style={{ ...backdropStyle, zIndex: 10000 }} onClick={() => { setPendingFault(null); setNote(''); setPhoto(null); }}>
                    <div style={{ background: '#ffffff', borderRadius: 12, padding: 28, width: 'min(420px, 94vw)', maxWidth: '100%', position: 'relative', border: '1px solid #e2e8f0', boxShadow: '0 20px 50px rgba(15, 23, 42, 0.12)' }} onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => { setPendingFault(null); setNote(''); setPhoto(null); }} aria-label="Close" style={{ position: 'absolute', top: 10, right: 12, background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
                        <p style={{ color: '#1e293b', fontWeight: 600, marginBottom: 16 }}>📍 {pendingFault.part}</p>
                        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>{pendingFault.damage}{pendingFault.detail ? ` — ${pendingFault.detail}` : ''}</p>
                        <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 6 }}>Photo (optional)</label>
                        <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] ?? null)} style={{ color: '#334155', marginBottom: 14, display: 'block', fontSize: 12 }} />
                        <label style={{ color: '#64748b', fontSize: 12, display: 'block', marginBottom: 6 }}>Note (optional)</label>
                        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Add note..." style={{ width: '100%', background: '#ffffff', color: '#334155', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'none', marginBottom: 16 }} />
                        <button
                            type="button"
                            onClick={async () => {
                                let photoUrl: string | undefined;
                                if (photo) {
                                    try { photoUrl = await fileToDataUrl(photo); } catch { /* ignore */ }
                                }
                                onPartSelect({ ...pendingFault, photoUrl, note });
                                setPendingFault(null);
                                setNote('');
                                setPhoto(null);
                            }}
                            style={{ width: '100%', background: '#4D7CFF', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                        >
                            Save Fault
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
