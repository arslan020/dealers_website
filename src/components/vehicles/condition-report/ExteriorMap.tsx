'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fileToDataUrl } from '@/lib/fileToDataUrl';

export interface FaultPoint {
    idx: number;
    part: string;
    damage: string;
    detail: string;
    note: string;
    coords: { x: number; y: number };
    sectionId?: string;
    photoUrl?: string;
    fromPrevious?: boolean;
}

interface ExteriorMapProps {
    onPartSelect: (fault: Partial<FaultPoint>) => void;
    faults?: FaultPoint[];
    onFaultPointClick?: (index: number) => void;
    onFaultPointDelete?: (index: number) => void;
    onFaultUpdate?: (index: number, coords: { x: number; y: number }) => void;
    /** Override diagram image (data URL or path), same as appraisal `imageBase64` */
    imageBase64?: string | null;
    /** 90° rotated mobile layout — coordinate mapping matches appraisal website */
    mobileRotated?: boolean;
}

const sizeMap: Record<string, string[]> = {
    'Edge Chiped': ['Small', 'Medium', 'Large'],
    'Multiple Chips': ['Small', 'Medium', 'Large'],
    'With Paint Damage': ['Small', 'Medium', 'Large'],
    'Holed': ['Small', 'Medium', 'Large'],
    'Rusted': ['Small', 'Medium', 'Large'],
    'Paint Flake': ['Small', 'Medium', 'Large'],
    'Poor Colour': ['Small', 'Medium', 'Large'],
    'Poor Paint': ['Small', 'Medium', 'Large'],
    'Edge Chip': ['Small', 'Medium', 'Large'],
};

function getAutoSizeFromLabel(label: string): string | null {
    const s = label.trim();
    if (s === '1 To 5') return 'Small';
    if (s.includes('Over 5mm')) return 'Small';
    if (s.includes('UpTo 10mm')) return 'Small';
    if (s.includes('Over 10mm')) return 'Medium';
    if (s === '2 Or Less UpTo 10mm') return 'Small';
    if (s === 'Over 2 UpTo 10mm') return 'Small';
    if (s === 'Between 10mm + 30mm') return 'Medium';
    if (s === 'Over 30mm') return 'Large';
    if (s === 'Over 30% Of Panel') return 'Large';
    if (s === 'With Paint Damage') return 'Large';
    if (s === 'UpTo 25mm Not Thru Paint') return 'Medium';
    if (s === 'UpTo 25mm Thru Paint') return 'Medium';
    if (s === 'Over 25mm Not Thru Paint') return 'Large';
    if (s === 'Over 25mm Thru Paint') return 'Large';
    if (s === '25 to 100mm Thru Paint') return 'Large';
    if (s === 'Over 100mm Thru Paint') return 'Large';
    if (s === 'UpTo 30mm') return 'Large';
    if (s === 'UpTo 100mm') return 'Large';
    if (s === 'Over 100mm') return 'Large';
    if (s === 'UpTo 5mm') return 'Small';
    if (s === 'UpTo 25mm') return 'Medium';
    if (s === 'Over 25mm') return 'Medium';
    if (s === 'UpTo 30mm (Alloy)') return 'Large';
    if (s === 'UpTo 30mm (Steel)') return 'Large';
    if (s === 'Over 30mm (Alloy)') return 'Large';
    if (s === 'Over 30mm (Steel)') return 'Large';
    if (s === 'UpTo 50mm') return 'Large';
    if (s === 'Over 50mm') return 'Large';
    if (s === '5-10mm') return 'Medium';
    if (s === '10-20mm') return 'Medium';
    if (s === 'Over 20mm') return 'Large';
    return null;
}

const frontBumperCategories: Record<string, string[]> = {
    'GRILLS/MOULDINGS': ['Bumper Front Grill', 'Bumper Front Moulding'],
    'LIGHTS': ['Headlamp ns', 'Headlamp os', 'Fogdriving Lamp nsf', 'Fogdriving Lamp osf', 'Fog Lamp Surround ns', 'Fog Lamp Surround os', 'Headlamp Washer ns', 'Headlamp Washer os'],
    'BUMPER DAMAGE': ['Bumper Front', 'Panel Front'],
    'ALIGNMENT': ['Number Plate Front', 'Front TowEye Cvr', 'Parking Sensor Front', 'Bumper Alignment Front', 'Bumper Height Front', 'Bumper Fitment Front'],
};

const backBumperCategories: Record<string, string[]> = {
    'REAR LIGHTS': ['Fog Lamp nsr', 'Fog Lamp osr', 'Lamp nsr', 'Lamp osr', 'Number Plate Lamp', 'Bumper Reflector nsr', 'Bumper Reflector osr', 'Reflector nsr', 'Reflector osr'],
    'BUMPER DAMAGE': ['Bumper Rear', 'Panel Rear'],
    'MOULDINGS': ['Bumper Rear Moulding'],
    'ALIGNMENT': ['Number Plate Rear', 'Parking Sensor Rear', 'Rear TowEye Cvr', 'Exhaust', 'Bumper Alignment Rear', 'Bumper Height Rear', 'Bumper Fitment Rear'],
};

