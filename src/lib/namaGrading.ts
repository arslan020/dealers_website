// NAMA / Manheim UK Grading Logic
// Ported from appraisal website ai.js

interface Fault {
  part?: string;
  damage?: string;
  detail?: string;
}

function isBodyPanel(part: string): boolean {
  const p = (part || '').toLowerCase().trim();

  if (p.includes('door pad') || p.includes('seat') ||
    p.includes('visor') || p.includes('carpet') ||
    p.includes('handle inner') || p.includes('fascia') ||
    p.includes('console') || p.includes('tailgate pad') ||
    p.includes('switches') || p.includes('entertainment') ||
    p.includes('steering wheel') || p.includes('dash') ||
    p.includes('glove box') || p.includes('roof lining') ||
    p.includes('jack') || p.includes('tools') || p.includes('wheel brace') ||
    p.includes('tyre inflation') || p.includes('load area carpet') ||
    p.includes('rear panel trim int') || p.includes('shelfload cover')) {
    return false;
  }

  if (p.includes('screen') || p.includes('glass') ||
    p.includes('window') || p.includes('sunroof') ||
    p.includes('qtr light')) {
    return false;
  }

  if (p.includes('lamp') || p.includes('light') ||
    p.includes('headlamp') || p.includes('fog lamp') ||
    p.includes('flasher')) {
    return false;
  }

  if (p.includes('badge') || p.includes('toweye') ||
    p.includes('reflector') || p.includes('number plate') ||
    p.includes('washer') || p.includes('sensor') ||
    p.includes('aerial') || p.includes('exhaust') ||
    p.includes('charging port') || p.includes('fuel flap')) {
    return false;
  }

  if (p.includes('wheel') || p.includes('tyre') || p.includes('tire')) {
    return false;
  }

  if (p.includes('moulding') || p.includes('trim panel') ||
    p.includes('aperture seal')) {
    return false;
  }

  if (p.includes('mirror')) return false;
  if (p.includes('handle') || p.includes('lock')) return false;
  if (p.includes('arch extension')) return false;

  return p.includes('bonnet') ||
    p.includes('roof') ||
    p.includes('door nsf') || p.includes('door osf') ||
    p.includes('door nsr') || p.includes('door osr') ||
    p.includes('wing nsf') || p.includes('wing osf') ||
    p.includes('bumper front') || p.includes('bumper rear') ||
    p.includes('panel front') || p.includes('panel rear') ||
    p.includes('tailgate') ||
    p.includes('qtr panel nsr') || p.includes('qtr panel osr') ||
    p.includes('a post') || p.includes('b post') ||
    p.includes('c post') || p.includes('d post');
}

function normalizePanel(part: string): string | null {
  const p = String(part || '').toLowerCase().trim();

  if (p.includes('bonnet')) return 'Bonnet';
  if (p.includes('roof') && !p.includes('glass')) return 'Roof';
  if (p.includes('bumper front')) return 'Bumper Front';
  if (p.includes('bumper rear')) return 'Bumper Rear';
  if (p.includes('door nsf')) return 'Door nsf';
  if (p.includes('door osf')) return 'Door osf';
  if (p.includes('door nsr')) return 'Door nsr';
  if (p.includes('door osr')) return 'Door osr';
  if (p.includes('wing nsf')) return 'Wing nsf';
  if (p.includes('wing osf')) return 'Wing osf';
  if (p.includes('qtr panel nsr')) return 'Qtr Panel nsr';
  if (p.includes('qtr panel osr')) return 'Qtr Panel osr';
  if (p.includes('panel front')) return 'Panel Front';
  if (p.includes('panel rear')) return 'Panel Rear';
  if (p.includes('tailgate')) return 'Tailgate';
  if (p.includes('a post')) return 'A Post';
  if (p.includes('b post')) return 'B Post';
  if (p.includes('c post')) return 'C Post';
  if (p.includes('d post')) return 'D Post';

  return null;
}

function isPaintMajor(damage: string, detail: string, part: string): boolean {
  const dmg = (damage || '').toLowerCase().trim();
  const det = (detail || '').toLowerCase().trim();
  const partLower = (part || '').toLowerCase().trim();

  const isBumper = partLower.includes('bumper');
  const isPaintDamage = dmg.includes('scratch') || dmg.includes('scuff') || dmg.includes('chip');

  if (!isPaintDamage) return false;

  if (isBumper) {
    return det.includes('over 100mm') || det.includes('>100mm');
  }

  return det.includes('over 25mm') || det.includes('>25mm');
}

function isDentMajor(damage: string, detail: string): boolean {
  const dmg = (damage || '').toLowerCase().trim();
  const det = (detail || '').toLowerCase().trim();

  if (!dmg.includes('dent')) return false;
  return det.includes('over 30mm') || det.includes('>30mm');
}

function isCrackMajor(damage: string, detail: string): boolean {
  const dmg = (damage || '').toLowerCase().trim();
  const det = (detail || '').toLowerCase().trim();

  const isCrackDamage = dmg.includes('crack') || dmg.includes('split');
  if (!isCrackDamage) return false;

  return det.includes('over 30%') || det.includes('>30%') || det.includes('replace');
}

