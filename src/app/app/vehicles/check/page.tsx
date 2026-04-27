'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuickCheck } from '@/components/vehicles/QuickCheckProvider';

type VehicleData = {
    make: string;
    vehicleModel: string;
    derivative: string;
    vrm: string;
    year: number;
    engineSize: number;
    fuelType: string;
    transmission: string;
    bodyType: string;
    colour: string;
    doors: number;
    seats: number;
    co2: number;
    features: string[];
    generation: string;
    trim: string;
    drivetrain: string;
    wheelbase: string;
    registeredDate: string;
    derivativeId?: string;
    rawResponse?: any;
};

type ValuationResult = {
    trade?: { amountGBP: number };
    partExchange?: { amountGBP: number };
    retail?: { amountGBP: number };
    private?: { amountGBP: number };
};

type MetricsResult = {
    rating?: { value: number } | null;
    daysToSell?: { value: number } | null;
    vehicleMetrics?: {
        retail?: { supply?: { value: number }; demand?: { value: number }; marketCondition?: { value: number } };
    } | null;
};

type TrendPoint = {
    date: string;
    odometerReadingMiles?: number;
    retail?: { amountGBP?: number | null };
    trade?: { amountGBP?: number | null };
    partExchange?: { amountGBP?: number | null };
};

type MotTest = {
    completedDate: string;
    expiryDate?: string;
    testResult: string;
    odometerValue?: number;
    odometerUnit?: string;
    motTestNumber?: string;
    rfrAndComments?: Array<{ type: string; text: string; dangerous?: boolean }>;
};

type VehicleHistory = {
    stolen?: boolean;
    scrapped?: boolean;
    imported?: boolean;
    exported?: boolean;
    previousOwners?: number;
    keeperChanges?: Array<{ dateOfLastKeeper: string }>;
    v5cs?: Array<{ issuedDate: string }>;
};

type VehicleCheck = VehicleHistory & {
    insuranceWriteoffCategory?: string | null;
    highRisk?: boolean;
    privateFinance?: boolean;
    tradeFinance?: boolean;
    mileageDiscrepancy?: boolean;
    registrationChanged?: boolean;
    colourChanged?: boolean;
    dvlaVehicle?: {
        engineCapacityCC?: number;
        co2EmissionsGKM?: number;
    };
    plateChanges?: Array<{
        previousVrm: string;
        currentVrm: string;
        dateChanged: string;
    }>;
    financeAgreements?: Array<{
        agreementNumber: string;
        company: string;
        telephone: string;
        type: string;
        startDate: string;
        term: string;
    }>;
};

type CheckData = {
    motTests?: MotTest[];
    history?: VehicleHistory | null;
    check?: VehicleCheck | null;
    vin?: string | null;
    engineNumber?: string | null;
    dvlaTax?: {
        taxStatus: string;
        taxDueDate: string;
        motStatus: string;
        firstUsedDate: string;
        engineCapacity?: number;
        co2Emissions?: number;
    } | null;
    fetchedAt?: string;
    limitedData?: boolean;
};

/** "2023-10-04" → "04/10/2023" */
function fmtDate(iso?: string | null): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m) return iso;
    if (!d) return `${m}/${y}`; // "YYYY-MM" → "MM/YYYY"
    return `${d}/${m}/${y}`;
}

/** "YYYY-MM" → "MM/YYYY"  |  "YYYY-MM-DD" → "MM/YYYY" */
function fmtMonthYear(val?: string | null): string {
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length >= 2) return `${parts[1]}/${parts[0]}`;
    return val;
}