const partsWithConditions = [
    'Screen Front','Badgedecal Front','Bonnet','Bumper Front','Bumper Front Grill','Bumper Front Moulding',
    'Fog Lamp Surround ns','Fog Lamp Surround os','Fogdriving Lamp nsf','Fogdriving Lamp osf','Front TowEye Cvr',
    'Headlamp ns','Headlamp os','Headlamp Washer ns','Headlamp Washer os','Number Plate Front','Panel Front',
    'Parking Sensor Front','Roof','Aerial','Glass Roof','Sunroof','Wiper nsf','Wiper osf','Bumper Rear',
    'Bumper Rear Moulding','Bumper Reflector nsr','Bumper Reflector osr','Exhaust','Fog Lamp nsr','Fog Lamp osr',
    'Lamp nsr','Lamp osr','Number Plate Lamp','Number Plate Rear','Panel Rear','Parking Sensor Rear',
    'Rear TowEye Cvr','Reflector nsr','Reflector osr','Badgedecal Rear','Moulding Tailgate','Spoiler Rear',
    'Tailgate','Tailgate Aperture Seal','Tailgate Glass','Tailgate Trim Panel','Wiper Rear','A Post ns',
    'Aperture Seal nsf','B Post ns','Door Lock nsf','Door Mirror Assy nsf','Door Mirror Glass ns',
    'Door Moulding nsf','Door nsf','Door Qtr Light nsf','Door Window nsf','Handle Outer nsf','Aperture Seal nsr',
    'C Post ns','D Post ns','Door Moulding nsr','Door nsr','Door Qtr Light nsr','Door Window nsr',
    'Handle Outer nsr','Fuel Flap','Qtr Panel Arch Extension ns','Qtr Panel Moulding ns','Qtr Panel nsr',
    'Qtr Panel Window ns','Flasher Side Repeater ns','Moulding nsf Wing','Wing Front Arch Extension ns',
    'Wing nsf','Tyre nsf','Wheel nsf','Wheel Trim nsf','Tyre nsr','Wheel nsr','Wheel Trim nsr',
    'EV Charging Port','Spare Tyre','Spare Wheel','A Post os','Aperture Seal osf','B Post os',
    'Door Lock osf','Door Mirror Assy osf','Door Mirror Glass os','Door Moulding osf','Door osf',
    'Door Qtr Light osf','Door Window osf','Handle Outer osf','Aperture Seal osr','C Post os','D Post os',
    'Door Moulding osr','Door osr','Door Qtr Light osr','Door Window osr','Handle Outer osr',
    'Tyre osf','Wheel osf','Wheel Trim osf','Tyre osr','Wheel osr','Wheel Trim osr',
    'Qtr Panel Arch Extension os','Qtr Panel Moulding os','Qtr Panel osr','Qtr Panel Window os',
    'Flasher Side Repeater os','Moulding osf Wing','Wing Front Arch Extension os','Wing osf',
    'Front Windshield Side Frame','Bumper Alignment Front','Bumper Height Front','Bumper Fitment Front',
    'Bumper Alignment Rear','Bumper Height Rear','Bumper Fitment Rear',
];

