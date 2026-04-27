/**
 * Condition Report PDF Generator
 * Matches the exact layout and style of the appraisal website's pdfGenerator.js
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Real PNG Icons (copied from appraisal website assets/icons/) ─────────────
// Served from /condition-report-icons/ in the public folder

const ICON_FILES: Record<string, string> = {
  colour:       '/condition-report-icons/color.png',
  fuel:         '/condition-report-icons/fuel.png',
  engine:       '/condition-report-icons/engine.png',
  transmission: '/condition-report-icons/gear.png',
  mot:          '/condition-report-icons/mot.png',
  tax:          '/condition-report-icons/tax.png',
  eu:           '/condition-report-icons/eu.png',
  weight:       '/condition-report-icons/weight.png',
  document:     '/condition-report-icons/document.png',
  year:         '/condition-report-icons/calendar.png',
  uk:           '/condition-report-icons/uk.png',
  mileage:      '/condition-report-icons/speedometer.png',
  owner:        '/condition-report-icons/users.png',
  key:          '/condition-report-icons/car-key.png',
  shield:       '/condition-report-icons/shield.png',
  service:      '/condition-report-icons/maintenance.png',
  road:         '/condition-report-icons/road.png',
  electric:     '/condition-report-icons/electric.png',
};

/** Fetch a URL and return a data URL (handles both PNG and SVG) */
const toDataURLFromPath = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

/** Preload all icons as data URLs — exact same approach as appraisal website preloadIcons() */
const preloadIcons = async (): Promise<Record<string, string>> => {
  const cache: Record<string, string> = {};
  await Promise.all(
    Object.entries(ICON_FILES).map(async ([key, src]) => {
      try { cache[key] = await toDataURLFromPath(src); } catch { /* skip */ }
    })
  );
  return cache;
};

/** Match label text to icon key — mirrors appraisal website iconImages lookup */
const getIconKey = (label: string): string | null => {
  const l = (label || '').toLowerCase();
  // Vehicle details
  if (l.includes('colour') || l.includes('color')) return 'colour';
  if (l.includes('fuel')) return 'fuel';
  if (l.includes('engine size') || l.includes('engine cc')) return 'engine';
  if (l.includes('transmission')) return 'transmission';
  if (l.includes('euro')) return 'eu';
  if (l.includes('tax')) return 'tax';
  if (l.includes('year') || l.includes('derived') || l.includes('manufacture')) return 'year';
  if (l.includes('v5') || l.includes('document')) return 'document';
  if (l.includes('uk') || l.includes('registered')) return 'uk';
  if (l.includes('mot') || l.includes('expiry')) return 'mot';
  if (l.includes('body type') || l.includes('doors') || l.includes('seats')) return 'engine';
  // Vehicle history
  if (l.includes('mileage') && !l.includes('modification')) return 'mileage';
  if (l.includes('modification')) return 'weight';
  if (l.includes('owner')) return 'owner';
  if (l.includes('key') && !l.includes('monkey')) return 'key';
  if (l.includes('write-off') || l.includes('write off') || l.includes('category')) return 'shield';
  if (l.includes('insurance')) return 'shield';
  if (l.includes('main dealer') || l.includes('service') || l.includes('record')) return 'service';
  if (l.includes('usage') || (l.includes('history') && !l.includes('service'))) return 'road';
  // Mechanical checks
  if (l.includes('oil')) return 'service';
  if (l.includes('coolant')) return 'engine';
  if (l.includes('brake')) return 'shield';
  if (l.includes('warning') || l.includes('lights/messages')) return 'mot';
  if (l.includes('battery')) return 'engine';
  if (l.includes('exhaust')) return 'service';
  if (l.includes('engine') || l.includes('start')) return 'engine';
  if (l.includes('steering')) return 'service';
  if (l.includes('gear') || l.includes('shift')) return 'transmission';
  return null;
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface FaultPoint {
  idx: number;
  part: string;
  damage: string;
  detail?: string;
  note?: string;
  coords?: { x: number; y: number };
  photoUrl?: string;
  photo?: string;
}

interface TyreData {
  position: string;
  treadDepth?: string;
  condition?: string;
  psi?: string;
}

export interface ConditionReportPDFData {
  reportType?: string;
  staffMember?: string;
  location?: string;
  mileage?: string;
  createdAt?: string;
  status?: string;
  overallGrade?: string;
  vehicleVRM?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  // Vehicle detail fields (from vehicle record)
  vehicleColour?: string;
  vehicleFuelType?: string;
  vehicleTransmission?: string;
  vehicleEngineSize?: string;
  vehicleYear?: string;
  vehicleBodyType?: string;
  vehicleDoors?: number;
  vehicleSeats?: number;
  faults?: { exterior: FaultPoint[]; interior: FaultPoint[] };
  tyres?: TyreData[];
  oilLeakage?: string;
  oilColor?: string;
  oilLevel?: number;
  coolantLevel?: string;
  coolantColor?: string;
  coolantLevelPercent?: number;
  brakeFluidLevel?: string;
  warningLights?: string;
  batteryCondition?: string;
  exhaustCondition?: string;
  mechanicalNotes?: string;
  lightsCheck?: boolean;
  mirrorsCheck?: boolean;
  wipersCheck?: boolean;
  engineStartSmooth?: boolean;
  steeringAlignment?: boolean;
  brakePerformance?: boolean;
  gearShiftQuality?: boolean;
  vehicleMileage?: string;
  mileageModifications?: string;
  hasV5Document?: string;
  numberOfOwners?: string;
  numberOfKeys?: string;
  firstRegisteredUK?: string;
  insuranceWriteOff?: string;
  insuranceWriteOffType?: string;
  serviceHistoryType?: string;
  serviceHistoryCount?: string;
  mainDealer?: string;
  vehicleUsageHistory?: string;
  motExpiryDate?: string;
  additionalNotes?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB');
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, dy] = dateStr.split('-');
      return `${dy}/${m}/${y}`;
    }
    return dateStr;
  } catch { return dateStr; }
};