export default function QuickCheckPage() {
    const searchParams = useSearchParams();
    const { openQuickCheck } = useQuickCheck();
    const router = useRouter();
    const vrmParam = searchParams.get('vrm')?.toUpperCase() ?? '';

    const LoadingSpinner = () => (
        <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </span>
    );

    const [vehicle, setVehicle] = useState<VehicleData | null>(null);
    const [derivativeData, setDerivativeData] = useState<any>(null);
    const [checkData, setCheckData] = useState<CheckData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeSection, setActiveSection] = useState('vehicle');
    const [mileage, setMileage] = useState('');
    const [condition, setCondition] = useState('Good');
    const [valuation, setValuation] = useState<ValuationResult | null>(null);
    const [metrics, setMetrics] = useState<MetricsResult | null>(null);
    const [valuationLoading, setValuationLoading] = useState(false);
    const [valuationError, setValuationError] = useState('');
    const [showPrivate, setShowPrivate] = useState(false);
    const [trend, setTrend] = useState<TrendPoint[] | null>(null);
    const [trendLoading, setTrendLoading] = useState(false);
    const [trendError, setTrendError] = useState('');
    const [showFullVin, setShowFullVin] = useState(false);
    const [upgradeLoading, setUpgradeLoading] = useState(false);
    const [upgradeError, setUpgradeError] = useState('');
    const [stdFeatures, setStdFeatures] = useState<{ name: string; category: string }[]>([]);
    const [optExtras, setOptExtras] = useState<{ name: string; category: string; price: number | null }[]>([]);
    const [featuresLoading, setFeaturesLoading] = useState(false);
    const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
    const [addingVehicle, setAddingVehicle] = useState(false);
    const [addVehicleError, setAddVehicleError] = useState('');

    async function handleAddVehicle() {
        if (!vehicle) return;
        setAddingVehicle(true);
        setAddVehicleError('');
        try {
            const motExpiry = checkData?.motTests?.find(t => t.testResult === 'Passed' && t.expiryDate)?.expiryDate;
            const previousOwners = checkData?.history?.previousOwners ?? checkData?.check?.previousOwners ?? undefined;
            const vin = checkData?.vin ?? undefined;

            const body = {
                make: vehicle.make,
                model: vehicle.vehicleModel,
                derivative: vehicle.derivative,
                derivativeId: vehicle.derivativeId,
                vrm: vrmParam,
                vin,
                year: vehicle.year,
                dateOfRegistration: vehicle.registeredDate,
                fuelType: vehicle.fuelType,
                transmission: vehicle.transmission,
                bodyType: vehicle.bodyType,
                colour: vehicle.colour,
                doors: vehicle.doors,
                seats: vehicle.seats,
                engineSize: vehicle.engineSize ? String(vehicle.engineSize) : undefined,
                drivetrain: vehicle.drivetrain,
                generation: vehicle.generation,
                trim: vehicle.trim,
                previousOwners,
                motExpiry: motExpiry ?? undefined,
                mileage: 0,
                price: 0,
                imagesCount: 0,
                videosCount: 0,
                primaryImage: '',
                websitePublished: false,
                status: 'Draft',
            };

            const res = await fetch('/api/vehicles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.ok && data.vehicle?._id) {
                router.push(`/app/vehicles/${data.vehicle._id}`);
            } else {
                setAddVehicleError(data.error?.message || data.error || 'Could not add vehicle.');
            }
        } catch {
            setAddVehicleError('Network error. Please try again.');
        } finally {
            setAddingVehicle(false);
        }
    }

    async function handleUpgradeToFullReport() {
        if (!vrmParam) return;
        setUpgradeLoading(true);
        setUpgradeError('');
        try {
            const res = await fetch(`/api/vehicles/vehicle-check?vrm=${encodeURIComponent(vrmParam)}`);
            const d = await res.json();
            if (d.ok && d.check) {
                setCheckData(prev => prev ? {
                    ...prev,
                    check: d.check,
                    history: d.history ?? prev.history,
                    dvlaTax: d.dvlaTax ?? prev.dvlaTax,
                    vin: d.vehicle?.vin || prev.vin,
                    engineNumber: d.vehicle?.engineNumber || prev.engineNumber,
                    fetchedAt: d._fetchedAt ?? prev.fetchedAt,
                } : null);
            } else if (!d.ok) {
                setUpgradeError(d.error?.message || 'Could not fetch full vehicle check. Please try again.');
            } else {
                // d.ok true but check is null — AT has no full check data for this VRM
                setUpgradeError('Full vehicle check data is not available for this vehicle in the current environment.');
            }
        } catch {
            setUpgradeError('Network error. Please try again.');
        } finally {
            setUpgradeLoading(false);
        }
    }

    async function handleShowTrend() {
        if (!vehicle?.derivativeId || !mileage.trim()) return;
        if (trend) { setTrend(null); return; } // toggle off
        setTrendLoading(true);
        setTrendError('');
        try {
            const res = await fetch('/api/vehicles/valuation-trend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    derivativeId: vehicle.derivativeId,
                    firstRegistrationDate: vehicle.registeredDate,
                    mileage: mileage.trim(),
                    condition,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setTrend(data.trend ?? []);
            } else {
                setTrendError(data.error?.message || 'Could not fetch trend.');
            }
        } catch {
            setTrendError('Network error.');
        } finally {
            setTrendLoading(false);
        }
    }

    async function handleGetValuation() {
        if (!vehicle || !mileage.trim()) return;
        setValuationLoading(true);
        setValuationError('');
        setValuation(null);
        setMetrics(null);
        setShowPrivate(false);
        try {
            const res = await fetch('/api/vehicles/valuation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vrm: vrmParam,
                    mileage: mileage.trim(),
                    condition,
                    derivativeId: vehicle.derivativeId,
                    registeredDate: vehicle.registeredDate,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setValuation(data.valuations);
                setMetrics(data.metrics ?? null);
            } else {
                setValuationError(data.error?.message || 'Could not fetch valuation.');
            }
        } catch {
            setValuationError('Network error. Please try again.');
        } finally {
            setValuationLoading(false);
        }
    }

    const fetchVehicle = useCallback(async (vrm: string) => {
        setLoading(true);
        setError('');
        setVehicle(null);
        setDerivativeData(null);
        setCheckData(null);
        setStdFeatures([]);
        setOptExtras([]);
        try {
            const res = await fetch(`/api/vehicles/lookup?vrm=${encodeURIComponent(vrm)}`);
            const data = await res.json();
            if (data.ok) {
                setVehicle(data.vehicle);
                
                // Fetch full derivative details if we have the derivativeId
                if (data.vehicle?.derivativeId) {
                    fetch(`/api/vehicles/derivatives?id=${data.vehicle.derivativeId}`)
                        .then(r => r.json())
                        .then(d => { if (d.ok) setDerivativeData(d.derivative?.vehicle || d.derivative || null); })
                        .catch(() => {});
                }

                // Fetch full check data in background
                fetch(`/api/vehicles/vehicle-check?vrm=${encodeURIComponent(vrm)}`)
                    .then(r => r.json())
                    .then(d => { if (d.ok) setCheckData({ motTests: d.motTests, dvlaTax: d.dvlaTax, history: d.history, check: d.check, vin: d.vehicle?.vin || null, engineNumber: d.vehicle?.engineNumber || null, fetchedAt: d._fetchedAt, limitedData: d.limitedData }); })
                    .catch(() => { });
                // Fetch standard features + optional extras in background
                setFeaturesLoading(true);
                fetch(`/api/vehicles/optional-extras?vrm=${encodeURIComponent(vrm)}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d.ok) {
                            setStdFeatures(d.standardFeatures || []);
                            setOptExtras(d.optionalExtras || []);
                        }
                    })
                    .catch(() => { })
                    .finally(() => setFeaturesLoading(false));
            } else {
                setError(data.error?.message || 'Could not find vehicle.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (vrmParam) fetchVehicle(vrmParam);
    }, [vrmParam, fetchVehicle]);

    // Auto-upgrade: if initial check came back limited, retry full report automatically
    useEffect(() => {
        if (checkData?.limitedData && !upgradeLoading) {
            handleUpgradeToFullReport();
        }
    }, [checkData?.limitedData]);

    // Scroll spy — update active sidebar section as user scrolls
    useEffect(() => {
        const sectionIds = ['vehicle', 'valuation', 'background', 'mot', 'features', 'extras', 'spec'];
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                });
            },
            { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
        );
        sectionIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [vehicle]);

    // No VRM — redirect to modal
    if (!vrmParam) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <div className="text-center">
                    <h2 className="text-lg font-bold text-slate-800">Quick Check</h2>
                    <p className="text-slate-400 text-sm mt-1">Enter a number plate to review a vehicle.</p>
                </div>
                <button
                    onClick={openQuickCheck}
                    className="px-6 py-3 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200"
                >
                    Check a Vehicle
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm font-medium">Loading vehicle data...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 font-medium max-w-sm text-center">
                    {error}
                </div>
                <button onClick={openQuickCheck} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all">
                    Try Another Plate
                </button>
            </div>
        );
    }

    if (!vehicle) return null;

    const navSections = [
        { id: 'vehicle', label: 'Vehicle', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10h10zm0 0h6l2-4-3-3h-5v7z" /></svg> },
        { id: 'valuation', label: 'Valuation', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'background', label: 'Background', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
        { id: 'mot', label: 'MOT History', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
        { id: 'features', label: 'Standard Features', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
        { id: 'extras', label: 'Optional Extras', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> },
        { id: 'spec', label: 'Specification', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg> },
    ];

    const leftSpecs = [
        { label: 'Type', value: vehicle.bodyType || 'Car' },
        { label: 'Make', value: vehicle.make },
        { label: 'Model', value: vehicle.vehicleModel },
        { label: 'Generation', value: vehicle.generation },
        { label: 'Derivative', value: vehicle.derivative },
        { label: 'Trim', value: vehicle.trim },
        { label: 'Engine Size', value: vehicle.engineSize ? String(vehicle.engineSize) : undefined },
        { label: 'Body', value: vehicle.bodyType },
    ].filter(s => s.value);

    const rightSpecs = [
        { label: 'Colour', value: vehicle.colour },
        { label: 'Fuel', value: vehicle.fuelType },
        { label: 'Transmission', value: vehicle.transmission },
        { label: 'Drivetrain', value: vehicle.drivetrain },
        { label: 'Seats', value: vehicle.seats != null ? String(vehicle.seats) : undefined },
        { label: 'Doors', value: vehicle.doors != null ? String(vehicle.doors) : undefined },
        { label: 'Wheelbase', value: vehicle.wheelbase || 'STD' },
        { label: 'Registered', value: fmtDate(vehicle.registeredDate) },
    ].filter(s => s.value);

    return (
        <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-400">
                <Link href="/app/vehicles" className="hover:text-indigo-600 transition-colors">Vehicles</Link>
                <span>/</span>
                <button onClick={openQuickCheck} className="hover:text-indigo-600 transition-colors">Quick Check</button>
                <span>/</span>
                <span className="text-slate-700 font-bold">{vrmParam}</span>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-start">
                {/* ── Sidebar ── */}
                <div className="w-full md:w-[220px] flex-shrink-0 md:sticky top-6 self-start">
                    {/* UK Plate */}
                    <div className="flex items-stretch rounded-md overflow-hidden mb-5 h-12 border-2 border-slate-800 shadow-sm">
                        <div className="bg-blue-700 flex flex-col items-center justify-center px-2 min-w-[36px]">
                            <div className="flex gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                    <span key={i} className="text-[4px] text-yellow-300 leading-none">★</span>
                                ))}
                            </div>
                            <span className="text-white text-[8px] font-black tracking-widest leading-none mt-0.5">UK</span>
                        </div>
                        <div className="flex-1 bg-amber-400 flex items-center justify-center">
                            <span className="text-slate-900 font-black text-xl tracking-[0.12em]">{vrmParam}</span>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="mb-5">
                        {navSections.map(s => (
                            <button
                                key={s.id}
                                onClick={() => {
                                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                                className={`w-full text-left py-2.5 text-[13px] transition-colors flex items-center gap-2.5 border-l-2 pl-3 ${
                                    activeSection === s.id
                                        ? 'border-blue-600 text-blue-600 font-semibold'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 font-normal'
                                }`}
                            >
                                <span className={`flex-shrink-0 ${activeSection === s.id ? 'text-blue-500' : 'text-slate-400'}`}>
                                    {s.icon}
                                </span>
                                {s.label}
                            </button>
                        ))}
                    </nav>

                    <button
                        onClick={handleAddVehicle}
                        disabled={addingVehicle}
                        className="w-full py-2.5 bg-blue-600 text-white font-semibold text-[13px] rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {addingVehicle ? (
                            <>
                                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                Adding...
                            </>
                        ) : 'Add Vehicle'}
                    </button>
                    {addVehicleError && (
                        <p className="text-xs text-red-500 mt-2 text-center">{addVehicleError}</p>
                    )}
                </div>

                {/* ── Main Content ── */}
                <div className="flex-1 min-w-0 pr-2">

                    {/* Vehicle */}
                    <section id="vehicle" className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden mb-6">
                        <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center">
                            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Vehicle</h2>
                        </div>
                        <div className="flex flex-col md:flex-row pb-2">
                            {/* Left Column */}
                            <div className="flex-1 border-r border-slate-50/50">
                                {leftSpecs.map(spec => (
                                    <div key={spec.label} className="flex items-center px-6 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors">
                                        <span className="text-[13px] text-slate-400 text-right w-32 pr-6 flex-shrink-0">{spec.label}:</span>
                                        <span className={`text-[13px] font-medium flex-1 ${spec.label === 'Generation' ? 'text-indigo-500 hover:underline cursor-pointer' : 'text-slate-800'}`}>
                                            {spec.value || '-'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {/* Right Column */}
                            <div className="flex-1">
                                {rightSpecs.map(spec => (
                                    <div key={spec.label} className="flex items-center px-6 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors">
                                        <span className="text-[13px] text-slate-400 text-right w-32 pr-6 flex-shrink-0">{spec.label}:</span>
                                        <span className="text-[13px] font-medium text-slate-800 flex-1 capitalize">{spec.value || '-'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Valuation */}
                    <section id="valuation" className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden mb-6">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50">
                            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Valuation</h2>
                            <span className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700 font-medium" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>[Back to Top]</span>
                        </div>
                        <div className="p-6">
                            {/* Inputs row matching Motordesk layout exactly */}
                            <div className="flex flex-col md:flex-row gap-6 mb-4 items-end">
                                <div className="flex-1">
                                    <label className="text-[12px] font-semibold text-slate-500 mb-2 block">Mileage</label>
                                    <input
                                        value={mileage}
                                        onChange={e => setMileage(e.target.value.replace(/\D/g, ''))}
                                        placeholder=""
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition-all shadow-sm"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[12px] font-semibold text-slate-500 mb-2 block">Condition</label>
                                    <select
                                        value={condition}
                                        onChange={e => setCondition(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none bg-white transition-all shadow-sm"
                                    >
                                        <option>Poor</option>
                                        <option>Average</option>
                                        <option>Good</option>
                                        <option>Excellent</option>
                                        <option>New</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleGetValuation}
                                    disabled={valuationLoading || !mileage.trim()}
                                    className="px-6 py-2.5 bg-[#8b5cf6] text-white font-bold text-[13px] rounded-lg hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-[0_4px_12px_rgba(139,92,246,0.25)] h-[42px]"
                                >
                                    {valuationLoading ? <LoadingSpinner /> : 'Get Valuation'}
                                </button>
                            </div>
                            <p className="text-[12px] text-slate-400">Note, <span className="text-[#8b5cf6] cursor-pointer hover:underline">selected optional extras</span> may affect valuation.</p>

                            {/* Error */}
                            {valuationError && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">{valuationError}</div>
                            )}

                            {/* Valuation Results */}
                            {valuation && (
                                <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-5 space-y-4 animate-in fade-in duration-300">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                                <span className="text-sm font-bold text-emerald-800">Valuation</span>
                                            </div>
                                            <p className="text-xs text-emerald-600 ml-6">Based on date first registered, mileage, condition and optional extras.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowPrivate(p => !p)}
                                                className="text-xs px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all font-medium"
                                            >
                                                {showPrivate ? 'Hide Private Valuation' : 'Show Private Valuation'}
                                            </button>
                                            <button
                                                onClick={() => setValuation(null)}
                                                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 text-lg leading-none"
                                            >×</button>
                                        </div>
                                    </div>

                                    {/* 3 main cards */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { label: 'Trade Valuation', amount: valuation.trade?.amountGBP },
                                            { label: 'Part Ex Valuation', amount: valuation.partExchange?.amountGBP },
                                            { label: 'Retail Valuation', amount: valuation.retail?.amountGBP },
                                        ].map(card => (
                                            <div key={card.label} className="bg-teal-500 rounded-xl p-4 text-white text-center">
                                                <div className="flex items-center justify-center gap-1.5 mb-2 opacity-80">
                                                    <svg viewBox="0 0 60 14" className="h-3 fill-white">
                                                        <text x="0" y="11" fontSize="11" fontWeight="bold" fontFamily="sans-serif">≡AutoTrader</text>
                                                    </svg>
                                                </div>
                                                <p className="text-[11px] opacity-80 mb-1">{card.label}</p>
                                                <p className="text-2xl font-black">
                                                    {card.amount != null ? `£${card.amount.toLocaleString()}` : '—'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Private valuation */}
                                    {showPrivate && valuation.private?.amountGBP != null && (
                                        <div className="bg-teal-600 rounded-xl p-4 text-white text-center animate-in fade-in duration-200">
                                            <p className="text-[11px] opacity-80 mb-1">Private Valuation</p>
                                            <p className="text-2xl font-black">£{valuation.private.amountGBP.toLocaleString()}</p>
                                        </div>
                                    )}

                                    {/* Show Valuation Trend */}
                                    <button
                                        onClick={handleShowTrend}
                                        disabled={trendLoading}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 transition-colors disabled:opacity-50"
                                    >
                                        {trendLoading ? (
                                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        ) : (
                                            <svg className={`w-3.5 h-3.5 transition-transform ${trend ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                        )}
                                        {trend ? 'Hide Valuation Trend' : 'Show Valuation Trend'}
                                    </button>

                                    {/* Trend error */}
                                    {trendError && (
                                        <p className="text-xs text-red-500 font-medium">{trendError}</p>
                                    )}

                                    {/* Trend table */}
                                    {trend && trend.length > 0 && (
                                        <div className="border border-teal-100 rounded-xl overflow-hidden animate-in fade-in duration-200">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-teal-500 text-white">
                                                        <th className="px-3 py-2 text-left font-semibold">Date</th>
                                                        <th className="px-3 py-2 text-right font-semibold">Retail</th>
                                                        <th className="px-3 py-2 text-right font-semibold">Trade</th>
                                                        <th className="px-3 py-2 text-right font-semibold">Part Ex</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {trend.map((pt, i) => (
                                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-teal-50/40'}>
                                                            <td className="px-3 py-2 text-slate-600 font-medium">{pt.date}</td>
                                                            <td className="px-3 py-2 text-right font-bold text-slate-800">
                                                                {pt.retail?.amountGBP != null ? `£${pt.retail.amountGBP.toLocaleString()}` : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-bold text-slate-800">
                                                                {pt.trade?.amountGBP != null ? `£${pt.trade.amountGBP.toLocaleString()}` : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-bold text-slate-800">
                                                                {pt.partExchange?.amountGBP != null ? `£${pt.partExchange.amountGBP.toLocaleString()}` : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {trend && trend.length === 0 && (
                                        <p className="text-xs text-slate-400">No trend data available for this vehicle.</p>
                                    )}
                                </div>
                            )}

                            {/* Vehicle Metrics */}
                            {metrics && (
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3 animate-in fade-in duration-300">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                                <span className="text-sm font-bold text-slate-700">Vehicle Metrics</span>
                                            </div>
                                            <p className="text-xs text-slate-400 ml-6">Market insights powered by AutoTrader.</p>
                                        </div>
                                        <button onClick={() => setMetrics(null)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                                    </div>
                                    {metrics.rating?.value != null && (
                                        <div className="bg-teal-500 rounded-xl p-4 text-white text-center">
                                            <p className="text-xs opacity-80 mb-1">Retail Rating</p>
                                            <p className="text-3xl font-black">{Math.round(metrics.rating.value)} <span className="text-base font-semibold opacity-70">/ 100</span></p>
                                        </div>
                                    )}
                                    {metrics.daysToSell?.value != null && (
                                        <div className="flex justify-between items-center px-2">
                                            <span className="text-xs text-slate-500">Est. Days to Sell</span>
                                            <span className="text-sm font-bold text-slate-800">{Math.round(metrics.daysToSell.value)} days</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Background */}
                    <section id="background" className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden mb-6">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50">
                            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Background</h2>
                            <span className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700 font-medium" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>[Back to Top]</span>
                        </div>
                        {!checkData ? (
                            <div className="p-6 flex items-center gap-3 text-slate-400">
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                <span className="text-sm">Loading background data...</span>
                            </div>
                        ) : (
                            <div className="p-6 grid grid-cols-2 gap-6">
                                {/* LEFT: status checks */}
                                <div className="space-y-2">
                                    {/* Auto-loading full check indicator */}
                                    {!checkData.check && upgradeLoading && (
                                        <div className="flex items-center gap-2 p-3 bg-cyan-50 border border-cyan-100 rounded-xl mb-3">
                                            <svg className="animate-spin w-3.5 h-3.5 text-cyan-600 flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                            <p className="text-xs font-medium text-cyan-700">Loading full vehicle report...</p>
                                        </div>
                                    )}

                                    {/* Status bars */}
                                    {(() => {
                                        const src = checkData.check ?? checkData.history;
                                        const isBasic = !checkData.check;
                                        const statusItems = [
                                            { label: src?.stolen === false ? 'Not Stolen' : 'Stolen', ok: !src?.stolen, alwaysShow: true },
                                            { label: src?.scrapped === false ? 'Not Scrapped' : 'Scrapped', ok: !src?.scrapped, alwaysShow: true },
                                            { label: src?.imported === false ? 'Not Imported' : 'Imported', ok: !src?.imported, alwaysShow: true },
                                            { label: src?.exported === false ? 'Not Exported' : 'Exported', ok: !src?.exported, alwaysShow: true },
                                        ];
                                        const upgradeLabels: string[] = isBasic ? [
                                            'Write-Off', 'Mileage Discrepancies', 'Colour Changes',
                                            'Plate Changes', 'High Risk Markers', 'Private Finance', 'Trade Finance',
                                        ] : [];

                                        // MOT expiry from motTests
                                        const latestPassed = checkData.motTests?.find(t => t.testResult === 'Passed' && t.expiryDate);
                                        const motExpiry = latestPassed?.expiryDate;

                                        // Render basic layout
                                        if (isBasic) {
                                            return (
                                                <>
                                                    {statusItems.map(item => (
                                                        <div key={item.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${item.ok ? 'bg-teal-500 text-white' : 'bg-red-500 text-white'}`}>
                                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                {item.ok
                                                                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
                                                            </svg>
                                                            {item.label}
                                                        </div>
                                                    ))}
                                                    {upgradeLabels.map((label) => (
                                                        <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-teal-400/80 text-white opacity-80">
                                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            Upgrade for {label}
                                                        </div>
                                                    ))}
                                                    {motExpiry && (
                                                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-teal-500 text-white">
                                                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            MOT Valid Until {new Date(motExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        }

                                        // Render upgraded layout
                                        const upgradedItems = [
                                            ...statusItems,
                                            {
                                                label: checkData.check?.insuranceWriteoffCategory ? `Write-Off: Cat ${checkData.check.insuranceWriteoffCategory}` : 'Not Written-Off',
                                                ok: !checkData.check?.insuranceWriteoffCategory
                                            },
                                            {
                                                label: checkData.check?.mileageDiscrepancy ? 'Mileage Discrepancy Detected' : 'No Mileage Discrepancies',
                                                ok: !checkData.check?.mileageDiscrepancy
                                            },
                                            {
                                                label: checkData.check?.colourChanged ? 'Colour Changed' : 'No Colour Changes',
                                                ok: !checkData.check?.colourChanged
                                            },
                                        ];

                                        const hasPlateChanges = checkData.check?.registrationChanged || (checkData.check?.plateChanges && checkData.check.plateChanges.length > 0);
                                        const plateChangesList = checkData.check?.plateChanges || [];

                                        const highRiskItem = {
                                            label: checkData.check?.highRisk ? 'High Risk Marker Detected' : 'No High Risk Markers',
                                            ok: !checkData.check?.highRisk
                                        };

                                        const hasPrivateFinance = checkData.check?.privateFinance;

                                        const tradeFinanceItem = {
                                            label: checkData.check?.tradeFinance ? 'Trade Finance' : 'No Trade Finance',
                                            ok: !checkData.check?.tradeFinance
                                        };

                                        return (
                                            <>
                                                {upgradedItems.map(item => (
                                                    <div key={item.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${item.ok ? 'bg-teal-500 text-white' : 'bg-red-500 text-white'}`}>
                                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            {item.ok
                                                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
                                                        </svg>
                                                        {item.label}
                                                    </div>
                                                ))}

                                                {/* Plate Changes Block */}
                                                {!hasPlateChanges ? (
                                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-teal-500 text-white">
                                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        No Plate Changes
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#eac99f] text-[#5c4018]">
                                                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        <div>
                                                            <p className="text-sm font-bold mb-1">Plate Changed!</p>
                                                            {plateChangesList.length > 0 ? (
                                                                plateChangesList.map((pc, i) => (
                                                                    <p key={i} className="text-xs">Plate changed from <span className="font-bold">{pc.previousVrm}</span> to <span className="font-bold">{pc.currentVrm}</span> on {pc.dateChanged}.</p>
                                                                ))
                                                            ) : (
                                                                <p className="text-xs">Vehicle has previous plate changes.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* High Risk Block */}
                                                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${highRiskItem.ok ? 'bg-teal-500 text-white' : 'bg-red-500 text-white'}`}>
                                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        {highRiskItem.ok
                                                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
                                                    </svg>
                                                    {highRiskItem.label}
                                                </div>

                                                {/* Private Finance Block */}
                                                {!hasPrivateFinance ? (
                                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-teal-500 text-white">
                                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        No Private Finance
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#eac99f] text-[#5c4018]">
                                                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        <div>
                                                            <p className="text-sm font-bold mb-1">Private Finance Agreements!</p>
                                                            <p className="text-xs">Vehicle has outstanding private finance.</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Trade Finance Block */}
                                                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${tradeFinanceItem.ok ? 'bg-teal-500 text-white' : 'bg-red-500 text-white'}`}>
                                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        {tradeFinanceItem.ok
                                                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
                                                    </svg>
                                                    {tradeFinanceItem.label}
                                                </div>

                                                {motExpiry && (
                                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-teal-500 text-white">
                                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        MOT Valid Until {new Date(motExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* RIGHT: your checks + vehicle tax + owners */}
                                <div className="space-y-6">
                                    {/* Your Checks */}
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Your Checks</h3>
                                        <div className="space-y-0 divide-y divide-slate-50">
                                            {/* VIN row with Show Full VIN button */}
                                            {checkData.vin && (
                                                <div className="flex justify-between py-1.5 text-sm items-center">
                                                    <span className="text-slate-400">{showFullVin ? 'VIN:' : 'VIN ends with:'}</span>
                                                    <span className="flex items-center gap-2 font-semibold text-slate-800">
                                                        {showFullVin ? checkData.vin : checkData.vin.slice(-4)}
                                                        <button
                                                            onClick={() => setShowFullVin(prev => !prev)}
                                                            className="text-[10px] px-2 py-0.5 border border-indigo-200 text-indigo-600 rounded font-semibold hover:bg-indigo-50 transition-all whitespace-nowrap"
                                                        >
                                                            {showFullVin ? 'Hide Full VIN' : 'Show Full VIN'}
                                                        </button>
                                                    </span>
                                                </div>
                                            )}
                                            {checkData.engineNumber && (
                                                <div className="flex justify-between py-1.5 text-sm">
                                                    <span className="text-slate-400">Engine number:</span>
                                                    <span className="font-semibold text-slate-800">{checkData.engineNumber}</span>
                                                </div>
                                            )}
                                            {(() => {
                                                const v5cDate = checkData.check?.v5cs?.[0]?.issuedDate || checkData.history?.v5cs?.[0]?.issuedDate;
                                                return v5cDate ? (
                                                    <div className="flex justify-between py-1.5 text-sm">
                                                        <span className="text-slate-400">V5C log book date:</span>
                                                        <span className="font-semibold text-slate-800">{fmtDate(v5cDate)}</span>
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    </div>

                                    {/* Vehicle Tax */}
                                    {(() => {
                                        const tx = checkData.dvlaTax;
                                        const atV = checkData.check?.dvlaVehicle;
                                        const taxStatus = tx?.taxStatus ?? null;
                                        const taxDueDate = tx?.taxDueDate ? fmtDate(tx.taxDueDate) : null;
                                        const engCap = tx?.engineCapacity ? `${tx.engineCapacity} cc` : atV?.engineCapacityCC ? `${atV.engineCapacityCC} cc` : null;
                                        const co2 = tx?.co2Emissions ? `${tx.co2Emissions} g/km` : atV?.co2EmissionsGKM ? `${atV.co2EmissionsGKM} g/km` : null;
                                        const firstReg = tx?.firstUsedDate ? fmtMonthYear(tx.firstUsedDate) : null;
                                        const hasAny = taxStatus || taxDueDate || engCap || co2 || firstReg;
                                        if (!hasAny) return null;
                                        const otherRows = [
                                            { label: 'Tax Due Date', value: taxDueDate, color: 'text-indigo-600' },
                                            { label: 'Engine Capacity', value: engCap, color: 'text-slate-800' },
                                            { label: 'CO2 Emissions', value: co2, color: 'text-slate-800' },
                                            { label: 'First Registered', value: firstReg, color: 'text-slate-800' },
                                        ].filter(r => r.value);
                                        return (
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Vehicle Tax</h3>
                                                <div className="space-y-0 divide-y divide-slate-50">
                                                    {taxStatus && (
                                                        <div className="flex justify-between py-2 text-sm items-center">
                                                            <span className="text-slate-400">Tax Status:</span>
                                                            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${taxStatus === 'Taxed' ? 'bg-emerald-500 text-white' : taxStatus === 'SORN' ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>{taxStatus}</span>
                                                        </div>
                                                    )}
                                                    {otherRows.map(row => (
                                                        <div key={row.label} className="flex justify-between py-2 text-sm">
                                                            <span className="text-slate-400">{row.label}:</span>
                                                            <span className={`font-semibold ${row.color}`}>{row.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-3 flex justify-end">
                                                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white font-semibold text-xs hover:bg-slate-700 transition-all">
                                                        Calculate Tax Cost
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Previous Owners */}
                                    {(() => {
                                        const src = checkData.check ?? checkData.history;
                                        const owners = src?.previousOwners;
                                        const changes = src?.keeperChanges ?? [];
                                        if (!owners && changes.length === 0) return null;
                                        return (
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
                                                    {owners != null ? `${owners} Previous Owner${owners !== 1 ? 's' : ''}` : 'Keeper Changes'}
                                                </h3>
                                                <div className="space-y-0 divide-y divide-slate-50">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase py-1.5 tracking-widest">Keeper Changes</div>
                                                    {changes.map((c, i, arr) => {
                                                        const num = arr.length - i;
                                                        const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
                                                        return (
                                                            <div key={i} className="flex justify-between py-2 text-sm">
                                                                <span className="text-slate-400">{num}{suffix} Change:</span>
                                                                <span className="font-semibold text-slate-800">{fmtDate(c.dateOfLastKeeper)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {vehicle.registeredDate && (
                                                        <div className="flex justify-between py-2 text-sm">
                                                            <span className="text-slate-400">First Registered:</span>
                                                            <span className="font-semibold text-indigo-600">{fmtMonthYear(vehicle.registeredDate)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Timestamp */}
                                    {checkData.fetchedAt && (
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Report Timestamp</h3>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Data timestamp:</span>
                                                <span className="font-semibold text-slate-800">
                                                    {new Date(checkData.fetchedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Finance Agreements Table */}
                        {checkData?.check?.financeAgreements && checkData.check.financeAgreements.length > 0 && (
                            <div className="p-6 border-t border-slate-100">
                                <h3 className="text-sm font-bold text-slate-800 tracking-wide mb-4">Finance Agreement</h3>
                                <div className="border border-slate-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Agreement</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Company</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Telephone</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Type</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Start Date</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wide">Term</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {checkData.check.financeAgreements.map((agreement, i) => (
                                                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-semibold text-slate-800">{agreement.agreementNumber}</td>
                                                    <td className="px-4 py-3 text-slate-600">{agreement.company}</td>
                                                    <td className="px-4 py-3 text-slate-600">{agreement.telephone}</td>
                                                    <td className="px-4 py-3 text-slate-600 uppercase">{agreement.type}</td>
                                                    <td className="px-4 py-3 text-slate-600">{agreement.startDate}</td>
                                                    <td className="px-4 py-3 text-slate-600">{agreement.term}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* MOT History */}
                    <section id="mot" className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden mb-6">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50">
                            <div className="flex items-center gap-3">
                                <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">MOT History</h2>
                                {checkData?.dvlaTax && (
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider text-white ${checkData.dvlaTax.motStatus === 'Valid' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                        {checkData.dvlaTax.motStatus}
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700 font-medium" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>[Back to Top]</span>
                        </div>
                        {!checkData ? (
                            <div className="p-6 flex items-center gap-3 text-slate-400">
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                <span className="text-sm">Loading MOT history...</span>
                            </div>
                        ) : !checkData.motTests?.length ? (
                            <div className="p-6 text-sm text-slate-400">No MOT history available.</div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide w-32">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide w-24">Result</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {checkData.motTests.map((test, i) => {
                                        const passed = test.testResult === 'Passed' || test.testResult === 'PASSED';
                                        const date = test.completedDate ? new Date(test.completedDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : test.completedDate;
                                        // mileage diff from next test
                                        const prevMileage = checkData.motTests![i + 1]?.odometerValue;
                                        const mileageDiff = test.odometerValue != null && prevMileage != null ? test.odometerValue - prevMileage : null;

                                        const dangerous = test.rfrAndComments?.filter(c => c.dangerous || ['FAIL', 'Fail', 'MAJOR', 'Major', 'DANGEROUS', 'Dangerous'].includes(c.type)) ?? [];
                                        const advisory = test.rfrAndComments?.filter(c => !c.dangerous && ['Advisory', 'ADVISORY', 'MINOR', 'Minor', 'User Entered', 'USER_ENTERED', 'PRS'].includes(c.type)) ?? [];

                                        return (
                                            <tr key={i} className="align-top">
                                                <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{date}</td>
                                                <td className="px-4 py-4">
                                                    <span className={`inline-block px-3 py-1 rounded-md text-xs font-bold text-white ${passed ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                                        {passed ? 'Passed' : 'Failed'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-700">
                                                    {test.odometerValue != null && (
                                                        <p className="font-semibold mb-1">
                                                            Mileage: {test.odometerValue.toLocaleString()} miles
                                                            {mileageDiff != null && mileageDiff > 0 && (
                                                                <span className="text-slate-400 font-normal"> (+{mileageDiff.toLocaleString()} miles)</span>
                                                            )}
                                                        </p>
                                                    )}
                                                    {dangerous.length > 0 && (
                                                        <div className="mt-1">
                                                            <p className="text-xs font-bold text-slate-700 mb-1">Dangerous Notices</p>
                                                            <ul className="list-disc list-inside space-y-0.5">
                                                                {dangerous.map((d, j) => <li key={j} className="text-xs text-slate-600">{d.text}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {advisory.length > 0 && (
                                                        <div className="mt-1">
                                                            <p className="text-xs font-bold text-slate-700 mb-1">Advisory Notices</p>
                                                            <ul className="list-disc list-inside space-y-0.5">
                                                                {advisory.map((d, j) => <li key={j} className="text-xs text-slate-600">{d.text}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </section>

                    {/* Standard Features */}
                    <section id="features" className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden mb-6">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50">
                            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Standard Features</h2>
                            <span className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700 font-medium" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>[Back to Top]</span>
                        </div>
                        <div className="p-6">
                            {featuresLoading ? (
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                    Loading features...
                                </div>
                            ) : stdFeatures.length > 0 ? (
                                (() => {
                                    const catMap: Record<string, string[]> = {};
                                    stdFeatures.forEach(f => {
                                        const cat = f.category || 'General';
                                        if (!catMap[cat]) catMap[cat] = [];
                                        catMap[cat].push(f.name);
                                    });
                                    return (
                                        <div className="space-y-4">
                                            {Object.entries(catMap).map(([cat, items]) => (
                                                <div key={cat}>
                                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">{cat}</div>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                        {items.map((feat, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-sm text-slate-700 py-1">
                                                                <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center bg-indigo-600 border border-indigo-600">
                                                                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                                                                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                                    </svg>
                                                                </div>
                                                                {feat}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()
                            ) : (
                                <p className="text-sm text-slate-400">No standard features data available.</p>
                            )}
                        </div>
                    </section>

                    {/* Optional Extras */}
                    <section id="extras" className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden mb-6">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50">
                            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Optional Extras</h2>
                            <span className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700 font-medium" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>[Back to Top]</span>
                        </div>
                        <div className="p-6">
                            {featuresLoading ? (
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                    Loading extras...
                                </div>
                            ) : optExtras.length > 0 ? (
                                (() => {
                                    const catMap: Record<string, typeof optExtras> = {};
                                    optExtras.forEach(f => {
                                        const cat = f.category || 'General';
                                        if (!catMap[cat]) catMap[cat] = [];
                                        catMap[cat].push(f);
                                    });
                                    const totalSelected = optExtras
                                        .filter(e => selectedExtras.has(e.name))
                                        .reduce((sum, e) => sum + (e.price ?? 0), 0);
                                    return (
                                        <div className="space-y-4">
                                            {Object.entries(catMap).map(([cat, items]) => (
                                                <div key={cat}>
                                                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cat}</span>
                                                        <div className="flex gap-2 text-xs text-indigo-500 font-medium">
                                                            <button onClick={() => setSelectedExtras(prev => { const n = new Set(prev); items.forEach(i => n.add(i.name)); return n; })}>Select All</button>
                                                            <span className="text-slate-300">/</span>
                                                            <button onClick={() => setSelectedExtras(prev => { const n = new Set(prev); items.forEach(i => n.delete(i.name)); return n; })}>None</button>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                                                        {items.map((extra, i) => (
                                                            <label key={i} className="flex items-center justify-between py-1.5 cursor-pointer group">
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedExtras.has(extra.name)}
                                                                        onChange={e => {
                                                                            setSelectedExtras(prev => {
                                                                                const n = new Set(prev);
                                                                                e.target.checked ? n.add(extra.name) : n.delete(extra.name);
                                                                                return n;
                                                                            });
                                                                        }}
                                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 flex-shrink-0 cursor-pointer accent-indigo-600"
                                                                    />
                                                                    <span className="text-[13px] text-slate-700 group-hover:text-slate-900 truncate">{extra.name}</span>
                                                                </div>
                                                                {extra.price != null && (
                                                                    <span className="text-[13px] text-slate-500 ml-2 shrink-0">£{extra.price.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                                                                )}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {/* Total */}
                                            <div className="flex justify-end pt-3 border-t border-slate-100">
                                                <span className="text-sm text-slate-600">
                                                    Total Cost of Selected Options: <strong className="text-slate-900">£{totalSelected.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong>
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                                <p className="text-sm text-slate-400">No optional extras data available.</p>
                            )}
                        </div>
                    </section>

                    {/* Specification */}
                    <section id="spec" className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden mb-6">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50">
                            <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">Technical Specification</h2>
                            <span className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700 font-medium" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>[Back to Top]</span>
                        </div>
                        <div className="space-y-0">
                            {(() => {
                                const raw = derivativeData?.techSpecs || derivativeData || vehicle.rawResponse || {};
                                
                                // Groupings matching Motordesk style
                                const performanceSpecs = [
                                    { label: 'Top Speed', value: raw.topSpeedMPH != null ? `${raw.topSpeedMPH} mph` : undefined },
                                    { label: '0-62 mph', value: raw.zeroToOneHundredKMPHSeconds != null ? `${raw.zeroToOneHundredKMPHSeconds} Seconds` : (raw.zeroToSixtyMPHSeconds != null ? `${raw.zeroToSixtyMPHSeconds} Seconds` : undefined) },
                                ].filter(s => s.value != null);

                                const engineSpecs = [
                                    { label: 'Manufacturer', value: vehicle.make },
                                    { label: 'Cylinders', value: raw.cylinders },
                                    { label: 'Arrangement', value: raw.cylinderArrangement || (raw.cylinders ? 'Inline' : undefined) },
                                    { label: 'Valves', value: raw.valves },
                                    { label: 'Engine Capacity', value: raw.engineCapacityCC != null ? `${raw.engineCapacityCC} cc` : (vehicle.engineSize ? `${vehicle.engineSize} cc` : undefined) },
                                    { label: 'Engine Power', value: raw.enginePowerBHP != null ? `${raw.enginePowerBHP} bhp / ${raw.enginePowerPS || Math.round(raw.enginePowerBHP * 1.01387)} ps` : undefined },
                                    { label: 'Engine Torque', value: raw.engineTorqueNM != null ? `${raw.engineTorqueNM} Nm / ${raw.engineTorqueLBFT || (raw.engineTorqueNM * 0.73756).toFixed(1)} lbs/ft` : undefined },
                                    { label: 'Gears', value: raw.gears },
                                    { label: 'Bore', value: raw.boreMM },
                                    { label: 'Stroke', value: raw.strokeMM },
                                    { label: 'Fuel Delivery', value: raw.fuelDelivery },
                                    { label: 'Start/Stop', value: raw.startStop === true ? 'Yes' : raw.startStop === false ? 'No' : undefined },
                                    { label: 'Drive Type', value: raw.driveType || raw.drivetrain || vehicle.drivetrain },
                                ].filter(s => s.value != null);

                                const sizeWeightSpecs = [
                                    { label: 'Length', value: raw.lengthMM != null ? `${raw.lengthMM.toLocaleString()} mm` : undefined },
                                    { label: 'Height', value: raw.heightMM != null ? `${raw.heightMM.toLocaleString()} mm` : undefined },
                                    { label: 'Width', value: raw.widthMM != null ? `${raw.widthMM.toLocaleString()} mm` : undefined },
                                    { label: 'Wheelbase', value: raw.wheelbaseMM != null ? `${raw.wheelbaseMM.toLocaleString()} mm` : vehicle.wheelbase || undefined },
                                    { label: 'Load Weight', value: raw.payloadWeightKG != null ? `${raw.payloadWeightKG.toLocaleString()} kg` : undefined },
                                    { label: 'Kerb Weight', value: raw.minimumKerbWeightKG != null ? `${raw.minimumKerbWeightKG.toLocaleString()} kg` : undefined },
                                    { label: 'Gross Weight', value: raw.grossVehicleWeightKG != null ? `${raw.grossVehicleWeightKG.toLocaleString()} kg` : undefined },
                                    { label: 'Boot Space, Seats Down', value: raw.bootSpaceSeatsDownLitres != null ? `${raw.bootSpaceSeatsDownLitres.toLocaleString()} litres` : undefined },
                                    { label: 'Boot Space, Seats Up', value: raw.bootSpaceSeatsUpLitres != null ? `${raw.bootSpaceSeatsUpLitres.toLocaleString()} litres` : undefined },
                                ].filter(s => s.value != null);

                                const fuelSpecs = [
                                    { label: 'Fuel Capacity', value: raw.fuelCapacityLitres != null ? `${raw.fuelCapacityLitres} litres` : undefined },
                                    { label: 'Emission Class', value: raw.emissionClass },
                                    { label: 'CO₂ Emissions', value: raw.co2EmissionGPKM != null ? `${raw.co2EmissionGPKM} g/km` : (vehicle.co2 ? `${vehicle.co2} g/km` : undefined) },
                                    { label: 'Fuel Consumption, Combined', value: raw.fuelEconomyNEDCCombinedMPG != null ? `${raw.fuelEconomyNEDCCombinedMPG} mpg` : undefined },
                                    { label: 'WLTP Fuel Consumption, Low', value: raw.fuelEconomyWLTPLowMPG != null ? `${raw.fuelEconomyWLTPLowMPG} mpg` : undefined },
                                    { label: 'WLTP Fuel Consumption, Medium', value: raw.fuelEconomyWLTPMediumMPG != null ? `${raw.fuelEconomyWLTPMediumMPG} mpg` : undefined },
                                    { label: 'WLTP Fuel Consumption, High', value: raw.fuelEconomyWLTPHighMPG != null ? `${raw.fuelEconomyWLTPHighMPG} mpg` : undefined },
                                    { label: 'WLTP Fuel Consumption, Extra High', value: raw.fuelEconomyWLTPExtraHighMPG != null ? `${raw.fuelEconomyWLTPExtraHighMPG} mpg` : undefined },
                                    { label: 'WLTP Fuel Consumption, Combined', value: raw.fuelEconomyWLTPCombinedMPG != null ? `${raw.fuelEconomyWLTPCombinedMPG} mpg` : undefined },
                                ].filter(s => s.value != null);

                                const renderGrid = (items: {label: string, value: any}[]) => {
                                    if (!items.length) return null;
                                    const half = Math.ceil(items.length / 2);
                                    const leftItems = items.slice(0, half);
                                    const rightItems = items.slice(half);

                                    return (
                                        <div className="flex flex-col md:flex-row pb-2">
                                            <div className="flex-1 border-r border-slate-50/50">
                                                {leftItems.map(item => (
                                                    <div key={item.label} className="flex items-center px-6 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors">
                                                        <span className="text-[13px] text-slate-400 text-right w-40 pr-6 flex-shrink-0">{item.label}:</span>
                                                        <span className="text-[13px] font-medium text-slate-800 flex-1 capitalize">{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex-1">
                                                {rightItems.map(item => (
                                                    <div key={item.label} className="flex items-center px-6 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors">
                                                        <span className="text-[13px] text-slate-400 text-right w-40 pr-6 flex-shrink-0">{item.label}:</span>
                                                        <span className="text-[13px] font-medium text-slate-800 flex-1 capitalize">{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <div className="pb-4">
                                        {performanceSpecs.length > 0 && (
                                            <div>
                                                <h3 className="text-[13px] font-bold text-slate-700 px-6 mt-6 mb-2">Performance</h3>
                                                {renderGrid(performanceSpecs)}
                                            </div>
                                        )}
                                        {engineSpecs.length > 0 && (
                                            <div>
                                                <h3 className="text-[13px] font-bold text-slate-700 px-6 mt-6 mb-2">Engine</h3>
                                                {renderGrid(engineSpecs)}
                                            </div>
                                        )}
                                        {sizeWeightSpecs.length > 0 && (
                                            <div>
                                                <h3 className="text-[13px] font-bold text-slate-700 px-6 mt-6 mb-2">Size & Weight</h3>
                                                {renderGrid(sizeWeightSpecs)}
                                            </div>
                                        )}
                                        {fuelSpecs.length > 0 && (
                                            <div>
                                                <h3 className="text-[13px] font-bold text-slate-700 px-6 mt-6 mb-2">Fuel Consumption</h3>
                                                {renderGrid(fuelSpecs)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
}