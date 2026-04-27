'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface Props { vehicle: any; onVehicleUpdate?: (updates: any) => void; }

const VEHICLE_HIGHLIGHTS = [
    ['Year', 'Age', 'Mileage', 'Hours Used'],
    ['Previous Owners', 'Seats', 'Doors', 'Body Type'],
    ['Colour', 'Fuel Type', 'Fuel Capacity', 'Transmission'],
    ['Drivetrain', 'Engine Size', 'Engine Cylinders', 'Engine Power (BHP)'],
    ['Engine Power (PS)', 'Engine Torque (lbs/ft)', 'Engine Torque (Nm)', 'Battery Full Charge Time'],
    ['Battery Quick Charge Time', 'Battery Capacity', 'Battery Range', 'Battery Health'],
    ['Height', 'Width', 'Length', 'Weight'],
    ['Kerb Weight', 'Gross Weight', 'Unladen Weight', 'MTPLM'],
    ['Load Height', 'Load Width', 'Load Length', 'Load Weight'],
    ['Load Volume', 'Boot Space', 'Cab Type', 'Driver Position'],
    ['Bedroom Layout', 'End Layout', 'Bedrooms', 'Berths'],
    ['Seat Belts', 'Acceleration', 'Top Speed', 'Fuel Consumption'],
    ['CO2 Emissions', 'Emission Class', 'ULEZ Compliance', 'CAZ Compliance'],
    ['Insurance Class', 'Warranty', 'Remaining Warranty', 'Battery Warranty'],
    ['Remaining Battery Warranty', 'Extended Warranty', 'UK Road Tax (VED)', 'Registration'],
];
const ALL_HIGHLIGHTS = VEHICLE_HIGHLIGHTS.flat();

const DISABLE_WEBSITE = ['Buy Online', 'Delivery', 'Click and Collect', 'Reserve Online', 'Finance', 'Viewings', 'Callbacks', 'Offers', 'Part Exchange'];
const EXCLUDE_FROM_ADVERT = ['Attention Grabber', 'Previous Owners', 'MOT', 'Warranty', 'Interior Condition', 'Exterior Condition', 'Tyre Condition'];
const STOP_FOLLOW_UPS = ['Vehicle Reserved (Email)'];

function toKey(label: string) {
    return label.replace(/[^a-zA-Z0-9]/g, '').replace(/^[A-Z]/, c => c.toLowerCase()).replace(/[A-Z]/g, c => c.toLowerCase()).split('').reduce((acc, c, i, arr) => {
        // camelCase
        return acc;
    }, label.replace(/[\s()\/\-]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toLowerCase()));
}

function labelToKey(label: string): string {
    return label
        .replace(/[\s\(\)\/\-]+(.)/g, (_, c) => c.toUpperCase())
        .replace(/^[A-Z]/, c => c.toLowerCase())
        .replace(/[^a-zA-Z0-9]/g, '');
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-[14px] font-semibold text-slate-800">{title}</h3>
                {action}
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

function RadioYesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center gap-5 mt-2">
            {[true, false].map(opt => (
                <label key={String(opt)} className="flex items-center gap-1.5 cursor-pointer text-[13px] text-slate-700">
                    <input type="radio" checked={value === opt} onChange={() => onChange(opt)} className="accent-[#4D7CFF]" />
                    {opt ? 'Yes' : 'No'}
                </label>
            ))}
        </div>
    );
}

