'use client';

import { useState, useCallback, useMemo } from 'react';

interface SpecificationTabProps {
    vehicle: any;
}

type FieldType = 'text' | 'yesno' | 'ulez' | 'caz' | 'select';

interface FieldDef {
    key: string;
    label: string;
    unit?: string;
    source?: 'vehicle';
    type?: FieldType;
    options?: string[];
    fullWidth?: boolean;
    atKeys?: string[]; // fallback AT field names to try
}

function pickFirst(obj: any, keys: string[]): any {
    for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
}

const CAZ_CITIES = [
    'Aberdeen', 'Bath', 'Birmingham', 'Bradford', 'Bristol', 'Dundee',
    'Edinburgh', 'Glasgow', 'Greater Manchester', 'Newcastle', 'Oxford',
    'Portsmouth', 'Sheffield', 'Southampton', 'Tyneside', 'York',
];

const EMISSION_CLASSES = ['Euro 1', 'Euro 2', 'Euro 3', 'Euro 4', 'Euro 5', 'Euro 5b', 'Euro 6', 'Euro 6b', 'Euro 6c', 'Euro 6d', 'Euro 6d-temp', 'Euro 7'];
const INSURANCE_SEC_CODES = ['A', 'B', 'C', 'D', 'E'];

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
    {
        title: 'Performance',
        fields: [
            { key: 'topSpeedMPH', label: 'Top Speed', unit: 'mph', atKeys: ['topSpeedMPH', 'topSpeed', 'maxSpeed'] },
            { key: 'zeroToSixtyMPHSeconds', label: '0 - 62 mph', unit: 'seconds', atKeys: ['zeroToSixtyMPHSeconds', 'zeroToOneHundredKMPHSeconds', 'acceleration', 'zeroToSixty'] },
        ],
    },
    {
        title: 'Engine',
        fields: [
            { key: 'make', label: 'Manufacturer', source: 'vehicle' },
            { key: 'engineCapacityCC', label: 'Engine Capacity', unit: 'cc', atKeys: ['engineCapacityCC', 'badgeEngineSizeCC', 'engineSizeCc'] },
            { key: 'cylinders', label: 'Cylinders', atKeys: ['cylinders', 'engineCylinders', 'numberOfCylinders'] },
            { key: 'cylinderArrangement', label: 'Arrangement', atKeys: ['cylinderArrangement', 'engineConfiguration'] },
            { key: 'valves', label: 'Valves', atKeys: ['valves', 'numberOfValves'] },
            { key: 'boreMM', label: 'Bore', unit: 'mm', atKeys: ['boreMM', 'bore'] },
            { key: 'strokeMM', label: 'Stroke', unit: 'mm', atKeys: ['strokeMM', 'stroke'] },
            { key: 'fuelDelivery', label: 'Fuel Delivery', atKeys: ['fuelDelivery', 'fuelSystem', 'injectionType'] },
            { key: 'enginePowerBHP', label: 'Engine Power', unit: 'bhp', atKeys: ['enginePowerBHP', 'powerBHP', 'bhp'] },
            { key: 'enginePowerPS', label: 'Engine Power', unit: 'ps', atKeys: ['enginePowerPS', 'powerPS', 'ps'] },
            { key: 'engineTorqueNM', label: 'Engine Torque', unit: 'Nm', atKeys: ['engineTorqueNM', 'torqueNm', 'engineTorqueNm', 'torque'] },
            { key: 'engineTorqueLBFT', label: 'Engine Torque', unit: 'lbs/ft', atKeys: ['engineTorqueLBFT', 'torqueLbsFt', 'engineTorqueLbFt', 'torqueLbft'] },
            { key: 'gears', label: 'Gears', atKeys: ['gears', 'numberOfGears', 'numberOfForwardGears'] },
            { key: 'driveType', label: 'Drive Type', atKeys: ['driveType', 'drivetrain', 'driveTrain', 'drivetrainType'] },
            { key: 'startStop', label: 'Start / Stop', type: 'yesno', atKeys: ['startStop', 'startStopTechnology'] },
            { key: 'transmission', label: 'Transmission', source: 'vehicle', atKeys: ['transmissionType', 'transmission', 'gearbox'] },
            { key: 'fuelType', label: 'Fuel Type', source: 'vehicle', atKeys: ['fuelType', 'fuel', 'fuelTypeLabel'] },
        ],
    },
    {
        title: 'Battery & Electric',
        fields: [
            { key: 'batteryChargeTime', label: 'Battery Charge Time', atKeys: ['batteryChargeTime', 'chargeTime'] },
            { key: 'batteryQuickChargeTime', label: 'Battery Quick Charge Time', atKeys: ['batteryQuickChargeTime', 'rapidChargeTime', 'quickChargeTime'] },
            { key: 'batteryRangeMiles', label: 'Battery Range', unit: 'miles', atKeys: ['batteryRangeMiles', 'batteryRange', 'electricRange', 'rangeElectricMiles'] },
            { key: 'batteryCapacityKWH', label: 'Battery Capacity', unit: 'kWh', atKeys: ['batteryCapacityKWH', 'batteryCapacityKWh', 'batteryCapacity'] },
            { key: 'batteryUsableCapacityKWH', label: 'Battery Usable Capacity', unit: 'kWh', atKeys: ['batteryUsableCapacityKWH', 'batteryUsableCapacityKWh', 'usableBatteryCapacity'] },
            { key: 'batteryHealth', label: 'Battery Health', atKeys: ['batteryHealth', 'batteryCondition'] },
        ],
    },
    {
        title: 'Size & Weight',
        fields: [
            { key: 'lengthMM', label: 'Length', unit: 'mm', atKeys: ['lengthMM', 'length', 'overallLength'] },
            { key: 'heightMM', label: 'Height', unit: 'mm', atKeys: ['heightMM', 'height', 'overallHeight'] },
            { key: 'widthMM', label: 'Width', unit: 'mm', atKeys: ['widthMM', 'width', 'overallWidth'] },
            { key: 'wheelbaseMM', label: 'Wheelbase', unit: 'mm', atKeys: ['wheelbaseMM', 'wheelbase'] },
            { key: 'minimumKerbWeightKG', label: 'Kerb Weight', unit: 'kg', atKeys: ['minimumKerbWeightKG', 'kerbWeightKG', 'kerbWeight'] },
            { key: 'grossVehicleWeightKG', label: 'Gross Weight', unit: 'kg', atKeys: ['grossVehicleWeightKG', 'grossCombinedWeightKG', 'grossWeight', 'gvw'] },
            { key: 'unladenWeightKG', label: 'Unladen Weight', unit: 'kg', atKeys: ['unladenWeightKG', 'unladenWeight', 'unladenMass'] },
            { key: 'noseWeightKG', label: 'Nose Weight', unit: 'kg', atKeys: ['noseWeightKG', 'noseWeight'] },
            { key: 'bootSpaceSeatsDownLitres', label: 'Boot Space, Seats Down', unit: 'litres', atKeys: ['bootSpaceSeatsDownLitres', 'bootSpaceDown'] },
            { key: 'bootSpaceSeatsUpLitres', label: 'Boot Space, Seats Up', unit: 'litres', atKeys: ['bootSpaceSeatsUpLitres', 'bootSpace', 'bootCapacityLitres', 'bootSpaceUp'] },
            { key: 'mtplmKG', label: 'MTPLM', unit: 'kg', atKeys: ['mtplmKG', 'mtplm', 'maximumTechPermissibleLadenMass', 'maxLadenMass'] },
            { key: 'axles', label: 'Axles', atKeys: ['axles', 'numberOfAxles'] },
            { key: 'doors', label: 'Doors', source: 'vehicle', atKeys: ['doors', 'numberOfDoors'] },
            { key: 'seats', label: 'Seats', source: 'vehicle', atKeys: ['seats', 'numberOfSeats', 'seatingCapacity'] },
        ],
    },
    {
        title: 'Load Space',
        fields: [
            { key: 'loadLengthMM', label: 'Load Length', unit: 'mm', atKeys: ['loadLengthMM', 'payloadLengthMM', 'loadLength'] },
            { key: 'loadWidthMM', label: 'Load Width', unit: 'mm', atKeys: ['loadWidthMM', 'payloadWidthMM', 'loadWidth'] },
            { key: 'loadHeightMM', label: 'Load Height', unit: 'mm', atKeys: ['loadHeightMM', 'payloadHeightMM', 'loadHeight'] },
            { key: 'loadWeightKG', label: 'Load Weight', unit: 'kg', atKeys: ['loadWeightKG', 'payloadWeightKG', 'loadWeight', 'payload'] },
            { key: 'loadVolumeM3', label: 'Load Volume', unit: 'm³', atKeys: ['loadVolumeM3', 'payloadVolumeCubicMetres', 'loadVolume'] },
        ],
    },
    {
        title: 'Identity & Classification',
        fields: [
            { key: 'countryOfOrigin', label: 'Country of Origin', atKeys: ['countryOfOrigin', 'countryOfManufacture'] },
            { key: 'sector', label: 'Sector', atKeys: ['sector', 'vehicleSector', 'marketSector'] },
            { key: 'insuranceGroup', label: 'Insurance Group', atKeys: ['insuranceGroup', 'insuranceClass', 'insurance'] },
            { key: 'insuranceSecurityCode', label: 'Insurance Security Code', type: 'select', options: INSURANCE_SEC_CODES, atKeys: ['insuranceSecurityCode', 'securityCode'] },
            { key: 'bodyType', label: 'Body Type', source: 'vehicle', atKeys: ['bodyType'] },
            { key: 'colour', label: 'Colour', source: 'vehicle', atKeys: ['colour', 'colourName', 'color', 'paintColor'] },
            { key: 'vin', label: 'VIN', source: 'vehicle', atKeys: ['vin'] },
        ],
    },
    {
        title: 'Emissions & Compliance',
        fields: [
            { key: 'emissionClass', label: 'Emission Class', type: 'select', options: EMISSION_CLASSES, atKeys: ['emissionClass', 'euroEmissions', 'euroStatus', 'emissionStandard'] },
            { key: 'co2EmissionGPKM', label: 'CO₂ Emissions', unit: 'g/km', atKeys: ['co2EmissionGPKM', 'co2Emissions', 'co2'] },
            { key: 'rde2', label: 'RDE2', atKeys: ['rde2', 'rde2Compliant'] },
            { key: 'fuelCapacityLitres', label: 'Fuel Capacity', unit: 'litres', atKeys: ['fuelCapacityLitres', 'fuelCapacity', 'fuelTankCapacity'] },
            { key: 'ulezCompliant', label: 'ULEZ Compliant', type: 'ulez', fullWidth: true, atKeys: ['ulezCompliant', 'ulez', 'ulezCompliance'] },
            { key: 'cazCompliant', label: 'CAZ Compliant', type: 'caz', fullWidth: true, atKeys: ['cazCompliant', 'caz', 'cazCompliance'] },
        ],
    },
    {
        title: 'Fuel Consumption (NEDC)',
        fields: [
            { key: 'fuelEconomyNEDCExtraUrbanMPG', label: 'Fuel Consumption, Extra Urban', unit: 'mpg', atKeys: ['fuelEconomyNEDCExtraUrbanMPG', 'extraUrbanMPG', 'fuelConsumptionExtraUrban'] },
            { key: 'fuelEconomyNEDCUrbanMPG', label: 'Fuel Consumption, Urban', unit: 'mpg', atKeys: ['fuelEconomyNEDCUrbanMPG', 'urbanMPG', 'fuelConsumptionUrban'] },
            { key: 'fuelEconomyNEDCCombinedMPG', label: 'Fuel Consumption, Combined', unit: 'mpg', atKeys: ['fuelEconomyNEDCCombinedMPG', 'combinedFuelEconomyMPG', 'fuelConsumption', 'combinedMPG'] },
        ],
    },
    {
        title: 'Fuel Consumption (WLTP)',
        fields: [
            { key: 'fuelEconomyWLTPLowMPG', label: 'WLTP Fuel Consumption, Low', unit: 'mpg', atKeys: ['fuelEconomyWLTPLowMPG', 'wltpLowMPG'] },
            { key: 'fuelEconomyWLTPMidMPG', label: 'WLTP Fuel Consumption, Medium', unit: 'mpg', atKeys: ['fuelEconomyWLTPMidMPG', 'fuelEconomyWLTPMediumMPG', 'wltpMidMPG', 'wltpMediumMPG'] },
            { key: 'fuelEconomyWLTPHighMPG', label: 'WLTP Fuel Consumption, High', unit: 'mpg', atKeys: ['fuelEconomyWLTPHighMPG', 'wltpHighMPG'] },
            { key: 'fuelEconomyWLTPExtraHighMPG', label: 'WLTP Fuel Consumption, Extra High', unit: 'mpg', atKeys: ['fuelEconomyWLTPExtraHighMPG', 'wltpExtraHighMPG'] },
            { key: 'fuelEconomyWLTPCombinedMPG', label: 'WLTP Fuel Consumption, Combined', unit: 'mpg', atKeys: ['fuelEconomyWLTPCombinedMPG', 'wltpCombinedMPG'] },
        ],
    },
];