function isMissingOrReplace(damage: string, detail: string): boolean {
  const dmg = (damage || '').toLowerCase().trim();
  const det = (detail || '').toLowerCase().trim();

  return dmg.includes('missing') || det.includes('replace') || dmg.includes('broken');
}

function isStructuralPanel(part: string): boolean {
  const p = (part || '').toLowerCase().trim();
  return p.includes('roof') || p.includes('qtr panel') || p.includes('quarter panel');
}

function isMisalignmentMajor(damage: string, detail: string): boolean {
  const dmg = (damage || '').toLowerCase().trim();
  const det = (detail || '').toLowerCase().trim();

  const isMisalignDamage = dmg.includes('misaligned') || dmg.includes('misalign') ||
    dmg.includes('uneven') || dmg.includes('gap');

  if (!isMisalignDamage) return false;

  return det.includes('moderate') || det.includes('severe') ||
    det.includes('10-20mm') || det.includes('over 20mm') ||
    det.includes('both sides') || det.includes('multiple');
}

function isPoorRepair(damage: string): boolean {
  const dmg = (damage || '').toLowerCase().trim();
  return dmg.includes('poor previous repair');
}

export type NAMAGrade = '1' | '2' | '3' | '4' | '5' | 'U';

export const NAMA_GRADE_INFO: Record<NAMAGrade, { label: string; color: string; bg: string }> = {
  '1': { label: 'Excellent',     color: '#4CAF50', bg: '#f0fdf4' },
  '2': { label: 'Good',          color: '#8BC34A', bg: '#f7fee7' },
  '3': { label: 'Average',       color: '#FFC107', bg: '#fffbeb' },
  '4': { label: 'Poor',          color: '#FF9800', bg: '#fff7ed' },
  '5': { label: 'Very Poor',     color: '#B71C1C', bg: '#fef2f2' },
  'U': { label: 'Uneconomical',  color: '#9E9E9E', bg: '#f9fafb' },
};

export function namaGradeFromFaults(exterior: Fault[] = [], interior: Fault[] = []): NAMAGrade {
  const faults = [...exterior, ...interior];

  const paintPanels = new Set<string>();
  const dentPanels = new Set<string>();
  const crackPanels = new Set<string>();
  const misalignmentPanels = new Set<string>();
  const poorRepairPanels = new Set<string>();

  let structuralCracks = 0;
  let significantTrims = 0;
  let totalSignificantFaults = 0;

  for (const fault of faults) {
    if (!fault || !fault.part) continue;

    totalSignificantFaults++;

    if (isMisalignmentMajor(fault.damage || '', fault.detail || '')) {
      const panel = normalizePanel(fault.part) || fault.part;
      misalignmentPanels.add(panel);
    }

    if (isPoorRepair(fault.damage || '')) {
      const panel = normalizePanel(fault.part) || fault.part;
      poorRepairPanels.add(panel);
    }

    if (!isBodyPanel(fault.part)) {
      if (isMissingOrReplace(fault.damage || '', fault.detail || '')) {
        significantTrims++;
      }
      continue;
    }

    const panel = normalizePanel(fault.part);
    if (!panel) continue;

    if (isPaintMajor(fault.damage || '', fault.detail || '', fault.part)) {
      paintPanels.add(panel);
    }

    if (isDentMajor(fault.damage || '', fault.detail || '')) {
      dentPanels.add(panel);
    }

    if (isCrackMajor(fault.damage || '', fault.detail || '')) {
      crackPanels.add(panel);
      if (isStructuralPanel(fault.part)) {
        structuralCracks++;
      }
    }

    if (isMissingOrReplace(fault.damage || '', fault.detail || '')) {
      significantTrims++;
    }
  }

  const paintCount = paintPanels.size;
  const dentCount = dentPanels.size;
  const crackCount = crackPanels.size;
  const misalignCount = misalignmentPanels.size;
  const poorRepairCount = poorRepairPanels.size;

  if (
    crackCount > 10 ||
    structuralCracks >= 2 ||
    significantTrims > 10 ||
    totalSignificantFaults > 15
  ) return 'U';

  if (
    crackCount >= 2 ||
    dentCount >= 8 ||
    paintCount >= 11 ||
    structuralCracks >= 1 ||
    misalignCount >= 3 ||
    poorRepairCount >= 3 ||
    totalSignificantFaults >= 12
  ) return '5';

  if (
    crackCount >= 1 ||
    (dentCount >= 4 && dentCount <= 7) ||
    (paintCount >= 6 && paintCount <= 10) ||
    misalignCount >= 2 ||
    poorRepairCount >= 2 ||
    totalSignificantFaults >= 8
  ) return '4';

  if (
    (paintCount >= 1 && paintCount <= 5) ||
    (dentCount >= 1 && dentCount <= 3) ||
    significantTrims >= 2 ||
    misalignCount >= 1 ||
    poorRepairCount >= 1 ||
    totalSignificantFaults >= 5
  ) return '3';

  if (
    paintCount === 1 ||
    dentCount === 1 ||
    significantTrims === 1 ||
    totalSignificantFaults >= 3
  ) return '2';

  return '1';
}
