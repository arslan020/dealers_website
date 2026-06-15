'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Step = 1 | 2;

const MAKE_COLORS: Record<string, string> = {
    audi: '#BB0A21', bmw: '#0066B1', mercedes: '#222222', ford: '#003476',
    volkswagen: '#001E61', toyota: '#EB0A1E', honda: '#CC0000', nissan: '#C3002F',
    vauxhall: '#FFCC00', peugeot: '#004165', renault: '#FFCC33', kia: '#05141F',
    hyundai: '#002C5F', volvo: '#003057', skoda: '#4BA82E', seat: '#E2001A',
    mazda: '#910020', subaru: '#003399', mitsubishi: '#CE1126',
    land: '#005A2B', jaguar: '#1A1A1A', porsche: '#AE9A64', lexus: '#1A1A1A',
    tesla: '#CC0000', mini: '#1A1A1A', fiat: '#8B0000',
};

function getMakeColor(make: string): string {
    const key = make.toLowerCase().split(' ')[0];
    return MAKE_COLORS[key] || '#4D7CFF';
}

function BrandLogo({ make }: { make: string }) {
    const makeSlug = make.toLowerCase().replace(/\s+/g, '-');
    const makeSlugNoDash = make.toLowerCase().replace(/\s+/g, '');

    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const target = e.currentTarget;
        const fallbacks = [
            `https://www.carlogos.org/car-logos/${makeSlugNoDash}-logo.png`,
            `https://logo.clearbit.com/${makeSlugNoDash}.com`,
        ];
        const currentSrc = target.src;
        const idx = fallbacks.findIndex(f => f === currentSrc);
        if (idx === -1) {
            target.src = fallbacks[0];
        } else if (idx < fallbacks.length - 1) {
            target.src = fallbacks[idx + 1];
        } else {
            target.style.display = 'none';
            const span = document.createElement('span');
            span.className = 'text-3xl font-black text-slate-400';
            span.textContent = make.charAt(0).toUpperCase();
            target.parentElement?.appendChild(span);
        }
    };

    return (
        <img
            src={`https://vehapi.com/apis/logo-api/img/logo/${makeSlug}.png`}
            alt={`${make} logo`}
            onError={handleError}
            className="w-full h-full object-contain"
            style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.10))' }}
        />
    );
}