const conditionOptionsMap: Record<string, string[]> = {
    'Screen Front': ['Chipped', 'Cracked', 'Missing', 'Scratched'],
    'Badgedecal Front': ['Broken', 'Missing'],
    'Bonnet': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Bumper Front': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Insecure', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Bumper Front Grill': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Bumper Front Moulding': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Fog Lamp Surround ns': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Fog Lamp Surround os': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Fogdriving Lamp nsf': ['Broken', 'Missing'],
    'Fogdriving Lamp osf': ['Broken', 'Missing'],
    'Front TowEye Cvr': ['Broken', 'Missing'],
    'Headlamp ns': ['Broken', 'Missing'],
    'Headlamp os': ['Broken', 'Missing'],
    'Headlamp Washer ns': ['Broken', 'Missing'],
    'Headlamp Washer os': ['Broken', 'Missing'],
    'Number Plate Front': ['Broken', 'Missing'],
    'Panel Front': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Parking Sensor Front': ['Broken', 'Missing'],
    'Roof': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Aerial': ['Broken', 'Missing'],
    'Glass Roof': ['Broken', 'Missing'],
    'Sunroof': ['Chipped', 'Cracked', 'Missing', 'Scratched'],
    'Wiper nsf': ['Broken', 'Missing'],
    'Wiper osf': ['Broken', 'Missing'],
    'Bumper Rear': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Insecure', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Bumper Rear Moulding': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Bumper Reflector nsr': ['Broken', 'Missing'],
    'Bumper Reflector osr': ['Broken', 'Missing'],
    'Exhaust': ['Broken', 'Missing'],
    'Fog Lamp nsr': ['Broken', 'Missing'],
    'Fog Lamp osr': ['Broken', 'Missing'],
    'Lamp nsr': ['Broken', 'Missing'],
    'Lamp osr': ['Broken', 'Missing'],
    'Number Plate Lamp': ['Broken', 'Missing'],
    'Number Plate Rear': ['Broken', 'Missing'],
    'Panel Rear': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Parking Sensor Rear': ['Broken', 'Missing'],
    'Rear TowEye Cvr': ['Broken', 'Missing'],
    'Reflector nsr': ['Broken', 'Missing'],
    'Reflector osr': ['Broken', 'Missing'],
    'Badgedecal Rear': ['Broken', 'Missing'],
    'Moulding Tailgate': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Spoiler Rear': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Tailgate': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Tailgate Aperture Seal': ['Broken', 'Missing'],
    'Tailgate Glass': ['Chipped', 'Cracked', 'Missing', 'Scratched'],
    'Tailgate Trim Panel': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Wiper Rear': ['Broken', 'Missing'],
    'A Post ns': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Aperture Seal nsf': ['Broken', 'Missing'],
    'B Post ns': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Door Lock nsf': ['Broken', 'Missing'],
    'Door Mirror Assy nsf': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Door Mirror Glass ns': ['Broken', 'Missing'],
    'Door Moulding nsf': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Door nsf': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Door Qtr Light nsf': ['Chipped', 'Cracked', 'Missing', 'Scratched'],
    'Door Window nsf': ['Chipped', 'Cracked', 'Missing', 'Scratched'],
    'Handle Outer nsf': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Aperture Seal nsr': ['Broken', 'Missing'],
    'C Post ns': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'D Post ns': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Door Moulding nsr': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Door nsr': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Door Qtr Light nsr': ['Chipped', 'Cracked', 'Missing', 'Scratched'],
    'Door Window nsr': ['Chipped', 'Cracked', 'Missing', 'Scratched'],
    'Handle Outer nsr': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Fuel Flap': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Qtr Panel Arch Extension ns': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Qtr Panel Moulding ns': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Qtr Panel nsr': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Qtr Panel Window ns': ['Chipped', 'Cracked', 'Missing', 'Scratched'],
    'Flasher Side Repeater ns': ['Broken', 'Missing'],
    'Moulding nsf Wing': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Wing Front Arch Extension ns': ['Broken', 'Missing', 'Scratched (Painted)', 'Scuffed (Unpainted)'],
    'Wing nsf': ['Chipped', 'Cracked', 'Dented', 'Hole', 'Missing', 'Poor Previous Repair', 'Rusted', 'Scratched'],
    'Tyre nsf': ['1.6mm','2mm','3mm','4mm','5mm','6mm','7mm','8mm','Damaged','Less Than 1.6mm','Missing','Punctured','Worn'],
    'Wheel nsf': ['Corroded','Damaged','Dented','Missing','Scratched','Punctured','Worn'],
    'Wheel Trim nsf': ['Broken','Missing','Scratched'],
    'Tyre nsr': ['1.6mm','2mm','3mm','4mm','5mm','6mm','7mm','8mm','Damaged','Less Than 1.6mm','Missing','Punctured','Worn'],
    'Wheel nsr': ['Corroded','Damaged','Dented','Missing','Scratched'],
    'Wheel Trim nsr': ['Broken','Missing','Scratched'],
    'EV Charging Port': ['Broken','Missing'],
    'Spare Tyre': ['1.6mm','2mm','3mm','4mm','5mm','6mm','7mm','8mm','Damaged','Less Than 1.6mm','Missing'],
    'Spare Wheel': ['Corroded','Damaged','Dented','Missing','Scratched'],
    'A Post os': ['Chipped','Cracked','Dented','Hole','Missing','Poor Previous Repair','Rusted','Scratched'],
    'Aperture Seal osf': ['Broken','Missing'],
    'B Post os': ['Chipped','Cracked','Dented','Hole','Missing','Poor Previous Repair','Rusted','Scratched'],
    'Door Lock osf': ['Broken','Missing'],
    'Door Mirror Assy osf': ['Broken','Missing','Scratched (Painted)','Scuffed (Unpainted)'],
    'Door Mirror Glass os': ['Broken','Missing'],
    'Door Moulding osf': ['Broken','Missing','Scratched (Painted)','Scuffed (Unpainted)'],
    'Door osf': ['Chipped','Cracked','Dented','Hole','Missing','Poor Previous Repair','Rusted','Scratched'],
    'Door Qtr Light osf': ['Chipped','Cracked','Missing','Scratched'],
    'Door Window osf': ['Chipped','Cracked','Missing','Scratched'],
    'Handle Outer osf': ['Broken','Missing'],
    'Aperture Seal osr': ['Broken','Missing'],
    'C Post os': ['Chipped','Cracked','Dented','Hole','Missing','Poor Previous Repair','Rusted','Scratched'],
    'D Post os': ['Chipped','Cracked','Dented','Hole','Missing','Poor Previous Repair','Rusted','Scratched'],
    'Door Moulding osr': ['Broken','Missing','Scratched (Painted)','Scuffed (Unpainted)'],
    'Door osr': ['Chipped','Cracked','Dented','Hole','Missing','Poor Previous Repair','Rusted','Scratched'],
    'Door Qtr Light osr': ['Chipped','Cracked','Missing','Scratched'],
    'Door Window osr': ['Chipped','Cracked','Missing','Scratched'],
    'Handle Outer osr': ['Chipped','Cracked','Missing','Scratched'],
    'Tyre osf': ['1.6mm','2mm','3mm','4mm','5mm','6mm','7mm','8mm','Damaged','Less Than 1.6mm','Missing','Punctured','Worn'],
    'Wheel osf': ['Corroded','Damaged','Dented','Missing','Scratched','Punctured','Worn'],
    'Wheel Trim osf': ['Broken','Missing','Scratched'],
    'Tyre osr': ['1.6mm','2mm','3mm','4mm','5mm','6mm','7mm','8mm','Damaged','Less Than 1.6mm','Missing','Punctured','Worn'],
    'Wheel osr': ['Corroded','Damaged','Dented','Missing','Scratched'],
    'Wheel Trim osr': ['Broken','Missing','Scratched'],
    'Qtr Panel Arch Extension os': ['Broken','Missing','Scratched (Painted)','Scuffed (Unpainted)'],
    'Qtr Panel Moulding os': ['Broken','Missing','Scratched (Painted)','Scuffed (Unpainted)'],
    'Qtr Panel osr': ['Chipped','Cracked','Dented','Hole','Missing','Poor Previous Repair','Rusted','Scratched'],
    'Qtr Panel Window os': ['Chipped','Cracked','Missing','Scratched'],
    'Flasher Side Repeater os': ['Broken','Missing'],
    'Moulding osf Wing': ['Broken','Missing','Scratched (Painted)','Scuffed (Unpainted)'],
    'Wing Front Arch Extension os': ['Broken','Missing','Scratched (Painted)','Scuffed (Unpainted)'],
    'Wing osf': ['Chipped','Cracked','Dented','Hole','Missing','Poor Previous Repair','Rusted','Scratched'],
    'Front Windshield Side Frame': ['Broken','Missing'],
    'Bumper Alignment Front': ['Misaligned','Gap Too Large','Uneven'],
    'Bumper Height Front': ['Too High','Too Low','Uneven'],
    'Bumper Fitment Front': ['Loose','Not Flush','Protruding'],
    'Bumper Alignment Rear': ['Misaligned','Gap Too Large','Uneven'],
    'Bumper Height Rear': ['Too High','Too Low','Uneven'],
    'Bumper Fitment Rear': ['Loose','Not Flush','Protruding'],
};