/** Convert any URL (including SVG) to a PNG data URL via canvas */
const toDataURL = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();

  // For SVGs, we need to render through canvas to get a raster image for jsPDF
  if (blob.type.includes('svg') || url.endsWith('.svg')) {
    return new Promise((resolve, reject) => {
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1332;
        canvas.height = img.naturalHeight || 733;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(blobUrl);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = blobUrl;
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

/** Convert SVG URL to fixed-size PNG data URL via canvas */
const svgToDataURL = (url: string, width: number, height: number): Promise<string> =>
  new Promise((resolve, reject) => {
    fetch(url)
      .then(r => r.text())
      .then(svgText => {
        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(blobUrl);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = blobUrl;
      })
      .catch(reject);
  });

const imgFormatFromDataUrl = (dataUrl: string) =>
  dataUrl?.startsWith('data:image/png') ? 'PNG' : 'JPEG';

// ── Section bar (teal — exactly like appraisal website) ──────────────────────

const drawSectionBar = (doc: jsPDF, title: string, y: number, color: [number, number, number] = [0, 172, 193]) => {
  doc.setFillColor(...color);
  doc.rect(5, y, 200, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 10, y + 8);
  doc.setTextColor(0);
};

// ── Footer ────────────────────────────────────────────────────────────────────

const addFooterAllPages = (doc: jsPDF, data: ConditionReportPDFData) => {
  const pageCount = (doc.internal as any).getNumberOfPages();
  const footerMid = `${data.vehicleVRM || ''}, ${data.vehicleMake || ''} ${data.vehicleModel || ''}`.trim();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220);
    doc.line(5, H - 12, W - 5, H - 12);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Page ${i}`, 5, H - 6);
    doc.text(footerMid, W / 2, H - 6, { align: 'center' });
    doc.text('Condition Report', W - 5, H - 6, { align: 'right' });
  }
};

// ── Pin drawing (exact copy from appraisal website) ───────────────────────────

const drawPin = (
  doc: jsPDF,
  xPx: number, yPx: number, number: number,
  imgX: number, imgY: number, imgW: number, imgH: number,
  originalW: number, originalH: number,
  fromPrevious = false
) => {
  const scaleX = imgW / originalW;
  const scaleY = imgH / originalH;
  const px = imgX + xPx * scaleX;
  const py = imgY + yPx * scaleY;
  const outerR = 2.0;
  const innerR = 0.8;

  if (fromPrevious) {
    doc.setFillColor(249, 115, 22);
  } else {
    doc.setFillColor(17, 17, 17);
  }
  doc.circle(px, py, innerR, 'F');
  doc.circle(px, py, outerR, 'F');
  doc.setFontSize(4.5);
  doc.setTextColor(255, 255, 255);
  doc.text(String(number), px, py + 1.0, { align: 'center' });
  doc.setTextColor(0);
};

/** Pin on fault-photo thumbnails — same as appraisal `drawPhotoPinExact` */
const drawPhotoPinExact = (
  doc: jsPDF,
  x: number,
  y: number,
  n: number,
  opts: { R?: number; border?: number; fill?: [number, number, number]; tailLen?: number; baseK?: number; baseW?: number } = {}
) => {
  const R = opts.R ?? 2.5;
  const border = opts.border ?? 0.3;
  const fill = opts.fill ?? [230, 118, 33];
  const tailLen = opts.tailLen ?? 1.0;
  const baseK = opts.baseK ?? 0.7;
  const baseW = opts.baseW ?? 0.75;
  const [r, g, b] = fill;

  const R_out = R;
  const baseY1 = y + R_out * baseK;
  const leftX1 = x - R_out * baseW;
  const rightX1 = x + R_out * baseW;
  const tipY1 = y + R_out + tailLen;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.circle(x, y, R_out, 'F');
  doc.triangle(leftX1, baseY1, rightX1, baseY1, x, tipY1, 'F');

  const R_in = Math.max(0.5, R_out - border);
  const baseY2 = y + R_in * baseK;
  const leftX2 = x - R_in * baseW;
  const rightX2 = x + R_in * baseW;
  const tipY2 = tipY1 - border;

  doc.setFillColor(r, g, b);
  doc.setDrawColor(r, g, b);
  doc.circle(x, y, R_in, 'F');
  doc.triangle(leftX2, baseY2, rightX2, baseY2, x, tipY2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.min(8, R_in * 2.3));
  doc.text(String(n), x, y + 0.8, { align: 'center' });

  doc.setTextColor(0, 0, 0);
};

/** Resolve fault photo to a data URL jsPDF can embed (data URL, http(s), or site-relative path) */
const resolveFaultPhotoSrc = async (raw: string): Promise<string> => {
  const s = String(raw).trim();
  if (!s) throw new Error('empty photo');
  if (s.startsWith('data:')) return s;
  const isRemoteOrPath = /^https?:\/\//i.test(s) || s.startsWith('/');
  if (isRemoteOrPath) {
    const abs =
      /^https?:\/\//i.test(s)
        ? s
        : typeof window !== 'undefined'
          ? `${window.location.origin}${s.startsWith('/') ? s : `/${s}`}`
          : s;
    return toDataURL(abs);
  }
  return s;
};

// ── Fault list (exact copy from appraisal website) ────────────────────────────

const renderFaultList = (doc: jsPDF, items: FaultPoint[], startX: number, startY: number, startNum = 1) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0);

  const clean = (s: string) => (s || '').trim();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const rightMaxW = pageW - startX - 5;
  const bottom = pageH - 20;
  let y = startY;

  items.forEach((item, i) => {
    const n = item.idx ?? startNum + i;
    const label = `${n}) `;
    const text = clean(`${item.part}; ${item.damage}${item.detail ? '; ' + item.detail : ''}${item.note ? ' - Note: ' + item.note : ''}`);
    doc.text(label, startX, y);
    const labelWidth = doc.getTextWidth(label);
    const textStartX = startX + labelWidth;
    const wrapWidth = Math.max(10, rightMaxW - labelWidth);
    const wrapped = doc.splitTextToSize(text, wrapWidth);
    wrapped.forEach((line: string, lineIdx: number) => {
      const x = lineIdx === 0 ? textStartX : startX;
      doc.text(line, x, y);
      y += 5;
      if (y > bottom) { doc.addPage(); doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(0); y = 20; }
    });
    y += 2;
  });

  return y;
};

// ── Grade colors (exact match from appraisal website) ─────────────────────────

const gradeColor = (grade: string): [number, number, number] => {
  switch (String(grade).toUpperCase()) {
    case '1': return [76, 175, 80];
    case '2': return [139, 195, 74];
    case '3': return [255, 193, 7];
    case '4': return [255, 152, 0];
    case '5': return [183, 28, 28];
    case 'U': return [158, 158, 158];
    default: return [73, 180, 85];
  }
};

// ── Mechanical check value mapping (no emojis in PDF) ─────────────────────────

const formatCheckValue = (val?: string): string | null => {
  if (!val || val === '') return null;
  const valueMap: Record<string, string> = {
    'none': 'No Leakage', 'minor': 'Minor Seepage', 'severe': 'Severe Leak',
    'good': 'Good', 'low': 'Low', 'empty': 'Empty', 'weak': 'Weak',
    'replace': 'Needs Replacement', 'rust': 'Surface Rust', 'damaged': 'Damaged/Corroded',
    'amber': 'Amber/Light Brown (Good)', 'dark-brown': 'Dark Brown (Due for Change)',
    'black': 'Black (Needs Immediate Change)', 'green': 'Green (Good)', 'blue': 'Blue (Good)',
    'pink': 'Pink/Red (Good)', 'orange': 'Orange (Good)', 'rusty': 'Rusty/Brown (Contaminated)',
    'dirty': 'Dirty/Cloudy', 'faded': 'Faded/Discolored', 'unknown': 'Unknown/Other',
  };
  return valueMap[String(val).toLowerCase()] || val;
};

// ── Main export ───────────────────────────────────────────────────────────────

export const generateConditionReportPDF = async (data: ConditionReportPDFData): Promise<void> => {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const headerCenterY = 15;

  // ── Preload icons as rasterised PNG (same as appraisal website) ──────────
  const iconCache = await preloadIcons();

  // ── Load exterior/interior diagrams ──────────────────────────────────────

  let extBase64: string | null = null;
  let intBase64: string | null = null;

  try {
    extBase64 = await svgToDataURL('/condition-report-exterior.svg', 1332, 733);
  } catch (e) {
    // Try PNG fallback
    try { extBase64 = await toDataURL('/condition-report-exterior.png'); } catch { /* skip */ }
  }

  try {
    intBase64 = await svgToDataURL('/condition-report-interior.svg', 1153, 718);
  } catch (e) {
    try { intBase64 = await toDataURL('/condition-report-interior.png'); } catch { /* skip */ }
  }

  // ── PAGE 1 HEADER (exact match appraisal website) ────────────────────────

  // 2. Main title (center) — shows the specific report type
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(0, 51, 102);
  const pdfTitle = data.reportType ? `Vehicle ${data.reportType} Report` : 'Vehicle Condition Report';
  doc.text(pdfTitle, pageW / 2 + 5, headerCenterY + 3, { align: 'center' });

  // 3. Grade circle (top right — exact match)
  if (data.overallGrade) {
    const grade = String(data.overallGrade).toUpperCase();
    const [gr, gg, gb] = gradeColor(grade);
    const gradeX = 192;
    const gradeR = 9;

    doc.setFillColor(gr, gg, gb);
    doc.circle(gradeX, headerCenterY, gradeR, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Grade', gradeX, headerCenterY - 2, { align: 'center' });
    doc.setFontSize(18);
    doc.text(String(data.overallGrade), gradeX, headerCenterY + 5, { align: 'center' });
    doc.setTextColor(0);
  }

  // Divider line (y=28 — exact match)
  doc.setDrawColor(200);
  doc.setLineWidth(0.4);
  doc.line(5, 28, 205, 28);

  // ── VEHICLE INFO ROW (exact match) ────────────────────────────────────────

  const rowTopY = 32;

  // Registration plate (exact match)
  const regText = data.vehicleVRM || 'N/A';
  const plateWidth = 38, plateHeight = 10;
  const plateX = 8, plateY = rowTopY;

  doc.setFillColor(255, 210, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.roundedRect(plateX, plateY, plateWidth, plateHeight, 1.5, 1.5, 'FD');

  const blueStripW = 7;
  doc.setFillColor(0, 51, 153);
  doc.roundedRect(plateX, plateY, blueStripW, plateHeight, 1.5, 1.5, 'F');
  doc.rect(plateX + 3, plateY, blueStripW - 3, plateHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  doc.text('UK', plateX + blueStripW / 2, plateY + plateHeight - 1.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const textCenterX = plateX + blueStripW + (plateWidth - blueStripW) / 2;
  doc.text(regText, textCenterX, plateY + 6.5, { align: 'center' });

  // Vehicle description (exact match)
  const descX = 52;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);

  const makeModel = `${data.vehicleMake || ''} ${data.vehicleModel || ''}`.trim() || 'Unknown Vehicle';
  const maxDescWidth = 92;
  const titleLines = doc.splitTextToSize(makeModel, maxDescWidth);
  doc.text(titleLines, descX, rowTopY + 5);

  let lastContentY = rowTopY + 5 + titleLines.length * 5;
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mileage: ${data.mileage || 'N/A'}`, descX, lastContentY);

  // Appraised info box (exact match)
  const infoBoxX = 148, infoBoxY = rowTopY;
  const infoBoxW = 54, infoBoxH = 14;

  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Appraised:', infoBoxX + 3, infoBoxY + 5);
  doc.text('By:', infoBoxX + 3, infoBoxY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(formatDate(data.createdAt) || 'N/A', infoBoxX + 24, infoBoxY + 5);
  doc.text(data.staffMember || 'Staff', infoBoxX + 24, infoBoxY + 11);

  // Divider (dynamic — exact match)
  const dividerY = Math.max(lastContentY + 4, infoBoxY + infoBoxH + 2);
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(5, dividerY, 205, dividerY);

  let currentY = dividerY + 4;

  // ── VEHICLE DETAILS TABLE (exact match — Field/Value/Field/Value) ─────────

  const formatFuelType = (fuel?: string): string => {
    if (!fuel) return '';
    const map: Record<string, string> = {
      'HEAVY OIL': 'Diesel', 'DIESEL': 'Diesel', 'PETROL': 'Petrol',
      'ELECTRICITY': 'Electric', 'ELECTRIC': 'Electric',
      'HYBRID ELECTRIC': 'Hybrid', 'PLUG-IN HYBRID': 'Plug-in Hybrid',
      'GAS': 'Gas (LPG)', 'GAS BI-FUEL': 'Gas Bi-Fuel',
    };
    return map[String(fuel).toUpperCase().trim()] || fuel;
  };

  const vehicleDetailFields: [string, string][] = ([
    ['Colour',           data.vehicleColour],
    ['Fuel Type',        formatFuelType(data.vehicleFuelType)],
    ['Engine Size (cc)', data.vehicleEngineSize],
    ['Transmission',     data.vehicleTransmission],
    ['Body Type',        data.vehicleBodyType],
    ['Year',             data.vehicleYear],
    ['Doors',            data.vehicleDoors != null ? String(data.vehicleDoors) : undefined],
    ['Seats',            data.vehicleSeats != null ? String(data.vehicleSeats) : undefined],
    ['MOT Expiry',       formatDate(data.motExpiryDate)],
    ['Mileage',          data.mileage ? `${data.mileage} miles` : undefined],
  ] as [string, string | undefined][]).filter(([, v]) => v && String(v).trim() !== '' && String(v).trim() !== 'N/A') as [string, string][];

  if (vehicleDetailFields.length > 0) {
    const vehicleTableBody: string[][] = [];
    for (let i = 0; i < vehicleDetailFields.length; i += 2) {
      const left = vehicleDetailFields[i];
      const right = vehicleDetailFields[i + 1];
      vehicleTableBody.push([left[0], left[1], right ? right[0] : '', right ? right[1] : '']);
    }

    autoTable(doc, {
      startY: currentY,
      head: [['Field', 'Value', 'Field', 'Value']],
      body: vehicleTableBody,
      styles: { fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [0, 51, 102], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 5, right: 5 },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && (hookData.column.index === 0 || hookData.column.index === 2)) {
          let pad = hookData.cell.styles.cellPadding;
          if (typeof pad === 'number') {
            hookData.cell.styles.cellPadding = { top: pad, right: pad, bottom: pad, left: pad + 7 };
          } else {
            hookData.cell.styles.cellPadding = { ...pad, left: (pad.left || 2) + 7 };
          }
        }
      },
      didDrawCell: (hookData: any) => {
        if (hookData.section === 'body' && (hookData.column.index === 0 || hookData.column.index === 2)) {
          const label = String(hookData.cell.raw || '');
          const key = getIconKey(label);
          const icon = key ? iconCache[key] : null;
          if (icon) {
            const x = hookData.cell.x + 1.5;
            const y = hookData.cell.y + (hookData.cell.height - 5) / 2;
            try { doc.addImage(icon, 'PNG', x, y, 5, 5); } catch { /* skip */ }
          }
        }
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── EXTERIOR CONDITION (exact match layout) ───────────────────────────────

  {
    const pageH = doc.internal.pageSize.getHeight();
    const minNeeded = 12 + 6 + 70 + 16;
    let yBar = currentY;

    if (yBar + minNeeded > pageH - 20) { doc.addPage(); yBar = 20; }

    drawSectionBar(doc, 'Exterior Condition', yBar);
    doc.setDrawColor(220);
    doc.setLineWidth(0.5);
    doc.line(5, yBar + 13, 205, yBar + 13);

    const extFaults = data.faults?.exterior ?? [];
    const extList = extFaults.map(f => ({
      ...f,
      idx: f.idx,
    }));

    const imgX = 5, imgY = yBar + 18, imgW = 100, imgH = 70;

    if (extBase64) {
      try {
        doc.addImage(extBase64, 'PNG', imgX, imgY, imgW, imgH);
        const originalW = 1332, originalH = 733;
        extFaults.forEach(f => {
          if (f?.coords && f?.idx) {
            drawPin(doc, f.coords.x, f.coords.y, f.idx, imgX, imgY, imgW, imgH, originalW, originalH);
          }
        });
      } catch (e) { /* skip diagram on error */ }
    }

    renderFaultList(doc, extList, 110, imgY + 5, 1);
    currentY = imgY + imgH + 12;
  }

  // ── INTERIOR CONDITION (exact match layout — new page) ────────────────────

  doc.addPage();
  drawSectionBar(doc, 'Interior Condition', 18);
  doc.setDrawColor(220);
  doc.setLineWidth(0.5);
  doc.line(5, 31, 205, 31);

  {
    const intFaults = data.faults?.interior ?? [];
    const imgW = 100, imgH = 70, imgX = 5, imgY = 36;

    if (intBase64) {
      try {
        doc.addImage(intBase64, 'PNG', imgX, imgY, imgW, imgH);
        const originalW = 1153, originalH = 718;
        intFaults.forEach(f => {
          if (f?.coords && f?.idx) {
            drawPin(doc, f.coords.x, f.coords.y, f.idx, imgX, imgY, imgW, imgH, originalW, originalH);
          }
        });
      } catch (e) { /* skip diagram on error */ }
    }

    const extCount = (data.faults?.exterior ?? []).length;
    renderFaultList(doc, intFaults, 110, 41, extCount + 1);
    currentY = imgY + imgH + 12;
  }

  // ── FAULT PHOTOS (same as appraisal website pdfGenerator.js) ───────────────

  const photoFaults = [
    ...(data.faults?.exterior ?? []),
    ...(data.faults?.interior ?? []),
  ].filter(f => {
    const p = (f as FaultPoint).photo || (f as FaultPoint).photoUrl;
    return !!p && String(p).trim() !== '';
  });

  if (photoFaults.length > 0) {
    doc.addPage();
    drawSectionBar(doc, 'Fault Photos', 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const cols = 2;
    const photoW = 90;
    const photoH = 68;
    const gapX = 10;
    const gapY = 28;
    const startX = 10;
    const startY = 35;

    let x = startX;
    let y = startY;
    let col = 0;
    const pageH = doc.internal.pageSize.getHeight();

    for (let i = 0; i < photoFaults.length; i++) {
      const f = photoFaults[i] as FaultPoint;
      try {
        const raw = (f.photo || f.photoUrl) as string;
        const isHttpOrPath = /^https?:\/\//i.test(raw) || raw.startsWith('/');
        const absForLink =
          /^https?:\/\//i.test(raw)
            ? raw
            : typeof window !== 'undefined'
              ? `${window.location.origin}${raw.startsWith('/') ? raw : `/${raw}`}`
              : raw;
        const src = await resolveFaultPhotoSrc(raw);

        if (y + photoH > pageH - 25) {
          doc.addPage();
          drawSectionBar(doc, 'Fault Photos (cont.)', 18);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          x = startX;
          y = startY;
          col = 0;
        }

        doc.addImage(src, imgFormatFromDataUrl(src), x, y, photoW, photoH);
        drawPhotoPinExact(doc, x + 6, y + 5, f.idx || i + 1, {
          R: 2.5,
          border: 0.3,
          fill: [230, 118, 33],
          tailLen: 1.0,
        });

        doc.setFontSize(10);
        const caption = `${f.part || 'Unknown'} — ${f.damage || ''}${f.detail ? ` — ${f.detail}` : ''}${f.note ? ` — ${f.note}` : ''}`;
        doc.text(caption, x, y + photoH + 5, { maxWidth: photoW });

        if (isHttpOrPath && absForLink) {
          try {
            doc.link(x, y, photoW, photoH, { url: absForLink });
          } catch { /* optional link */ }
        }
      } catch (err) {
        console.error('Error adding fault photo to PDF:', err);
      }

      col++;
      if (col < cols) {
        x += photoW + gapX;
      } else {
        col = 0;
        x = startX;
        y += photoH + gapY;
      }
    }

    doc.setPage((doc.internal as any).getNumberOfPages());
    currentY = y + photoH + gapY;
  }

  // ── TYRE INSPECTION ───────────────────────────────────────────────────────

  const tyresToShow = (data.tyres ?? []).filter(
    t =>
      t.treadDepth ||
      t.condition ||
      (t.psi && String(t.psi).trim()) ||
      (t.photo && String(t.photo).trim()),
  );
  if (tyresToShow.length > 0) {
    const pageH = doc.internal.pageSize.getHeight();
    if (currentY + 40 > pageH - 20) { doc.addPage(); currentY = 20; }

    drawSectionBar(doc, 'Tyre & Wheel Inspection', currentY);
    currentY += 15;

    const TYRE_LABEL: Record<string, string> = {
      'front-left': 'Front Left (NS)', 'front-right': 'Front Right (OS)',
      'rear-left': 'Rear Left (NS)', 'rear-right': 'Rear Right (OS)',
      spare: 'Spare',
    };

    const tyreRows = (data.tyres ?? []).map(t => [
      TYRE_LABEL[t.position] || t.position,
      t.treadDepth ? `${t.treadDepth}mm` : 'Not Checked',
      t.psi && String(t.psi).trim() ? `${String(t.psi).trim()} PSI` : 'Not Checked',
      t.condition || 'Not Checked',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Position', 'Tread Depth (mm)', 'PSI', 'Condition']],
      body: tyreRows,
      styles: { fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [0, 51, 102], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 5, right: 5 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── APPRAISAL SUMMARY (Vehicle History — exact match) ─────────────────────

  const conditionFields: [string, string][] = ([
    ['Mileage', data.vehicleMileage],
    ['Mileage Modification', data.mileageModifications],
    ['V5 Document Present', data.hasV5Document],
    ['Number of Owners', data.numberOfOwners],
    ['Number of Keys', data.numberOfKeys],
    ['First Registered in UK', data.firstRegisteredUK],
    ['Insurance Write-Off', data.insuranceWriteOff],
    ...(data.insuranceWriteOff === 'yes' ? [['Write-Off Category', data.insuranceWriteOffType]] : []),
    ['Service History', data.serviceHistoryType],
    ['Service Records Count', data.serviceHistoryCount],
    ['Main Dealer Serviced', data.mainDealer],
    ['Usage History', data.vehicleUsageHistory],
    ['MOT Status', data.status === 'completed' ? 'Inspected' : 'In Progress'],
    ['MOT Expiry Date', formatDate(data.motExpiryDate)],
    ...(data.additionalNotes ? [['Additional Notes', data.additionalNotes]] : []),
  ] as [string, string | undefined][]).filter(([, v]) => v && String(v).trim() !== '' && String(v).trim() !== 'N/A') as [string, string][];

  if (conditionFields.length > 0) {
    const pageH = doc.internal.pageSize.getHeight();
    if (currentY + 60 > pageH - 20) { doc.addPage(); currentY = 25; }

    drawSectionBar(doc, 'Vehicle History', currentY);
    currentY += 15;

    const conditionBody: string[][] = [];
    for (let i = 0; i < conditionFields.length; i += 2) {
      const left = conditionFields[i];
      const right = conditionFields[i + 1];
      conditionBody.push([left[0], left[1], right ? right[0] : '', right ? right[1] : '']);
    }

    autoTable(doc, {
      startY: currentY,
      body: conditionBody,
      styles: { fontSize: 10, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 5, right: 5 },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && (hookData.column.index === 0 || hookData.column.index === 2)) {
          let pad = hookData.cell.styles.cellPadding;
          if (typeof pad === 'number') {
            hookData.cell.styles.cellPadding = { top: pad, right: pad, bottom: pad, left: pad + 7 };
          } else {
            hookData.cell.styles.cellPadding = { ...pad, left: (pad.left || 2) + 7 };
          }
        }
      },
      didDrawCell: (hookData: any) => {
        if (hookData.section === 'body' && (hookData.column.index === 0 || hookData.column.index === 2)) {
          const label = String(hookData.cell.raw || '');
          const key = getIconKey(label);
          const icon = key ? iconCache[key] : null;
          if (icon) {
            const x = hookData.cell.x + 1.5;
            const y = hookData.cell.y + (hookData.cell.height - 5) / 2;
            try { doc.addImage(icon, 'PNG', x, y, 5, 5); } catch { /* skip */ }
          }
        }
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 7;
  }

  // ── MECHANICAL & FLUID CHECKS (exact match) ───────────────────────────────

  const checkVal = (v: boolean | undefined): string | null =>
    v === undefined ? null : v ? 'Pass' : 'Fail';

  const mechanicalFields: [string, string | null][] = [
    ['Lights Check', checkVal(data.lightsCheck)],
    ['Mirrors Check', checkVal(data.mirrorsCheck)],
    ['Wipers Check', checkVal(data.wipersCheck)],
    ['Engine Start Smooth', checkVal(data.engineStartSmooth)],
    ['Steering Alignment', checkVal(data.steeringAlignment)],
    ['Brake Performance', checkVal(data.brakePerformance)],
    ['Gear Shift Quality', checkVal(data.gearShiftQuality)],
    ['Oil Leakage', formatCheckValue(data.oilLeakage)],
    ['Oil Color', formatCheckValue(data.oilColor)],
    ['Oil Level', data.oilLevel != null ? `${data.oilLevel}%` : null],
    ['Coolant Level', formatCheckValue(data.coolantLevel)],
    ['Coolant Color', formatCheckValue(data.coolantColor)],
    ['Coolant Level %', data.coolantLevelPercent != null ? `${data.coolantLevelPercent}%` : null],
    ['Brake Fluid Level', formatCheckValue(data.brakeFluidLevel)],
    ['Warning Lights/Messages', data.warningLights || null],
    ['Battery Condition', formatCheckValue(data.batteryCondition)],
    ['Exhaust Condition', formatCheckValue(data.exhaustCondition)],
    ...(data.mechanicalNotes ? [['Mechanical Notes', data.mechanicalNotes] as [string, string]] : []),
  ];

  const validMechanical = mechanicalFields.filter(([, v]) => v && String(v).trim() !== '' && String(v).trim() !== 'N/A') as [string, string][];

  if (validMechanical.length > 0) {
    const pageH = doc.internal.pageSize.getHeight();
    if (currentY + 60 > pageH - 20) { doc.addPage(); currentY = 25; }

    drawSectionBar(doc, 'Mechanical & Fluid Checks', currentY);
    currentY += 15;

    const mechanicalBody: string[][] = [];
    for (let i = 0; i < validMechanical.length; i += 2) {
      const left = validMechanical[i];
      const right = validMechanical[i + 1];
      mechanicalBody.push([left[0], left[1], right ? right[0] : '', right ? right[1] : '']);
    }

    autoTable(doc, {
      startY: currentY,
      body: mechanicalBody,
      styles: { fontSize: 10, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 5, right: 5 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [60, 60, 60] },
        1: { textColor: [0, 0, 0] },
        2: { fontStyle: 'bold', textColor: [60, 60, 60] },
        3: { textColor: [0, 0, 0] },
      },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && (hookData.column.index === 0 || hookData.column.index === 2)) {
          let pad = hookData.cell.styles.cellPadding;
          if (typeof pad === 'number') {
            hookData.cell.styles.cellPadding = { top: pad, right: pad, bottom: pad, left: pad + 7 };
          } else {
            hookData.cell.styles.cellPadding = { ...pad, left: (pad.left || 2) + 7 };
          }
        }
      },
      didDrawCell: (hookData: any) => {
        if (hookData.section === 'body' && (hookData.column.index === 0 || hookData.column.index === 2)) {
          const label = String(hookData.cell.raw || '');
          const key = getIconKey(label);
          const icon = key ? iconCache[key] : null;
          if (icon) {
            const x = hookData.cell.x + 1.5;
            const y = hookData.cell.y + (hookData.cell.height - 5) / 2;
            try { doc.addImage(icon, 'PNG', x, y, 5, 5); } catch { /* skip */ }
          }
        }
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 7;
  }

  // ── FOOTER (exact match) ──────────────────────────────────────────────────

  addFooterAllPages(doc, data);

  // ── SAVE ─────────────────────────────────────────────────────────────────

  const reportTypeSafe = (data.reportType || 'condition').toLowerCase().replace(/\s+/g, '_');
  const filename = `${data.vehicleVRM || 'vehicle'}_${reportTypeSafe}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};
