/**
 * AutoTrader / MotorDesk often store the main advert body as HTML. Strip tags for plain textarea / PDF text.
 */
export function advertDescriptionToPlainText(input: string): string {
    if (input == null) return '';
    const s = String(input);
    if (!s.includes('<')) return s.trim();
    let t = s
        .replace(/\r\n/g, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    t = t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
    return t;
}

/** AT / cache payloads nest specs under `vehicle` or `technicalSpecs` (see autotrader-stock mapping). */
export function mergeVehicleForPdf(raw: any) {
    const base = { ...(raw?.vehicle || {}), ...(raw?.technicalSpecs || {}) };
    return { ...base, ...raw };
}

export function vPick(v: any, key: string) {
    if (v == null) return null;
    if (v[key] != null && String(v[key]).trim() !== '') return v[key];
    const inner = v.vehicle;
    if (inner && inner[key] != null && String(inner[key]).trim() !== '') return inner[key];
    return null;
}

/** PDF layout: keep bullet block a sensible length on A4. */
export const SILENT_SALESMAN_MAX_FEATURE_BULLETS = 16;
/** Simple Finance PDF caps bullets at 12 — textarea pre-fill matches that so WYSIWYG. */
export const SILENT_SALESMAN_TEXTAREA_FEATURE_CAP = 12;

/** Same shape as PDF: string[] or { name }[] from stock / vehicle. */
export function normalizeFeatureStrings(v: any): string[] {
    const raw = v?.features;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((f: any) => (typeof f === 'string' ? f : f?.name))
        .filter((s: any) => s != null && String(s).trim() !== '')
        .map((s: string) => String(s).trim());
}

function firstNonEmptyStr(...vals: any[]): string {
    for (const x of vals) {
        if (x == null) continue;
        const s = String(x).trim();
        if (s !== '') return s;
    }
    return '';
}

function formatUkDateFromAt(raw: string): string {
    if (!raw) return '';
    const s = String(raw).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * Extract the MOT expiry date from anywhere it might live on the vehicle object.
 * Returns a formatted UK date string (DD/MM/YYYY) or empty string.
 */
export function extractMotExpiryDate(vehicle: any): string {
    const vv = mergeVehicleForPdf(vehicle);
    const motObj = vv?.mot;
    const histObj = vv?.history;
    const checkObj = vv?.check;

    const candidates = [
        // AT Stock API primary field
        vPick(vv, 'motExpiryDate'),
        vPick(vv, 'motExpiry'),
        vPick(vv, 'motDueDate'),
        vPick(vv, 'motValidUntil'),
        vPick(vv, 'motExpires'),
        vPick(vv, 'nextMotDue'),
        vPick(vv, 'nextMot'),
        vPick(vv, 'motInsuranceExpires'),
        vPick(vv, 'dateOfLastMot'),
        motObj && typeof motObj === 'object' ? String((motObj as any).expiryDate || '') : '',
        motObj && typeof motObj === 'object' ? String((motObj as any).expiry || '') : '',
        motObj && typeof motObj === 'object' ? String((motObj as any).validUntil || '') : '',
        histObj && typeof histObj === 'object' ? String((histObj as any).motExpiry || '') : '',
        histObj && typeof histObj === 'object' ? String((histObj as any).motExpiryDate || '') : '',
        checkObj && typeof checkObj === 'object' ? String((checkObj as any).motExpiry || '') : '',
    ];

    // Also check motTests array — take the most recent passing test's expiry
    const motTests: any[] = Array.isArray(vv?.motTests)
        ? vv.motTests
        : Array.isArray(motObj?.tests)
        ? motObj.tests
        : [];
    for (const t of motTests) {
        if (t?.expiryDate) candidates.push(String(t.expiryDate));
        if (t?.expiry) candidates.push(String(t.expiry));
    }

    for (const raw of candidates) {
        const fmt = formatUkDateFromAt(firstNonEmptyStr(raw));
        if (fmt) return fmt;
    }
    return '';
}

/**
 * When AT has no written advert description, build a MotorDesk-style opening line from stock fields.
 */
export function buildSilentSalesmanSummaryFromSpecs(vehicle: any): string {
    const vv = mergeVehicleForPdf(vehicle);
    const make = vPick(vv, 'make');
    const parts: string[] = [];

    // AT API uses 'colour' (not 'colourName')
    const colour = firstNonEmptyStr(vPick(vv, 'colour'), vPick(vv, 'colourName'), vPick(vv, 'exteriorColour'));
    if (colour) parts.push(colour);

    // AT API uses 'previousOwners' in stock, 'owners' in vehicles API
    const ownersRaw = vPick(vv, 'previousOwners') ?? vPick(vv, 'owners') ?? vPick(vv, 'numberOfPreviousOwners');
    if (ownersRaw != null && String(ownersRaw).trim() !== '' && Number.isFinite(Number(ownersRaw))) {
        const n = Math.max(0, Math.floor(Number(ownersRaw)));
        parts.push(`${n} Previous Owner${n === 1 ? '' : 's'}`);
    }

    const sh = vPick(vv, 'serviceHistory');
    if (sh != null && String(sh).trim() !== '') {
        const t = String(sh).trim();
        if (/full/i.test(t) && /service|history|dealership/i.test(t)) {
            parts.push(make ? `Full ${make} Service History` : 'Full Service History');
        } else if (!/^no /i.test(t) && t.length > 0 && t.length < 90) {
            parts.push(t);
        }
    }

    const motFmt = extractMotExpiryDate(vehicle);
    if (motFmt) parts.push(`Long MOT Until ${motFmt}`);

    // AT API uses 'keys' (not 'numberOfKeys')
    const keysRaw = vPick(vv, 'keys') ?? vPick(vv, 'numberOfKeys');
    if (keysRaw != null && String(keysRaw).trim() !== '' && Number.isFinite(Number(keysRaw)) && Number(keysRaw) > 0) {
        parts.push(`${Number(keysRaw)} Keys`);
    }

    return parts.join(', ');
}

export function pickSilentSalesmanDescriptionFromVehicle(vehicle: any): string {
    const vv = mergeVehicleForPdf(vehicle);
    const ra = vehicle?.adverts?.retailAdverts;
    let d =
        vPick(vv, 'description') ||
        (ra?.description != null && String(ra.description).trim() !== '' ? String(ra.description) : '') ||
        vPick(vv, 'description2') ||
        (ra?.description2 != null && String(ra.description2).trim() !== '' ? String(ra.description2) : '') ||
        (ra?.longAttentionGrabber != null && String(ra.longAttentionGrabber).trim() !== ''
            ? String(ra.longAttentionGrabber)
            : '') ||
        vPick(vv, 'longAttentionGrabber') ||
        (ra?.attentionGrabber != null && String(ra.attentionGrabber).trim() !== '' ? String(ra.attentionGrabber) : '') ||
        vPick(vv, 'attentionGrabber') ||
        '';

    let out = String(d || '').trim();
    if (!out) out = buildSilentSalesmanSummaryFromSpecs(vehicle);
    return advertDescriptionToPlainText(out);
}

/**
 * Silent Salesman description box default — MotorDesk-style: opening advert paragraph (from AT
 * retail description) then feature lines, when those are not already duplicated in the prose.
 */
/** Max prose chars shown in description — matches Simple Finance PDF descMax. */
export const SILENT_SALESMAN_DESC_PROSE_MAX = 420;

export function pickSilentSalesmanTextareaDefault(vehicle: any): string {
    const prosePlain = pickSilentSalesmanDescriptionFromVehicle(vehicle);
    const summary = buildSilentSalesmanSummaryFromSpecs(vehicle);
    const proseLower = prosePlain.toLowerCase();
    const summaryLower = summary.toLowerCase();

    // Combine summary + prose, then cap prose to match what PDF actually renders
    let combinedFirstLine =
        summary && (!prosePlain || !proseLower.includes(summaryLower))
            ? (prosePlain ? `${summary}, ${prosePlain}` : summary)
            : prosePlain;

    // Trim to PDF prose limit so what you see = what you get
    if (combinedFirstLine.length > SILENT_SALESMAN_DESC_PROSE_MAX) {
        combinedFirstLine = combinedFirstLine.slice(0, SILENT_SALESMAN_DESC_PROSE_MAX).trimEnd();
        // Don't cut mid-word
        const lastSpace = combinedFirstLine.lastIndexOf(' ');
        if (lastSpace > SILENT_SALESMAN_DESC_PROSE_MAX - 40) {
            combinedFirstLine = combinedFirstLine.slice(0, lastSpace);
        }
    }

    const firstLine = combinedFirstLine;
    const vv = mergeVehicleForPdf(vehicle);
    const featLines = normalizeFeatureStrings(vv).slice(0, SILENT_SALESMAN_TEXTAREA_FEATURE_CAP);

    const proseLineKey = (line: string) => line.replace(/^[•\-*]\s*/, '').trim().toLowerCase();
    const proseLines = new Set(
        firstLine
            .split(/\r?\n/)
            .map(proseLineKey)
            .filter(Boolean)
    );
    const extra = featLines.filter(f => !proseLines.has(proseLineKey(f)));

    let result = '';
    if (!firstLine && !extra.length) result = '';
    else if (!firstLine) result = extra.join('\n');
    else if (!extra.length) result = firstLine;
    else result = `${firstLine}\n\n${extra.join('\n')}`;

    // Always ensure MOT expiry is mentioned — inject it at the top if not already present.
    const motFmt = extractMotExpiryDate(vehicle);
    if (motFmt) {
        const lower = result.toLowerCase();
        const motLine = `Long MOT Until ${motFmt}`;
        if (!lower.includes('mot until') && !lower.includes('mot expir') && !lower.includes('mot valid')) {
            result = result ? `${motLine}\n\n${result}` : motLine;
        }
    }

    return result;
}

/**
 * Returns only the highlight labels that have actual data for the given vehicle.
 * Used in the UI to hide checkboxes for fields with no data.
 */
export function getAvailableHighlightLabels(vehicle: any): string[] {
    const vv = mergeVehicleForPdf(vehicle);

    /** Returns true if at least one of the given AT API field names has a real value. */
    const has = (...keys: string[]): boolean =>
        keys.some(k => {
            const val = vv[k] ?? vv?.vehicle?.[k];
            if (val == null) return false;
            const s = String(val).trim();
            return s !== '' && s.toLowerCase() !== 'unlisted' && s !== '0' && s !== 'null';
        });

    /** Like `has` but also accepts zero as valid (e.g. CO2 = 0 g/km for EVs). */
    const hasNum = (...keys: string[]): boolean =>
        keys.some(k => {
            const val = vv[k] ?? vv?.vehicle?.[k];
            if (val == null) return false;
            const s = String(val).trim();
            return s !== '' && s.toLowerCase() !== 'unlisted' && Number.isFinite(Number(s));
        });

    const available: string[] = [];

    if (has('yearOfManufacture', 'year'))                                      available.push('Year');
    if (has('yearOfManufacture', 'year'))                                      available.push('Age');
    if (hasNum('odometerReadingMiles', 'mileage'))                             available.push('Mileage');
    if (has('hoursUsed', 'engineHours', 'hours'))                              available.push('Hours Used');
    if (hasNum('previousOwners', 'owners', 'numberOfPreviousOwners'))          available.push('Previous Owners');
    if (hasNum('seats', 'numberOfSeats', 'seatCount'))                         available.push('Seats');
    if (hasNum('doors', 'numberOfDoors'))                                      available.push('Doors');
    if (has('bodyType', 'bodyStyle', 'body'))                                  available.push('Body Type');
    if (has('colour', 'colourName', 'color', 'paintColor'))                    available.push('Colour');
    if (has('fuelType', 'fuel', 'fuelTypeLabel'))                              available.push('Fuel Type');
    if (hasNum('fuelCapacityLitres', 'fuelCapacity', 'fuelTankCapacity'))      available.push('Fuel Capacity');
    if (has('transmissionType', 'transmission', 'gearbox'))                    available.push('Transmission');
    if (has('drivetrain', 'driveType'))                                        available.push('Drivetrain');
    if (has('badgeEngineSizeLitres', 'engineCapacityCC', 'engineSize'))        available.push('Engine Size');
    if (hasNum('cylinders', 'engineCylinders', 'numberOfCylinders'))          available.push('Engine Cylinders');
    if (hasNum('enginePowerBHP', 'powerBHP', 'bhp'))                          available.push('Engine Power (BHP)');
    if (hasNum('enginePowerPS', 'powerPS', 'ps'))                             available.push('Engine Power (PS)');
    if (hasNum('engineTorqueNM', 'torqueNm', 'engineTorqueNm'))               available.push('Engine Torque (Nm)');
    if (hasNum('engineTorqueLBFT', 'torqueLbsFt', 'engineTorqueLbFt'))        available.push('Engine Torque (lbs/ft)');
    if (has('batteryFullChargeTime', 'fullChargeTime', 'chargeTimeFull'))      available.push('Battery Full Charge Time');
    if (has('batteryQuickChargeTime', 'quickChargeTime', 'rapidChargeTime'))   available.push('Battery Quick Charge Time');
    if (hasNum('batteryCapacityKWH', 'batteryUsableCapacityKWH', 'batteryCapacityKWh', 'batteryCapacity')) available.push('Battery Capacity');
    if (hasNum('batteryRangeMiles', 'batteryRange', 'electricRange'))          available.push('Battery Range');
    if (has('batteryHealth', 'batteryCondition'))                              available.push('Battery Health');
    if (hasNum('heightMM', 'height', 'overallHeight'))                        available.push('Height');
    if (hasNum('widthMM', 'width', 'overallWidth'))                           available.push('Width');
    if (hasNum('lengthMM', 'length', 'overallLength'))                        available.push('Length');
    if (hasNum('weight', 'vehicleWeight'))                                     available.push('Weight');
    if (hasNum('minimumKerbWeightKG', 'kerbWeightKG', 'kerbWeight'))          available.push('Kerb Weight');
    if (hasNum('grossVehicleWeightKG', 'grossCombinedWeightKG', 'grossWeight')) available.push('Gross Weight');
    if (hasNum('unladenWeight', 'unladenMass'))                               available.push('Unladen Weight');
    if (has('mtplm', 'maximumTechPermissibleLadenMass'))                       available.push('MTPLM');
    if (hasNum('payloadHeightMM', 'loadHeight', 'loadHeightMM'))              available.push('Load Height');
    if (hasNum('payloadWidthMM', 'loadWidth', 'loadWidthMM'))                 available.push('Load Width');
    if (hasNum('payloadLengthMM', 'loadLength', 'loadLengthMM'))              available.push('Load Length');
    if (hasNum('payloadWeightKG', 'loadWeight', 'payload'))                   available.push('Load Weight');
    if (has('payloadVolumeCubicMetres', 'loadVolume', 'loadVolumeM3'))        available.push('Load Volume');
    if (hasNum('bootSpaceSeatsUpLitres', 'bootSpaceSeatsDownLitres', 'bootSpace')) available.push('Boot Space');
    if (has('cabType'))                                                        available.push('Cab Type');
    if (has('driverPosition'))                                                 available.push('Driver Position');
    if (has('bedroomLayout', 'bedLayout'))                                     available.push('Bedroom Layout');
    if (has('endLayout'))                                                      available.push('End Layout');
    if (hasNum('bedrooms', 'numberOfBedrooms'))                               available.push('Bedrooms');
    if (hasNum('berths', 'numberOfBerths'))                                   available.push('Berths');
    if (has('seatBelts', 'numberOfSeatBelts'))                                available.push('Seat Belts');
    if (hasNum('zeroToSixtyMPHSeconds', 'zeroToOneHundredKMPHSeconds', 'acceleration')) available.push('Acceleration');
    if (hasNum('topSpeedMPH', 'topSpeed', 'maxSpeed'))                        available.push('Top Speed');
    if (hasNum('fuelEconomyWLTPCombinedMPG', 'fuelEconomyNEDCCombinedMPG', 'combinedFuelEconomyMPG')) available.push('Fuel Consumption');
    if (hasNum('co2EmissionGPKM', 'co2Emissions'))                            available.push('CO2 Emissions');
    if (has('emissionClass', 'euroEmissions', 'euroStatus'))                  available.push('Emission Class');
    if (has('ulezCompliant', 'ulez', 'ulezCompliance'))                       available.push('ULEZ Compliance');
    if (has('cazCompliant', 'caz', 'cazCompliance'))                          available.push('CAZ Compliance');
    if (has('insuranceGroup', 'insuranceClass', 'insurance'))                  available.push('Insurance Class');
    if (has('warrantyMonthsOnPurchase', 'warrantyMonths', 'warranty'))        available.push('Warranty');
    if (has('remainingWarranty', 'warrantyExpiry'))                            available.push('Remaining Warranty');
    if (has('batteryWarranty'))                                                available.push('Battery Warranty');
    if (has('remainingBatteryWarranty'))                                       available.push('Remaining Battery Warranty');
    if (has('extendedWarranty'))                                               available.push('Extended Warranty');
    if (has('vehicleExciseDutyWithoutSupplementGBP', 'roadTax', 'ved', 'taxBand')) available.push('UK Road Tax (VED)');
    if (has('registration', 'vrm', 'registrationNumber', 'plate', 'reg'))    available.push('Registration');

    return available;
}