export function VehicleSettingsTab({ vehicle, onVehicleUpdate }: Props) {
    const v = vehicle || {};

    // Vehicle Settings state
    const [featured, setFeatured] = useState<boolean>(!!v.featured);
    const [priceOnApplication, setPriceOnApplication] = useState<boolean>(!!v.priceOnApplication);
    const [vehicleUrl, setVehicleUrl] = useState<string>(v.vehicleUrl || '');
    const [highlights, setHighlights] = useState<string[]>(v.vehicleHighlights || []);
    const [disableWebsite, setDisableWebsite] = useState<Record<string, boolean>>(v.disableWebsite || {});
    const [stopFollowUps, setStopFollowUps] = useState<Record<string, boolean>>(v.stopFollowUps || {});

    // AutoTrader Settings state
    const [exDemo, setExDemo] = useState<boolean>(!!v.exDemo);
    const [atPoa, setAtPoa] = useState<boolean>(!!v.atPriceOnApplication);
    const [excludeFromAdvert, setExcludeFromAdvert] = useState<Record<string, boolean>>(v.excludeFromAdvert || {});

    // Advert channel states
    const [channelStatuses, setChannelStatuses] = useState<Record<string, 'PUBLISHED' | 'NOT_PUBLISHED'>>({
        atAdvertStatus:          v.atAdvertStatus          || 'NOT_PUBLISHED',
        advertiserAdvertStatus:  v.advertiserAdvertStatus  || 'NOT_PUBLISHED',
        locatorAdvertStatus:     v.locatorAdvertStatus     || 'NOT_PUBLISHED',
        exportAdvertStatus:      v.exportAdvertStatus      || 'NOT_PUBLISHED',
        profileAdvertStatus:     v.profileAdvertStatus     || 'NOT_PUBLISHED',
    });
    const [togglingChannel, setTogglingChannel] = useState<string | null>(null);

    const [savingVehicle, setSavingVehicle] = useState(false);
    const [savingAt, setSavingAt] = useState(false);
    const [reUploading, setReUploading] = useState(false);
    const [copyingVehicle, setCopyingVehicle] = useState(false);
    const [newVrm, setNewVrm] = useState('');
    const [updatingReg, setUpdatingReg] = useState(false);

    const patch = useCallback(async (data: Record<string, any>) => {
        let vehicleId = String(v._id ?? v.id ?? '');
        // AT stock IDs are 32-char hex — prepend at- so the API routes to the AT branch
        if (/^[a-f0-9]{32}$/i.test(vehicleId)) vehicleId = `at-${vehicleId}`;
        const res = await fetch('/api/vehicles', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: vehicleId, ...data }),
        });
        return res.json();
    }, [v._id, v.id]);

    const saveVehicleSettings = useCallback(async () => {
        setSavingVehicle(true);
        try {
            await patch({
                featured,
                priceOnApplication,
                vehicleUrl: vehicleUrl.trim(),
                vehicleHighlights: highlights,
                disableWebsite,
                stopFollowUps,
            });
            toast.success('Vehicle settings saved');
            onVehicleUpdate?.({ featured, priceOnApplication, vehicleUrl: vehicleUrl.trim(), vehicleHighlights: highlights, disableWebsite, stopFollowUps });
        } catch { toast.error('Failed to save'); }
        finally { setSavingVehicle(false); }
    }, [featured, priceOnApplication, vehicleUrl, highlights, disableWebsite, stopFollowUps, patch, onVehicleUpdate]);

    const saveAtSettings = useCallback(async () => {
        setSavingAt(true);
        try {
            await patch({ exDemo, atPriceOnApplication: atPoa, excludeFromAdvert });
            toast.success('AutoTrader settings saved');
            onVehicleUpdate?.({ exDemo, atPriceOnApplication: atPoa, excludeFromAdvert });
        } catch { toast.error('Failed to save'); }
        finally { setSavingAt(false); }
    }, [exDemo, atPoa, excludeFromAdvert, patch, onVehicleUpdate]);

    const toggleChannel = useCallback(async (key: string, currentStatus: 'PUBLISHED' | 'NOT_PUBLISHED') => {
        const newStatus = currentStatus === 'PUBLISHED' ? 'NOT_PUBLISHED' : 'PUBLISHED';
        setTogglingChannel(key);
        try {
            const res = await patch({ [key]: newStatus });
            if (res.ok !== false) {
                setChannelStatuses(prev => ({ ...prev, [key]: newStatus }));
                onVehicleUpdate?.({ [key]: newStatus });
                toast.success(`${newStatus === 'PUBLISHED' ? 'Published' : 'Unpublished'} successfully`);
            } else {
                toast.error(res.error?.message || 'Failed to update channel');
            }
        } catch { toast.error('Failed to update channel'); }
        finally { setTogglingChannel(null); }
    }, [patch, onVehicleUpdate]);

    const handleReUpload = useCallback(async () => {
        if (!v.stockId) return toast.error('Vehicle not linked to AutoTrader');
        setReUploading(true);
        try {
            // Re-push all vehicle data to AT by sending a full update
            await patch({
                colour: v.colour, mileage: v.mileage, fuelType: v.fuelType,
                transmission: v.transmission, bodyType: v.bodyType, vin: v.vin,
                doors: v.doors, seats: v.seats,
                description: v.description, attentionGrabber: v.attentionGrabber,
                features: v.features,
            });
            toast.success('Vehicle re-uploaded to AutoTrader');
        } catch { toast.error('Re-upload failed'); }
        finally { setReUploading(false); }
    }, [v, patch]);

    const handleCopyVehicle = useCallback(async () => {
        setCopyingVehicle(true);
        try {
            const res = await fetch('/api/vehicles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    make: v.make, model: v.model, derivative: v.derivative,
                    vrm: `COPY-${v.vrm}`, year: v.year, mileage: v.mileage,
                    price: v.price, fuelType: v.fuelType, transmission: v.transmission,
                    bodyType: v.bodyType, colour: v.colour, status: 'Draft',
                    description: v.description, features: v.features,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                toast.success('Vehicle copied — edit the VRM before publishing');
                if (data.vehicle?._id) window.open(`/app/vehicles/${data.vehicle._id}`, '_blank');
            } else toast.error(data.error || 'Copy failed');
        } catch { toast.error('Copy failed'); }
        finally { setCopyingVehicle(false); }
    }, [v]);

    const handleUpdateRegistration = useCallback(async () => {
        if (!newVrm.trim()) return toast.error('Enter a new registration');
        setUpdatingReg(true);
        try {
            await patch({ vrm: newVrm.trim().toUpperCase() });
            toast.success('Registration updated');
            onVehicleUpdate?.({ vrm: newVrm.trim().toUpperCase() });
            setNewVrm('');
        } catch { toast.error('Update failed'); }
        finally { setUpdatingReg(false); }
    }, [newVrm, patch, onVehicleUpdate]);

    const toggleHighlight = (h: string) => setHighlights(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);
    const toggleDisable = (k: string) => setDisableWebsite(prev => ({ ...prev, [labelToKey(k)]: !prev[labelToKey(k)] }));
    const toggleExclude = (k: string) => setExcludeFromAdvert(prev => ({ ...prev, [labelToKey(k)]: !prev[labelToKey(k)] }));
    const toggleStopFollowUp = (k: string) => setStopFollowUps(prev => ({ ...prev, [labelToKey(k)]: !prev[labelToKey(k)] }));

    return (
        <div className="space-y-5 w-full">

            {/* ─── Vehicle Settings ─────────────────────────────────────────── */}
            <SectionCard title="Vehicle Settings">
                <div className="space-y-6">
                    {/* Row 1 */}
                    <div className="grid grid-cols-3 gap-8">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-slate-700">Vehicle Status</span>
                                <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">ⓘ Important!</span>
                            </div>
                            <div className="mt-2 border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-500 bg-slate-50">
                                {v.status || 'In Stock'}
                                <span className="text-[11px] text-slate-400 ml-2">(change via Sales Channels)</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[13px] font-medium text-slate-700">Featured Vehicle</p>
                            <RadioYesNo value={featured} onChange={setFeatured} />
                        </div>
                        <div>
                            <p className="text-[13px] font-medium text-slate-700">Price On Application</p>
                            <RadioYesNo value={priceOnApplication} onChange={setPriceOnApplication} />
                        </div>
                    </div>

                    {/* Vehicle URL */}
                    <div>
                        <label className="text-[13px] font-medium text-slate-700">Vehicle URL</label>
                        <input
                            type="text"
                            value={vehicleUrl}
                            onChange={e => setVehicleUrl(e.target.value)}
                            placeholder={`${(v.make || '')} ${(v.model || '')} ${(v.derivative || '')}`.trim().replace(/\s+/g, '-')}
                            className="mt-1.5 w-full border border-slate-200 rounded-md px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-[#4D7CFF]"
                        />
                    </div>

                    {/* Vehicle Highlights */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[13px] font-medium text-slate-700">Vehicle Highlights</p>
                            <div className="flex gap-3 text-[12px]">
                                <button onClick={() => setHighlights(ALL_HIGHLIGHTS)} className="text-[#4D7CFF] hover:underline">Select All</button>
                                <span className="text-slate-300">/</span>
                                <button onClick={() => setHighlights([])} className="text-[#4D7CFF] hover:underline">None</button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            {VEHICLE_HIGHLIGHTS.map((row, ri) => (
                                <div key={ri} className="grid grid-cols-4 gap-x-4">
                                    {row.map(h => (
                                        <label key={h} className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-700 py-0.5">
                                            <input type="checkbox" checked={highlights.includes(h)} onChange={() => toggleHighlight(h)} className="accent-[#4D7CFF]" />
                                            {h}
                                        </label>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Disable Website Settings */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[13px] font-medium text-slate-700">Disable Website Settings</p>
                            <div className="flex gap-3 text-[12px]">
                                <button onClick={() => { const all: Record<string,boolean> = {}; DISABLE_WEBSITE.forEach(k => all[labelToKey(k)] = true); setDisableWebsite(all); }} className="text-[#4D7CFF] hover:underline">Select All</button>
                                <span className="text-slate-300">/</span>
                                <button onClick={() => setDisableWebsite({})} className="text-[#4D7CFF] hover:underline">None</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-x-4 gap-y-1.5">
                            {DISABLE_WEBSITE.map(k => (
                                <label key={k} className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-700 py-0.5">
                                    <input type="checkbox" checked={!!disableWebsite[labelToKey(k)]} onChange={() => toggleDisable(k)} className="accent-[#4D7CFF]" />
                                    {k}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Stop Follow-Ups */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[13px] font-medium text-slate-700">Stop Follow-Ups</p>
                            <div className="flex gap-3 text-[12px]">
                                <button onClick={() => { const all: Record<string,boolean> = {}; STOP_FOLLOW_UPS.forEach(k => all[labelToKey(k)] = true); setStopFollowUps(all); }} className="text-[#4D7CFF] hover:underline">Select All</button>
                                <span className="text-slate-300">/</span>
                                <button onClick={() => setStopFollowUps({})} className="text-[#4D7CFF] hover:underline">None</button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                            {STOP_FOLLOW_UPS.map(k => (
                                <label key={k} className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-700 py-0.5">
                                    <input type="checkbox" checked={!!stopFollowUps[labelToKey(k)]} onChange={() => toggleStopFollowUp(k)} className="accent-[#4D7CFF]" />
                                    {k}
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={saveVehicleSettings}
                        disabled={savingVehicle}
                        className="bg-[#4D7CFF] text-white px-6 py-2 rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae8] disabled:opacity-60"
                    >
                        {savingVehicle ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </SectionCard>

            {/* ─── AutoTrader Settings ──────────────────────────────────────── */}
            <SectionCard title="AutoTrader Settings">
                <div className="space-y-6">
                    {/* Advert channels — all 5, individually toggleable */}
                    <div>
                        <p className="text-[13px] font-medium text-slate-700 mb-3">Advertising Channels</p>
                        <div className="grid grid-cols-5 gap-4">
                            {[
                                { label: 'AutoTrader',  key: 'atAdvertStatus' },
                                { label: 'Advertiser',  key: 'advertiserAdvertStatus' },
                                { label: 'Locator',     key: 'locatorAdvertStatus' },
                                { label: 'Export',      key: 'exportAdvertStatus' },
                                { label: 'Profile',     key: 'profileAdvertStatus' },
                            ].map(({ label, key }) => {
                                const isPublished = channelStatuses[key] === 'PUBLISHED';
                                const isToggling = togglingChannel === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => toggleChannel(key, channelStatuses[key] as 'PUBLISHED' | 'NOT_PUBLISHED')}
                                        disabled={isToggling || !v.stockId}
                                        className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border-2 transition-all ${
                                            isPublished
                                                ? 'border-[#4D7CFF] bg-[#EEF2FF] text-[#4D7CFF]'
                                                : 'border-slate-200 bg-white text-slate-400'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        <div className={`w-3 h-3 rounded-full ${isPublished ? 'bg-[#4D7CFF]' : 'bg-slate-300'}`} />
                                        <span className="text-[12px] font-semibold">{label}</span>
                                        <span className="text-[11px]">
                                            {isToggling ? 'Updating…' : isPublished ? 'Published' : 'Not Published'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        {!v.stockId && (
                            <p className="text-[11px] text-slate-400 mt-2">Vehicle must be linked to AutoTrader to manage channels.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-4 gap-6">
                        <div>
                            <p className="text-[13px] font-medium text-slate-700">Ex-Demonstrator</p>
                            <RadioYesNo value={exDemo} onChange={setExDemo} />
                        </div>
                        <div>
                            <p className="text-[13px] font-medium text-slate-700">Price on Application</p>
                            <RadioYesNo value={atPoa} onChange={setAtPoa} />
                        </div>
                    </div>

                    {/* Exclude From Advert */}
                    <div>
                        <p className="text-[13px] font-medium text-slate-700 mb-3">Exclude From Advert</p>
                        <div className="grid grid-cols-4 gap-x-4 gap-y-1.5">
                            {EXCLUDE_FROM_ADVERT.map(k => (
                                <label key={k} className="flex items-center gap-2 cursor-pointer text-[13px] text-slate-700 py-0.5">
                                    <input type="checkbox" checked={!!excludeFromAdvert[labelToKey(k)]} onChange={() => toggleExclude(k)} className="accent-[#4D7CFF]" />
                                    {k}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Re-Upload */}
                    {v.stockId && (
                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[13px] font-semibold text-[#4D7CFF] mb-1">↑ Re-Upload</p>
                                <p className="text-[12px] text-slate-600">To force a complete re-upload of your vehicle data please select the Re-Upload button, this should not be necessary unless changes have been mistakenly made via AutoTrader Portal.</p>
                            </div>
                            <button
                                onClick={handleReUpload}
                                disabled={reUploading}
                                className="shrink-0 bg-slate-700 text-white px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-slate-800 disabled:opacity-60"
                            >
                                {reUploading ? 'Uploading…' : 'Re-Upload'}
                            </button>
                        </div>
                    )}

                    <button
                        onClick={saveAtSettings}
                        disabled={savingAt}
                        className="bg-[#4D7CFF] text-white px-6 py-2 rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae8] disabled:opacity-60"
                    >
                        {savingAt ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </SectionCard>

            {/* ─── Change Registration ──────────────────────────────────────── */}
            <SectionCard title="Change Registration">
                <div className="grid grid-cols-2 gap-8 items-start">
                    <div>
                        <div className="flex items-center gap-0 border-2 border-slate-800 rounded-lg overflow-hidden w-fit">
                            <div className="bg-[#1e1b72] px-2 py-2 flex flex-col items-center justify-center">
                                <div className="w-4 h-3 bg-[#FFD200] rounded-sm mb-1" />
                                <span className="text-white text-[9px] font-bold leading-none">UK</span>
                            </div>
                            <input
                                type="text"
                                value={newVrm}
                                onChange={e => setNewVrm(e.target.value.toUpperCase())}
                                placeholder={v.vrm || 'AB12 CDE'}
                                className="bg-[#FFD200] text-slate-900 font-bold text-[22px] tracking-widest px-4 py-2 w-48 text-center placeholder:text-slate-500 focus:outline-none uppercase"
                            />
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={handleUpdateRegistration}
                                disabled={updatingReg}
                                className="bg-[#4D7CFF] text-white px-5 py-2 rounded-lg text-[13px] font-semibold hover:bg-[#3a6ae8] disabled:opacity-60"
                            >
                                {updatingReg ? 'Updating…' : 'Update Registration'}
                            </button>
                            <button
                                onClick={handleCopyVehicle}
                                disabled={copyingVehicle}
                                className="border border-slate-300 text-slate-700 px-5 py-2 rounded-lg text-[13px] font-semibold hover:bg-slate-50 disabled:opacity-60"
                            >
                                {copyingVehicle ? 'Copying…' : 'Copy Vehicle'}
                            </button>
                        </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                        <p className="text-[13px] text-blue-800">ⓘ Please ensure you carefully check your vehicle data when using this feature.</p>
                    </div>
                </div>
            </SectionCard>

        </div>
    );
}