const severityMap: Record<string, Record<string, string[]>> = {
    'Screen Front': { 'Chipped': ['Over 10mm','UpTo 10mm'], 'Cracked': ['Replace'], 'Missing': ['Replace'], 'Scratched': ['Over 30mm','UpTo 30mm'] },
    'Bonnet': { 'Chipped': ['1 To 5','Edge Chip','Multiple Chips','Over 5mm'], 'Cracked': ['Replace'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 10mm','UpTo 10mm'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 5mm','UpTo 5mm'], 'Scratched': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','Rusted','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Bumper Front': { 'Chipped': ['1 To 5','Multiple Chips','Over 5mm'], 'Cracked': ['Over 25mm','UpTo 25mm'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 25mm','UpTo 25mm'], 'Insecure': ['Action Required'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 5mm','UpTo 5mm'], 'Scratched': ['25 to 100mm Thru Paint','Over 100mm Thru Paint','Over 25mm Not Thru Paint','Rusted','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Bumper Front Grill': { 'Broken': ['Replace'], 'Missing': ['Replace'], 'Scratched (Painted)': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'], 'Scuffed (Unpainted)': ['Over 100mm','UpTo 100mm'] },
    'Roof': { 'Chipped': ['1 To 5','Edge Chip','Multiple Chips','Over 5mm'], 'Cracked': ['Replace'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 10mm','UpTo 10mm'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 5mm','UpTo 5mm'], 'Scratched': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','Rusted','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Bumper Rear': { 'Chipped': ['1 To 5','Multiple Chips','Over 5mm'], 'Cracked': ['Over 25mm','UpTo 25mm'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 25mm','UpTo 25mm'], 'Insecure': ['Action Required'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 25mm','UpTo 25mm'], 'Scratched': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','Rusted','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Tailgate': { 'Chipped': ['1 To 5','Edge Chip','Multiple Chips','Over 5mm'], 'Cracked': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 10mm','UpTo 10mm'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 5mm','UpTo 5mm'], 'Scratched': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','Rusted','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Door nsf': { 'Chipped': ['1 To 5','Edge Chip','Multiple Chips','Over 5mm'], 'Cracked': ['Replace'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 10mm','UpTo 10mm'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 5mm','UpTo 5mm'], 'Scratched': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','Rusted','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Door nsr': { 'Chipped': ['1 To 5','Edge Chip','Multiple Chips','Over 5mm'], 'Cracked': ['Replace'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 10mm','UpTo 10mm'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 5mm','UpTo 5mm'], 'Scratched': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','Rusted','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Door osf': { 'Chipped': ['1 To 5','Edge Chip','Multiple Chips','Over 5mm'], 'Cracked': ['Replace'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 10mm','UpTo 10mm'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 5mm','UpTo 5mm'], 'Scratched': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','Rusted','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Door osr': { 'Chipped': ['1 To 5','Edge Chip','Multiple Chips','Over 5mm'], 'Cracked': ['Replace'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 10mm','UpTo 10mm'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 5mm','UpTo 5mm'], 'Scratched': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','Rusted','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Wing nsf': { 'Chipped': ['1 To 5','Edge Chip','Multiple Chips','Over 5mm'], 'Cracked': ['Replace'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 10mm','UpTo 10mm'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 5mm','UpTo 5mm'], 'Scratched': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Wing osf': { 'Chipped': ['1 To 5','Edge Chip','Multiple Chips','Over 5mm'], 'Cracked': ['Replace'], 'Dented': ['2 Or Less UpTo 10mm','Between 10mm + 30mm','Over 2 UpTo 10mm','Over 30% Of Panel','Over 30mm','With Paint Damage'], 'Hole': ['Over 10mm','UpTo 10mm'], 'Missing': ['Replace'], 'Poor Previous Repair': ['Paint Flake','Poor Colour','Poor Paint','Rippled Over 30%','Rippled UpTo 30%'], 'Rusted': ['Holed','Over 5mm','UpTo 5mm'], 'Scratched': ['Over 25mm Not Thru Paint','Over 25mm Thru Paint','UpTo 25mm Not Thru Paint','UpTo 25mm Thru Paint'] },
    'Tyre nsf': { '1.6mm': ['Legal'], '2mm': ['Legal'], '3mm': ['Legal'], '4mm': ['Legal'], '5mm': ['Legal'], '6mm': ['Legal'], '7mm': ['Legal'], '8mm': ['Legal'], 'Damaged': ['Replace'], 'Less Than 1.6mm': ['Ilegal'], 'Missing': ['Replace'], 'Punctured': ['Replace'], 'Worn': ['Replace'] },
    'Wheel nsf': { 'Corroded': ['Light'], 'Damaged': ['Replace'], 'Dented': ['Over 30mm (Alloy)','Over 30mm (Steel)','UpTo 30mm (Alloy)','UpTo 30mm (Steel)'], 'Missing': ['Replace'], 'Scratched': ['Over 50mm','UpTo 50mm'] },
    'Tyre osf': { '1.6mm': ['Legal'], '2mm': ['Legal'], '3mm': ['Legal'], '4mm': ['Legal'], '5mm': ['Legal'], '6mm': ['Legal'], '7mm': ['Legal'], '8mm': ['Legal'], 'Damaged': ['Replace'], 'Less Than 1.6mm': ['Ilegal'], 'Missing': ['Replace'], 'Punctured': ['Replace'], 'Worn': ['Replace'] },
    'Wheel osf': { 'Corroded': ['Light'], 'Damaged': ['Replace'], 'Dented': ['Over 30mm (Alloy)','Over 30mm (Steel)','UpTo 30mm (Alloy)','UpTo 30mm (Steel)'], 'Missing': ['Replace'], 'Scratched': ['Over 50mm','UpTo 50mm'] },
    'Tyre nsr': { '1.6mm': ['Legal'], '2mm': ['Legal'], '3mm': ['Legal'], '4mm': ['Legal'], '5mm': ['Legal'], '6mm': ['Legal'], '7mm': ['Legal'], '8mm': ['Legal'], 'Damaged': ['Replace'], 'Less Than 1.6mm': ['Ilegal'], 'Missing': ['Replace'], 'Punctured': ['Replace'], 'Worn': ['Replace'] },
    'Wheel nsr': { 'Corroded': ['Light'], 'Damaged': ['Replace'], 'Dented': ['Over 30mm (Alloy)','Over 30mm (Steel)','UpTo 30mm (Alloy)','UpTo 30mm (Steel)'], 'Missing': ['Replace'], 'Scratched': ['Over 50mm','UpTo 50mm'] },
    'Tyre osr': { '1.6mm': ['Legal'], '2mm': ['Legal'], '3mm': ['Legal'], '4mm': ['Legal'], '5mm': ['Legal'], '6mm': ['Legal'], '7mm': ['Legal'], '8mm': ['Legal'], 'Damaged': ['Replace'], 'Less Than 1.6mm': ['Ilegal'], 'Missing': ['Replace'], 'Punctured': ['Replace'], 'Worn': ['Replace'] },
    'Wheel osr': { 'Corroded': ['Light'], 'Damaged': ['Replace'], 'Dented': ['Over 30mm (Alloy)','Over 30mm (Steel)','UpTo 30mm (Alloy)','UpTo 30mm (Steel)'], 'Missing': ['Replace'], 'Scratched': ['Over 50mm','UpTo 50mm'] },
    'Bumper Alignment Front': { 'Misaligned': ['Minor','Moderate','Severe'], 'Gap Too Large': ['5-10mm','10-20mm','Over 20mm'], 'Uneven': ['One Side','Both Sides','Multiple Points'] },
    'Bumper Height Front': { 'Too High': ['Slight','Noticeable','Excessive'], 'Too Low': ['Slight','Noticeable','Excessive'], 'Uneven': ['Left Side','Right Side','Both Sides'] },
    'Bumper Fitment Front': { 'Loose': ['Slightly Loose','Very Loose','Detaching'], 'Not Flush': ['Minor Gap','Visible Gap','Large Gap'], 'Protruding': ['Slight','Moderate','Severe'] },
    'Bumper Alignment Rear': { 'Misaligned': ['Minor','Moderate','Severe'], 'Gap Too Large': ['5-10mm','10-20mm','Over 20mm'], 'Uneven': ['One Side','Both Sides','Multiple Points'] },
    'Bumper Height Rear': { 'Too High': ['Slight','Noticeable','Excessive'], 'Too Low': ['Slight','Noticeable','Excessive'], 'Uneven': ['Left Side','Right Side','Both Sides'] },
    'Bumper Fitment Rear': { 'Loose': ['Slightly Loose','Very Loose','Detaching'], 'Not Flush': ['Minor Gap','Visible Gap','Large Gap'], 'Protruding': ['Slight','Moderate','Severe'] },
};

export function ExteriorFaultMarker({ x, y, n, color = '#111' }: { x: number; y: number; n: number; color?: string }) {
    return (
        <g transform={`translate(${x} ${y})`}>
            <path d="M0,-16 C-9,-16 -16,-9 -16,0 C-16,9 0,24 0,24 C0,24 16,9 16,0 C16,-9 9,-16 0,-16Z" fill={color} opacity="0.95" />
            <circle cx="0" cy="-2" r="12" fill={color} />
            <text x="0" y="2" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">{n}</text>
        </g>
    );
}

const popupColStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 'min(280px, 86vw)',
};
/** Light panels — same family as Condition Report / AutoDesk (not dark appraisal-style) */
const popupBtnBase: React.CSSProperties = {
    background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '8px',
    padding: '10px 14px', cursor: 'pointer', textAlign: 'left', fontSize: '14px',
    transition: 'background 0.15s, border-color 0.15s',
};
const popupBtnActive: React.CSSProperties = {
    ...popupBtnBase, background: '#4D7CFF', color: '#fff', borderColor: '#4D7CFF',
};

export default function ExteriorMap({
    onPartSelect,
    faults = [],
    onFaultPointClick,
    onFaultPointDelete,
    onFaultUpdate,
    imageBase64 = null,
    mobileRotated = false,
}: ExteriorMapProps) {
    const [showSubParts, setShowSubParts] = useState<string[] | null>(null);
    const [selectedSubPart, setSelectedSubPart] = useState<string | null>(null);
    const [showConditions, setShowConditions] = useState(false);
    const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
    const [selectedMainPart, setSelectedMainPart] = useState<string | null>(null);
    const [photo, setPhoto] = useState<File | null>(null);
    const [note, setNote] = useState('');
    const [pendingFault, setPendingFault] = useState<Partial<FaultPoint> | null>(null);
    const [clickedCoords, setClickedCoords] = useState<{ x: number; y: number } | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [draggedFaultIndex, setDraggedFaultIndex] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
    const [mounted, setMounted] = useState(false);
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
        setSelectedSubPart(null); setPhoto(null); setNote(''); setPendingFault(null);
        setClickedCoords(null); setSelectedCategory(null); setSelectedSeverity(null); setSelectedSize(null);
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
        const viewW = 1332;
        const viewH = 733;
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

    const handleClick = (partName: string, event: React.MouseEvent<SVGElement>) => {
        setSelectedMainPart(partName);
        setPhoto(null); setNote('');
        const coords = getSVGCoords(event);
        setClickedCoords(coords);

        const subPartMap: Record<string, string[]> = {
            'Bonnet': ['Badgedecal Front', 'Bonnet'],
            'Boot': ['Badgedecal Rear','Moulding Tailgate','Spoiler Rear','Tailgate','Tailgate Aperture Seal','Tailgate Glass','Tailgate Trim Panel','Wiper Rear'],
            'Left Front Door': ['A Post ns','Aperture Seal nsf','B Post ns','Door Lock nsf','Door Mirror Assy nsf','Door Mirror Glass ns','Door Moulding nsf','Door nsf','Door Qtr Light nsf','Door Window nsf','Handle Outer nsf'],
            'Left Back Door': ['Aperture Seal nsr','C Post ns','D Post ns','Door Moulding nsr','Door nsr','Door Qtr Light nsr','Door Window nsr','Handle Outer nsr'],
            'Front Left Fender / Wing': ['Flasher Side Repeater ns','Moulding nsf Wing','Wing Front Arch Extension ns','Wing nsf'],
            'Front Right Fender / Wing': ['Flasher Side Repeater os','Moulding osf Wing','Wing Front Arch Extension os','Wing osf'],
            'Fuel Cap Panel Left': ['Fuel Flap','Qtr Panel Arch Extension ns','Qtr Panel Moulding ns','Qtr Panel nsr','Qtr Panel Window ns'],
            'Fuel Cap Panel Right': ['Fuel Flap','Qtr Panel Arch Extension os','Qtr Panel Moulding os','Qtr Panel osr','Qtr Panel Window os'],
            'Glass/Sun Roof': ['Aerial','Glass Roof','Sunroof'],
            'Front mirror': ['Screen Front','Wiper nsf','Wiper osf'],
            'Front Left Tyre': ['Tyre nsf','Wheel nsf','Wheel Trim nsf'],
            'Back Left tyre': ['Tyre nsr','Wheel nsr','Wheel Trim nsr'],
            'Spare tyre': ['EV Charging Port','Spare Tyre','Spare Wheel'],
            'Front Right Door Panel': ['A Post os','Aperture Seal osf','B Post os','Door Lock osf','Door Mirror Assy osf','Door Mirror Glass os','Door Moulding osf','Door osf','Door Qtr Light osf','Door Window osf','Handle Outer osf'],
            'Back Right Door Panel': ['Aperture Seal osr','C Post os','D Post os','Door Moulding osr','Door osr','Door Qtr Light osr','Door Window osr','Handle Outer osr'],
            'Front Right tyre': ['Tyre osf','Wheel osf','Wheel Trim osf'],
            'Back Right tyre': ['Tyre osr','Wheel osr','Wheel Trim osr'],
            'Front Bumper Corner (Right Side)': ['Bumper Front'],
            'Front Bumper Corner (Left Side)': ['Bumper Front'],
            'Back Bumper Corner (Right Side)': ['Bumper Rear'],
            'Back Bumper Corner (Left Side)': ['Bumper Rear'],
        };

        if (partName === 'Front Bumper') {
            setShowSubParts(Object.keys(frontBumperCategories));
            setSelectedCategory(null);
        } else if (partName === 'Back Bumper') {
            setShowSubParts(Object.keys(backBumperCategories));
            setSelectedCategory(null);
        } else if (subPartMap[partName]) {
            setShowSubParts(subPartMap[partName]);
        } else if (partsWithConditions.includes(partName)) {
            setSelectedSubPart(partName);
            setShowConditions(true);
            setShowSubParts([partName]);
        } else {
            onPartSelect({ part: partName, damage: '', detail: '', coords });
            setShowSubParts(null); setShowConditions(false); setSelectedSubPart(null); setSelectedMainPart(null);
        }
    };

    const handleSubPartClick = (subPart: string) => {
        if (selectedMainPart === 'Front Bumper' && frontBumperCategories[subPart]) {
            setSelectedCategory(subPart); setShowSubParts(frontBumperCategories[subPart]); return;
        }
        if (selectedMainPart === 'Back Bumper' && backBumperCategories[subPart]) {
            setSelectedCategory(subPart); setShowSubParts(backBumperCategories[subPart]); return;
        }
        setSelectedSubPart(subPart); setPhoto(null); setNote('');
        if (partsWithConditions.includes(subPart)) {
            setShowConditions(true);
        } else {
            onPartSelect({ part: subPart, damage: '', detail: '', coords: clickedCoords ?? undefined });
            resetAll();
        }
    };

    const handleConditionSelect = (condition: string) => {
        setSelectedCondition(condition); setSelectedSeverity(null); setSelectedSize(null);
        setPhoto(null); setNote('');
        if (selectedSubPart && severityMap[selectedSubPart]?.[condition]) return;
        if (selectedSubPart) {
            setPendingFault({ part: selectedSubPart, damage: condition, detail: '', coords: clickedCoords ?? undefined });
            setShowSubParts(null); setShowConditions(false); setSelectedSubPart(null); setSelectedMainPart(null); setSelectedCondition(null); setClickedCoords(null);
        }
    };

    const handleSeveritySelect = (severity: string) => {
        setSelectedSeverity(severity);
        if (sizeMap[severity]) { setSelectedSize(null); return; }
        const autoSize = getAutoSizeFromLabel(severity);
        setPendingFault({ part: selectedSubPart ?? '', damage: selectedCondition ?? '', detail: autoSize ? `${severity} (${autoSize})` : severity, coords: clickedCoords ?? undefined });
        setShowSubParts(null); setShowConditions(false); setSelectedSubPart(null); setSelectedMainPart(null); setSelectedCondition(null); setClickedCoords(null);
    };

    const handleSizeSelect = (size: string) => {
        setPendingFault({ part: selectedSubPart ?? '', damage: selectedCondition ?? '', detail: `${selectedSeverity} - ${size}`, coords: clickedCoords ?? undefined });
        resetAll();
    };

    const handleFaultMouseDown = (index: number, event: React.MouseEvent) => {
        event.stopPropagation();
        setDraggedFaultIndex(index);
        setDragStartPos({ x: event.clientX, y: event.clientY });
    };

    const handleFaultMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (draggedFaultIndex === null || !dragStartPos) return;
        if (Math.abs(event.clientX - dragStartPos.x) > 5 || Math.abs(event.clientY - dragStartPos.y) > 5) {
            setIsDragging(true);
            const svg = event.currentTarget;
            const ctm = svg.getScreenCTM();
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

    const backdropStyle: React.CSSProperties = {
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    };
    const popupStyle: React.CSSProperties = {
        background: '#ffffff', borderRadius: '14px', padding: '28px 32px', display: 'flex',
        gap: '28px', minWidth: 'min(360px, 94vw)', maxWidth: 'min(960px, 96vw)', maxHeight: '85vh', overflow: 'auto',
        position: 'relative', border: '1px solid #e2e8f0',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.12)',
    };

    const exteriorSrc = imageBase64 ?? '/condition-report-exterior.png';

    return (
        <>
            <div ref={wrapRef} style={{ position: 'relative', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                <img src={exteriorSrc} alt="Vehicle exterior" style={{ width: '100%', height: 'auto', display: 'block', minWidth: 'min(100%, 1332px)' }} />
                <svg
                    viewBox="0 0 1332 733"
                    preserveAspectRatio="xMidYMid meet"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'all' }}
                    onMouseMove={handleFaultMouseMove}
                    onMouseUp={handleFaultMouseUp}
                >
                    <polygon points="610,287,613,425,919,426,919,292" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Roof', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="230,315,230,395,377,446,383,270" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Bonnet', e)} style={{ cursor: 'pointer' }} />
                    <circle cx="773" cy="629" r="43" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Back Left tyre', e)} style={{ cursor: 'pointer' }} />
                    <circle cx="347" cy="95" r="44" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Right tyre', e)} style={{ cursor: 'pointer' }} />
                    <circle cx="786" cy="84" r="43" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Back Right tyre', e)} style={{ cursor: 'pointer' }} />
                    <circle cx="1042" cy="136" r="47" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Spare tyre', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="429,258,406,347,419,456,513,431,513,286" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front mirror', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="422,533,429,610,596,613,591,563,550,543,550,526" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Left door panel', e)} style={{ cursor: 'pointer' }} />
                    <rect x="540" y="300" width="64" height="119" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Glass/Sun Roof', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="400,255,388,290,382,330,381,376,384,410,388,429,394,457,411,456,396,362,407,295,419,253,407,254" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Windshield Side Frame', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="150,296,168,296,168,420,151,420" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Bumper', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="171,254,184,251,184,466,173,466" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Bumper', e)} style={{ cursor: 'pointer' }} />
                    <rect x="400" y="621" width="305" height="13" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Right Side Skirt', e)} style={{ cursor: 'pointer' }} />
                    <rect x="410" y="79" width="310" height="12" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Left Side Skirt', e)} style={{ cursor: 'pointer' }} />
                    <rect x="1110" y="224" width="85" height="268" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Back Bumper', e)} style={{ cursor: 'pointer' }} />
                    <rect x="135" y="243" width="82" height="235" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Bumper', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="933,272,1107,272,1107,449,933,449" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Boot', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="596,446 597,619 424,620 419,544 421,517 443,495 490,465 550,447" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Left Front Door', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="604,449 604,619 704,618 711,591 720,577 733,563 749,553 755,543 754,529 755,517 755,503 753,489 754,472 753,459 753,449" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Left Back Door', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="761,448 761,553 792,555 812,565 820,573 860,573 924,573 924,527 926,471 922,447" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Fuel Cap Panel Left', e)} style={{ cursor: 'pointer' }} />
                    <circle cx="333" cy="618" r="46" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Left Tyre', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="614,96 615,258 770,257 769,157 740,145 727,130 721,112 718,96" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Back Right Door Panel', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="779,257 936,257 936,136 832,136 815,149 800,154 788,156 777,156" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Fuel Cap Panel Right', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="227,553,228,575,278,575,293,562,316,552,347,551,371,561,383,573,393,589,396,616,420,618,419,596,415,575,415,553,416,537,414,516,381,518,330,522,290,526,252,535,234,542" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Left Fender / Wing', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="269,581,210,584,216,603,228,620,238,623,251,624,261,623,268,620" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Bumper Corner (Right Side)', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="246,85,227,105,220,124,223,132,248,132,278,133,287,131,281,106,280,85,269,87" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Bumper Corner (Left Side)', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="846,82,841,121,934,121,919,90" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Back Bumper Corner (Right Side)', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="242,135,240,161,264,175,300,184,334,188,374,191,408,194,427,195,427,175,426,158,426,141,428,120,433,95,411,92,404,118,397,135,384,148,369,155,346,158,324,156,307,149,290,135" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Right Fender / Wing', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="829,588 832,629 907,624 919,608 921,589" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Back Bumper Corner (Left Side)', e)} style={{ cursor: 'pointer' }} />
                    <polygon points="610,97 609,259 556,264 502,243 470,227 433,202 429,179 430,156 432,131 433,98" fill="transparent" strokeWidth="2" onClick={(e) => handleClick('Front Right Door Panel', e)} style={{ cursor: 'pointer' }} />

                    {faults.map((f, i) => {
                        if (!f?.coords) return null;
                        return (
                            <g key={f.idx ?? i} onMouseDown={(e) => handleFaultMouseDown(i, e)} style={{ cursor: 'grab', pointerEvents: 'all' }}>
                                <ExteriorFaultMarker x={f.coords.x} y={f.coords.y} n={f.idx ?? (i + 1)} color={f.fromPrevious ? '#f97316' : '#111'} />
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
                    <div style={popupStyle} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={resetAll} aria-label="Close" style={{ position: 'absolute', top: 12, right: 14, background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>

                        <div style={popupColStyle}>
                            <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Select Part</p>
                            {showSubParts.map(part => (
                                <button key={part} style={part === selectedSubPart ? popupBtnActive : popupBtnBase} onClick={() => handleSubPartClick(part)}>{part}</button>
                            ))}
                            <button type="button" onClick={() => { setPendingFault({ part: selectedMainPart ?? 'Custom', damage: 'Custom Modification', detail: '', coords: clickedCoords ?? undefined }); setShowSubParts(null); setShowConditions(false); }} style={{ ...popupBtnBase, background: '#16a34a', color: '#fff', borderColor: '#16a34a', marginTop: 8 }}>➕ Any Modification</button>
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
                                    const auto = getAutoSizeFromLabel(sev);
                                    return (
                                        <button key={sev} style={sev === selectedSeverity ? popupBtnActive : popupBtnBase} onClick={() => handleSeveritySelect(sev)}>{auto ? `${sev} (${auto})` : sev}</button>
                                    );
                                })}
                            </div>
                        )}

                        {selectedSeverity && sizeMap[selectedSeverity] && (
                            <div style={popupColStyle}>
                                <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Size</p>
                                {sizeMap[selectedSeverity].map(size => (
                                    <button key={size} style={size === selectedSize ? popupBtnActive : popupBtnBase} onClick={() => handleSizeSelect(size)}>{size}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {mounted && pendingFault && createPortal(
                <div style={{ ...backdropStyle, zIndex: 10000 }} onClick={() => { setPendingFault(null); setPhoto(null); setNote(''); }}>
                    <div style={{ background: '#ffffff', borderRadius: 12, padding: 28, width: 'min(420px, 94vw)', maxWidth: '100%', position: 'relative', border: '1px solid #e2e8f0', boxShadow: '0 20px 50px rgba(15, 23, 42, 0.12)' }} onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => { setPendingFault(null); setPhoto(null); setNote(''); }} aria-label="Close" style={{ position: 'absolute', top: 10, right: 12, background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
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
                                setPhoto(null);
                                setNote('');
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
