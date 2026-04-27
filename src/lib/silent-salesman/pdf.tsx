import React from 'react';
import QRCode from 'qrcode';
import { Circle, Document, Font, Image, Page, Path, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from '@react-pdf/renderer';
import {
    mergeVehicleForPdf,
    normalizeFeatureStrings,
    pickSilentSalesmanDescriptionFromVehicle,
    SILENT_SALESMAN_MAX_FEATURE_BULLETS,
    vPick,
} from '@/lib/silent-salesman/vehicle-fields';

// Avoid ugly word breaks ("list-ing") in narrow QR caption columns.
Font.registerHyphenationCallback((word: string) => [word]);

type TemplateId = 'classic' | 'specOptions' | 'simpleFinance';

type SilentSalesmanOptions = {
    template?: TemplateId;
    heading?: string;
    description?: string;
    showPrice?: boolean;
    showOptionalExtras?: boolean;
    highlights?: string[];
    financeExample?: {
        deposit?: number;
        termMonths?: number;
        apr?: number;
        monthly?: number;
        cashPrice?: number;
    };
};

type RenderArgs = {
    vehicle: any;
    tenantId: string;
    tenantName?: string;
    options: SilentSalesmanOptions;
    publicBaseUrl: string;
};

const styles = StyleSheet.create({
    page: { padding: 24, fontSize: 10, color: '#0f172a', fontFamily: 'Helvetica' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    title: { fontSize: 18, fontWeight: 700 },
    subtitle: { fontSize: 11, color: '#334155', marginTop: 4 },
    tag: { fontSize: 9, color: '#334155', border: '1 solid #e2e8f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    grid2: { flexDirection: 'row', gap: 10 },
    col: { flex: 1 },
    card: { border: '1 solid #e2e8f0', borderRadius: 12, padding: 12, backgroundColor: '#ffffff' },
    sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 8, color: '#1e293b' },
    kvRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1 solid #f1f5f9', paddingVertical: 5 },
    kvKey: { color: '#64748b' },
    kvVal: { fontWeight: 700, color: '#0f172a' },
    photoRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    photo: { width: '33.33%', height: 150, borderRadius: 10, objectFit: 'cover', backgroundColor: '#f1f5f9' },
    qrWrap: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    qrImgWrap: { flexShrink: 0 },
    qrTextCol: { flex: 1, minWidth: 118 },
    qr: { width: 90, height: 90, borderRadius: 10, border: '1 solid #e2e8f0' },
    qrText: { fontSize: 10, color: '#334155', lineHeight: 1.4 },
    bullet: { flexDirection: 'row', gap: 6, marginBottom: 4 },
    dot: { width: 6, height: 6, borderRadius: 6, marginTop: 3, backgroundColor: '#2563eb' },
    small: { fontSize: 9, color: '#64748b' },
    /* Simple With Finance — showroom / MotorDesk-style layout */
    sfBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sfDealer: { fontSize: 20, fontWeight: 800, color: '#1e3a8a', maxWidth: '62%' },
    sfCta: { fontSize: 18, fontWeight: 500, color: '#1e3a8a', textAlign: 'right' },
    sfHeroContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    sfHeroLeft: { flex: 1, paddingRight: 20, justifyContent: 'center' },
    sfHero: { fontSize: 26, fontWeight: 700, color: '#0f172a' },
    sfSub: { fontSize: 14, color: '#1e293b', marginTop: 4, lineHeight: 1.3 },
    sfPrice: { fontSize: 36, fontWeight: 800, color: '#0f172a', marginTop: 12 },
    sfQrLarge: { width: 160, height: 160 },
    sfGridTitle: { fontSize: 18, fontWeight: 500, color: '#0f172a', marginTop: 10, marginBottom: 12 },
    sfGridRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    sfCell: { flex: 1, paddingHorizontal: 2, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
    sfIconBox: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex',
    },
    sfIconTxt: { fontSize: 6, fontWeight: 800, color: '#334155' },
    sfTextWrap: { flex: 1 },
    sfLbl: { fontSize: 8, color: '#475569' },
    sfVal: { fontSize: 10, fontWeight: 500, color: '#0f172a', marginTop: 1 },
    sfDescTitle: { fontSize: 18, fontWeight: 500, marginTop: 20, marginBottom: 10, color: '#0f172a' },
    sfDesc: { fontSize: 10, color: '#1e293b', lineHeight: 1.5 },
    sfBulletRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
    sfBulletDot: { width: 3, height: 3, borderRadius: 1.5, marginTop: 5, backgroundColor: '#0f172a' },
});

function HighlightIcon({ abbr, label }: { abbr: string; label: string }) {
    const l = (label || '').toLowerCase();
    const stroke = '#0f172a';
    const sW = 1.2;
    const common = { width: 20, height: 20, viewBox: '0 0 24 24' } as const;

    const icon = (() => {
        if (l.includes('year')) {
            return (
                <Svg {...common}>
                    <Rect x="4" y="5" width="16" height="15" rx="2" stroke={stroke} fill="none" strokeWidth={sW} />
                    <Path d="M7 3v4M17 3v4M4 10h16" stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                    <Path d="M9 135h1.5a1 1 0 0 1 1 1.5 1 1 0 0 1-1 1.5h-.5m.5 0a1.5 1.5 0 0 1 0 3H9" stroke={stroke} fill="none" strokeWidth={sW} />
                    <Path d="M10 14h3v1h-2v1h2v1h-3M15 14v3h2v-3" stroke={stroke} fill="none" strokeWidth={sW} strokeLinejoin="round"/>
                    {/* Fold corner effect */}
                    <Path d="M16 20v-4h4" stroke={stroke} fill="none" strokeWidth={sW} strokeLinejoin="round"/>
                </Svg>
            );
        }
        if (l.includes('mileage')) {
            return (
                <Svg {...common}>
                    <Rect x="3" y="7" width="18" height="10" rx="2" stroke={stroke} fill="none" strokeWidth={sW} />
                    <Path d="M9 7v10M15 7v10" stroke={stroke} strokeWidth={sW} />
                    <Path d="M6 10v4M12 10v4M18 10v4" stroke={stroke} strokeWidth={sW} strokeLinecap="round"/>
                </Svg>
            );
        }
        if (l.includes('seat')) {
            return (
                <Svg {...common}>
                    <Path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" stroke={stroke} fill="none" strokeWidth={sW} strokeLinejoin="round" />
                    <Path d="M5 14h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2z" stroke={stroke} fill="none" strokeWidth={sW} strokeLinejoin="round"/>
                    <Path d="M12 11v7" stroke={stroke} strokeWidth={sW} />
                    <Path d="M8 11h8" stroke={stroke} strokeWidth={sW} strokeLinecap="round"/>
                </Svg>
            );
        }
        if (l.includes('door')) {
            return (
                <Svg {...common}>
                    <Path d="M5 19V8a2 2 0 0 1 2-2h4l5 5h3a2 2 0 0 1 2 2v6Z" fill="none" stroke={stroke} strokeWidth={sW} strokeLinejoin="round"/>
                    <Path d="M5 11h14M11 6v5" stroke={stroke} strokeWidth={sW} />
                    <Path d="M16 14h2" stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                </Svg>
            );
        }
        if (l.includes('body')) {
            return (
                <Svg {...common}>
                    <Path d="M4 14l2-4 3-3h6l4 3 2 4v3H4v-3z" stroke={stroke} fill="none" strokeWidth={sW} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx="7" cy="17" r="2" stroke={stroke} fill="none" strokeWidth={sW} />
                    <Circle cx="17" cy="17" r="2" stroke={stroke} fill="none" strokeWidth={sW} />
                    <Path d="M10 7v5M15 7v5" stroke={stroke} strokeWidth={sW} />
                    <Path d="M4 12h17" stroke={stroke} strokeWidth={sW} strokeLinecap="round"/>
                </Svg>
            );
        }
        if (l.includes('colour') || l.includes('color')) {
            return (
                <Svg {...common}>
                     <Path d="M9 2v4M15 2v4" stroke={stroke} strokeWidth={sW} strokeLinecap="round"/>
                     <Rect x="7" y="6" width="10" height="6" rx="1" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Path d="M7 12h10v4H7z" stroke={stroke} fill="none" strokeWidth={sW} strokeLinejoin="round"/>
                     <Path d="M3 20h18M5 17h14" stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                </Svg>
            );
        }
        if (l.includes('fuel')) {
            return (
                <Svg {...common}>
                    <Rect x="5" y="5" width="10" height="15" rx="2" stroke={stroke} fill="none" strokeWidth={sW} />
                    <Rect x="7" y="8" width="6" height="4" stroke={stroke} fill="none" strokeWidth={sW} />
                    <Path d="M15 9h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3" stroke={stroke} fill="none" strokeWidth={sW} strokeLinecap="round" />
                    <Path d="M20 16v4M5 12h10M5 16h10" stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                </Svg>
            );
        }
        if (l.includes('transmission')) {
            return (
                <Svg {...common}>
                     <Path d="M5 6v7M12 6v12M19 6v7" stroke={stroke} fill="none" strokeWidth={sW} strokeLinecap="round" strokeLinejoin="round" />
                     <Path d="M5 13h14" stroke={stroke} fill="none" strokeWidth={sW} strokeLinecap="round" />
                     <Circle cx="5" cy="5" r="1.5" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Circle cx="12" cy="5" r="1.5" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Circle cx="19" cy="5" r="1.5" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Circle cx="5" cy="14" r="1.5" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Circle cx="12" cy="19" r="1.5" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Circle cx="19" cy="14" r="1.5" stroke={stroke} fill="none" strokeWidth={sW} />
                </Svg>
            );
        }
        if (l.includes('drivetrain')) {
            return (
                <Svg {...common}>
                     <Path d="M12 6v12M8 6h8M8 18h8" stroke={stroke} fill="none" strokeWidth={sW} strokeLinecap="round" />
                     <Rect x="4" y="4" width="4" height="4" rx="1" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Rect x="16" y="4" width="4" height="4" rx="1" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Rect x="4" y="16" width="4" height="4" rx="1" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Rect x="16" y="16" width="4" height="4" rx="1" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Rect x="10" y="10" width="4" height="4" rx="1" stroke={stroke} fill="none" strokeWidth={sW} />
                </Svg>
            );
        }
        if (l.includes('engine')) {
            return (
                <Svg {...common}>
                     <Path d="M8 8h2l1-3h2l1 3h2v10H8V8z" stroke={stroke} fill="none" strokeWidth={sW} strokeLinejoin="round" />
                     <Path d="M5 10h3M5 15h3M16 10h3M16 15h3M11 6v2M13 6v2M12 11l-2 3h4l-2 3" stroke={stroke} strokeWidth={sW} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </Svg>
            );
        }
        if (l === 'mpg') {
            return (
                <Svg {...common}>
                     <Path d="M4 16A8 8 0 0 1 20 16" stroke={stroke} fill="none" strokeWidth={sW} strokeLinecap="round" />
                     <Path d="M12 16l4-4" stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                     <Circle cx="12" cy="16" r="1" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Path d="M6 11l1 1M18 11l-1 1M12 8v2" stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                     <Path d="M3 18h-2v-2h2M1 17h1.5" stroke={stroke} strokeWidth={0.8} />
                     <Path d="M22 18v-2h2M22 17h1.5" stroke={stroke} strokeWidth={0.8} />
                </Svg>
            );
        }
        if (l.includes('co2')) {
            return (
                <Svg {...common}>
                     <Path d="M5 13a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1.5 3.5 3.5 0 0 1 .5 6.5H5Z" stroke={stroke} fill="none" strokeWidth={sW} strokeLinejoin="round" />
                     <Circle cx="12" cy="18" r="1.5" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Path d="M9 16.5a1.5 1.5 0 0 0 0 3" stroke={stroke} fill="none" strokeWidth={sW} strokeLinecap="round"/>
                     <Path d="M14 16.5h2v1h-2v1h2" stroke={stroke} fill="none" strokeWidth={sW} strokeLinecap="square" strokeLinejoin="bevel"/>
                </Svg>
            );
        }
        if (l.includes('emission')) {
            return (
                <Svg {...common}>
                     <Rect x="4" y="9" width="10" height="6" rx="2" stroke={stroke} fill="none" strokeWidth={sW} />
                     <Path d="M2 12h2M14 12h3" stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                     <Path d="M17 11.5v2M8 12h2" stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                     <Path d="M20 9.5l1 1M21.5 14l1-1M19 12h1" stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                </Svg>
            );
        }
        if (l.includes('insurance')) {
            return (
                <Svg {...common}>
                     <Path d="M4 13a8 8 0 0 1 16 0z" stroke={stroke} fill="none" strokeWidth={sW} strokeLinejoin="round" />
                     <Path d="M12 13v6a2 2 0 0 1-2 2" stroke={stroke} fill="none" strokeWidth={sW} strokeLinecap="round" />
                     <Path d="M12 5v8" stroke={stroke} strokeWidth={sW} />
                     <Path d="M8 13q2-4 4-8q2 4 4 8" stroke={stroke} fill="none" strokeWidth={sW} />
                </Svg>
            );
        }
        return null;
    })();

    if (icon) return icon;
    return <Text style={styles.sfIconTxt}>{abbr}</Text>;
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/** Build ALL possible spec cells from vehicle data. Labels match the UI checkbox labels exactly. */
function motorDeskSpecCells(vv: any): { abbr: string; label: string; value: string }[] {
    const rows: { abbr: string; label: string; value: string | null }[] = [];

    // Use highlightValueForUiLabel so field resolution is always in sync.
    for (const label of [
        'Year','Age','Mileage','Hours Used','Previous Owners','Seats','Doors','Body Type',
        'Colour','Fuel Type','Fuel Capacity','Transmission','Drivetrain',
        'Engine Size','Engine Cylinders','Engine Power (BHP)','Engine Power (PS)',
        'Engine Torque (Nm)','Engine Torque (lbs/ft)',
        'Battery Full Charge Time','Battery Quick Charge Time','Battery Capacity','Battery Range','Battery Health',
        'Height','Width','Length','Kerb Weight','Gross Weight','Unladen Weight','MTPLM',
        'Load Height','Load Width','Load Length','Load Weight','Load Volume','Boot Space',
        'Cab Type','Driver Position','Bedroom Layout','End Layout','Bedrooms','Berths','Seat Belts',
        'Acceleration','Top Speed','Fuel Consumption',
        'CO2 Emissions','Emission Class','ULEZ Compliance','CAZ Compliance','Insurance Class',
        'Warranty','Remaining Warranty','Battery Warranty','Remaining Battery Warranty','Extended Warranty',
        'UK Road Tax (VED)','Registration',
    ]) {
        const val = highlightValueForUiLabel(vv, label);
        if (val != null && String(val).trim() !== '') {
            const abbr = label.replace(/[^A-Z]/g, '').slice(0, 2) || label.slice(0, 2).toUpperCase();
            rows.push({ abbr, label, value: val });
        }
    }

    return rows.filter((r): r is { abbr: string; label: string; value: string } => r.value != null && r.value.trim() !== '');
}

function firstNonEmpty(...vals: any[]) {
    for (const v of vals) {
        if (v == null) continue;
        const s = String(v).trim();
        if (s !== '' && s !== 'undefined' && s !== 'null') return v;
    }
    return null;
}

function engineLabel(vehicle: any) {
    const litres = firstNonEmpty(vehicle?.engineSize, vehicle?.badgeEngineSizeLitres);
    if (litres != null && Number.isFinite(Number(litres))) return `${Number(litres)}L`;
    const cc = firstNonEmpty(vehicle?.engineCapacityCC, vehicle?.badgeEngineSizeCC);
    if (cc != null && Number.isFinite(Number(cc))) return `${Number(cc).toLocaleString('en-GB')}cc`;
    return firstNonEmpty(vehicle?.engineSize, vehicle?.engine) as any;
}

function transmissionLabel(vehicle: any) {
    return firstNonEmpty(vehicle?.transmissionType, vehicle?.transmission, vehicle?.gearbox) as any;
}

function fuelLabel(vehicle: any) {
    return firstNonEmpty(vehicle?.fuelType, vehicle?.fuel, vehicle?.fuelTypeLabel) as any;
}

function doorsLabel(vehicle: any) {
    return firstNonEmpty(vehicle?.doors, vehicle?.numberOfDoors) as any;
}

function colourLabel(vehicle: any) {
    return firstNonEmpty(vehicle?.colour, vehicle?.colourName, vehicle?.color, vehicle?.paintColor) as any;
}

function yearLabel(vehicle: any) {
    return firstNonEmpty(vehicle?.yearOfManufacture, vehicle?.year, vehicle?.plate) as any;
}

function mileageNum(vehicle: any): number | null {
    const raw = firstNonEmpty(vehicle?.odometerReadingMiles, vehicle?.mileage);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

/**
 * UI sends checkbox labels (e.g. "Engine Size"); resolve to a display value for PDF.
 * Every label from SS_ALL_HIGHLIGHTS is handled here.
 */
function highlightValueForUiLabel(vehicle: any, label: string): string | null {
    const key = String(label || '').trim();
    const v = vehicle;

    const fe = (...vals: any[]) => {
        const r = firstNonEmpty(...vals);
        return r != null ? String(r) : null;
    };

    switch (key) {
        /* ── Core ────────────────────────────────── */
        case 'Year': {
            const yr = yearLabel(v);
            return yr != null ? String(yr) : null;
        }
        case 'Age': {
            const yr = yearLabel(v);
            if (yr == null) return null;
            const n = Number(yr);
            if (!Number.isFinite(n) || n < 1900) return null;
            return `${new Date().getFullYear() - n} years`;
        }
        case 'Mileage': {
            const m = mileageNum(v);
            if (m == null) return null;
            return `${m.toLocaleString('en-GB')} miles`;
        }
        case 'Hours Used':
            return fe(v?.hoursUsed, v?.engineHours, v?.hours);
        case 'Previous Owners':
            // AT Vehicles API uses 'owners'; Stock/History uses 'previousOwners'
            return fe(v?.previousOwners, v?.owners, v?.numberOfPreviousOwners, v?.history?.previousOwners);
        case 'Seats':
            return fe(v?.seats, v?.numberOfSeats, v?.seatCount);
        case 'Doors':
            return doorsLabel(v) != null ? String(doorsLabel(v)) : null;
        case 'Body Type':
            return fe(v?.bodyType, v?.bodyStyle, v?.body);
        case 'Colour':
            return colourLabel(v) != null ? String(colourLabel(v)) : null;
        case 'Fuel Type':
            return fuelLabel(v) != null ? String(fuelLabel(v)) : null;
        case 'Fuel Capacity': {
            // AT API: fuelCapacityLitres
            const fc = firstNonEmpty(v?.fuelCapacityLitres, v?.fuelCapacity, v?.fuelTankCapacity);
            if (fc == null || !Number.isFinite(Number(fc))) return null;
            return `${Number(fc)}L`;
        }
        case 'Transmission':
            return transmissionLabel(v) != null ? String(transmissionLabel(v)) : null;
        case 'Drivetrain':
            // AT API: drivetrain or driveType (4X2, FWD etc.)
            return fe(v?.drivetrain, v?.driveType);
        /* ── Engine ───────────────────────────────── */
        case 'Engine Size':
            return engineLabel(v) != null ? String(engineLabel(v)) : null;
        case 'Engine Cylinders':
            return fe(v?.cylinders, v?.engineCylinders, v?.numberOfCylinders);
        case 'Engine Power (BHP)': {
            // AT API: enginePowerBHP
            const bhp = firstNonEmpty(v?.enginePowerBHP, v?.powerBHP, v?.bhp);
            if (bhp == null || !Number.isFinite(Number(bhp))) return null;
            return `${Math.round(Number(bhp))} bhp`;
        }
        case 'Engine Power (PS)': {
            // AT API: enginePowerPS
            const ps = firstNonEmpty(v?.enginePowerPS, v?.powerPS, v?.ps);
            if (ps == null || !Number.isFinite(Number(ps))) return null;
            return `${Math.round(Number(ps))} ps`;
        }
        case 'Engine Torque (Nm)': {
            // AT API: engineTorqueNM
            const nm = firstNonEmpty(v?.engineTorqueNM, v?.torqueNm, v?.engineTorqueNm, v?.torque);
            if (nm == null || !Number.isFinite(Number(nm))) return null;
            return `${Math.round(Number(nm))} Nm`;
        }
        case 'Engine Torque (lbs/ft)': {
            // AT API: engineTorqueLBFT
            const lb = firstNonEmpty(v?.engineTorqueLBFT, v?.torqueLbsFt, v?.engineTorqueLbFt, v?.torqueLbft);
            if (lb == null || !Number.isFinite(Number(lb))) return null;
            return `${Math.round(Number(lb))} lb/ft`;
        }
        /* ── Battery / EV ─────────────────────────── */
        case 'Battery Full Charge Time':
            return fe(v?.batteryFullChargeTime, v?.fullChargeTime, v?.chargeTimeFull);
        case 'Battery Quick Charge Time':
            return fe(v?.batteryQuickChargeTime, v?.quickChargeTime, v?.chargeTimeQuick, v?.rapidChargeTime);
        case 'Battery Capacity': {
            // AT API: batteryCapacityKWH, batteryUsableCapacityKWH
            const bc = firstNonEmpty(v?.batteryCapacityKWH, v?.batteryUsableCapacityKWH, v?.batteryCapacityKWh, v?.batteryCapacity);
            if (bc == null || !Number.isFinite(Number(bc))) return null;
            return `${Number(bc)} kWh`;
        }
        case 'Battery Range': {
            // AT API: batteryRangeMiles
            const r = firstNonEmpty(v?.batteryRangeMiles, v?.batteryRange, v?.electricRange, v?.rangeElectricMiles);
            if (r == null || !Number.isFinite(Number(r))) return null;
            return `${Math.round(Number(r))} miles`;
        }
        case 'Battery Health':
            return fe(v?.batteryHealth, v?.batteryCondition);
        /* ── Dimensions / Weight ──────────────────── */
        case 'Height':
            return fe(v?.heightMM, v?.height, v?.overallHeight);
        case 'Width':
            return fe(v?.widthMM, v?.width, v?.overallWidth);
        case 'Length':
            return fe(v?.lengthMM, v?.length, v?.overallLength);
        case 'Weight':
            return fe(v?.weight, v?.vehicleWeight);
        case 'Kerb Weight': {
            // AT API: minimumKerbWeightKG
            const kw = firstNonEmpty(v?.minimumKerbWeightKG, v?.kerbWeightKG, v?.kerbWeight);
            if (kw == null || !Number.isFinite(Number(kw))) return null;
            return `${Math.round(Number(kw))} kg`;
        }
        case 'Gross Weight': {
            // AT API: grossVehicleWeightKG
            const gw = firstNonEmpty(v?.grossVehicleWeightKG, v?.grossCombinedWeightKG, v?.grossWeight, v?.gvw);
            if (gw == null || !Number.isFinite(Number(gw))) return null;
            return `${Math.round(Number(gw))} kg`;
        }
        case 'Unladen Weight': {
            const uw = firstNonEmpty(v?.unladenWeight, v?.unladenMass);
            if (uw == null || !Number.isFinite(Number(uw))) return null;
            return `${Math.round(Number(uw))} kg`;
        }
        case 'MTPLM':
            return fe(v?.mtplm, v?.maximumTechPermissibleLadenMass, v?.maxLadenMass);
        /* ── Payload / Van ────────────────────────── */
        case 'Load Height':
            // AT API: payloadHeightMM
            return fe(v?.payloadHeightMM, v?.loadHeight, v?.loadHeightMM);
        case 'Load Width':
            return fe(v?.payloadWidthMM, v?.loadWidth, v?.loadWidthMM);
        case 'Load Length':
            return fe(v?.payloadLengthMM, v?.loadLength, v?.loadLengthMM);
        case 'Load Weight': {
            // AT API: payloadWeightKG
            const lw = firstNonEmpty(v?.payloadWeightKG, v?.loadWeight, v?.payload);
            if (lw == null || !Number.isFinite(Number(lw))) return null;
            return `${Math.round(Number(lw))} kg`;
        }
        case 'Load Volume': {
            // AT API: payloadVolumeCubicMetres
            const lv = firstNonEmpty(v?.payloadVolumeCubicMetres, v?.loadVolume, v?.loadVolumeM3);
            if (lv == null) return null;
            return `${lv} m³`;
        }
        case 'Boot Space': {
            // AT API: bootSpaceSeatsUpLitres
            const b = firstNonEmpty(v?.bootSpaceSeatsUpLitres, v?.bootSpaceSeatsDownLitres, v?.bootSpace, v?.bootCapacityLitres);
            if (b == null || !Number.isFinite(Number(b))) return null;
            return `${Math.round(Number(b))}L`;
        }
        case 'Cab Type':
            return fe(v?.cabType, v?.cab);
        case 'Driver Position':
            return fe(v?.driverPosition, v?.steeringPosition, v?.steering);
        /* ── Leisure / Motorhome ──────────────────── */
        case 'Bedroom Layout':
            return fe(v?.bedroomLayout, v?.bedLayout);
        case 'End Layout':
            return fe(v?.endLayout);
        case 'Bedrooms':
            return fe(v?.bedrooms, v?.numberOfBedrooms);
        case 'Berths':
            return fe(v?.berths, v?.numberOfBerths);
        case 'Seat Belts':
            return fe(v?.seatBelts, v?.numberOfSeatBelts);
        /* ── Performance ──────────────────────────── */
        case 'Acceleration': {
            // AT API: zeroToSixtyMPHSeconds, zeroToOneHundredKMPHSeconds
            const a = firstNonEmpty(v?.zeroToSixtyMPHSeconds, v?.zeroToOneHundredKMPHSeconds, v?.acceleration, v?.zeroToSixty);
            if (a == null || !Number.isFinite(Number(a))) return null;
            return `${Number(a)}s 0-62mph`;
        }
        case 'Top Speed': {
            // AT API: topSpeedMPH
            const ts = firstNonEmpty(v?.topSpeedMPH, v?.topSpeed, v?.maxSpeed);
            if (ts == null || !Number.isFinite(Number(ts))) return null;
            return `${Math.round(Number(ts))} mph`;
        }
        case 'Fuel Consumption': {
            const mpg = firstNonEmpty(v?.fuelEconomyWLTPCombinedMPG, v?.fuelEconomyNEDCCombinedMPG, v?.combinedFuelEconomyMPG, v?.fuelConsumption);
            if (mpg == null || !Number.isFinite(Number(mpg))) return null;
            return `${Number(mpg).toFixed(1)} mpg`;
        }
        /* ── Emissions / Tax ──────────────────────── */
        case 'CO2 Emissions': {
            const co2 = firstNonEmpty(v?.co2EmissionGPKM, v?.co2Emissions);
            if (co2 == null || !Number.isFinite(Number(co2))) return null;
            return `${Math.round(Number(co2))} g/km`;
        }
        case 'Emission Class':
            return fe(v?.emissionClass, v?.euroEmissions, v?.euroStatus);
        case 'ULEZ Compliance':
            return fe(v?.ulezCompliant, v?.ulez, v?.ulezCompliance);
        case 'CAZ Compliance':
            return fe(v?.cazCompliant, v?.caz, v?.cazCompliance);
        case 'Insurance Class':
            // AT API: insuranceGroup
            return fe(v?.insuranceGroup, v?.insuranceClass, v?.insurance);
        /* ── Admin / Warranty ─────────────────────── */
        case 'Warranty':
            // AT API: warrantyMonthsOnPurchase
            return fe(v?.warrantyMonthsOnPurchase, v?.warrantyMonths, v?.warranty);
        case 'Remaining Warranty':
            return fe(v?.remainingWarranty, v?.warrantyExpiry);
        case 'Battery Warranty':
            return fe(v?.batteryWarranty);
        case 'Remaining Battery Warranty':
            return fe(v?.remainingBatteryWarranty);
        case 'Extended Warranty':
            return fe(v?.extendedWarranty);
        case 'UK Road Tax (VED)': {
            // AT API: vehicleExciseDutyWithoutSupplementGBP
            const ved = firstNonEmpty(v?.vehicleExciseDutyWithoutSupplementGBP, v?.roadTax, v?.ved, v?.annualRoadTax, v?.taxBand);
            if (ved == null) return null;
            if (Number.isFinite(Number(ved))) return `£${Math.round(Number(ved))}/yr`;
            return String(ved);
        }
        case 'Registration':
            // AT API: registration (the plate), or plate shorthand
            return fe(v?.registration, v?.vrm, v?.registrationNumber, v?.plate, v?.reg);
        default:
            return null;
    }
}

function ResolvedHighlightRows({ vehicle, labels }: { vehicle: any; labels: string[] }) {
    const rows = labels
        .map(l => {
            const val = highlightValueForUiLabel(vehicle, l);
            if (val == null || String(val).trim() === '') return null;
            return { label: l, val: String(val) };
        })
        .filter(Boolean) as { label: string; val: string }[];

    if (!rows.length) {
        return <Text style={styles.small}>No data for the selected highlights (check vehicle fields).</Text>;
    }

    return (
        <>
            {rows.map((row, i) => (
                <View key={`${i}-${row.label}`} style={styles.kvRow}>
                    <Text style={styles.kvKey}>{row.label}</Text>
                    <Text style={styles.kvVal}>{row.val}</Text>
                </View>
            ))}
        </>
    );
}

/** Skip Key details / spec rows when the same field is already shown under Vehicle highlights. */
const KEY_ROW_TO_HIGHLIGHT_LABEL: Record<string, string> = {
    Year: 'Year',
    Mileage: 'Mileage',
    Fuel: 'Fuel',
    Transmission: 'Transmission',
    Engine: 'Engine Size',
    Doors: 'Doors',
    Colour: 'Colour',
};

function keyRowVisible(rowLabel: string, selectedHighlights: string[]) {
    const hl = KEY_ROW_TO_HIGHLIGHT_LABEL[rowLabel];
    if (!hl) return true;
    return !selectedHighlights.includes(hl);
}

function money(n: any) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return `£${Math.round(x).toLocaleString('en-GB')}`;
}

function buildListingUrl(publicBaseUrl: string, vehicle: any, tenantId: string) {
    // Match in-app vehicle detail URL (Mongo id or at-{stockId}); server sets _silentSalesmanRouteId.
    const base = (publicBaseUrl || '').replace(/\/$/, '');
    const slug =
        vehicle?._silentSalesmanRouteId ||
        (vehicle?._id ? String(vehicle._id) : '') ||
        (vehicle?.stockId ? `at-${vehicle.stockId}` : '') ||
        (vehicle?.id ? String(vehicle.id) : '');
    if (!slug || slug === 'undefined') {
        throw new Error('Missing vehicle id for listing link.');
    }
    const path = `/app/vehicles/${slug}`;
    const url = base ? `${base}${path}` : path;
    return `${url}?src=silent-salesman&tenant=${encodeURIComponent(tenantId)}`;
}

function normalizeImageUrls(vehicle: any): string[] {
    if (Array.isArray(vehicle?.images) && vehicle.images.length && typeof vehicle.images[0] === 'string') {
        return vehicle.images.map((u: string) => u.replace('{resize}', 'w800h600'));
    }
    const out: string[] = [];
    const media = vehicle?.media?.images;
    if (Array.isArray(media)) {
        for (const img of media) {
            const href = typeof img === 'string' ? img : img?.href;
            if (href) out.push(String(href).replace('{resize}', 'w800h600'));
        }
    }
    return out;
}

function ClassicTemplate({ vehicle, opts, qrDataUrl, tenantName, listingUrl }: {
    vehicle: any;
    opts: SilentSalesmanOptions;
    qrDataUrl: string;
    tenantName: string;
    listingUrl: string;
}) {
    const vv = mergeVehicleForPdf(vehicle);
    const images = normalizeImageUrls(vehicle);
    const mainPhoto = images[0] ?? null;
    const thumbs = images.slice(1, 3);

    const makeStr  = soStr(vv, 'make')  ?? '';
    const modelStr = soStr(vv, 'model') ?? '';
    const vehicleTitle = `${makeStr} ${modelStr}`.trim() || 'Vehicle';
    const derivativeFull = soStr(vv, 'derivative') ?? '';

    const price  = soNum(vv, 'price', 'retailPrice', 'forecourtPrice') ?? 0;
    const dealer = tenantName?.trim() || 'Dealership';

    // Spec cells (selected highlights → 2-col grid)
    const selectedHighlights = Array.isArray(opts.highlights) ? opts.highlights : [];
    const allCells = motorDeskSpecCells(vv);
    const specCells = selectedHighlights.length > 0
        ? allCells.filter(c => selectedHighlights.includes(c.label))
        : allCells;
    const specRows = chunk(specCells, 2);

    // Description
    const clientDesc = (opts.description || '').trim();
    const stripBullet = (l: string) => l.replace(/^[•\-*]\s*/, '').trim();
    let descText = '';
    let descBullets: string[] = [];
    if (clientDesc) {
        const blocks = clientDesc.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
        if (blocks.length >= 2) {
            descText = stripBullet(blocks[0]).slice(0, 600);
            descBullets = blocks.slice(1).join('\n').split(/\r?\n/).map(stripBullet).filter(Boolean);
        } else {
            const lines = clientDesc.split(/\r?\n/).map(stripBullet).filter(Boolean);
            if (lines.length > 1) descBullets = lines;
            else descText = clientDesc.slice(0, 600);
        }
    } else {
        descText = pickSilentSalesmanDescriptionFromVehicle(vehicle).slice(0, 600);
    }

    // Optional extras
    const rawFeatures: any[] = Array.isArray(vv?.features) ? vv.features : [];
    const { optional: optFeat } = soSplitFeatures(rawFeatures);
    const optGroups = soGroupFeatures(optFeat);

    return (
        <Page size="A4" style={[styles.page, { padding: 20 }]}>

            {/* ── Title row: Make+Model | Price ── */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{vehicleTitle}</Text>
                {opts.showPrice !== false && price > 0 && (
                    <Text style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{money(price)}</Text>
                )}
            </View>
            {derivativeFull && (
                <Text style={{ fontSize: 9, color: '#475569', marginBottom: 8 }}>{derivativeFull}</Text>
            )}

            {/* ── Two columns: Photos | Dealer brand + Spec grid ── */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>

                {/* Left: photos */}
                <View style={{ width: '44%' }}>
                    {mainPhoto ? (
                        <Image
                            style={{ width: '100%', height: 168, objectFit: 'cover', borderRadius: 3, marginBottom: 4 }}
                            src={mainPhoto}
                        />
                    ) : (
                        <View style={{ width: '100%', height: 168, backgroundColor: '#f1f5f9', borderRadius: 3, marginBottom: 4 }} />
                    )}
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                        {thumbs.length > 0 ? thumbs.map((img, i) => (
                            <Image key={i} style={{ flex: 1, height: 72, objectFit: 'cover', borderRadius: 3 }} src={img} />
                        )) : null}
                        {thumbs.length === 1 && <View style={{ flex: 1, height: 72, backgroundColor: '#f1f5f9', borderRadius: 3 }} />}
                    </View>
                </View>

                {/* Right: dealer branding + spec grid */}
                <View style={{ flex: 1 }}>
                    {/* Dealer name */}
                    <View style={{ alignItems: 'center', marginBottom: 6, paddingBottom: 4, borderBottom: '1 solid #e2e8f0' }}>
                        <Text style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a' }}>{dealer}</Text>
                    </View>

                    {/* Spec grid (2 per row) */}
                    {specRows.map((row, ri) => (
                        <View key={ri} style={[styles.sfGridRow, { marginBottom: 8 }]}>
                            {row.map(cell => (
                                <View key={cell.label} style={styles.sfCell}>
                                    <View style={styles.sfIconBox}>
                                        <HighlightIcon abbr={cell.abbr} label={cell.label} />
                                    </View>
                                    <View style={styles.sfTextWrap}>
                                        <Text style={styles.sfLbl}>{cell.label}</Text>
                                        <Text style={styles.sfVal}>{cell.value}</Text>
                                    </View>
                                </View>
                            ))}
                            {/* Pad to 2 if row has only 1 cell */}
                            {row.length < 2 && <View style={styles.sfCell} />}
                        </View>
                    ))}
                </View>
            </View>

            {/* ── Description ── */}
            {(descText || descBullets.length > 0) && (
                <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Description</Text>
                    {descText ? <Text style={{ fontSize: 9, color: '#334155', lineHeight: 1.4, marginBottom: 3 }}>{descText}</Text> : null}
                    {descBullets.map((b, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 2 }}>
                            <Text style={{ fontSize: 9, color: '#334155' }}>•</Text>
                            <Text style={{ fontSize: 9, color: '#334155', flex: 1, lineHeight: 1.35 }}>{b}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* ── Optional Extras ── */}
            {opts.showOptionalExtras !== false && optGroups.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Optional Extras</Text>
                    {optGroups.map((grp, gi) => (
                        <View key={gi} style={{ marginBottom: 3 }}>
                            {grp.category !== 'General' && (
                                <Text style={{ fontSize: 8, fontWeight: 700, color: '#334155', marginBottom: 2 }}>{grp.category}</Text>
                            )}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                {grp.items.map((item, ii) => (
                                    <Text key={ii} style={{ fontSize: 8, color: '#334155', width: '50%', paddingRight: 4, marginBottom: 1, lineHeight: 1.4 }}>{item}</Text>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* ── Footer: View & Reserve Online ── */}
            {(() => {
                let displayUrl = listingUrl;
                try { displayUrl = new URL(listingUrl).origin.replace(/^https?:\/\//, ''); } catch { /* keep full */ }
                return (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 6, padding: 12, marginTop: 'auto' }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>View & Reserve Online</Text>
                            <Text style={{ fontSize: 8, color: '#475569', marginBottom: 2 }}>Scan the QR code to find this vehicle on our website:</Text>
                            <Text style={{ fontSize: 8, color: '#475569', marginBottom: 2 }}>Or visit:</Text>
                            <Text style={{ fontSize: 8, color: '#3b82f6' }}>{displayUrl}</Text>
                        </View>
                        <Image style={{ width: 80, height: 80 }} src={qrDataUrl} />
                    </View>
                );
            })()}

            {/* ── Disclaimer ── */}
            <Text style={{ fontSize: 6, color: '#94a3b8', marginTop: 5, lineHeight: 1.5 }}>
                {'Please note, whilst every effort has been made to ensure the accuracy of this information and images, some errors may occur. It is important that you do not rely solely on this information or images, but check with your supplying dealer any items that may affect your decision to purchase this vehicle.'}
            </Text>

        </Page>
    );
}

/* ─── Spec & Options – helpers ───────────────────────────────────────────── */

type SoTechRow    = [string, string];
type SoTechSection = { title: string; rows: SoTechRow[] };
type SoFeatureGroup = { category: string; items: string[] };

function soNum(vv: any, ...keys: string[]): number | null {
    for (const k of keys) {
        const v = vPick(vv, k);
        if (v != null && Number.isFinite(Number(v))) return Number(v);
    }
    return null;
}
function soStr(vv: any, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = vPick(vv, k);
        if (v != null) {
            const s = String(v).trim();
            if (s !== '' && s.toLowerCase() !== 'unlisted') return s;
        }
    }
    return null;
}

function buildSoTechSections(vv: any): SoTechSection[] {
    const sections: SoTechSection[] = [];

    // Performance
    const perf: SoTechRow[] = [];
    const topSpd = soNum(vv, 'topSpeedMPH', 'topSpeed');
    if (topSpd) perf.push(['Top Speed', `${Math.round(topSpd)} mph`]);
    const z60 = soNum(vv, 'zeroToSixtyMPHSeconds');
    const z100 = soNum(vv, 'zeroToOneHundredKMPHSeconds');
    if (z60) perf.push(['0 - 62 mph', `${z60} Seconds`]);
    else if (z100) perf.push(['0 - 100 km/h', `${z100} Seconds`]);
    if (perf.length) sections.push({ title: 'Performance', rows: perf });

    // Engine
    const eng: SoTechRow[] = [];
    const make = soStr(vv, 'make');
    if (make) eng.push(['Manufacturer', make]);
    const cyl = soNum(vv, 'cylinders', 'engineCylinders');
    if (cyl) eng.push(['Cylinders', String(cyl)]);
    const arr = soStr(vv, 'cylinderArrangement');
    if (arr) eng.push(['Arrangement', arr]);
    const valves = soNum(vv, 'valves');
    if (valves) eng.push(['Valves', String(valves)]);
    const cc = soNum(vv, 'engineCapacityCC', 'badgeEngineSizeCC');
    if (cc) eng.push(['Engine Capacity', `${Math.round(cc).toLocaleString('en-GB')} cc`]);
    const bhp = soNum(vv, 'enginePowerBHP', 'powerBHP');
    const ps  = soNum(vv, 'enginePowerPS',  'powerPS');
    if (bhp || ps) {
        const pts: string[] = [];
        if (bhp) pts.push(`${Math.round(bhp)} bhp`);
        if (ps)  pts.push(`${Math.round(ps)} ps`);
        eng.push(['Engine Power', pts.join(' / ')]);
    }
    const tqNm = soNum(vv, 'engineTorqueNM', 'torqueNm');
    const tqLb = soNum(vv, 'engineTorqueLBFT', 'torqueLbsFt');
    if (tqNm || tqLb) {
        const pts: string[] = [];
        if (tqNm) pts.push(`${Math.round(tqNm)} Nm`);
        if (tqLb) pts.push(`${tqLb!.toFixed(2)} lbs/ft`);
        eng.push(['Engine Torque', pts.join(' / ')]);
    }
    const gears = soNum(vv, 'gears');
    if (gears) eng.push(['Gears', String(gears)]);
    const bore = soNum(vv, 'boreMM');
    if (bore) eng.push(['Bore', `${bore}`]);
    const stroke = soNum(vv, 'strokeMM');
    if (stroke) eng.push(['Stroke', `${stroke}`]);
    const fuelDel = soStr(vv, 'fuelDelivery');
    if (fuelDel) eng.push(['Fuel Delivery', fuelDel]);
    const ss = vPick(vv, 'startStop');
    if (ss != null && ss !== '') eng.push(['Start/Stop', ss ? 'Yes' : 'No']);
    const drv = soStr(vv, 'driveType', 'drivetrain');
    if (drv) eng.push(['Drive Type', drv]);
    if (eng.length) sections.push({ title: 'Engine', rows: eng });

    // Size & Weight
    const sz: SoTechRow[] = [];
    const len = soNum(vv, 'lengthMM');
    if (len) sz.push(['Length', `${Math.round(len).toLocaleString('en-GB')} mm`]);
    const ht  = soNum(vv, 'heightMM');
    if (ht)  sz.push(['Height',    `${Math.round(ht).toLocaleString('en-GB')} mm`]);
    const wd  = soNum(vv, 'widthMM');
    if (wd)  sz.push(['Width',     `${Math.round(wd).toLocaleString('en-GB')} mm`]);
    const wb  = soNum(vv, 'wheelbaseMM');
    if (wb)  sz.push(['Wheelbase', `${Math.round(wb).toLocaleString('en-GB')} mm`]);
    const loadWt  = soNum(vv, 'payloadWeightKG', 'loadWeight');
    if (loadWt)  sz.push(['Load Weight',  `${Math.round(loadWt)} kg`]);
    const kerbWt  = soNum(vv, 'minimumKerbWeightKG', 'kerbWeight');
    if (kerbWt)  sz.push(['Kerb Weight',  `${Math.round(kerbWt).toLocaleString('en-GB')} kg`]);
    const grossWt = soNum(vv, 'grossVehicleWeightKG', 'grossWeight');
    if (grossWt) sz.push(['Gross Weight', `${Math.round(grossWt).toLocaleString('en-GB')} kg`]);
    const bootDn  = soNum(vv, 'bootSpaceSeatsDownLitres');
    if (bootDn)  sz.push(['Boot Space, Seats Down', `${bootDn} litres`]);
    const bootUp  = soNum(vv, 'bootSpaceSeatsUpLitres');
    if (bootUp)  sz.push(['Boot Space, Seats Up',   `${bootUp} litres`]);
    if (sz.length) sections.push({ title: 'Size & Weight', rows: sz });

    // Fuel Consumption
    const fuel: SoTechRow[] = [];
    const fuelCap = soNum(vv, 'fuelCapacityLitres', 'fuelCapacity');
    if (fuelCap) fuel.push(['Fuel Capacity', `${fuelCap} litres`]);
    const emClass = soStr(vv, 'emissionClass', 'euroEmissions');
    if (emClass) fuel.push(['Emission Class', emClass]);
    const co2Val = soNum(vv, 'co2EmissionGPKM', 'co2Emissions');
    if (co2Val != null) fuel.push(['CO2 Emissions', `${Math.round(co2Val)} g/km`]);
    const mpgVal = soNum(vv, 'fuelEconomyWLTPCombinedMPG', 'fuelEconomyNEDCCombinedMPG', 'combinedFuelEconomyMPG');
    if (mpgVal) fuel.push(['Fuel Consumption, Combined', `${mpgVal.toFixed(1)} mpg`]);
    if (fuel.length) sections.push({ title: 'Fuel Consumption', rows: fuel });

    return sections;
}

function soGroupFeatures(rawFeatures: any[]): SoFeatureGroup[] {
    if (!Array.isArray(rawFeatures) || !rawFeatures.length) return [];
    const map = new Map<string, string[]>();
    for (const f of rawFeatures) {
        const name = (typeof f === 'string' ? f : f?.name ?? '').toString().trim();
        if (!name) continue;
        const cat = (typeof f === 'object' && f?.category && String(f.category).trim())
            ? String(f.category).trim()
            : 'General';
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(name);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

function soSplitFeatures(rawFeatures: any[]) {
    if (!Array.isArray(rawFeatures)) return { optional: [], standard: [] };
    const optional: any[] = [];
    const standard: any[] = [];
    for (const f of rawFeatures) {
        const isOptional = typeof f === 'object' && (f?.optional === true || f?.type === 'Optional');
        (isOptional ? optional : standard).push(f);
    }
    // If API gives no optional/standard split, treat all as optional extras
    if (optional.length === 0) return { optional: rawFeatures, standard: [] };
    return { optional, standard };
}

/* ─── Spec & Options Template ────────────────────────────────────────────── */
function SpecOptionsTemplate({ vehicle, opts, qrDataUrl, tenantName }: {
    vehicle: any;
    opts: SilentSalesmanOptions;
    qrDataUrl: string;
    tenantName: string;
}) {
    const vv = mergeVehicleForPdf(vehicle);
    const dealer  = tenantName?.trim() || 'Dealership';
    const heading = (opts.heading || '').trim() || 'Drive Away Today!';

    const derivativeStr = soStr(vv, 'derivative') ?? '';
    const makeStr  = soStr(vv, 'make')  ?? '';
    const modelStr = soStr(vv, 'model') ?? '';
    const vehicleName = derivativeStr || `${makeStr} ${modelStr}`.trim() || 'Vehicle';
    const price = soNum(vv, 'price', 'retailPrice', 'forecourtPrice') ?? 0;

    // ── Description
    const clientDesc = (opts.description || '').trim();
    const stripBullet = (l: string) => l.replace(/^[•\-*]\s*/, '').trim();
    let descText = '';
    let descBullets: string[] = [];
    if (clientDesc) {
        const blocks = clientDesc.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
        if (blocks.length >= 2) {
            descText = stripBullet(blocks[0]).slice(0, 600);
            descBullets = blocks.slice(1).join('\n').split(/\r?\n/).map(stripBullet).filter(Boolean);
        } else {
            const lines = clientDesc.split(/\r?\n/).map(stripBullet).filter(Boolean);
            if (lines.length > 1) descBullets = lines;
            else descText = clientDesc.slice(0, 600);
        }
    }

    // ── Highlights
    const selectedHighlights = Array.isArray(opts.highlights) ? opts.highlights : [];
    const highlightRows = selectedHighlights
        .map(label => ({ label, value: highlightValueForUiLabel(vv, label) }))
        .filter(r => r.value != null && String(r.value).trim() !== '');

    // ── Tech spec
    const techSections = buildSoTechSections(vv);

    // ── Features
    const rawFeatures: any[] = Array.isArray(vv?.features) ? vv.features : [];
    const { optional: optFeat, standard: stdFeat } = soSplitFeatures(rawFeatures);
    const optGroups = soGroupFeatures(optFeat);
    const stdGroups = soGroupFeatures(stdFeat);

    // shared row styles (inline to avoid StyleSheet pollution)
    const soKvKey: any = { fontSize: 8, color: '#475569', flex: 1, paddingRight: 4 };
    const soKvVal: any = { fontSize: 8, fontWeight: 700, color: '#0f172a', textAlign: 'right' };
    const soKvRow: any = { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1 solid #f1f5f9', paddingVertical: 3 };
    const soSecHead: any = { fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6, marginBottom: 2 };
    const soCatHead: any = { fontSize: 8, fontWeight: 700, color: '#334155', marginTop: 5, marginBottom: 2 };
    const soItemTxt: any = { fontSize: 8, color: '#334155', lineHeight: 1.4 };

    return (
        <>
            {/* ══════════════ PAGE 1 ══════════════ */}
            <Page size="A4" style={[styles.page, { padding: 20 }]}>

                {/* Header bar */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1 solid #e2e8f0', paddingBottom: 6, marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{dealer}</Text>
                    <Text style={{ fontSize: 12, fontWeight: 500, color: '#1e293b' }}>{heading}</Text>
                </View>

                {/* Vehicle name + price + QR */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }}>{vehicleName}</Text>
                        {opts.showPrice !== false && price > 0 && (
                            <Text style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 3 }}>{money(price)}</Text>
                        )}
                    </View>
                    <Image style={{ width: 70, height: 70 }} src={qrDataUrl} />
                </View>

                {/* Description */}
                {(descText || descBullets.length > 0) && (
                    <View style={{ marginBottom: 8 }}>
                        {descText ? <Text style={{ fontSize: 9, color: '#334155', lineHeight: 1.4, marginBottom: 4 }}>{descText}</Text> : null}
                        {descBullets.map((b, i) => (
                            <View key={i} style={{ flexDirection: 'row', gap: 5, marginBottom: 2 }}>
                                <Text style={{ fontSize: 9, color: '#334155' }}>•</Text>
                                <Text style={{ fontSize: 9, color: '#334155', flex: 1, lineHeight: 1.35 }}>{b}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Highlights + Technical Spec (two columns) */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>

                    {/* Left: Highlights */}
                    <View style={{ width: '38%' }}>
                        <Text style={{ fontSize: 10, fontWeight: 700, color: '#0f172a', marginBottom: 4, borderBottom: '1 solid #0f172a', paddingBottom: 2 }}>Highlights</Text>
                        {highlightRows.length > 0 ? highlightRows.map((r, i) => (
                            <View key={i} style={soKvRow}>
                                <Text style={soKvKey}>{r.label}</Text>
                                <Text style={soKvVal}>{r.value}</Text>
                            </View>
                        )) : (
                            <Text style={{ fontSize: 8, color: '#94a3b8', fontStyle: 'italic' }}>No highlights selected.</Text>
                        )}
                    </View>

                    {/* Right: Technical Specification */}
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: 700, color: '#0f172a', marginBottom: 4, borderBottom: '1 solid #0f172a', paddingBottom: 2 }}>Technical Specification</Text>
                        {techSections.length === 0 ? (
                            <Text style={{ fontSize: 8, color: '#94a3b8', fontStyle: 'italic' }}>No technical data available.</Text>
                        ) : techSections.map((sec, si) => (
                            <View key={si}>
                                <Text style={soSecHead}>{sec.title}</Text>
                                {sec.rows.map(([k, v], ri) => (
                                    <View key={ri} style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1 solid #f1f5f9', paddingVertical: 2 }}>
                                        <Text style={{ fontSize: 8, color: '#475569', flex: 1 }}>{k}</Text>
                                        <Text style={{ fontSize: 8, fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>{v}</Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>
                </View>

                {/* Optional Extras */}
                {opts.showOptionalExtras !== false && optGroups.length > 0 && (
                    <View>
                        <Text style={{ fontSize: 10, fontWeight: 700, color: '#0f172a', borderBottom: '1 solid #0f172a', paddingBottom: 2, marginBottom: 4 }}>Optional Extras</Text>
                        {optGroups.map((grp, gi) => (
                            <View key={gi} style={{ marginBottom: 4 }}>
                                {grp.category !== 'General' && (
                                    <Text style={soCatHead}>{grp.category}</Text>
                                )}
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                    {grp.items.map((item, ii) => (
                                        <Text key={ii} style={[soItemTxt, { width: '50%', paddingRight: 6, marginBottom: 1 }]}>{item}</Text>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

            </Page>

            {/* ══════════════ PAGE 2 — Standard Features (only if data exists) ══════════════ */}
            {stdGroups.length > 0 && (
                <Page size="A4" style={[styles.page, { padding: 20 }]}>
                    <View style={{ borderBottom: '1 solid #0f172a', paddingBottom: 4, marginBottom: 10 }}>
                        <Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Standard Features</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        {/* Split categories into two columns */}
                        {[stdGroups.slice(0, Math.ceil(stdGroups.length / 2)), stdGroups.slice(Math.ceil(stdGroups.length / 2))].map((colGroups, ci) => (
                            <View key={ci} style={{ flex: 1 }}>
                                {colGroups.map((grp, gi) => {
                                    const startIdx = stdGroups
                                        .slice(0, stdGroups.indexOf(grp))
                                        .reduce((acc, g) => acc + g.items.length, 0);
                                    return (
                                        <View key={gi} style={{ marginBottom: 8 }}>
                                            {grp.category !== 'General' && (
                                                <Text style={soCatHead}>{grp.category}</Text>
                                            )}
                                            {grp.items.map((item, ii) => (
                                                <Text key={ii} style={[soItemTxt, { marginBottom: 1 }]}>
                                                    {startIdx + ii + 1}. {item}
                                                </Text>
                                            ))}
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </Page>
            )}
        </>
    );
}

function SimpleFinanceTemplate({
    vehicle,
    opts,
    qrDataUrl,
    tenantName,
}: {
    vehicle: any;
    opts: SilentSalesmanOptions;
    qrDataUrl: string;
    tenantName: string;
}) {
    const vv = mergeVehicleForPdf(vehicle);
    const heading = (opts.heading || '').trim() || 'Drive Away Today!';
    const price = Number(vPick(vv, 'price') ?? vPick(vv, 'retailPrice') ?? vPick(vv, 'forecourtPrice') ?? 0);

    const makeStr = vPick(vv, 'make') != null ? String(vPick(vv, 'make')) : '';
    const modelStr = vPick(vv, 'model') != null ? String(vPick(vv, 'model')) : '';
    const heroTitle = `${makeStr} ${modelStr}`.trim() || 'Vehicle';

    const trimPart = [vPick(vv, 'trim'), vPick(vv, 'bodyType')]
        .filter(x => x != null && String(x).trim() !== '')
        .map(x => String(x));
    const doorsP = vPick(vv, 'doors');
    if (doorsP != null && String(doorsP).trim() !== '') trimPart.push(`${doorsP}dr`);
    const derivative =
        firstNonEmpty(vPick(vv, 'derivative'), trimPart.length ? trimPart.join(' ') : null) || '';

    const selectedHighlights: string[] = Array.isArray(opts.highlights) && opts.highlights.length > 0
        ? opts.highlights
        : [];
    const allSpecCells = motorDeskSpecCells(vv);
    const specCells = selectedHighlights.length > 0
        ? allSpecCells.filter(c => selectedHighlights.includes(c.label))
        : allSpecCells;
    const specRows = chunk(specCells, 4);
    const featureLines = normalizeFeatureStrings(vv);
    const descMax = 420;
    // Keep Simple Finance to a single page reliably.
    const maxSpecRows = 3;
    const maxFeatureBullets = Math.min(SILENT_SALESMAN_MAX_FEATURE_BULLETS, 12);
    const limitedSpecRows = specRows.slice(0, maxSpecRows);
    const clientDesc = (opts.description || '').trim();
    const fallbackProse = pickSilentSalesmanDescriptionFromVehicle(vehicle);

    let descText = '';
    let bullets: string[] = [];

    if (clientDesc) {
        const stripBullet = (l: string) => l.replace(/^[•\-*]\s*/, '').trim();
        // MotorDesk-style default: opening paragraph, blank line, then one feature per line
        const blocks = clientDesc.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
        if (blocks.length >= 2) {
            descText = stripBullet(blocks[0]).slice(0, descMax);
            bullets = blocks
                .slice(1)
                .join('\n')
                .split(/\r?\n/)
                .map(stripBullet)
                .filter(Boolean)
                .slice(0, maxFeatureBullets);
        } else {
            const lines = clientDesc.split(/\r?\n/).map(stripBullet).filter(Boolean);
            const multiLine = /\r?\n/.test(clientDesc);
            const looksLikeBulletList = lines.length > 1 || (lines.length >= 1 && multiLine);
            if (looksLikeBulletList && lines.length > 0) {
                bullets = lines.slice(0, maxFeatureBullets);
            } else {
                descText = clientDesc.slice(0, descMax);
            }
        }
    } else {
        descText = fallbackProse.slice(0, descMax);
        bullets = featureLines.slice(0, maxFeatureBullets);
    }

    const dealer = tenantName?.trim() || 'Dealership';

    return (
        <Page size="A4" style={styles.page}>
            <View style={styles.sfBar}>
                <Text style={styles.sfDealer}>{dealer}</Text>
                <Text style={styles.sfCta}>{heading}</Text>
            </View>

            <View style={styles.sfHeroContainer}>
                <View style={styles.sfHeroLeft}>
                    <Text style={styles.sfHero}>{heroTitle}</Text>
                    {derivative ? <Text style={styles.sfSub}>{derivative}</Text> : null}
                    
                    {opts.showPrice !== false ? (
                        <Text style={styles.sfPrice}>{money(price)}</Text>
                    ) : (
                        <Text style={[styles.small, { marginTop: 12 }]}>Price on application.</Text>
                    )}
                </View>
                <View style={styles.qrImgWrap}>
                    <Image style={styles.sfQrLarge} src={qrDataUrl} />
                </View>
            </View>

            <Text style={styles.sfGridTitle}>Highlights</Text>
            {limitedSpecRows.length === 0 ? (
                <Text style={styles.small}>No specification highlights available for this vehicle record.</Text>
            ) : (
                limitedSpecRows.map((row, ri) => (
                    <View key={`sr-${ri}`} style={styles.sfGridRow}>
                        {row.map((cell, ci) => (
                            <View key={`${cell.abbr}-${ci}`} style={styles.sfCell}>
                                <View style={styles.sfIconBox}>
                                    <HighlightIcon abbr={cell.abbr} label={cell.label} />
                                </View>
                                <View style={styles.sfTextWrap}>
                                    <Text style={styles.sfLbl}>{cell.label}</Text>
                                    <Text style={styles.sfVal}>{cell.value}</Text>
                                </View>
                            </View>
                        ))}
                        {row.length < 4
                            ? Array.from({ length: 4 - row.length }).map((_, ei) => (
                                  <View key={`pad-${ri}-${ei}`} style={styles.sfCell} />
                              ))
                            : null}
                    </View>
                ))
            )}

            {(descText || bullets.length > 0) && (
                <>
                    <Text style={styles.sfDescTitle}>Description</Text>
                    {descText ? <Text style={[styles.sfDesc, { marginBottom: 10 }]}>{descText}</Text> : null}
                    {bullets.length > 0
                        ? bullets.map((line, i) => (
                              <View key={`b-${i}`} style={styles.sfBulletRow}>
                                  <View style={styles.sfBulletDot} />
                                  <Text style={[styles.sfDesc, { flex: 1 }]}>{line}</Text>
                              </View>
                          ))
                        : null}
                </>
            )}


        </Page>
    );
}

function SilentSalesmanDoc({
    vehicle,
    opts,
    qrDataUrl,
    tenantName,
    listingUrl,
}: {
    vehicle: any;
    opts: SilentSalesmanOptions;
    qrDataUrl: string;
    tenantName: string;
    listingUrl: string;
}) {
    const template: TemplateId = (opts.template as TemplateId) || 'classic';

    return (
        <Document>
            {template === 'classic' ? (
                <ClassicTemplate vehicle={vehicle} opts={opts} qrDataUrl={qrDataUrl} tenantName={tenantName} listingUrl={listingUrl} />
            ) : template === 'specOptions' ? (
                <SpecOptionsTemplate vehicle={vehicle} opts={opts} qrDataUrl={qrDataUrl} tenantName={tenantName} />
            ) : (
                <SimpleFinanceTemplate vehicle={vehicle} opts={opts} qrDataUrl={qrDataUrl} tenantName={tenantName} />
            )}
        </Document>
    );
}

export async function renderSilentSalesmanPdf({
    vehicle,
    tenantId,
    tenantName = 'Dealership',
    options,
    publicBaseUrl,
}: RenderArgs) {
    const listingUrl = buildListingUrl(publicBaseUrl, vehicle, tenantId);
    const template = (options?.template as TemplateId) || 'classic';
    const qrWidth = template === 'simpleFinance' ? 300 : 220;
    const qrDataUrl = await QRCode.toDataURL(listingUrl, { margin: 1, width: qrWidth });
    const opts: SilentSalesmanOptions = {
        template: options?.template || 'classic',
        heading: options?.heading || '',
        description: options?.description || '',
        showPrice: options?.showPrice !== false,
        showOptionalExtras: options?.showOptionalExtras !== false,
        highlights: Array.isArray(options?.highlights) ? options.highlights : [],
        financeExample: options?.financeExample || undefined,
    };

    return renderToBuffer(
        <SilentSalesmanDoc vehicle={vehicle} opts={opts} qrDataUrl={qrDataUrl} tenantName={tenantName} listingUrl={listingUrl} />
    );
}