// Flatten all fields for iteration in save logic
const ALL_FIELDS = SECTIONS.flatMap(s => s.fields);

function resolveFieldValue(f: FieldDef, s: any, m: any, vehicle: any): any {
    if (f.type === 'caz') {
        const raw = m[f.key] ?? s[f.key];
        return Array.isArray(raw) ? raw : [];
    }
    if (f.source === 'vehicle') {
        const raw = vehicle?.[f.key] ?? (f.atKeys ? pickFirst(s, f.atKeys) : undefined);
        return raw !== undefined && raw !== null ? String(raw) : '';
    }
    const atKeys = f.atKeys ? [f.key, ...f.atKeys] : [f.key];
    // manualSpecs override first, then try all AT field name variants
    const raw = (m[f.key] !== undefined ? m[f.key] : pickFirst(s, atKeys));
    return raw !== undefined && raw !== null ? String(raw) : '';
}

function SpecField({
    field, value, fromAT, onChange,
}: {
    field: FieldDef;
    value: any;
    fromAT: boolean;
    onChange: (key: string, val: any) => void;
}) {
    const labelClass = `text-[12px] font-medium ${fromAT && (Array.isArray(value) ? value.length > 0 : value) ? 'text-orange-500' : 'text-slate-500'}`;

    if (field.type === 'ulez') {
        return (
            <div className="flex flex-col gap-2">
                <label className={labelClass}>{field.label}</label>
                <div className="flex items-center gap-6">
                    {['Compliant', 'Not Compliant', 'Exempt'].map(opt => (
                        <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-[13px] text-slate-700">
                            <input
                                type="radio"
                                name={field.key}
                                value={opt}
                                checked={value === opt}
                                onChange={() => onChange(field.key, opt)}
                                className="accent-[#4D7CFF]"
                            />
                            {opt}
                        </label>
                    ))}
                </div>
            </div>
        );
    }

    if (field.type === 'caz') {
        const selected: string[] = Array.isArray(value) ? value : [];
        const toggle = (city: string) => {
            const next = selected.includes(city)
                ? selected.filter(c => c !== city)
                : [...selected, city];
            onChange(field.key, next);
        };
        return (
            <div className="flex flex-col gap-2">
                <label className={labelClass}>{field.label}</label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {CAZ_CITIES.map(city => (
                        <label key={city} className="flex items-center gap-1.5 cursor-pointer text-[13px] text-slate-700">
                            <input
                                type="checkbox"
                                checked={selected.includes(city)}
                                onChange={() => toggle(city)}
                                className="accent-[#4D7CFF]"
                            />
                            {city}
                        </label>
                    ))}
                    <label className="flex items-center gap-1.5 cursor-pointer text-[13px] text-slate-700">
                        <input type="checkbox" checked={selected.includes('Not Compliant')} onChange={() => toggle('Not Compliant')} className="accent-[#4D7CFF]" />
                        Not Compliant
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[13px] text-slate-700">
                        <input type="checkbox" checked={selected.includes('Exempt')} onChange={() => toggle('Exempt')} className="accent-[#4D7CFF]" />
                        Exempt
                    </label>
                </div>
            </div>
        );
    }

    if (field.type === 'yesno') {
        return (
            <div className="flex flex-col gap-2">
                <label className={labelClass}>{field.label}</label>
                <div className="flex items-center gap-6">
                    {['Yes', 'No'].map(opt => (
                        <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-[13px] text-slate-700">
                            <input
                                type="radio"
                                name={field.key}
                                value={opt}
                                checked={value === opt || (opt === 'Yes' && value === 'true') || (opt === 'No' && value === 'false')}
                                onChange={() => onChange(field.key, opt)}
                                className="accent-[#4D7CFF]"
                            />
                            {opt}
                        </label>
                    ))}
                </div>
            </div>
        );
    }

    if (field.type === 'select') {
        return (
            <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{field.label}</label>
                <select
                    value={value}
                    onChange={e => onChange(field.key, e.target.value)}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-[#4D7CFF] bg-white"
                >
                    <option value="">—</option>
                    {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{field.label}</label>
            <div className="flex items-center border border-slate-200 rounded-md overflow-hidden focus-within:border-[#4D7CFF]">
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(field.key, e.target.value)}
                    placeholder="—"
                    className="flex-1 px-3 py-2 text-[13px] text-slate-800 focus:outline-none bg-white placeholder:text-slate-300"
                />
                {field.unit && (
                    <span className="px-3 text-[12px] text-slate-400 border-l border-slate-200 bg-slate-50 py-2 shrink-0">
                        {field.unit}
                    </span>
                )}
            </div>
        </div>
    );
}

export function SpecificationTab({ vehicle }: SpecificationTabProps) {
    const s = vehicle?.technicalSpecs || {};
    const m = vehicle?.manualSpecs || {};

    // AT + manualSpecs values, recalculated whenever vehicle changes
    const baseValues = useMemo(() => {
        const vals: Record<string, any> = {};
        for (const f of ALL_FIELDS) {
            vals[f.key] = resolveFieldValue(f, s, m, vehicle);
        }
        return vals;
    }, [vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

    // User edits in this session (not yet saved)
    const [overrides, setOverrides] = useState<Record<string, any>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);

    const values = useMemo(() => ({ ...baseValues, ...overrides }), [baseValues, overrides]);

    const handleChange = useCallback((key: string, val: any) => {
        setOverrides(prev => ({ ...prev, [key]: val }));
        setDirty(true);
        setSaved(false);
    }, []);

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            // Save all current values as manualSpecs (overriding AT data where user edited)
            const manualSpecs: Record<string, any> = {};
            const vehicleUpdate: Record<string, any> = {};

            for (const f of ALL_FIELDS) {
                const val = values[f.key];
                const atKeys = f.atKeys ? [f.key, ...f.atKeys] : [f.key];
                const atVal = pickFirst(s, atKeys);

                if (f.type === 'caz') {
                    manualSpecs[f.key] = Array.isArray(val) ? val : [];
                    continue;
                }
                if (f.source === 'vehicle') {
                    if (val !== '' && val !== undefined) vehicleUpdate[f.key] = val;
                    continue;
                }
                if (f.type === 'yesno') {
                    const boolVal = val === 'Yes' ? true : val === 'No' ? false : undefined;
                    if (boolVal !== undefined && String(boolVal) !== String(atVal ?? '')) {
                        manualSpecs[f.key] = boolVal;
                    }
                    continue;
                }
                const parsed = val !== '' && val !== undefined
                    ? (!isNaN(Number(val)) ? Number(val) : val)
                    : undefined;
                if (parsed !== undefined && String(parsed) !== String(atVal ?? '')) {
                    manualSpecs[f.key] = parsed;
                }
            }

            let vehicleId = String(vehicle._id ?? vehicle.id ?? '');
            if (/^[a-f0-9]{32}$/i.test(vehicleId)) vehicleId = `at-${vehicleId}`;
            await fetch('/api/vehicles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: vehicleId,
                    manualSpecs,
                    ...vehicleUpdate,
                }),
            });

            setSaved(true);
            setDirty(false);
        } finally {
            setSaving(false);
        }
    }, [values, vehicle, s]);

    return (
        <div className="space-y-5 w-full">
            {SECTIONS.map(sec => (
                <div key={sec.title} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h3 className="text-[14px] font-semibold text-slate-700">{sec.title}</h3>
                    </div>
                    <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-5">
                        {sec.fields.map(f => {
                            const atKeys = f.atKeys ? [f.key, ...f.atKeys] : [f.key];
                            const fromAT = f.source !== 'vehicle' && pickFirst(s, atKeys) !== undefined && m[f.key] === undefined;
                            return (
                                <div key={f.key} className={f.fullWidth ? 'col-span-2' : ''}>
                                    <SpecField field={f} value={values[f.key]} fromAT={fromAT} onChange={handleChange} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Save button at bottom */}
            <div className="flex items-center justify-between bg-white border border-[#E2E8F0] rounded-xl px-5 py-3 shadow-sm">
                <p className="text-[12px] text-slate-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1.5 mb-px" />
                    Orange labels = auto-filled from AutoTrader
                </p>
                <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className={`px-6 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                        saved && !dirty
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : dirty
                            ? 'bg-[#4D7CFF] text-white hover:bg-[#3a6ae8]'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    {saving ? 'Saving…' : saved && !dirty ? 'Saved ✓' : 'Save'}
                </button>
            </div>
        </div>
    );
}