export function AddVehicleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);
    const [vrm, setVrm] = useState('');
    const [lookupError, setLookupError] = useState('');
    const [vehicleData, setVehicleData] = useState<Record<string, any>>({});
    const [featuresData, setFeaturesData] = useState<{ standardFeatures: any[]; optionalExtras: any[]; factoryFitted: string[] }>({ standardFeatures: [], optionalExtras: [], factoryFitted: [] });

    useEffect(() => {
        if (!open) {
            setStep(1);
            setVrm('');
            setLookupError('');
            setVehicleData({});
            setFeaturesData({ standardFeatures: [], optionalExtras: [], factoryFitted: [] });
            setLoading(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    const handleLookup = async () => {
        if (!vrm.trim()) return;
        setLoading(true);
        setLookupError('');
        try {
            const res = await fetch(`/api/vehicles/lookup?vrm=${encodeURIComponent(vrm.trim())}`);
            const data = await res.json();
            if (data.ok && data.vehicle) {
                setVehicleData(data.vehicle);
                setFeaturesData({
                    standardFeatures: data.standardFeatures || [],
                    optionalExtras: data.optionalExtras || [],
                    factoryFitted: data.factoryFitted || [],
                });
                setStep(2);
            } else {
                setLookupError(data.error?.message || 'Vehicle not found. Check the registration and try again.');
            }
        } catch {
            setLookupError('Network error — please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddToStock = async () => {
        setLoading(true);
        try {
            const v = vehicleData;
            const res = await fetch('/api/vehicles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vrm: vrm.toUpperCase(),
                    vehicleType: 'Car',
                    make: v.make || '',
                    model: v.vehicleModel || '',
                    vehicleModel: v.vehicleModel || '',
                    derivative: v.derivative || '',
                    derivativeId: v.derivativeId || '',
                    colour: v.colour || '',
                    colourName: v.colour || '',
                    dateOfRegistration: v.registeredDate || undefined,
                    emissionClass: v.technicalSpecs?.emissionClass || undefined,
                    engineSize: v.engineSize ? String(v.engineSize) : undefined,
                    fuelType: v.fuelType || '',
                    transmission: v.transmission || 'Automatic',
                    bodyType: v.bodyType || '',
                    doors: parseInt(v.doors) || undefined,
                    seats: parseInt(v.seats) || undefined,
                    generation: v.generation || '',
                    trim: v.trim || '',
                    driverPosition: v.driverPosition || 'Right',
                    drivetrain: v.drivetrain || '',
                    vin: v.vin || undefined,
                    year: v.year || undefined,
                    co2EmissionGPKM: v.co2EmissionGPKM || undefined,
                    technicalSpecs: v.technicalSpecs || undefined,
                    status: 'Draft',
                    price: 0,
                    retailPrice: 0,
                    purchasePrice: 0,
                    mileage: 0,
                    previousOwners: 1,
                    serviceHistory: 'Full',
                    features: featuresData.standardFeatures.map((f: any) => f.name).filter(Boolean),
                    customFeatures: featuresData.optionalExtras.filter((f: any) => f.fitted).map((f: any) => f.name).filter(Boolean),
                    factoryFittedFeatures: featuresData.factoryFitted,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                const vehicleId = data.vehicle?._id || data.vehicle?.id;
                onClose();
                router.push(vehicleId ? `/app/vehicles/${vehicleId}` : '/app/vehicles');
            } else {
                alert(data.error?.message || data.error || 'Failed to add vehicle');
            }
        } catch {
            alert('Network error — please try again.');
        } finally {
            setLoading(false);
        }
    };

    const makeColor = getMakeColor(vehicleData.make || '');

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
            <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-slate-900/55 backdrop-blur-[3px]"
                onClick={onClose}
            />

            {step === 1 && (
                <div className="relative w-full max-w-xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/20 border border-slate-200 p-7 sm:p-9">
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                        <div className="text-center mb-7">
                            <div className="inline-flex items-center justify-center w-14 h-14 bg-[#4D7CFF] rounded-2xl shadow-lg shadow-blue-200 mb-4">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Add New Vehicle</h2>
                            <p className="text-slate-500 mt-2 text-[14px] font-medium">Enter the registration plate to get started</p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Registration Number</label>
                            <div className="flex items-stretch gap-0 rounded-2xl overflow-hidden border-2 border-slate-200 focus-within:border-[#4D7CFF] transition-colors shadow-sm">
                                <div className="bg-[#003399] flex flex-col items-center justify-center px-3 py-4 gap-0.5 shrink-0">
                                    <span className="text-white text-[8px] font-black tracking-wider">GB</span>
                                    <div className="w-5 h-5">
                                        <svg viewBox="0 0 60 40" className="w-full h-full">
                                            <rect width="60" height="40" fill="#012169"/>
                                            <path d="M0,0 L60,40 M60,0 L0,40" stroke="white" strokeWidth="8"/>
                                            <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="4"/>
                                            <path d="M30,0 V40 M0,20 H60" stroke="white" strokeWidth="12"/>
                                            <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="8"/>
                                        </svg>
                                    </div>
                                </div>
                                <input
                                    value={vrm}
                                    onChange={(e) => setVrm(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                                    placeholder="AB12 CDE"
                                    autoFocus
                                    className="flex-1 px-5 py-4 text-2xl font-black text-slate-900 uppercase tracking-widest bg-[#FFC200] placeholder-yellow-700/55 outline-none"
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>
                        </div>

                        {lookupError && (
                            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[12px] font-semibold text-red-600 flex items-center gap-2">
                                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                {lookupError}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleLookup}
                            disabled={loading || !vrm.trim()}
                            className="w-full py-4 bg-[#4D7CFF] hover:bg-[#3b6ce0] disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-blue-200 transition-all text-[14px] uppercase tracking-widest flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                            {loading ? 'Looking up...' : 'Lookup Vehicle'}
                        </button>

                        <p className="text-center text-[11px] text-slate-400 font-medium mt-4">Powered by AutoTrader VRM Lookup</p>
                    </div>
                    <div className="text-center mt-3 text-[10px] text-slate-300">Press ESC to close</div>
                </div>
            )}

            {step === 2 && (
                <div className="relative w-full max-w-md flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                        <h2 className="text-[15px] font-bold text-slate-900">Confirm Vehicle</h2>
                        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-5">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 shrink-0">
                                <BrandLogo make={vehicleData.make || ''} />
                            </div>
                            <p className="text-[13px] text-slate-500">Is this the correct vehicle?</p>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            {[
                                { label: 'Registration', value: vrm },
                                { label: 'Country', value: 'UNITED KINGDOM' },
                                { label: 'Manufacturer', value: (vehicleData.make || '').toUpperCase() },
                                { label: 'Year', value: vehicleData.year },
                                { label: 'Colour', value: (vehicleData.colour || '').toUpperCase() },
                            ].map((row, i, arr) => (
                                <div key={i} className={`flex items-center px-4 py-3 ${i < arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                    <span className="text-[12px] text-slate-400 w-32 shrink-0">{row.label}</span>
                                    <span className="text-[13px] font-bold text-slate-900">{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            onClick={handleAddToStock}
                            disabled={loading}
                            className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white bg-[#4D7CFF] hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : 'Correct Vehicle'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
