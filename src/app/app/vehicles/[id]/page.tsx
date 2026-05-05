'use client';

import { useState, useEffect, use, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import { advertDescriptionToPlainText, pickSilentSalesmanTextareaDefault, getAvailableHighlightLabels } from '@/lib/silent-salesman/vehicle-fields';
import ConditionReportTab from '@/components/vehicles/condition-report/ConditionReportTab';
import { VehicleJobsTab } from '@/components/jobs/VehicleJobsTab';
import { VehicleChecklistTab } from '@/components/checklists/VehicleChecklistTab';
import { SpecificationTab } from '@/components/vehicles/SpecificationTab';
import { VehicleSettingsTab } from '@/components/vehicles/VehicleSettingsTab';
import { VehicleDocumentsTab } from '@/components/vehicles/VehicleDocumentsTab';
import { VehicleAppointmentsTab } from '@/components/vehicles/VehicleAppointmentsTab';
import { VehicleTestDriveTab } from '@/components/vehicles/VehicleTestDriveTab';
import { VehicleLeadsDealsTab } from '@/components/vehicles/VehicleLeadsDealsTab';
import { VehicleReserveTab } from '@/components/vehicles/VehicleReserveTab';
import { VehicleSellTab } from '@/components/vehicles/VehicleSellTab';

import { textValue } from '@/lib/textValue';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface VehicleDetail {
    id: string;
    _id?: string;
    vrm: string;
    vin?: string;
    make: string;
    model: string;
    derivative: string;
    year: string | number;
    mileage: number;
    price: number;
    status: string;
    images: string[];
    imageIds?: string[];
    youtubeVideoIds?: string[];
    fuelType: string;
    transmission: string;
    colour: string;
    engineSize: string;
    bodyType: string;
    features: string[];
    description?: string;
    description2?: string;
    attentionGrabber?: string;
    longAttentionGrabber?: string;
    customFeatures?: string[];
    // Expanded detail fields
    vehicleType?: string;
    generation?: string;
    trim?: string;
    seats?: number;
    doors?: number;
    driverPosition?: string;
    drivetrain?: string;
    colourName?: string;
    exteriorFinish?: string;
    interiorUpholstery?: string;
    purchasePrice?: number;
    retailPrice?: number;
    keyTags?: string;
    serviceHistory?: string;
    previousOwners?: number;
    // History tab fields
    numberOfKeys?: number;
    v5Present?: boolean;
    condition?: string;          // 'Used' | 'New'
    interiorCondition?: string;
    exteriorCondition?: string;
    tyreCondition?: string;
    dateOfNextService?: string;
    dateOfLastService?: string;
    mileageAtLastService?: number;
    serviceNotes?: string;
    manufacturerWarrantyMonths?: number;
    manufacturerWarrantyExpiry?: string;
    batteryWarrantyMonths?: number;
    batteryWarrantyExpiry?: string;
    extendedWarrantyMonths?: number;
    motExpiry?: string;
    includes12MonthsMot?: boolean;
    includesMotInsurance?: boolean;
    tags?: string[];

    stockId?: string;
    source?: string;
    atAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
    advertiserAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
    locatorAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
    exportAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
    profileAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
    createdAt?: string;
    updatedAt?: string;
    responseMetrics?: {
        performanceRating?: { score: number | null; rating: string | null };
        advertViewRating?: { rating: string | null };
        searchViewRating?: { rating: string | null };
        leadCountRating?: { rating: string | null };
        yesterday?: { advertViews: number | null; searchViews: number | null };
        lastWeek?: { advertViews: number | null; searchViews: number | null };
    };
    imageMetadata?: Record<string, { group?: string; banner?: string; bannerColor?: string; branding?: boolean; watermark?: boolean }>;
    history?: { scrapped: boolean; stolen: boolean; imported: boolean; exported: boolean; previousOwners: number };
    check?: { insuranceWriteoffCategory: string | null; privateFinance: boolean | null; tradeFinance: boolean | null; highRisk: boolean | null; mileageDiscrepancy: boolean | null; colourChanged: boolean | null };
    priceOnApplication?: boolean;
    atPriceOnApplication?: boolean;
    purchaseDate?: string;
    supplierName?: string;
    supplierInvoiceNo?: string;
    vatType?: string;
    purchaseVatAmount?: number;
    fundingProvider?: string;
    fundingAmount?: number;
    vehicleAdditionalCosts?: any[];
    referenceId?: string;
    engineNumber?: string;
    newKeeperReference?: string;
    keyReference?: string;
    dueInDate?: string;
    dateOnForecourt?: string;
    location?: string;
    origin?: string;
    saleOrReturn?: boolean;
    demonstrator?: boolean;
    trade?: boolean;
    stockNotes?: string;
    vatStatus?: string;
    reservePaymentAmount?: number;
    quantityAvailable?: number;
    dateInStock?: string;
    workflowStages?: Record<string, { completed: boolean; date?: string; notes?: string }>;
    technicalSpecs?: Record<string, any>;
    manualSpecs?: Record<string, any>;
}

interface Deal {
    dealId: string;
    created: string;
    lastUpdated: string;
    advertiserDealStatus: string;
    consumerDealStatus: string;
    consumer: { firstName: string; lastName: string; email: string; phone: string; type: string };
    buyingSignals?: { dealIntentScore: number; intent: string };
    messages?: { id: string; lastUpdated: string } | null;
}

interface LookupResult {
    make: string; vehicleModel: string; derivative: string; vrm: string; year: string | number;
    fuelType: string; transmission: string; bodyType: string; colour: string; doors: number; seats: number;
    co2: number | null; features: string[]; derivativeId: string;
    rawResponse: any;
}

/* ─── Constants ────────────────────────────────────────────────────────────── */
const LIFECYCLE_OPTIONS = [
    { value: 'In Stock', label: 'In Stock', color: 'bg-blue-100 text-blue-700' },
    { value: 'Due In', label: 'Due In', color: 'bg-amber-100 text-amber-700' },
    { value: 'Sale In Progress', label: 'Sale In Progress', color: 'bg-purple-100 text-purple-700' },
    { value: 'Sold', label: 'Sold', color: 'bg-green-100 text-green-700' },
    { value: 'Wastebin', label: 'Wastebin', color: 'bg-orange-100 text-orange-700' },
    { value: 'Deleted', label: 'Deleted', color: 'bg-red-100 text-red-700' },
];

const FUEL_TYPES = [
    'Petrol', 'Diesel', 'Electric',
    'Petrol Hybrid', 'Diesel Hybrid',
    'Petrol Plug-in Hybrid', 'Diesel Plug-in Hybrid',
    'Petrol Mild Hybrid', 'Diesel Mild Hybrid',
    'Hybrid', 'Plug-in Hybrid', 'Mild Hybrid',
    'Hydrogen',
];
const TRANSMISSIONS = ['Automatic', 'Manual'];
const BODY_TYPES = ['Saloon', 'Hatchback', 'Estate', 'SUV', 'Coupe', 'Convertible', 'Van', 'Pickup', 'MPV', 'Crossover'];
const VEHICLE_TYPES = ['Car', 'Van', 'Motorbike', 'Motorhome'];
const COLOURS = ['Black', 'White', 'Silver', 'Grey', 'Blue', 'Red', 'Green', 'Brown', 'Beige', 'Orange', 'Yellow', 'Gold', 'Purple', 'Bronze', 'Burgundy', 'Copper', 'Maroon', 'Navy', 'Turquoise'];
const EXTERIOR_FINISHES = ['Metallic', 'Solid', 'Pearl', 'Matte', 'Satin'];
const INTERIOR_UPHOLSTERIES = ['Leather', 'Cloth', 'Alcantara', 'Suede', 'Vinyl', 'Half Leather', 'Leatherette'];

/* ─── Sidebar Tab Groups ──────────────────────────────────────────────────── */
const TAB_GROUPS = [
    {
        tabs: [
            { id: 'overview',   label: 'Overview',       icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="1.8"/></svg> },
            { id: 'vehicle',    label: 'Vehicle',         icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 13l1.5-5h11L19 13M5 13H3v3h1m15-3h2v3h-1M5 13h14M7 16v1m10-1v1"/><circle cx="7.5" cy="17.5" r="1.5" strokeWidth="1.8"/><circle cx="16.5" cy="17.5" r="1.5" strokeWidth="1.8"/></svg> },
            { id: 'images',     label: 'Images & Videos', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1.8"/><circle cx="8.5" cy="10.5" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 15l-5-5L7 19"/></svg> },
            { id: 'options',    label: 'Options',         icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 6h16M4 12h16M4 18h10"/></svg> },
            { id: 'history',      label: 'History',          icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
            { id: 'purchaseCosts', label: 'Purchase & Costs', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
            { id: 'stockPrice',    label: 'Stock & Price',    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg> },
            { id: 'salesChannels', label: 'Sales Channels',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/></svg> },
        ],
    },
    {
        tabs: [
            { id: 'competitors',    label: 'Competitors',     icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
            { id: 'vehicleCheck',   label: 'Vehicle Check',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> },
            { id: 'silentSalesman', label: 'Silent Salesman',  icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg> },
            { id: 'conditionReport',label: 'Condition Report', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> },
        ],
    },
    {
        tabs: [
            { id: 'jobBoards',   label: 'Job Boards',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
            { id: 'workflow',    label: 'Workflow',     icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg> },
            { id: 'checklist',   label: 'Checklist',    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg> },
            { id: 'specification',label: 'Specification', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg> },
            { id: 'settings',    label: 'Settings',     icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
            { id: 'documents',   label: 'Documents',    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> },
        ],
    },
    {
        tabs: [
            { id: 'appointments',   label: 'Appointments',    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 2v4M8 2v4M3 10h18"/></svg> },
            { id: 'testDrive',      label: 'Test Drive',      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg> },
            { id: 'leadsDeals',     label: 'Leads & Deals',   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
            { id: 'reserveVehicle', label: 'Reserve Vehicle',  icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> },
            { id: 'sellVehicle',    label: 'Sell Vehicle',    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
        ],
    },
];

// Flat list for tab switching logic (keep backward compat)
const TABS = TAB_GROUPS.flatMap(g => g.tabs);

/* ─── VIN Row helper ─────────────────────────────────────────────────────────── */
function VinRow({ atVehicle }: { atVehicle: any }) {
    const [showFull, setShowFull] = useState(false);
    const vin: string = atVehicle?.vin || '';
    if (!vin) return null;
    const display = showFull ? vin : `****${vin.slice(-4)}`;
    return (
        <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
            <span className="text-[11px] font-semibold text-slate-500">VIN ends with</span>
            <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-slate-700 font-mono">{display}</span>
                <button onClick={() => setShowFull(p => !p)} className="text-[10px] font-bold text-[#4D7CFF] border border-[#4D7CFF] rounded px-1.5 py-0.5 hover:bg-blue-50 transition-colors">
                    {showFull ? 'Hide VIN' : 'Show Full VIN'}
                </button>
            </div>
        </div>
    );
}

/* ─── Derivative Smart Selector Component ───────────────────────────────────── */
function DerivativeSelector({
    currentDerivative, make, model, generation, generationId, fuelType, engineSize,
    onChange, onAutoComplete
}: {
    currentDerivative: string;
    make?: string; model?: string; generation?: string; generationId?: string;
    fuelType?: string; engineSize?: string;
    onChange: (label: string) => void;
    onAutoComplete: (fields: Record<string, any>) => void;
}) {
    const [query, setQuery] = useState(currentDerivative || '');
    const [options, setOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<any | null>(null);
    const [autoFilling, setAutoFilling] = useState(false);

    useEffect(() => { setQuery(currentDerivative || ''); }, [currentDerivative]);

    const search = async () => {
        if (!make && !model && !generationId) return;
        setLoading(true);
        setOpen(true);
        try {
            const params = new URLSearchParams();
            // Prefer generationId (already resolved) — skips the full taxonomy chain on AT side
            if (generationId) {
                params.set('generationId', generationId);
            } else {
                if (make) params.set('make', make);
                if (model) params.set('model', model);
                if (generation) params.set('generation', generation);
            }
            // AT-supported derivative filters per docs: fuelType, transmission, trim
            if (fuelType) params.set('fuelType', fuelType);
            const res = await fetch(`/api/vehicles/derivatives?${params.toString()}`);
            const data = await res.json();
            setOptions(data.derivatives || []);
        } catch (e) {
            setOptions([]);
        } finally {
            setLoading(false);
        }
    };

    const selectDerivative = (opt: any) => {
        setSelected(opt);
        setQuery(opt.label);
        onChange(opt.label);
        setOpen(false);
    };

    const autoComplete = async () => {
        if (!selected?.id) return;
        setAutoFilling(true);
        try {
            const res = await fetch(`/api/vehicles/derivatives?id=${selected.id}`);
            const data = await res.json();
            const d = data.derivative || selected;
            
            // Helper to extract primitive from AT {name: "..."} taxonomy objects
            const strVal = (x: any) => {
                if (!x) return undefined;
                if (typeof x === 'string') return x;
                if (typeof x === 'object' && x.name !== undefined) return String(x.name);
                return String(x);
            };

            onAutoComplete({
                make: strVal(d.make) || make,
                model: strVal(d.model) || model,
                generation: strVal(d.generation) || generation,
                trim: strVal(d.trim) || undefined,
                fuelType: strVal(d.fuelType) || fuelType,
                engineSize: d.badgeEngineSizeLitres?.toString() || strVal(d.engineSize) || engineSize,
                transmission: strVal(d.transmissionType) || strVal(d.transmission),
                bodyType: strVal(d.bodyType),
                seats: typeof d.seats === 'object' ? Number(d.seats?.name) || undefined : d.seats,
                doors: typeof d.doors === 'object' ? Number(d.doors?.name) || undefined : d.doors,
                drivetrain: strVal(d.drivetrain),
                colour: strVal(d.colour),
                derivative: strVal(d.name) || strVal(d.label) || query,
            });
        } catch (e) {
            // fallback: use already-fetched data
            const strValFallback = (x: any) => (x && typeof x === 'object' && x.name ? x.name : x);
            onAutoComplete({
                fuelType: strValFallback(selected.fuelType) || fuelType,
                engineSize: strValFallback(selected.engineSize) || engineSize,
                transmission: strValFallback(selected.transmission),
                bodyType: strValFallback(selected.bodyType),
                seats: typeof selected.seats === 'object' ? Number(selected.seats?.name) || undefined : selected.seats,
                doors: typeof selected.doors === 'object' ? Number(selected.doors?.name) || undefined : selected.doors,
                drivetrain: strValFallback(selected.drivetrain),
                derivative: strValFallback(selected.label) || query,
            });
        } finally {
            setAutoFilling(false);
        }
    };

    // Filter options by query for keyboard-type search
    const filtered = options.filter(o =>
        !query || o.label.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className="p-6 bg-white rounded-lg border border-[#E2E8F0] shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Derivative</label>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={search}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#4D7CFF] text-white rounded text-[11px] font-bold hover:bg-blue-600 transition-colors"
                        title="Search derivatives from AutoTrader based on Make/Model/Fuel/Engine"
                    >
                        {loading ? (
                            <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                            <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2.5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-4.35-4.35" /></svg>
                        )}
                        Search Derivatives
                    </button>
                    {selected && (
                        <button
                            type="button"
                            onClick={autoComplete}
                            disabled={autoFilling}
                            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 text-white rounded text-[11px] font-bold hover:bg-emerald-600 transition-colors disabled:opacity-60"
                            title="Auto-fill all vehicle fields from this derivative"
                        >
                            {autoFilling ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : '✦'}
                            Auto-Complete All
                        </button>
                    )}
                </div>
            </div>

            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={e => { setQuery(e.target.value); onChange(e.target.value); }}
                    onFocus={() => options.length > 0 && setOpen(true)}
                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF] transition-colors shadow-sm"
                    placeholder="e.g. 2.0 TFSI 35 Black Edition Estate 5dr — or click Search Derivatives"
                />

                {open && (
                    <div className="absolute top-full left-0 right-0 z-40 bg-white border border-[#E2E8F0] rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                        {loading ? (
                            <div className="px-4 py-3 text-[12px] text-slate-400 text-center">Searching AutoTrader...</div>
                        ) : filtered.length === 0 ? (
                            <div className="px-4 py-3 text-[12px] text-slate-400 text-center">
                                No derivatives found — try adjusting Make/Model/Fuel fields above, then click Search Derivatives
                            </div>
                        ) : (
                            <>
                                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">{filtered.length} derivative{filtered.length !== 1 ? 's' : ''} found</div>
                                {filtered.map((opt, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => selectDerivative(opt)}
                                        className={`w-full text-left px-4 py-2.5 text-[12px] text-slate-700 hover:bg-blue-50 hover:text-[#4D7CFF] transition-colors border-b border-slate-50 ${selected?.id === opt.id ? 'bg-blue-50 text-[#4D7CFF] font-bold' : ''}`}
                                    >
                                        <div className="font-semibold">{opt.label}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            {[opt.fuelType, opt.transmission, opt.bodyType, opt.engineSize && `${opt.engineSize}cc`].filter(Boolean).join(' · ')}
                                        </div>
                                    </button>
                                ))}
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-full px-4 py-2 text-[11px] text-slate-400 hover:text-slate-600 text-center border-t border-slate-100"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>

            {!make && !model && (
                <p className="mt-1.5 text-[11px] text-amber-600">⚠ Enter Manufacturer and Model first, then click Search Derivatives</p>
            )}
            {selected && (
                <p className="mt-1.5 text-[11px] text-emerald-600 font-semibold">✓ Derivative selected — click Auto-Complete All to fill in remaining fields</p>
            )}
        </div>
    );
}


/* ─── Competitors Tab Component ─────────────────────────────────────────────── */
const COMP_FUEL_OPTIONS = ['', 'Petrol', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'Mild Hybrid'];
const COMP_TRANS_OPTIONS = ['', 'Automatic', 'Manual'];
const COMP_CONDITION_OPTIONS = ['', 'Used', 'New'];

function CompetitorScatterChart({
    data,
    currentVrm,
    xKey,
    yKey,
}: {
    data: any[];
    currentVrm: string;
    xKey: 'mileage' | 'year' | 'daysOnForecourt' | 'distance';
    yKey: 'price' | 'valuation';
}) {
    const W = 600; const H = 280;
    const PAD = { top: 20, right: 30, bottom: 40, left: 60 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top - PAD.bottom;

    const numeric = data.filter(d => d[xKey] != null && d[yKey] != null);
    if (numeric.length === 0) return (
        <div className="flex items-center justify-center h-[200px] text-[12px] font-semibold text-slate-300">
            Not enough data for chart
        </div>
    );

    const maxX = Math.max(...numeric.map(d => Number(d[xKey])));
    const minX = Math.min(...numeric.map(d => Number(d[xKey])));
    const maxY = Math.max(...numeric.map(d => Number(d[yKey])));
    const minY = Math.min(...numeric.map(d => Number(d[yKey])));

    const mx = (x: number) => PAD.left + ((x - minX) / Math.max(maxX - minX, 1)) * cw;
    const my = (y: number) => PAD.top + (1 - (y - minY) / Math.max(maxY - minY, 1)) * ch;

    const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
    const fmtP = (n: number) => `£${n.toLocaleString()}`;

    const yTicks = 5;
    const xTicks = 5;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[300px]" style={{ fontFamily: 'inherit' }}>
            {/* Y gridlines + labels */}
            {Array.from({ length: yTicks + 1 }, (_, i) => {
                const val = minY + (maxY - minY) * (i / yTicks);
                const y = my(val);
                return (
                    <g key={`y${i}`}>
                        <line x1={PAD.left} y1={y} x2={PAD.left + cw} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                        <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8" fontWeight="600">
                            {yKey === 'price' || yKey === 'valuation' ? fmtP(val) : fmt(val)}
                        </text>
                    </g>
                );
            })}
            {/* X gridlines + labels */}
            {Array.from({ length: xTicks + 1 }, (_, i) => {
                const val = minX + (maxX - minX) * (i / xTicks);
                const x = mx(val);
                return (
                    <g key={`x${i}`}>
                        <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + ch} stroke="#f1f5f9" strokeWidth="1" />
                        <text x={x} y={PAD.top + ch + 16} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">{fmt(val)}</text>
                    </g>
                );
            })}
            {/* Axis labels */}
            <text x={PAD.left + cw / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="700">
                {xKey === 'daysOnForecourt' ? 'Days on Forecourt' : xKey[0].toUpperCase() + xKey.slice(1)}
            </text>
            <text transform={`rotate(-90,12,${PAD.top + ch / 2})`} x="12" y={PAD.top + ch / 2 + 4} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="700">
                {yKey[0].toUpperCase() + yKey.slice(1)}
            </text>
            {/* Bubbles */}
            {numeric.map((d, i) => {
                const cx2 = mx(Number(d[xKey]));
                const cy2 = my(Number(d[yKey]));
                const isCurrent = String(d.registration || '').replace(/\s/g, '').toUpperCase() === currentVrm;
                return (
                    <g key={i}>
                        <circle cx={cx2} cy={cy2} r={isCurrent ? 14 : 11}
                            fill={isCurrent ? '#4D7CFF' : '#93c5fd'}
                            fillOpacity={isCurrent ? 0.9 : 0.7}
                            stroke={isCurrent ? '#2563eb' : '#60a5fa'}
                            strokeWidth={isCurrent ? 2 : 1}
                        />
                        <text x={cx2} y={cy2 + 3.5} textAnchor="middle" fontSize="7" fill={isCurrent ? '#fff' : '#1e40af'} fontWeight="700">
                            {d.registration.slice(-6)}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

function CompetitorsTab({ vehicle }: { vehicle: any }) {
    const [filters, setFilters] = useState(() => {
        const engineStr = (() => {
            if (vehicle?.badgeEngineSizeLitres) return Number(vehicle.badgeEngineSizeLitres).toFixed(1);
            const raw = String(vehicle?.engineSize || '').replace(/[^\d.]/g, '');
            const n = raw ? Number(raw) : NaN;
            if (!Number.isFinite(n)) return '';
            const litres = n > 100 ? Math.round((n / 1000) * 10) / 10 : n;
            return litres.toFixed(1);
        })();
        return {
            trim: String(vehicle?.trim || '').trim(),
            fuelType: String(vehicle?.fuelType || '').trim(),
            transmission: String(vehicle?.transmission || vehicle?.transmissionType || '').trim(),
            drivetrain: String(vehicle?.drivetrain || vehicle?.driveTrain || '').trim(),
            doors: vehicle?.doors != null ? String(vehicle.doors) : '',
            minEngineSize: engineStr,
            maxEngineSize: engineStr,
            minMileage: '', maxMileage: '',
            minYear: String(Math.max(2010, Number(vehicle?.year || 2015) - 2)),
            maxYear: String(Number(vehicle?.year || 2025) + 2),
            condition: '',
        };
    });
    const [results, setResults] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [isSampleData, setIsSampleData] = useState(false);
    const [searched, setSearched] = useState(false);
    const [sortCol, setSortCol] = useState<string>('price');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [tableSearch, setTableSearch] = useState('');
    const [chartYAxis, setChartYAxis] = useState<'price' | 'valuation'>('price');
    const [chartXAxis, setChartXAxis] = useState<'mileage' | 'year' | 'daysOnForecourt' | 'distance'>('mileage');
    const [preview, setPreview] = useState<{ url: string; x: number; y: number; locked: boolean } | null>(null);
    const [showCompHelp, setShowCompHelp] = useState(false);
    const [filterPool, setFilterPool] = useState<any[]>([]); // larger pool used only for dropdown options
    const FETCH_RESULTS_TARGET = 200; // MotorDesk-style: fetch more, paginate locally

    const selectOptions = useMemo(() => {
        const uniq = (vals: Array<string | undefined | null>) => {
            const out: string[] = [];
            for (const v of vals) {
                const s = String(v || '').trim();
                if (!s) continue;
                if (!out.includes(s)) out.push(s);
            }
            return out;
        };

        const uniqNum = (vals: Array<number | string | null | undefined>) => {
            const nums: number[] = [];
            for (const v of vals) {
                const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
                if (!Number.isFinite(n)) continue;
                nums.push(n);
            }
            return Array.from(new Set(nums)).sort((a, b) => a - b);
        };

        const vehicleTrim       = String(vehicle?.trim || '').trim();
        const vehicleFuel       = String(vehicle?.fuelType || '').trim();
        const vehicleTrans      = String(vehicle?.transmission || vehicle?.transmissionType || '').trim();
        const vehicleDrivetrain = String(vehicle?.drivetrain || vehicle?.driveTrain || '').trim();
        const vehicleDoors      = String(vehicle?.doors ?? '').trim();
        const vehicleCondition  = String(vehicle?.condition || '').trim();
        const vehicleYear       = Number(vehicle?.year || 0);
        const vehicleEngineSizeLitres = (() => {
            if (vehicle?.badgeEngineSizeLitres) return Number(vehicle.badgeEngineSizeLitres);
            const raw = String(vehicle?.engineSize || '').replace(/[^\d.]/g, '');
            const n = raw ? Number(raw) : NaN;
            if (!Number.isFinite(n)) return null;
            // engineSize stored as CC (e.g. "1998") — convert to litres
            return n > 100 ? Math.round((n / 1000) * 10) / 10 : n;
        })();

        // Use filterPool (full set) for options when available, otherwise fall back to displayed results
        const pool = filterPool.length > 0 ? filterPool : results;
        const fuelsFromResults   = uniq(pool.map(r => r?.fuelType));
        const transFromResults   = uniq(pool.map(r => r?.transmission));
        const drivesFromResults  = uniq(pool.map(r => r?.drivetrain));
        const condFromResults    = uniq(pool.map(r => r?.condition));
        const doorsFromResults   = uniq(pool.map(r => (r?.doors != null ? String(r.doors) : '')));
        const trimsFromResults   = uniq(pool.map(r => r?.trim));
        const yearsFromResults   = uniqNum(pool.map(r => r?.year));
        const engineSizesFromResults = uniqNum(pool.map(r => r?.engineSizeLitres));
        const mileageBuckets = (() => {
            const miles = uniqNum(pool.map(r => r?.mileage));
            const buckets = new Set<number>();
            for (const m of miles) buckets.add(Math.round(m / 5000) * 5000);
            return Array.from(buckets).sort((a, b) => a - b);
        })();

        const vehicleYearRange = vehicleYear > 1900 ? Array.from({ length: 11 }, (_, i) => vehicleYear - 5 + i) : [];
        const allYears   = Array.from(new Set([...vehicleYearRange, ...yearsFromResults])).sort((a, b) => a - b);
        const allEngines = Array.from(new Set([...(vehicleEngineSizeLitres ? [vehicleEngineSizeLitres] : []), ...engineSizesFromResults])).sort((a, b) => a - b).map(n => n.toFixed(1));

        return {
            trim:          ['', ...uniq([vehicleTrim, ...trimsFromResults])],
            fuelType:      ['', ...uniq([vehicleFuel, ...fuelsFromResults])],
            transmission:  ['', ...uniq([vehicleTrans, ...transFromResults])],
            drivetrain:    ['', ...uniq([vehicleDrivetrain, ...drivesFromResults])],
            doors:         ['', ...uniq([vehicleDoors, ...doorsFromResults])],
            condition:     ['', 'Used', 'New'],
            minYear:       ['', ...allYears.map(String)],
            maxYear:       ['', ...allYears.map(String)],
            minEngineSize: ['', ...Array.from(new Set(allEngines))],
            maxEngineSize: ['', ...Array.from(new Set(allEngines))],
            minMileage:    ['', ...mileageBuckets.map(String)],
            maxMileage:    ['', ...mileageBuckets.map(String)],
        };
    }, [results, filterPool, vehicle?.trim, vehicle?.fuelType, vehicle?.transmission, vehicle?.transmissionType, vehicle?.drivetrain, vehicle?.driveTrain, vehicle?.doors, vehicle?.condition, vehicle?.year, vehicle?.engineSize, vehicle?.badgeEngineSizeLitres]);

    const doSearch = async (limit?: number) => {
        if (!vehicle?.vrm) return;
        setLoading(true);
        setError('');
        setWarning('');
        setSearched(true);
        setPage(1);
        try {
            const params = new URLSearchParams({ vrm: vehicle.vrm });
            // Pass make/model/year so API can use as fallback if no competitorUrl
            if (vehicle.make) params.set('make', textValue(vehicle.make));
            if (vehicle.model) params.set('model', textValue(vehicle.model));
            if (vehicle.year) params.set('year', String(vehicle.year));
            if (filters.fuelType) params.set('fuelType', filters.fuelType);
            if (filters.trim) params.set('trim', filters.trim);
            if (filters.transmission) params.set('transmission', filters.transmission);
            if (filters.drivetrain) params.set('drivetrain', filters.drivetrain);
            if (filters.doors) params.set('doors', filters.doors);
            if (filters.minEngineSize) params.set('minEngineSize', filters.minEngineSize);
            if (filters.maxEngineSize) params.set('maxEngineSize', filters.maxEngineSize);
            if (filters.minMileage) params.set('minMileage', filters.minMileage);
            if (filters.maxMileage) params.set('maxMileage', filters.maxMileage);
            if (filters.minYear) params.set('minYear', filters.minYear);
            if (filters.maxYear) params.set('maxYear', filters.maxYear);
            if (filters.condition) params.set('condition', filters.condition);
            // Auto-search uses a smaller pool (25); manual Search button fetches full pool
            params.set('pageSize', String(limit ?? FETCH_RESULTS_TARGET));

            const res = await fetch(`/api/vehicles/competitors?${params.toString()}`, {
                credentials: 'include',
            });
            const data = await res.json();
            if (data.ok) {
                setResults(data.competitors || []);
                setTotal(data.total || 0);
                setIsSampleData(!!data.capabilityError);
                if (data.warning) setWarning(data.warning);
            } else {
                setError(data.error?.message || 'Failed to load competitors.');
            }
        } catch (err: any) {
            setError('Network error — ' + (err?.message || 'please try again.'));
        }
        setLoading(false);
    };

    // Silently fetch a larger pool of results just to populate filter dropdowns
    const fetchFilterPool = async () => {
        if (!vehicle?.vrm) return;
        try {
            const params = new URLSearchParams({ vrm: vehicle.vrm });
            if (vehicle.make) params.set('make', textValue(vehicle.make));
            if (vehicle.model) params.set('model', textValue(vehicle.model));
            if (vehicle.year) params.set('year', String(vehicle.year));
            params.set('pageSize', '150');
            const res = await fetch(`/api/vehicles/competitors?${params.toString()}`, { credentials: 'include' });
            const data = await res.json();
            if (data.ok && data.competitors?.length) setFilterPool(data.competitors);
        } catch { /* silent — filter options will fall back to displayed results */ }
    };

    const autoSearchedVrmRef = useRef<string | null>(null);

    // Auto-search once when tab opens
    useEffect(() => {
        const vrm = String(vehicle?.vrm || '').toUpperCase().replace(/\s/g, '');
        if (!vrm) return;
        if (autoSearchedVrmRef.current === vrm) return;
        autoSearchedVrmRef.current = vrm;
        doSearch(25);
        fetchFilterPool();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vehicle?.vrm]);

    // Sort + filter table
    const filtered = results.filter(r => {
        if (!tableSearch) return true;
        const q = tableSearch.toLowerCase();
        return r.registration?.toLowerCase().includes(q)
            || r.trim?.toLowerCase().includes(q)
            || r.derivative?.toLowerCase().includes(q)
            || r.fuelType?.toLowerCase().includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
        const av = a[sortCol] ?? (sortDir === 'asc' ? Infinity : -Infinity);
        const bv = b[sortCol] ?? (sortDir === 'asc' ? Infinity : -Infinity);
        if (typeof av === 'number' && typeof bv === 'number') {
            return sortDir === 'asc' ? av - bv : bv - av;
        }
        return sortDir === 'asc'
            ? String(av).localeCompare(String(bv))
            : String(bv).localeCompare(String(av));
    });

    const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);
    const totalPages = Math.ceil(sorted.length / pageSize);

    // Summary stats
    const withPrice = results.filter(r => r.price != null);
    const withVal = results.filter(r => r.valuation != null);
    const withDays = results.filter(r => r.daysOnForecourt != null);
    const withDist = results.filter(r => r.distance != null);
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;
    const minOf = (arr: number[]) => arr.length ? Math.min(...arr) : null;
    const maxOf = (arr: number[]) => arr.length ? Math.max(...arr) : null;

    const avgPrice = avg(withPrice.map(r => r.price));
    const avgVal = avg(withVal.map(r => r.valuation));
    const avgDays = avg(withDays.map(r => r.daysOnForecourt));
    const avgDist = avg(withDist.map(r => r.distance));

    const handleSort = (col: string) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const SortIcon = ({ col }: { col: string }) => (
        <span className="ml-0.5 text-[9px] opacity-50">
            {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
    );

    const exportCSV = () => {
        const headers = ['Registration', 'Price', 'Valuation', 'Price vs Val %', 'Trim', 'Derivative', 'Engine', 'Fuel', 'Transmission', 'Mileage', 'Days on Forecourt', 'Distance'];
        const rows = sorted.map(r => [
            r.registration, r.price ?? '', r.valuation ?? '',
            r.price && r.valuation ? Math.round((r.price / r.valuation) * 100) : '',
            r.trim, r.derivative, r.engine, r.fuelType, r.transmission ?? '',
            r.mileage ?? '', r.daysOnForecourt ?? '', r.distance ? `${r.distance} miles` : '',
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `competitors-${vehicle?.vrm || 'export'}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const FilterInput = ({ label, field, type = 'text', options, placeholder }: {
        label: string; field: keyof typeof filters;
        type?: 'text' | 'number' | 'select'; options?: string[]; placeholder?: string;
    }) => (
        <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4D7CFF] mb-1">{label}</label>
            {type === 'select' ? (
                <select
                    value={filters[field]}
                    onChange={e => setFilters(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-[12px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF] shadow-sm"
                >
                    {options?.map((o, i) => <option key={`${String(o)}-${i}`} value={o}>{o || 'Nothing selected'}</option>)}
                </select>
            ) : (
                <input
                    type={type}
                    value={filters[field]}
                    onChange={e => setFilters(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={placeholder || ''}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-[12px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF] shadow-sm"
                />
            )}
        </div>
    );

    return (
        <div className="space-y-5 min-w-0 w-full">
            {/* MotorDesk-style hover image preview */}
            {preview && (
                <div
                    className="fixed z-[200] pointer-events-none"
                    style={{
                        left: Math.min(preview.x + 18, window.innerWidth - 360),
                        top: Math.min(preview.y + 18, window.innerHeight - 260),
                    }}
                >
                    <div className="bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden">
                        <img
                            src={preview.url}
                            alt=""
                            className="w-[340px] h-[220px] object-cover bg-slate-100"
                            onError={(e) => {
                                const cur = e.currentTarget.src;
                                if (cur.includes('w300h225')) e.currentTarget.src = cur.replace('w300h225', 'w480h360');
                                else if (cur.includes('w480h360')) e.currentTarget.src = cur.replace('w480h360', 'w800h600');
                            }}
                        />
                    </div>
                </div>
            )}
            {/* ── Search Competitors ── */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                    <h2 className="text-[15px] font-bold text-slate-800">Search Competitors</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setShowCompHelp(true)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-[11px] font-bold transition-colors shadow-sm ${showCompHelp ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-[#E2E8F0] text-slate-500 hover:bg-slate-50'}`}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            Help
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-400 hover:bg-slate-50 transition-colors">
                            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-[#4D7CFF] border border-[#DCE4FF] rounded bg-blue-50/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4D7CFF]" />On Site
                        </div>
                        <div className="px-3 py-1.5 text-[11px] font-bold text-white bg-[#4D7CFF] rounded">For Sale</div>
                    </div>
                </div>

                {/* Row 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4D7CFF] mb-1">Manufacturer</label>
                        <input readOnly value={textValue(vehicle?.make)} className="w-full px-2.5 py-1.5 bg-slate-50 border border-[#E2E8F0] rounded text-[12px] text-slate-600 cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4D7CFF] mb-1">Model</label>
                        <input readOnly value={textValue(vehicle?.model)} className="w-full px-2.5 py-1.5 bg-slate-50 border border-[#E2E8F0] rounded text-[12px] text-slate-600 cursor-not-allowed" />
                    </div>
                    <FilterInput label="Trim" field="trim" type="select" options={selectOptions.trim} />
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4D7CFF] mb-1">Engine Size</label>
                        <div className="flex items-center gap-1">
                            <select
                                value={filters.minEngineSize}
                                onChange={e => setFilters(p => ({ ...p, minEngineSize: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-[12px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF] shadow-sm"
                            >
                                {selectOptions.minEngineSize?.map((o, i) => (
                                    <option key={`minEngine-${String(o)}-${i}`} value={o}>{o || 'Nothing selected'}</option>
                                ))}
                            </select>
                            <span className="text-[11px] text-slate-400 font-semibold">to</span>
                            <select
                                value={filters.maxEngineSize}
                                onChange={e => setFilters(p => ({ ...p, maxEngineSize: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-[12px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF] shadow-sm"
                            >
                                {selectOptions.maxEngineSize?.map((o, i) => (
                                    <option key={`maxEngine-${String(o)}-${i}`} value={o}>{o || 'Nothing selected'}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    <FilterInput label="Fuel" field="fuelType" type="select" options={selectOptions.fuelType} />
                    <FilterInput label="Transmission" field="transmission" type="select" options={selectOptions.transmission} />
                    <FilterInput label="Drivetrain" field="drivetrain" type="select" options={selectOptions.drivetrain} />
                    <FilterInput label="Doors" field="doors" type="select" options={selectOptions.doors} />
                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4D7CFF] mb-1">Mileage</label>
                        <div className="flex items-center gap-1">
                            <select
                                value={filters.minMileage}
                                onChange={e => setFilters(p => ({ ...p, minMileage: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-[12px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] shadow-sm"
                            >
                                {selectOptions.minMileage?.map((o, i) => (
                                    <option key={`minMiles-${String(o)}-${i}`} value={o}>{o || 'Nothing selected'}</option>
                                ))}
                            </select>
                            <span className="text-[11px] text-slate-400 font-semibold">to</span>
                            <select
                                value={filters.maxMileage}
                                onChange={e => setFilters(p => ({ ...p, maxMileage: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-[12px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] shadow-sm"
                            >
                                {selectOptions.maxMileage?.map((o, i) => (
                                    <option key={`maxMiles-${String(o)}-${i}`} value={o}>{o || 'Nothing selected'}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4D7CFF] mb-1">Year</label>
                        <div className="flex items-center gap-1">
                            <select
                                value={filters.minYear}
                                onChange={e => setFilters(p => ({ ...p, minYear: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-[12px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] shadow-sm"
                            >
                                {selectOptions.minYear?.map((o, i) => (
                                    <option key={`minYear-${String(o)}-${i}`} value={o}>{o || 'Nothing selected'}</option>
                                ))}
                            </select>
                            <span className="text-[11px] text-slate-400 font-semibold">to</span>
                            <select
                                value={filters.maxYear}
                                onChange={e => setFilters(p => ({ ...p, maxYear: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded text-[12px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] shadow-sm"
                            >
                                {selectOptions.maxYear?.map((o, i) => (
                                    <option key={`maxYear-${String(o)}-${i}`} value={o}>{o || 'Nothing selected'}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <FilterInput label="Condition" field="condition" type="select" options={selectOptions.condition} />
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={() => doSearch()}
                        disabled={loading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#4D7CFF] text-white font-bold text-[13px] rounded hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2.5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-4.35-4.35" /></svg>
                        )}
                        Search
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-[13px] font-semibold text-red-700">
                    ⚠ {error}
                </div>
            )}

            {/* API Warning / diagnostic */}
            {warning && !error && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-[12px] font-medium text-amber-700">
                    ⚠ {warning}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center h-40">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[13px] font-semibold text-slate-400">Searching AutoTrader competitors...</span>
                    </div>
                </div>
            )}

            {/* Sample data banner — Search capability not enabled */}
            {!loading && isSampleData && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-start gap-3">
                    <div className="text-lg mt-0.5">🔓</div>
                    <div className="flex-1">
                        <div className="text-[13px] font-bold text-blue-800 mb-1">Sample Data — AutoTrader Search Capability Required</div>
                        <p className="text-[12px] text-blue-700 leading-relaxed">
                            The data below is <strong>sample/demo data</strong> to preview the layout. Your AutoTrader account&apos;s API token
                            (<strong>Stock Management</strong>) does not have the <strong>Search</strong> or <strong>Search Adverts</strong> capability enabled.
                        </p>
                        <p className="text-[11px] text-blue-600 mt-2">
                            To enable live competitor data: contact AutoTrader Connect support and request <code className="bg-blue-100 px-1 rounded text-[10px]">Search</code> or <code className="bg-blue-100 px-1 rounded text-[10px]">Search Adverts</code> capability to be added to your API integration.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Summary Stats ── */}
            {!loading && searched && results.length > 0 && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            {
                                label: 'AVG. PRICE',
                                main: avgPrice != null ? `£${avgPrice.toLocaleString()}` : '—',
                                sub: withPrice.length > 1 ? `£${minOf(withPrice.map(r => r.price))!.toLocaleString()} to £${maxOf(withPrice.map(r => r.price))!.toLocaleString()}` : '',
                            },
                            {
                                label: 'AVG. VALUATION',
                                main: avgVal != null ? `£${avgVal.toLocaleString()}` : '—',
                                sub: withVal.length > 1 ? `£${minOf(withVal.map(r => r.valuation))!.toLocaleString()} to £${maxOf(withVal.map(r => r.valuation))!.toLocaleString()}` : '',
                            },
                            {
                                label: 'AVG. DAYS ON FORECOURT',
                                main: avgDays != null ? `${avgDays} days` : '—',
                                sub: withDays.length > 1 ? `${minOf(withDays.map(r => r.daysOnForecourt))} to ${maxOf(withDays.map(r => r.daysOnForecourt))} days` : '',
                            },
                            {
                                label: 'AVG. DISTANCE',
                                main: avgDist != null ? `${avgDist} miles` : '—',
                                sub: withDist.length > 1 ? `${minOf(withDist.map(r => r.distance))} to ${maxOf(withDist.map(r => r.distance))} miles` : '',
                            },
                        ].map(card => (
                            <div key={card.label} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">{card.label}</div>
                                <div className="text-[22px] font-extrabold text-slate-800 leading-none mb-1.5">{card.main}</div>
                                {card.sub && <div className="text-[11px] font-medium text-slate-400">{card.sub}</div>}
                            </div>
                        ))}
                    </div>

                    {/* ── Competitors Table ── */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden w-full min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-[#E2E8F0]">
                            <div className="flex items-center gap-3">
                                <h3 className="text-[14px] font-bold text-slate-800">AutoTrader Competitors</h3>
                                <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{filtered.length} results</span>
                            </div>
                            <input
                                type="text"
                                value={tableSearch}
                                onChange={e => setTableSearch(e.target.value)}
                                placeholder="Search results..."
                                className="w-full sm:w-48 px-3 py-1.5 border border-[#E2E8F0] rounded text-[12px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] shadow-sm"
                            />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px]">
                                <thead>
                                    <tr className="bg-slate-50/80">
                                        {[
                                            { col: 'registration', label: 'REGISTRATION' },
                                            { col: 'price', label: 'PRICE' },
                                            { col: 'valuation', label: 'VALUATION' },
                                            { col: 'price', label: 'PRICE VS VALUATION' },
                                            { col: 'trim', label: 'TRIM' },
                                            { col: 'derivative', label: 'DERIVATIVE' },
                                            { col: 'engine', label: 'ENGINE' },
                                            { col: 'fuelType', label: 'FUEL' },
                                            { col: 'transmission', label: 'TRANSMISSION' },
                                            { col: 'optionalExtrasCount', label: 'OPTIONS' },
                                            { col: 'fullDealershipHistory', label: 'FULL DEALER HISTORY' },
                                            { col: 'daysOnForecourt', label: 'DAYS ON FORECOURT' },
                                        ].map(({ col, label }) => (
                                            <th key={label}
                                                onClick={() => col !== 'image' && handleSort(col)}
                                                className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-slate-600 whitespace-nowrap border-b border-[#E2E8F0]"
                                            >
                                                {label} <SortIcon col={col} />
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((row, i) => {
                                        const pct = row.price && row.valuation ? Math.round((row.price / row.valuation) * 100) : null;
                                        const barColor = pct == null ? '#e2e8f0' : pct < 95 ? '#10b981' : pct > 105 ? '#f87171' : '#60a5fa';
                                        const isCurrent = row.registration === vehicle?.vrm?.replace(/\s/g, '').toUpperCase();
                                        return (
                                            <tr key={i} className={`border-b border-[#E2E8F0] hover:bg-blue-50/30 transition-colors ${isCurrent ? 'bg-blue-50/50' : ''}`}>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {row.searchId ? (
                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href={`https://www.autotrader.co.uk/car-details/${row.searchId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className={`font-bold text-[#4D7CFF] hover:underline ${isCurrent ? 'text-[#2563eb]' : ''}`}
                                                                title="Open this advert on AutoTrader"
                                                            >
                                                                {row.registration}
                                                            </a>
                                                            <a
                                                                href={`https://www.autotrader.co.uk/car-details/${row.searchId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-slate-300 hover:text-[#4D7CFF] transition-colors"
                                                                title="Open on AutoTrader"
                                                                aria-label="Open on AutoTrader"
                                                                onMouseEnter={(e) => {
                                                                    if (!row.image) return;
                                                                    if (preview?.locked) return;
                                                                    setPreview({ url: row.image, x: e.clientX, y: e.clientY, locked: false });
                                                                }}
                                                                onMouseMove={(e) => {
                                                                    if (!row.image) return;
                                                                    if (!preview || preview.locked) return;
                                                                    setPreview(p => (p ? { ...p, x: e.clientX, y: e.clientY } : null));
                                                                }}
                                                                onMouseLeave={() => {
                                                                    if (preview?.locked) return;
                                                                    setPreview(null);
                                                                }}
                                                                onClick={(e) => {
                                                                    // Lock/unlock preview on click (keep opening AT in new tab)
                                                                    if (!row.image) return;
                                                                    setPreview(p => {
                                                                        if (!p || p.url !== row.image) return { url: row.image, x: e.clientX, y: e.clientY, locked: true };
                                                                        return { ...p, locked: !p.locked };
                                                                    });
                                                                }}
                                                            >
                                                                🔍
                                                            </a>
                                                        </div>
                                                    ) : (
                                                        <span className={`font-bold text-[#4D7CFF] ${isCurrent ? 'text-[#2563eb]' : ''}`}>
                                                            {row.registration}
                                                        </span>
                                                    )}
                                                    {isCurrent && <span className="ml-1.5 text-[9px] font-bold text-[#4D7CFF] bg-blue-100 px-1.5 py-0.5 rounded">YOU</span>}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-700">
                                                    {row.price != null ? `£${row.price.toLocaleString()}` : '—'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-500">
                                                    {row.valuation != null ? `£${row.valuation.toLocaleString()}` : '—'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct ?? 100, 120)}%`, backgroundColor: barColor, maxWidth: '100%' }} />
                                                        </div>
                                                        <span className="font-bold text-[11px]" style={{ color: barColor }}>{pct != null ? `${pct}%` : '—'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{textValue(row.trim)}</td>
                                                <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate" title={textValue(row.derivative)}>{textValue(row.derivative)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.engine}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{textValue(row.fuelType)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{textValue(row.transmission)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.optionalExtrasCount ?? 0}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.fullDealershipHistory ? 'Yes' : 'No'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.daysOnForecourt ?? '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Table footer */}
                        <div className="px-4 sm:px-5 py-3 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
                            <div className="flex items-center gap-3">
                                <label className="text-[11px] font-semibold text-slate-500">Show</label>
                                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                                    className="px-2 py-1 border border-[#E2E8F0] rounded text-[12px] text-slate-700 bg-white focus:outline-none">
                                    {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <button onClick={exportCSV} className="px-3 py-1 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-500 hover:bg-white hover:text-[#4D7CFF] transition-colors bg-transparent">
                                    Export CSV
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    className="px-3 py-1 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-500 hover:bg-white transition-colors disabled:opacity-40">
                                    Previous
                                </button>
                                <span className="px-3 py-1 bg-[#4D7CFF] text-white text-[11px] font-bold rounded">{page} / {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="px-3 py-1 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-500 hover:bg-white transition-colors disabled:opacity-40">
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Scatter Chart ── */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <select
                                value={chartYAxis}
                                onChange={e => setChartYAxis(e.target.value as 'price' | 'valuation')}
                                className="px-2.5 py-1.5 border border-[#E2E8F0] rounded text-[12px] text-slate-700 bg-white focus:outline-none focus:border-[#4D7CFF]"
                            >
                                <option value="price">Price</option>
                                <option value="valuation">Valuation</option>
                            </select>
                            <span className="text-[12px] font-bold text-slate-400">vs</span>
                            <select
                                value={chartXAxis}
                                onChange={e => setChartXAxis(e.target.value as 'mileage' | 'year' | 'daysOnForecourt' | 'distance')}
                                className="px-2.5 py-1.5 border border-[#E2E8F0] rounded text-[12px] text-slate-700 bg-white focus:outline-none focus:border-[#4D7CFF]"
                            >
                                <option value="mileage">Mileage</option>
                                <option value="year">Year</option>
                                <option value="daysOnForecourt">Days on Forecourt</option>
                                <option value="distance">Distance</option>
                            </select>
                        </div>
                        <CompetitorScatterChart
                            data={results}
                            currentVrm={vehicle?.vrm?.replace(/\s/g, '').toUpperCase() || ''}
                            xKey={chartXAxis}
                            yKey={chartYAxis}
                        />
                    </div>
                </>
            )}

            {/* Empty state */}
            {!loading && searched && results.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
                    <div className="text-3xl mb-3 opacity-30">📊</div>
                    <p className="text-[13px] font-semibold text-slate-600">No competitor results found.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try adjusting filters or checking AutoTrader stock visibility.</p>
                </div>
            )}

            {/* Pre-search state */}
            {!searched && !loading && (
                <div className="flex flex-col items-center justify-center py-14 bg-white rounded-xl border border-dashed border-[#E2E8F0]">
                    <div className="text-3xl mb-3 opacity-20">🔍</div>
                    <p className="text-[13px] font-semibold text-slate-500">Click Search to find competitor vehicles on AutoTrader</p>
                    <p className="text-[11px] text-slate-400 mt-1">Adjust filters above before searching</p>
                </div>
            )}

            {/* ── Competitors Help Drawer ─────────────────────────────────── */}
            {showCompHelp && (
                <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300" onClick={() => setShowCompHelp(false)}>
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                    <div
                        className="relative w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 ease-out"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 bg-[#4D7CFF] text-white shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                </div>
                                <div>
                                    <div className="text-[15px] font-bold leading-tight">Competitors</div>
                                    <div className="text-[11px] text-white/70 font-medium">Help Guide &amp; How To Use</div>
                                </div>
                            </div>
                            <button onClick={() => setShowCompHelp(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white text-[14px]">✕</button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-7 bg-slate-50/30">

                            {/* What is this section */}
                            <div>
                                <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                    What is the Competitors Section?
                                </h3>
                                <p className="text-[12px] text-slate-600 leading-relaxed">
                                    This section lets you search AutoTrader live to find similar vehicles listed by other dealers. It helps you understand your competition, compare prices, and make smarter pricing decisions — all without leaving the system.
                                </p>
                            </div>

                            {/* How to search */}
                            <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
                                <h3 className="text-[13px] font-bold text-blue-900 mb-4 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2"/><path d="m21 21-4.35-4.35" strokeWidth="2"/></svg>
                                    How to Search
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="mt-0.5 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</div>
                                        <div>
                                            <p className="text-[12px] font-bold text-slate-800">Manufacturer &amp; Model are pre-filled</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">These are locked to the current vehicle's make and model so results are always relevant.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-0.5 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</div>
                                        <div>
                                            <p className="text-[12px] font-bold text-slate-800">Refine with filters</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Use Trim, Fuel, Transmission, Drivetrain, Doors, Engine Size, Mileage, Year, Condition, and Distance to narrow down the search to your closest competitors.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-0.5 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</div>
                                        <div>
                                            <p className="text-[12px] font-bold text-slate-800">Click Search</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Results are pulled live from AutoTrader — up to 200 competitor listings are fetched and displayed in the table below.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Results table */}
                            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 6h18M3 14h18M3 18h18" /></svg>
                                    Reading the Results Table
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-600 leading-relaxed"><strong>Price</strong> — the advertised retail price on AutoTrader.</p>
                                    </div>
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-600 leading-relaxed"><strong>Mileage / Year</strong> — key condition indicators for comparison.</p>
                                    </div>
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-600 leading-relaxed"><strong>Days on Forecourt</strong> — how long the competitor listing has been live. High numbers can indicate overpricing.</p>
                                    </div>
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-600 leading-relaxed"><strong>Distance</strong> — how far the competitor dealer is from your location.</p>
                                    </div>
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-600 leading-relaxed"><strong>Click any row</strong> to preview the competitor listing directly on AutoTrader.</p>
                                    </div>
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-600 leading-relaxed"><strong>Sort columns</strong> by clicking the column headers. Search within results using the table search bar.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Scatter chart */}
                            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>
                                    Scatter Chart
                                </h3>
                                <p className="text-[12px] text-slate-600 leading-relaxed mb-3">
                                    The scatter chart gives you a visual overview of competitor pricing. Each dot is a competitor vehicle. Use the axis dropdowns to switch between Mileage, Year, Days on Forecourt, and Distance on the X-axis, and Price or Valuation on the Y-axis.
                                </p>
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <p className="text-[11px] text-blue-800 font-medium">Tip: Hover over any dot to see the vehicle details. Dots clustered at a lower price with low mileage are your strongest competitors.</p>
                                </div>
                            </div>

                            {/* Export */}
                            <div>
                                <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                    Export to CSV
                                </h3>
                                <p className="text-[12px] text-slate-600 leading-relaxed">
                                    Use the Export button to download all competitor results as a CSV file. This is useful for sharing with your team or doing deeper analysis in a spreadsheet.
                                </p>
                            </div>

                            {/* Pro tip */}
                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <p className="text-[12px] font-bold text-amber-800 mb-1">Pricing Tip</p>
                                <p className="text-[11px] text-amber-700 leading-relaxed">
                                    If your vehicle's price is higher than most competitors with similar mileage and year, consider whether your spec justifies the premium — or adjust to stay competitive. Vehicles priced in the bottom third of comparable listings typically sell significantly faster.
                                </p>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-200">
                            <button
                                onClick={() => setShowCompHelp(false)}
                                className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-[12px] font-bold hover:bg-slate-900 transition-colors shadow-sm"
                            >
                                Got it, thanks!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


/* ─── Silent Salesman – all highlights shown in the UI ───────────────────── */
const SS_ALL_HIGHLIGHTS: string[] = [
    'Year', 'Age', 'Mileage', 'Hours Used',
    'Previous Owners', 'Seats', 'Doors', 'Body Type',
    'Colour', 'Fuel Type', 'Fuel Capacity', 'Transmission',
    'Drivetrain', 'Engine Size', 'Engine Cylinders', 'Engine Power (BHP)',
    'Engine Power (PS)', 'Engine Torque (lbs/ft)', 'Engine Torque (Nm)', 'Battery Full Charge Time',
    'Battery Quick Charge Time', 'Battery Capacity', 'Battery Range', 'Battery Health',
    'Height', 'Width', 'Length', 'Weight',
    'Kerb Weight', 'Gross Weight', 'Unladen Weight', 'MTPLM',
    'Load Height', 'Load Width', 'Load Length', 'Load Weight',
    'Load Volume', 'Boot Space', 'Cab Type', 'Driver Position',
    'Bedroom Layout', 'End Layout', 'Bedrooms', 'Berths',
    'Seat Belts', 'Acceleration', 'Top Speed', 'Fuel Consumption',
    'CO2 Emissions', 'Emission Class', 'ULEZ Compliance', 'CAZ Compliance',
    'Insurance Class', 'Warranty', 'Remaining Warranty', 'Battery Warranty',
    'Remaining Battery Warranty', 'Extended Warranty', 'UK Road Tax (VED)', 'Registration',
];

const SS_DEFAULT_ON = new Set([
    'Year', 'Mileage', 'Doors', 'Body Type', 'Colour', 'Fuel Type',
    'Transmission', 'Drivetrain', 'Engine Size', 'Engine Power (BHP)',
    'Battery Full Charge Time', 'Battery Range', 'Fuel Consumption',
    'CO2 Emissions', 'Insurance Class',
]);

function ssHtmlToPlainText(html: string): string {
    return html
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function ssPlainToHtml(text: string): string {
    if (!text) return '';
    return text
        .split(/\n/)
        .map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</p>`)
        .join('');
}

/* ─── Toolbar button helper ─────────────────────────────────────────────────── */
function SSToolbarBtn({ title, onClick, active, children }: { title: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
    return (
        <button
            type="button"
            title={title}
            onMouseDown={e => { e.preventDefault(); onClick(); }}
            className={`px-[7px] py-[3px] rounded text-[13px] text-slate-700 hover:bg-slate-200 transition-colors ${active ? 'bg-slate-200 font-bold' : ''}`}
        >
            {children}
        </button>
    );
}

/* ─── Silent Salesman Tab Component ─────────────────────────────────────────── */
function SilentSalesmanTab({ vehicle, routeVehicleId }: { vehicle: any; routeVehicleId: string }) {
    const [template, setTemplate] = useState<'classic' | 'specOptions' | 'simpleFinance'>('simpleFinance');
    const [heading, setHeading] = useState('Drive Away Today!');
    const [showPrice, setShowPrice] = useState<'visible' | 'hidden'>('visible');
    const [showOptionalExtras, setShowOptionalExtras] = useState<'visible' | 'hidden'>('hidden');
    // Only show highlights that have actual data for this vehicle
    const availableHighlights = useMemo(
        () => getAvailableHighlightLabels(vehicle),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [vehicle?._id, vehicle?.id, vehicle?.vrm]
    );

    const [highlights, setHighlights] = useState<Record<string, boolean>>(
        () => Object.fromEntries(availableHighlights.map(k => [k, SS_DEFAULT_ON.has(k)]))
    );

    // Re-sync when vehicle changes
    useEffect(() => {
        setHighlights(Object.fromEntries(availableHighlights.map(k => [k, SS_DEFAULT_ON.has(k)])));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableHighlights.join('|')]);
    const [downloading, setDownloading] = useState(false);
    const [showSSHelp, setShowSSHelp] = useState(false);

    const editorRef = useRef<HTMLDivElement>(null);
    const userEditedDescRef = useRef(false);
    const lastAutoDescRef = useRef<string>('');

    const vehicleDescIdentity = useMemo(() => (
        (vehicle?._id && String(vehicle._id)) ||
        (vehicle?.id && String(vehicle.id)) ||
        (vehicle?.vrm && String(vehicle.vrm)) ||
        ''
    ), [vehicle?._id, vehicle?.id, vehicle?.vrm]);

    const setEditorHtml = (html: string) => {
        if (editorRef.current) editorRef.current.innerHTML = html;
    };

    // When vehicle changes reset editor content
    useEffect(() => {
        userEditedDescRef.current = false;
        const auto = ssPlainToHtml(pickSilentSalesmanTextareaDefault(vehicle));
        setEditorHtml(auto);
        lastAutoDescRef.current = auto;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vehicleDescIdentity]);

    const autoDescKey = useMemo(() => {
        return [
            vehicle?.vrm, vehicle?._id, vehicle?.id,
            vehicle?.description, vehicle?.description2,
            vehicle?.attentionGrabber, vehicle?.longAttentionGrabber,
            pickSilentSalesmanTextareaDefault(vehicle),
        ].map(v => (v == null ? '' : String(v))).join('|');
    }, [vehicle]);

    useEffect(() => {
        if (userEditedDescRef.current) return;
        const auto = ssPlainToHtml(pickSilentSalesmanTextareaDefault(vehicle));
        const current = editorRef.current?.innerHTML || '';
        if (current.trim() === '' || current === lastAutoDescRef.current) {
            setEditorHtml(auto);
            lastAutoDescRef.current = auto;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoDescKey]);

    const pdfVehicleId =
        (vehicle?._id && String(vehicle._id)) ||
        (vehicle?.id && String(vehicle.id)) ||
        (routeVehicleId ? String(routeVehicleId) : '');

    useEffect(() => {
        if (!pdfVehicleId) return;
        if (userEditedDescRef.current) return;
        if (pickSilentSalesmanTextareaDefault(vehicle).trim() !== '') return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/vehicles/silent-salesman/resolve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ vehicleId: pdfVehicleId }),
                });
                if (!res.ok) return;
                const j = await res.json().catch(() => null);
                const v = j?.vehicle;
                const resolved = String(v?.description || v?.description2 || v?.longAttentionGrabber || v?.attentionGrabber || '').trim();
                if (!cancelled && resolved) {
                    const html = ssPlainToHtml(resolved);
                    setEditorHtml(html);
                    lastAutoDescRef.current = html;
                }
            } catch { /* ignore */ }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfVehicleId, autoDescKey]);

    const HIGHLIGHT_LIMIT = 13;
    const selectedHighlights = availableHighlights.filter(k => highlights[k]);
    const toggleHighlight = (k: string) => setHighlights(p => {
        if (!p[k] && selectedHighlights.length >= HIGHLIGHT_LIMIT) return p; // limit reached
        return { ...p, [k]: !p[k] };
    });
    const allOn = availableHighlights.every(k => highlights[k]);

    /* rich-text exec helper */
    const exec = (cmd: string, arg?: string) => {
        document.execCommand(cmd, false, arg ?? undefined);
        editorRef.current?.focus();
    };

    const downloadPdf = async () => {
        if (!pdfVehicleId) { toast.error('Could not determine vehicle id for PDF.'); return; }
        setDownloading(true);
        try {
            const plainDesc = ssHtmlToPlainText(editorRef.current?.innerHTML || '');
            const res = await fetch('/api/vehicles/silent-salesman/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    vehicleId: pdfVehicleId,
                    options: {
                        template,
                        heading,
                        description: plainDesc,
                        showPrice: showPrice === 'visible',
                        showOptionalExtras: showOptionalExtras === 'visible',
                        highlights: selectedHighlights,
                    },
                }),
            });
            if (!res.ok) {
                const t = await res.text();
                let msg = t;
                try { const j = JSON.parse(t); if (j?.error?.message) msg = j.error.message; } catch { /* plain text */ }
                throw new Error(msg || `HTTP ${res.status}`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `silent-salesman-${vehicle?.vrm || pdfVehicleId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success('Silent Salesman PDF downloaded.');
        } catch (e: any) {
            toast.error(`Failed to generate PDF — ${e?.message || 'please try again.'}`);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="w-full">
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-4 sm:p-6 space-y-5">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[15px] font-bold text-slate-800">Silent Salesman</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowSSHelp(true)}
                            className={`flex items-center gap-1.5 px-3 py-[6px] border rounded text-[12px] font-bold transition-colors shadow-sm ${showSSHelp ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-[#E2E8F0] text-slate-500 hover:bg-slate-50'}`}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            Help
                        </button>
                        <button
                            type="button"
                            onClick={() => toast('Defaults can be configured in Settings.')}
                            className="px-3 py-[6px] border border-[#E2E8F0] rounded text-[12px] text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                            Customise Defaults
                        </button>
                    </div>
                </div>

                {/* ── Template ───────────────────────────────────────────── */}
                <div>
                    <div className="text-[12px] font-semibold text-slate-600 mb-2">Template</div>
                    <div className="space-y-[6px]">
                        {([
                            { id: 'simpleFinance', label: 'Simple with Finance' },
                            { id: 'specOptions',   label: 'Specification and Options' },
                            { id: 'classic',       label: 'Classic' },
                        ] as const).map(t => (
                            <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="ss-template"
                                    checked={template === t.id}
                                    onChange={() => setTemplate(t.id)}
                                    className="accent-[#4D7CFF]"
                                />
                                <span className="text-[13px] text-slate-700">{t.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* ── Heading ────────────────────────────────────────────── */}
                <div>
                    <div className="text-[12px] font-semibold text-slate-600 mb-1">Heading</div>
                    <input
                        value={heading}
                        onChange={e => setHeading(e.target.value)}
                        className="w-full px-3 py-2 border border-[#E2E8F0] rounded text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] bg-white"
                    />
                </div>

                {/* ── Highlights ─────────────────────────────────────────── */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="text-[12px] font-semibold text-slate-600">Highlights</div>
                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${selectedHighlights.length >= HIGHLIGHT_LIMIT ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                {selectedHighlights.length}/{HIGHLIGHT_LIMIT}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const next: Record<string, boolean> = {};
                                if (allOn) {
                                    for (const k of availableHighlights) next[k] = false;
                                } else {
                                    // Select up to limit
                                    let count = 0;
                                    for (const k of availableHighlights) {
                                        next[k] = count < HIGHLIGHT_LIMIT;
                                        if (count < HIGHLIGHT_LIMIT) count++;
                                    }
                                }
                                setHighlights(next);
                            }}
                            className="text-[12px] text-[#4D7CFF] hover:underline"
                        >
                            Select All / None
                        </button>
                    </div>
                    {availableHighlights.length === 0 ? (
                        <p className="text-[12px] text-slate-400 italic">No specification data found for this vehicle.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-[6px]">
                            {availableHighlights.map(k => {
                                const checked = !!highlights[k];
                                const disabled = !checked && selectedHighlights.length >= HIGHLIGHT_LIMIT;
                                return (
                                    <label
                                        key={k}
                                        className={`flex items-center gap-[6px] ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                                        title={disabled ? `Maximum ${HIGHLIGHT_LIMIT} highlights allowed` : undefined}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleHighlight(k)}
                                            disabled={disabled}
                                            className="accent-[#4D7CFF] w-3.5 h-3.5 flex-shrink-0"
                                        />
                                        <span className="text-[12px] text-slate-600 leading-tight">{k}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Description (rich-text editor) ─────────────────────── */}
                <div>
                    <div className="text-[12px] font-semibold text-slate-600 mb-1">Description</div>
                    <div className="border border-[#E2E8F0] rounded overflow-hidden bg-white">
                        {/* Toolbar */}
                        <div className="flex flex-wrap items-center gap-[1px] px-2 py-1 border-b border-[#E2E8F0] bg-white">
                            <select
                                onMouseDown={e => e.stopPropagation()}
                                onChange={e => { exec('formatBlock', e.target.value); (e.target as HTMLSelectElement).value = 'p'; }}
                                defaultValue="p"
                                className="text-[12px] text-slate-700 border border-[#E2E8F0] rounded px-1 py-[2px] mr-1 focus:outline-none"
                            >
                                <option value="p">Paragraph</option>
                                <option value="h1">Heading 1</option>
                                <option value="h2">Heading 2</option>
                                <option value="h3">Heading 3</option>
                            </select>
                            <SSToolbarBtn title="Bold" onClick={() => exec('bold')}><b>B</b></SSToolbarBtn>
                            <SSToolbarBtn title="Italic" onClick={() => exec('italic')}><i>I</i></SSToolbarBtn>
                            <SSToolbarBtn title="Underline" onClick={() => exec('underline')}><u>U</u></SSToolbarBtn>
                            <SSToolbarBtn title="Strikethrough" onClick={() => exec('strikeThrough')}><s>S</s></SSToolbarBtn>
                            <span className="w-px h-4 bg-slate-200 mx-1" />
                            <SSToolbarBtn title="Align left" onClick={() => exec('justifyLeft')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                            </SSToolbarBtn>
                            <SSToolbarBtn title="Align center" onClick={() => exec('justifyCenter')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                            </SSToolbarBtn>
                            <SSToolbarBtn title="Align right" onClick={() => exec('justifyRight')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
                            </SSToolbarBtn>
                            <SSToolbarBtn title="Justify" onClick={() => exec('justifyFull')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                            </SSToolbarBtn>
                            <span className="w-px h-4 bg-slate-200 mx-1" />
                            <SSToolbarBtn title="Ordered list" onClick={() => exec('insertOrderedList')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
                            </SSToolbarBtn>
                            <SSToolbarBtn title="Bullet list" onClick={() => exec('insertUnorderedList')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
                            </SSToolbarBtn>
                            <SSToolbarBtn title="Decrease indent" onClick={() => exec('outdent')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="9" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/><polyline points="7 8 3 12 7 16"/></svg>
                            </SSToolbarBtn>
                            <SSToolbarBtn title="Increase indent" onClick={() => exec('indent')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/><polyline points="5 8 9 12 5 16"/></svg>
                            </SSToolbarBtn>
                            <span className="w-px h-4 bg-slate-200 mx-1" />
                            <SSToolbarBtn title="Insert link" onClick={() => {
                                const url = window.prompt('Enter URL:');
                                if (url) exec('createLink', url);
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            </SSToolbarBtn>
                            <SSToolbarBtn title="Remove formatting" onClick={() => exec('removeFormat')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 19l-5-5 9-9 5 5-9 9z"/><line x1="3" y1="21" x2="21" y2="3" strokeDasharray="4 2"/></svg>
                            </SSToolbarBtn>
                        </div>
                        {/* Editable area */}
                        <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={() => { userEditedDescRef.current = true; }}
                            className="min-h-[160px] px-4 py-3 text-[13px] text-slate-700 focus:outline-none leading-relaxed"
                            style={{ minHeight: 160 }}
                        />
                    </div>
                </div>

                {/* ── Show Optional Extras + Show Price dropdowns ─────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <div className="text-[12px] font-semibold text-slate-600 mb-1">Show Optional Extras</div>
                        <select
                            value={showOptionalExtras}
                            onChange={e => setShowOptionalExtras(e.target.value as 'visible' | 'hidden')}
                            className="w-full px-3 py-2 border border-[#E2E8F0] rounded text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] bg-white"
                        >
                            <option value="visible">Visible</option>
                            <option value="hidden">Hidden</option>
                        </select>
                    </div>
                    <div>
                        <div className="text-[12px] font-semibold text-slate-600 mb-1">Show Price</div>
                        <select
                            value={showPrice}
                            onChange={e => setShowPrice(e.target.value as 'visible' | 'hidden')}
                            className="w-full px-3 py-2 border border-[#E2E8F0] rounded text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] bg-white"
                        >
                            <option value="visible">Visible</option>
                            <option value="hidden">Hidden</option>
                        </select>
                    </div>
                </div>

                {/* ── Action buttons ─────────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={downloadPdf}
                        disabled={downloading}
                        className="flex-1 sm:flex-none px-5 py-2 bg-[#4D7CFF] text-white rounded text-[13px] font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60 text-center"
                    >
                        {downloading ? 'Generating…' : 'Download'}
                    </button>
                    <button
                        type="button"
                        onClick={() => toast('Add as Public Document — coming soon.')}
                        className="flex-1 sm:flex-none px-5 py-2 border border-[#E2E8F0] text-slate-700 rounded text-[13px] font-semibold hover:bg-slate-50 transition-colors text-center"
                    >
                        Add as Public Document
                    </button>
                </div>

            </div>

            {/* ── Silent Salesman Help Drawer ────────────────────────────────── */}
            {showSSHelp && (
                <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300" onClick={() => setShowSSHelp(false)}>
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                    <div
                        className="relative w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 ease-out"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 bg-[#4D7CFF] text-white shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                </div>
                                <div>
                                    <div className="text-[15px] font-bold leading-tight">Silent Salesman</div>
                                    <div className="text-[11px] text-white/70 font-medium">Help Guide &amp; How To Use</div>
                                </div>
                            </div>
                            <button onClick={() => setShowSSHelp(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white text-[14px]">✕</button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-7 bg-slate-50/30">

                            {/* What is Silent Salesman */}
                            <div>
                                <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                    What is Silent Salesman?
                                </h3>
                                <p className="text-[12px] text-slate-600 leading-relaxed">
                                    Silent Salesman generates a professional, print-ready PDF document for any vehicle — designed to be placed on or near the car in your showroom. It gives customers all the key information they need to make a decision, even when no salesperson is present.
                                </p>
                            </div>

                            {/* Template */}
                            <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
                                <h3 className="text-[13px] font-bold text-blue-900 mb-4 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2"/><path d="M3 9h18M9 21V9" strokeWidth="2"/></svg>
                                    Step 1 — Choose a Template
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="mt-0.5 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">A</div>
                                        <div>
                                            <p className="text-[12px] font-bold text-slate-800">Simple with Finance</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Clean, single-page layout with a large icon-based highlights grid. Best for showroom use with finance figures.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-0.5 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">B</div>
                                        <div>
                                            <p className="text-[12px] font-bold text-slate-800">Specification &amp; Options</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Two-page detailed breakdown including full Technical Specification (engine, size, fuel data) and a categorised Optional Extras list. Ideal for high-spec vehicles.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-0.5 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">C</div>
                                        <div>
                                            <p className="text-[12px] font-bold text-slate-800">Classic</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Photo-led layout with vehicle images on the left and spec highlights on the right. Includes an online reservation footer with QR code.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Highlights */}
                            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                    Step 2 — Select Highlights
                                </h3>
                                <p className="text-[12px] text-slate-600 leading-relaxed mb-3">
                                    Tick the vehicle attributes you want to display on the PDF. Only checkboxes for data that actually exists on this vehicle are shown — so you will never see a blank field on the printed document.
                                </p>
                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                                    <p className="text-[11px] text-amber-800 font-medium">Maximum 13 highlights can be selected at a time. Once the limit is reached, remaining checkboxes are greyed out.</p>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h10" /></svg>
                                    Step 3 — Edit the Description
                                </h3>
                                <p className="text-[12px] text-slate-600 leading-relaxed mb-3">
                                    The description field is pre-filled automatically using the vehicle's MOT date, colour, service history, owner count, and key features. What you see in this box is <strong>exactly</strong> what will print on the PDF — no more, no less.
                                </p>
                                <div className="space-y-2">
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">Use the toolbar to format text — <strong>Bold</strong>, <em>Italic</em>, bullet lists, alignment, etc.</p>
                                    </div>
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">The opening paragraph is limited to <strong>420 characters</strong>. Feature bullet points are capped at <strong>12 lines</strong> to match the PDF layout.</p>
                                    </div>
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">MOT expiry is always included automatically in the first line.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Display options + Download */}
                            <div>
                                <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                    Step 4 — Set Options &amp; Download
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-600 leading-relaxed"><strong>Show Price</strong> — toggle whether the vehicle price appears on the PDF.</p>
                                    </div>
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-600 leading-relaxed"><strong>Show Optional Extras</strong> — toggle whether the optional extras list is included (default: hidden).</p>
                                    </div>
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-600 leading-relaxed"><strong>Download</strong> — generates and saves the PDF instantly to your device.</p>
                                    </div>
                                    <div className="flex gap-2 items-start">
                                        <span className="text-blue-500 mt-0.5 text-[10px]">•</span>
                                        <p className="text-[11px] text-slate-600 leading-relaxed"><strong>Add as Public Document</strong> — attaches the PDF to the vehicle's public listing page so customers can download it themselves online.</p>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-200">
                            <button
                                onClick={() => setShowSSHelp(false)}
                                className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-[12px] font-bold hover:bg-slate-900 transition-colors shadow-sm"
                            >
                                Got it, thanks!
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}


/* ─── Vehicle Check Tab Component ───────────────────────────────────────────── */
function VehicleCheckTab({ vehicle, checkData, checkLoading, checkError, checkLoaded, onLoad, onRefresh }: {
    vehicle: any; checkData: any; checkLoading: boolean; checkError: string; checkLoaded: boolean;
    onLoad: () => void; onRefresh: () => void;
}) {
    const [showCheckHelp, setShowCheckHelp] = useState(false);
    // Auto-fetch on mount / when vehicle VRM changes
    useEffect(() => {
        if (!checkLoaded && !checkLoading && !checkError) {
            onLoad();
        }
    }, [vehicle?.vrm]); // eslint-disable-line react-hooks/exhaustive-deps

    const history = checkData?.history;
    const check = checkData?.check;
    const motTests: any[] = checkData?.motTests || [];
    const limited = checkData?.limitedData;
    const dvla = check?.dvlaVehicle;

    // Latest MOT expiry
    const latestMot = motTests[0];
    const motExpiry = latestMot?.expiryDate;
    const motPassed = latestMot?.testResult === 'Passed';
    const today = new Date();
    const motValid = motExpiry ? new Date(motExpiry) > today : false;

    // UK VED calculator — rates for pre-March-2017 CO2 bands (2024/25)
    function calcVED(co2?: number, firstRegStr?: string, engineCC?: number) {
        if (!firstRegStr) return null;
        const parts = firstRegStr.includes('-') ? firstRegStr.split('-') : firstRegStr.split('/').reverse();
        const regYear = parseInt(parts[0]);
        const regMonth = parseInt(parts[1]) || 1; // default month 1 if missing
        if (!regYear || isNaN(regYear)) return null;
        const isPreMarch2001 = regYear < 2001 || (regYear === 2001 && regMonth < 3);
        const isPostApril2017 = regYear > 2017 || (regYear === 2017 && regMonth >= 4);
        let annual = 0;
        if (isPreMarch2001 && engineCC) {
            annual = engineCC <= 1549 ? 200 : 325;
        } else if (isPostApril2017) {
            annual = 200;
        } else if (co2 != null) {
            const bands: [number, number, number][] = [
                [0, 100, 0], [101, 110, 20], [111, 120, 35], [121, 130, 165],
                [131, 140, 205], [141, 150, 230], [151, 165, 280], [166, 175, 315],
                [176, 185, 355], [186, 200, 400], [201, 225, 450], [226, 255, 695], [256, 9999, 735],
            ];
            for (const [min, max, rate] of bands) {
                if (co2 >= min && co2 <= max) { annual = rate; break; }
            }
        }
        if (annual === 0 && (co2 ?? 1) > 0) return null;
        const fmt = (n: number) => `£${n.toFixed(2)}`;
        return {
            single12: fmt(annual),
            single6:  fmt(annual * 0.55),
            dd12:     fmt(annual),
            dd6:      fmt(annual * 1.05 / 2),
            dd1:      fmt(annual * 1.05 / 12),
        };
    }

    const co2Val  = checkData?.dvlaTax?.co2Emissions ?? dvla?.co2EmissionsGKM;
    const engCC   = checkData?.dvlaTax?.engineCapacity ?? dvla?.engineCapacityCC;
    // DVLA firstUsedDate is "YYYY-MM" — most reliable source for VED band
    const firstRegRaw = checkData?.dvlaTax?.firstUsedDate
        ?? checkData?.vehicle?.firstRegistrationDate
        ?? vehicle?.registeredDate ?? '';
    const vedData = calcVED(co2Val, firstRegRaw, engCC);

    const CheckItem = ({ label, ok, upgrade }: { label: string; ok?: boolean | null; upgrade?: boolean }) => {
        if (upgrade) return (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[11px] font-bold">?</span>
                </div>
                <span className="text-[13px] font-semibold text-amber-700">Upgrade for {label}</span>
            </div>
        );
        return (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${ok !== false ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${ok !== false ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    <span className="text-white text-[12px]">{ok !== false ? '✓' : '✗'}</span>
                </div>
                <span className={`text-[13px] font-semibold ${ok !== false ? 'text-emerald-700' : 'text-red-700'}`}>{label}</span>
            </div>
        );
    };

    if (checkLoading) return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin" />
                <span className="text-[13px] font-semibold text-slate-500">Loading Vehicle Check...</span>
            </div>
        </div>
    );

    if (checkError) return (
        <div className="bg-red-50 border border-red-100 rounded-lg p-6 text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-red-700 font-semibold text-[13px] mb-3">{checkError}</p>
            <button onClick={onLoad} className="px-4 py-2 bg-red-600 text-white rounded-md text-[12px] font-bold hover:bg-red-700 transition-colors">
                Try Again
            </button>
        </div>
    );

    if (!checkData) return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin" />
                <span className="text-[13px] font-semibold text-slate-500">Loading Vehicle Check...</span>
            </div>
        </div>
    );

    const src = history || check;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[15px] font-bold text-slate-800">Vehicle Check</h2>
                    {limited && <p className="text-[11px] text-amber-600 font-semibold mt-0.5">⚠ Basic check only — upgrade AT account for full provenance data</p>}
                </div>
                <button onClick={() => setShowCheckHelp(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors bg-white shadow-sm">
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" /></svg>
                    Help
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left — Check Items */}
                <div className="lg:col-span-2 space-y-3">
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                        <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-4">Provenance Checks</h3>
                        <div className="space-y-2">
                            <CheckItem label="Not Stolen" ok={!(src?.stolen)} />
                            <CheckItem label="Not Scrapped" ok={!(src?.scrapped)} />
                            <CheckItem label="Not Imported" ok={!(src?.imported)} />
                            <CheckItem label="Not Exported" ok={!(src?.exported)} />
                            {check ? (
                                <>
                                    <CheckItem label={check.insuranceWriteoffCategory ? `Insurance Write-Off (Cat ${check.insuranceWriteoffCategory})` : 'No Insurance Write-Off'} ok={!check.insuranceWriteoffCategory} />
                                    <CheckItem label={check.mileageDiscrepancy ? 'Mileage Discrepancy Found' : 'No Mileage Discrepancy'} ok={!check.mileageDiscrepancy} />
                                    <CheckItem label={check.colourChanged ? 'Colour Changed' : 'No Colour Changes'} ok={!check.colourChanged} />
                                    <CheckItem label={check.registrationChanged ? 'Plate Changed' : 'No Plate Changes'} ok={!check.registrationChanged} />
                                    <CheckItem label={check.highRisk ? 'High Risk Markers Found' : 'No High Risk Markers'} ok={!check.highRisk} />
                                    <CheckItem label={check.privateFinance ? 'Outstanding Private Finance' : 'No Private Finance'} ok={!check.privateFinance} />
                                    <CheckItem label={check.tradeFinance ? 'Outstanding Trade Finance' : 'No Trade Finance'} ok={!check.tradeFinance} />
                                </>
                            ) : (
                                <>
                                    <CheckItem label="Write-Off" upgrade />
                                    <CheckItem label="Mileage Discrepancies" upgrade />
                                    <CheckItem label="Colour Changes" upgrade />
                                    <CheckItem label="Plate Changes" upgrade />
                                    <CheckItem label="High Risk Markers" upgrade />
                                    <CheckItem label="Private Finance" upgrade />
                                    <CheckItem label="Trade Finance" upgrade />
                                </>
                            )}
                            {motExpiry && (
                                <CheckItem label={`MOT ${motValid ? `Valid Until ${new Date(motExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Expired'}`} ok={motValid} />
                            )}
                        </div>
                    </div>

                </div>

                {/* Right — Your Checks / DVLA Info */}
                <div className="space-y-4">
                    {/* YOUR CHECKS — VIN, Engine number, V5C only */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                        <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-4">Your Checks</h3>
                        <div className="space-y-0">
                            <VinRow atVehicle={checkData?.vehicle} />
                            {checkData?.vehicle?.engineNumber && (
                                <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
                                    <span className="text-[11px] font-semibold text-slate-500">Engine number</span>
                                    <span className="text-[12px] font-bold text-slate-700 font-mono">{checkData.vehicle.engineNumber}</span>
                                </div>
                            )}
                            {src?.v5cs?.[0]?.issuedDate && (
                                <div className="flex justify-between items-center py-2.5">
                                    <span className="text-[11px] font-semibold text-slate-500">V5C log book date</span>
                                    <span className="text-[12px] font-bold text-slate-700">{new Date(src.v5cs[0].issuedDate).toLocaleDateString('en-GB')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* VEHICLE TAX — engine cap, CO2, first reg, fuel, body, colour */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                        <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-4">Vehicle Tax</h3>
                        <div className="space-y-0">
                            {/* Tax Status — from DVLA */}
                            <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
                                <span className="text-[11px] font-semibold text-slate-500">Tax Status</span>
                                {checkData?.dvlaTax?.taxStatus ? (
                                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${checkData.dvlaTax.taxStatus === 'Taxed' ? 'bg-emerald-500 text-white' :
                                        checkData.dvlaTax.taxStatus === 'SORN' ? 'bg-red-500 text-white' :
                                            'bg-amber-400 text-white'
                                        }`}>{checkData.dvlaTax.taxStatus}</span>
                                ) : <span className="text-[12px] font-bold text-slate-400">—</span>}
                            </div>
                            {/* Tax Due Date — from DVLA */}
                            <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
                                <span className="text-[11px] font-semibold text-slate-500">Tax Due Date</span>
                                <span className="text-[12px] font-bold text-slate-700">
                                    {checkData?.dvlaTax?.taxDueDate
                                        ? new Date(checkData.dvlaTax.taxDueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                        : '—'}
                                </span>
                            </div>
                            {[
                                ['Engine Capacity', dvla?.engineCapacityCC ? `${dvla.engineCapacityCC} cc` : (checkData?.dvlaTax?.engineCapacity ? `${checkData.dvlaTax.engineCapacity} cc` : (checkData?.vehicle?.engineCapacityCC ? `${checkData.vehicle.engineCapacityCC} cc` : '—'))],
                                ['CO2 Emissions', dvla?.co2EmissionsGKM ? `${dvla.co2EmissionsGKM} g/km` : (checkData?.dvlaTax?.co2Emissions ? `${checkData.dvlaTax.co2Emissions} g/km` : (checkData?.vehicle?.co2EmissionGPKM != null ? `${checkData.vehicle.co2EmissionGPKM} g/km` : '—'))],
                                ['First Registered', (() => { const d = checkData?.vehicle?.firstRegistrationDate; return d ? new Date(d).toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' }) : (vehicle?.year ? String(vehicle.year) : '—'); })()],
                            ].map(([label, val]) => (
                                <div key={label} className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
                                    <span className="text-[11px] font-semibold text-slate-500">{label}</span>
                                    <span className="text-[12px] font-bold text-slate-700">{val}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Keeper Changes */}
                    {(src?.previousOwners !== undefined || (src?.keeperChanges?.length > 0)) && (
                        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                            <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                {src.previousOwners ?? '?'} Previous Owner{src.previousOwners !== 1 ? 's' : ''}
                            </h3>
                            {src.keeperChanges?.length > 0 && (
                                <div className="mb-3">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Keeper Changes</div>
                                    <div className="space-y-1.5">
                                        {src.keeperChanges.map((kc: any, i: number) => (
                                            <div key={i} className="flex justify-between text-[11px]">
                                                <span className="text-slate-500">Change {src.keeperChanges.length - i}</span>
                                                <span className="font-semibold text-slate-700">{kc.dateOfLastKeeper ? new Date(kc.dateOfLastKeeper).toLocaleDateString('en-GB') : '—'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {src.v5cs?.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">V5C Log Book</div>
                                    {src.v5cs.map((v: any, i: number) => (
                                        <div key={i} className="text-[12px] font-semibold text-slate-700">{v.issuedDate ? new Date(v.issuedDate).toLocaleDateString('en-GB') : '—'}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Finance Agreements */}
                    {check?.financeAgreements?.length > 0 && (
                        <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-5">
                            <h3 className="text-[12px] font-bold text-red-600 uppercase tracking-widest mb-3">⚠ Finance Agreements</h3>
                            {check.financeAgreements.map((fa: any, i: number) => (
                                <div key={i} className="text-[11px] text-red-700 space-y-1">
                                    <div><span className="font-bold">Company:</span> {fa.company}</div>
                                    <div><span className="font-bold">Type:</span> {fa.type}</div>
                                    <div><span className="font-bold">Term:</span> {fa.term} months</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Report Timestamp */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                        <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-3">Report Timestamp</h3>
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-semibold text-slate-500">Data timestamp</span>
                            <span className="text-[12px] font-bold text-slate-700">{checkData?._fetchedAt ? new Date(checkData._fetchedAt).toLocaleString('en-GB') : new Date().toLocaleString('en-GB')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Full-width MOT History ─────────────────────── */}
            {motTests.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
                        <h3 className="text-[13px] font-bold text-slate-700 uppercase tracking-widest">MOT History</h3>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">From DVSA</span>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[#E2E8F0] bg-slate-50">
                                <th className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide w-32">Date</th>
                                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide w-24">Result</th>
                                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {motTests.map((mot: any, i: number) => {
                                const passed = mot.testResult === 'Passed';
                                const date = mot.completedDate ? new Date(mot.completedDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
                                const advisories = (mot.rfrAndComments || []).filter((r: any) => ['Advisory', 'ADVISORY', 'MINOR', 'Minor', 'User Entered', 'USER_ENTERED', 'PRS'].includes(r.type));
                                const fails = (mot.rfrAndComments || []).filter((r: any) => ['Fail', 'FAIL', 'Major', 'MAJOR', 'Dangerous', 'DANGEROUS'].includes(r.type));
                                const prevMot = motTests[i + 1];
                                const mileageDiff = mot.odometerValue && prevMot?.odometerValue
                                    ? mot.odometerValue - prevMot.odometerValue : null;
                                return (
                                    <tr key={i} className="align-top hover:bg-slate-50/50">
                                        <td className="px-5 py-3 text-[12px] font-semibold text-slate-600 whitespace-nowrap">{date}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${passed ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>{mot.testResult}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {mot.odometerValue && (
                                                <p className="text-[12px] text-slate-600 mb-1">
                                                    Mileage: <span className="font-semibold">{mot.odometerValue.toLocaleString()} {mot.odometerUnit || 'miles'}</span>
                                                    {mileageDiff != null && mileageDiff > 0 && (
                                                        <span className="ml-1 text-slate-400">(+{mileageDiff.toLocaleString()} miles)</span>
                                                    )}
                                                </p>
                                            )}
                                            {fails.length > 0 && (
                                                <div className="mt-1">
                                                    <p className="text-[10px] font-bold text-red-600 uppercase mb-1">MAJOR Notices</p>
                                                    <ul className="list-disc list-inside space-y-0.5">
                                                        {fails.map((f: any, j: number) => <li key={j} className="text-[11px] text-red-700">{f.text}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {advisories.length > 0 && (
                                                <div className="mt-1">
                                                    <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Advisory Notices</p>
                                                    <ul className="list-disc list-inside space-y-0.5">
                                                        {advisories.map((a: any, j: number) => <li key={j} className="text-[11px] text-amber-700">{a.text}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ─── Full-width UK Vehicle Tax ───────────────────── */}
            {vedData && (
                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                    <h3 className="text-[13px] font-bold text-slate-700 uppercase tracking-widest mb-4">UK Vehicle Tax</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                            { label: 'Single 12 Month Payment', value: vedData.single12 },
                            { label: 'Single 6 Month Payment',  value: vedData.single6 },
                            { label: '1 Month Direct Debit',    value: vedData.dd1 },
                            { label: '12 Month Direct Debit',   value: vedData.dd12 },
                            { label: '6 Month Direct Debit',    value: vedData.dd6 },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <p className="text-[11px] font-semibold text-slate-500 mb-0.5">{label}</p>
                                <p className="text-[15px] font-bold text-slate-800">{value}</p>
                            </div>
                        ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-4">Please verify amounts and notify us if incorrect.</p>
                </div>
            )}

            {/* ─── Vehicle Check Help Sidebar ─────────────────── */}
            {showCheckHelp && (
                <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowCheckHelp(false)}>
                    <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 bg-[#4D7CFF] text-white">
                            <div className="flex items-center gap-2">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" /></svg>
                                <div className="text-[14px] font-bold">Vehicle Check — Help</div>
                            </div>
                            <button onClick={() => setShowCheckHelp(false)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors text-white text-[12px]">✕</button>
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-700">

                            {/* Overview */}
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">Overview</h2>
                                <p className="text-[12px] leading-relaxed text-slate-600">
                                    The Vehicle Check section shows you a vehicle&apos;s history and background data. It combines data from <strong>AutoTrader</strong> and the <strong>DVLA VES API</strong> to give you a comprehensive provenance report — including stolen status, MOT history, keeper changes, VIN/engine details, and live tax data.
                                </p>
                            </div>

                            {/* Provenance Checks */}
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">✅ Provenance Checks</h2>
                                <ul className="space-y-2 text-[12px] text-slate-600">
                                    <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Not Stolen</strong> — cross-checked against the Police National Computer (PNC)</span></li>
                                    <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Not Scrapped</strong> — DVLA certificate of destruction check</span></li>
                                    <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Not Imported / Not Exported</strong> — vehicle movement flags</span></li>
                                    <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Not Written-Off</strong> — insurance write-off category (Cat A/B/S/N)</span></li>
                                    <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>No Mileage Discrepancies</strong> — compares MOT mileage readings</span></li>
                                    <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>No Colour Changes</strong> — flags if colour was officially changed</span></li>
                                    <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>No Plate Changes</strong> — flags personalised/transferred plates</span></li>
                                    <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>No High Risk Markers</strong> — police intelligence flags</span></li>
                                    <li className="flex gap-2"><span className="text-amber-500 font-bold">•</span><span><strong>Private/Trade Finance</strong> — outstanding finance check (requires Full Vehicle Check upgrade)</span></li>
                                </ul>
                                <p className="text-[11px] text-amber-600 bg-amber-50 rounded px-3 py-2 mt-3 border border-amber-100">⚠ By default only basic check data is available. For full provenance data (finance, high risk, write-off details) you need the <strong>Full Vehicle Check</strong> product on your AutoTrader account.</p>
                            </div>

                            {/* MOT History */}
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">🔧 MOT History</h2>
                                <ul className="space-y-2 text-[12px] text-slate-600">
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span>Full MOT test history sourced from <strong>DVSA</strong> (Driver and Vehicle Standards Agency)</span></li>
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span>Shows date, result (Pass/Fail), mileage, and mileage increase between tests</span></li>
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span>Fail details include advisory notes and failure reasons</span></li>
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span>MOT expiry date highlighted in the Provenance panel</span></li>
                                </ul>
                            </div>

                            {/* Your Checks */}
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">📋 Your Checks</h2>
                                <ul className="space-y-2 text-[12px] text-slate-600">
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>VIN (last 4 digits)</strong> — verify against the physical dashboard VIN plate</span></li>
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Engine Number</strong> — verify against the engine bay stamp</span></li>
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>V5C Log Book Date</strong> — date the current V5C was issued</span></li>
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Previous Keepers</strong> — number of previous registered keepers + first registration date + keeper change dates</span></li>
                                </ul>
                            </div>

                            {/* Vehicle Tax */}
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">🏛 Vehicle Tax (DVLA Live)</h2>
                                <ul className="space-y-2 text-[12px] text-slate-600">
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Tax Status</strong> — live from DVLA VES API (Taxed / SORN / Not Taxed)</span></li>
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Tax Due Date</strong> — when road tax expires</span></li>
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>Engine Capacity</strong> — in cc from DVLA registration record</span></li>
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>CO2 Emissions</strong> — g/km for tax band calculation</span></li>
                                    <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold">•</span><span><strong>First Registered</strong> — original UK registration month/year</span></li>
                                </ul>
                                <p className="text-[11px] text-slate-500 mt-2">Requires <code className="bg-slate-100 px-1 rounded">DVLA_API_KEY</code> environment variable set on the server.</p>
                            </div>

                            {/* Data Sources */}
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">📡 Data Sources</h2>
                                <div className="space-y-2 text-[12px] text-slate-600">
                                    <div className="flex gap-3 items-start"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold whitespace-nowrap">AutoTrader</span><span>Provenance checks, keeper history, plate/colour changes, MOT history, finance markers</span></div>
                                    <div className="flex gap-3 items-start"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold whitespace-nowrap">DVLA VES</span><span>Live tax status, tax due date, engine capacity, CO2, first registered</span></div>
                                    <div className="flex gap-3 items-start"><span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold whitespace-nowrap">DVSA</span><span>Full MOT test history with mileage and failure reasons</span></div>
                                </div>
                            </div>

                            {/* Refresh */}
                            <div>
                                <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">🔄 Data Refresh</h2>
                                <p className="text-[12px] text-slate-600 leading-relaxed">The check data is fetched fresh on every page load. A <strong>Report Timestamp</strong> is shown at the bottom of the check panel so you can see when the data was last retrieved. Click <strong>Refresh</strong> to force a new lookup.</p>
                            </div>

                            {/* Coming Soon */}
                            <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                                <div className="text-[12px] font-bold text-orange-700 mb-3">🚧 Coming Soon — Future Work</div>
                                <div className="space-y-3 text-[11px] text-orange-800">

                                    <div>
                                        <div className="font-bold mb-0.5">MotorCheck Integration</div>
                                        <div className="text-orange-700 leading-relaxed">Enable MotorCheck via <em>Business → Connect Services → Vehicle Data</em> on AutoTrader for even richer vehicle data including full HPI-style checks. <strong>Requires:</strong> MotorCheck connected service on AT account.</div>
                                    </div>

                                    <div>
                                        <div className="font-bold mb-0.5">Outstanding Finance (Full Report)</div>
                                        <div className="text-orange-700 leading-relaxed">Show full finance agreement details (lender name, agreement type, finance amount). Currently only shows a pass/fail flag. <strong>Requires:</strong> Full Vehicle Check product on AutoTrader.</div>
                                    </div>

                                    <div>
                                        <div className="font-bold mb-0.5">ULEZ / CAZ Compliance</div>
                                        <div className="text-orange-700 leading-relaxed">Show if the vehicle meets ULEZ (London) and Clean Air Zone standards based on engine/emission data. <strong>Requires:</strong> TfL/JAQU API integration using the vehicle&apos;s VRN.</div>
                                    </div>

                                    <div>
                                        <div className="font-bold mb-0.5">CAP / Glass&apos;s Valuation</div>
                                        <div className="text-orange-700 leading-relaxed">Show trade-in, retail, and private valuations inline. <strong>Requires:</strong> CAP HPI or Glass&apos;s API subscription + integration.</div>
                                    </div>

                                    <div>
                                        <div className="font-bold mb-0.5">Keeper Change Timeline</div>
                                        <div className="text-orange-700 leading-relaxed">Visual timeline showing all keeper change dates. Currently shows dates in a table. <strong>Requires:</strong> UI redesign of the keeper history panel.</div>
                                    </div>

                                    <div>
                                        <div className="font-bold mb-0.5">AT Ad Score — Vehicle Check Impact</div>
                                        <div className="text-orange-700 leading-relaxed">Show how many advert score points are gained by having a full vehicle check. <strong>Requires:</strong> AT Ad Score API endpoint (separate capability).</div>
                                    </div>

                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

/* ─── HistoryTab Component ──────────────────────────────────────────────── */
const CONDITION_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
const SERVICE_HISTORY_OPTIONS = ['Full service history', 'Full dealership history', 'Part service history', 'No service history'];

function calcWarrantyExpiry(regDate: string | undefined, months: number | string): string {
    if (!regDate || !months) return '';
    const m = parseInt(String(months));
    if (isNaN(m) || m <= 0) return '';
    const d = new Date(regDate);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + m);
    return d.toISOString().split('T')[0]; // yyyy-mm-dd
}

function calcRemainingMonths(expiry: string | undefined): number {
    if (!expiry) return 0;
    const e = new Date(expiry);
    const now = new Date();
    const diff = (e.getFullYear() - now.getFullYear()) * 12 + (e.getMonth() - now.getMonth());
    return Math.max(0, diff);
}

function HistoryTab({
    vehicle,
    saving,
    onSave,
    onVinFound,
}: {
    vehicle: VehicleDetail;
    saving: boolean;
    onSave: (fields: Record<string, any>) => void;
    onVinFound?: (vin: string, engineNumber?: string) => void;
}) {
    // Local state mirrors all history fields
    const [fields, setFields] = useState({
        previousOwners:          vehicle.previousOwners ?? '',
        numberOfKeys:            vehicle.numberOfKeys ?? '',
        v5Present:               vehicle.v5Present ?? true,
        year:                    vehicle.year || ((vehicle as any).dateOfRegistration ? new Date((vehicle as any).dateOfRegistration).getFullYear() : '') || '',
        condition:               vehicle.condition ?? 'Used',
        interiorCondition:       vehicle.interiorCondition ?? '',
        exteriorCondition:       vehicle.exteriorCondition ?? '',
        tyreCondition:           vehicle.tyreCondition ?? '',
        serviceHistory:          vehicle.serviceHistory ?? '',
        dateOfNextService:       vehicle.dateOfNextService ?? '',
        dateOfLastService:       vehicle.dateOfLastService ?? '',
        mileageAtLastService:    vehicle.mileageAtLastService ?? '',
        serviceNotes:            vehicle.serviceNotes ?? '',
        manufacturerWarrantyMonths: vehicle.manufacturerWarrantyMonths ?? '',
        manufacturerWarrantyExpiry: vehicle.manufacturerWarrantyExpiry ?? '',
        batteryWarrantyMonths:   vehicle.batteryWarrantyMonths ?? '',
        batteryWarrantyExpiry:   vehicle.batteryWarrantyExpiry ?? '',
        extendedWarrantyMonths:  vehicle.extendedWarrantyMonths ?? '',
        motExpiry:               vehicle.motExpiry ?? '',
        includes12MonthsMot:     vehicle.includes12MonthsMot ?? false,
        includesMotInsurance:    vehicle.includesMotInsurance ?? false,
    });

    const set = (k: string, v: any) => setFields(prev => ({ ...prev, [k]: v }));

    // Auto-calc manufacturer warranty expiry from reg year + months
    useEffect(() => {
        if (fields.manufacturerWarrantyMonths && vehicle.year) {
            // Use Jan 1 of reg year as base date
            const base = `${vehicle.year}-01-01`;
            const expiry = calcWarrantyExpiry(base, fields.manufacturerWarrantyMonths);
            if (expiry) set('manufacturerWarrantyExpiry', expiry);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields.manufacturerWarrantyMonths]);

    // Auto-calc battery warranty expiry
    useEffect(() => {
        if (fields.batteryWarrantyMonths && vehicle.year) {
            const base = `${vehicle.year}-01-01`;
            const expiry = calcWarrantyExpiry(base, fields.batteryWarrantyMonths);
            if (expiry) set('batteryWarrantyExpiry', expiry);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields.batteryWarrantyMonths]);

    // ── Auto-fill from AutoTrader vehicle-check data ─────────────────────────
    // Only fills fields that are currently empty — never overwrites saved data
    const [atFilled, setAtFilled] = useState(false);
    useEffect(() => {
        if (!vehicle.vrm || atFilled) return;
        fetch(`/api/vehicles/vehicle-check?vrm=${encodeURIComponent(vehicle.vrm)}`)
            .then(r => r.json())
            .then(d => {
                if (!d.ok) return;
                const motTests: any[] = d.motTests || [];
                const history = d.history || {};
                const latestMot = motTests[0]; // most recent MOT first

                setFields(prev => {
                    const next = { ...prev };

                    // Previous Owners — from AT history
                    if (!prev.previousOwners && history.previousOwners != null)
                        next.previousOwners = history.previousOwners;

                    // MOT Expiry — from latest MOT test
                    if (!prev.motExpiry && latestMot?.expiryDate)
                        next.motExpiry = latestMot.expiryDate.split('T')[0];

                    // Date of Last Service — use most recent passed MOT date as proxy
                    const latestPassed = motTests.find((m: any) => m.testResult === 'Passed');
                    if (!prev.dateOfLastService && latestPassed?.completedDate)
                        next.dateOfLastService = latestPassed.completedDate.split('T')[0];

                    // Mileage at Last Service — from most recent passed MOT
                    if (!prev.mileageAtLastService && latestPassed?.odometerValue)
                        next.mileageAtLastService = latestPassed.odometerValue;

                    // Date of Next Service — not available from AT
                    // No. of Keys — not available from AT

                    return next;
                });
                // VIN + Engine Number — propagate to parent if not already saved
                const vinFromCheck = d.vehicle?.vin || d.vin || '';
                const engFromCheck = d.vehicle?.engineNumber || '';
                const missingVin = !vehicle.vin && !!vinFromCheck;
                const missingEng = !vehicle.engineNumber && !!engFromCheck;
                if (onVinFound && (missingVin || missingEng)) {
                    onVinFound(missingVin ? vinFromCheck : '', missingEng ? engFromCheck : undefined);
                }

                setAtFilled(true);
            })
            .catch(() => {}); // silently fail — fields stay blank
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vehicle.vrm]);

    const mfgRemaining = calcRemainingMonths(fields.manufacturerWarrantyExpiry as string);
    const batRemaining = calcRemainingMonths(fields.batteryWarrantyExpiry as string);

    const handleSave = () => {
        const payload: Record<string, any> = {};
        for (const [k, v] of Object.entries(fields)) {
            if (v !== '' && v !== undefined && v !== null) payload[k] = v;
        }
        onSave(payload);
    };

    // ── MotorDesk-style sub-components ─────────────────────────────────────
    const MdLabel = ({ children }: { children: React.ReactNode }) => (
        <label className="block text-[12px] text-[#2B7CB5] mb-1">{children}</label>
    );
    const MdInput = ({ value, onChange, type = 'text' }: { value: any; onChange: (v: any) => void; type?: string }) => (
        <input
            type={type}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="w-full px-2 py-[5px] border border-[#c8ccd4] rounded text-[13px] text-slate-700 focus:outline-none focus:border-[#2B7CB5] bg-white"
        />
    );
    const MdSelect = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) => (
        <div className="relative">
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full px-2 py-[5px] border border-[#c8ccd4] rounded text-[13px] text-slate-700 focus:outline-none focus:border-[#2B7CB5] bg-white appearance-none cursor-pointer pr-6"
            >
                <option value="">Nothing selected</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
        </div>
    );
    const MdRadio = ({ value, onChange, options }: { value: any; onChange: (v: any) => void; options: { label: string; value: any }[] }) => (
        <div className="flex items-center gap-4 mt-1">
            {options.map(o => (
                <label key={String(o.value)} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={value === o.value} onChange={() => onChange(o.value)} className="w-3.5 h-3.5 accent-[#2B7CB5]" />
                    <span className="text-[13px] text-slate-700">{o.label}</span>
                </label>
            ))}
        </div>
    );
    const MdMonths = ({ value, onChange, readOnly = false }: { value: any; onChange?: (v: any) => void; readOnly?: boolean }) => (
        <div className="flex">
            <input
                type="number"
                value={value || ''}
                onChange={e => onChange && onChange(e.target.value)}
                readOnly={readOnly}
                className={`flex-1 min-w-0 px-2 py-[5px] border border-[#c8ccd4] rounded-l text-[13px] ${readOnly ? 'bg-[#f4f4f4] text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 focus:outline-none focus:border-[#2B7CB5]'}`}
            />
            <span className="px-2.5 flex items-center border border-l-0 border-[#c8ccd4] rounded-r bg-[#f4f4f4] text-[12px] text-slate-500 whitespace-nowrap">Months</span>
        </div>
    );
    const MdCard = ({ children }: { children: React.ReactNode }) => (
        <div className="bg-white border border-[#dde0e5] rounded">
            <div className="px-6 py-5">{children}</div>
        </div>
    );

    return (
        <div className="space-y-4 w-full">
            <h2 className="text-[15px] font-semibold text-slate-800 mb-1">Vehicle History</h2>

            {/* ── Section 1: Basic Info ─────────────────────────── */}
            <MdCard>
                <div className="grid grid-cols-4 gap-x-6 gap-y-4">
                    <div>
                        <MdLabel>Previous Owners</MdLabel>
                        <MdInput value={fields.previousOwners} onChange={v => set('previousOwners', v)} type="number" />
                    </div>
                    <div>
                        <MdLabel>No. of Keys</MdLabel>
                        <MdInput value={fields.numberOfKeys} onChange={v => set('numberOfKeys', v)} type="number" />
                    </div>
                    <div>
                        <MdLabel>V5 Present</MdLabel>
                        <MdRadio value={fields.v5Present} onChange={v => set('v5Present', v)} options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]} />
                    </div>
                    <div>
                        <MdLabel>Year of Manufacture</MdLabel>
                        <MdSelect value={String(fields.year || '')} onChange={v => set('year', v)} options={Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() - i))} />
                    </div>
                </div>
            </MdCard>

            {/* ── Section 2: Condition ─────────────────────────── */}
            <MdCard>
                <div className="grid grid-cols-4 gap-x-6 gap-y-4">
                    <div>
                        <MdLabel>Condition</MdLabel>
                        <MdRadio value={fields.condition} onChange={v => set('condition', v)} options={[{ label: 'Used', value: 'Used' }, { label: 'New', value: 'New' }]} />
                    </div>
                    <div>
                        <MdLabel>Interior Condition</MdLabel>
                        <MdSelect value={fields.interiorCondition as string} onChange={v => set('interiorCondition', v)} options={CONDITION_OPTIONS} />
                    </div>
                    <div>
                        <MdLabel>Exterior Condition</MdLabel>
                        <MdSelect value={fields.exteriorCondition as string} onChange={v => set('exteriorCondition', v)} options={CONDITION_OPTIONS} />
                    </div>
                    <div>
                        <MdLabel>Tyre Condition</MdLabel>
                        <MdSelect value={fields.tyreCondition as string} onChange={v => set('tyreCondition', v)} options={CONDITION_OPTIONS} />
                    </div>
                </div>
            </MdCard>

            {/* ── Section 3: Service History ───────────────────── */}
            <MdCard>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                        <MdLabel>Service History</MdLabel>
                        <MdSelect value={fields.serviceHistory as string} onChange={v => set('serviceHistory', v)} options={SERVICE_HISTORY_OPTIONS} />
                    </div>
                    <div>
                        <MdLabel>Date of Next Service</MdLabel>
                        <MdInput value={fields.dateOfNextService} onChange={v => set('dateOfNextService', v)} type="date" />
                    </div>
                    <div>
                        <MdLabel>Date of Last Service</MdLabel>
                        <MdInput value={fields.dateOfLastService} onChange={v => set('dateOfLastService', v)} type="date" />
                    </div>
                    <div>
                        <MdLabel>Mileage at Last Service</MdLabel>
                        <MdInput value={fields.mileageAtLastService} onChange={v => set('mileageAtLastService', v)} type="number" />
                    </div>
                    <div className="col-span-2">
                        <MdLabel>Service Notes</MdLabel>
                        <textarea
                            value={fields.serviceNotes as string}
                            onChange={e => set('serviceNotes', e.target.value)}
                            rows={3}
                            className="w-full px-2 py-[5px] border border-[#c8ccd4] rounded text-[13px] text-slate-700 focus:outline-none focus:border-[#2B7CB5] bg-white resize-y"
                        />
                    </div>
                </div>
            </MdCard>

            {/* ── Section 4: Warranty ──────────────────────────── */}
            <MdCard>
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-x-6">
                        <div>
                            <MdLabel>Manufacturer Warranty</MdLabel>
                            <MdMonths value={fields.manufacturerWarrantyMonths} onChange={v => set('manufacturerWarrantyMonths', v)} />
                        </div>
                        <div>
                            <MdLabel>Manufacturer Warranty Expiry</MdLabel>
                            <MdInput value={fields.manufacturerWarrantyExpiry} onChange={v => set('manufacturerWarrantyExpiry', v)} type="date" />
                        </div>
                        <div>
                            <MdLabel>Remaining Manufacturer Warranty</MdLabel>
                            <MdMonths value={mfgRemaining || ''} readOnly />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-x-6">
                        <div>
                            <MdLabel>Battery Warranty</MdLabel>
                            <MdMonths value={fields.batteryWarrantyMonths} onChange={v => set('batteryWarrantyMonths', v)} />
                        </div>
                        <div>
                            <MdLabel>Battery Warranty Expiry</MdLabel>
                            <MdInput value={fields.batteryWarrantyExpiry} onChange={v => set('batteryWarrantyExpiry', v)} type="date" />
                        </div>
                        <div>
                            <MdLabel>Remaining Battery Warranty</MdLabel>
                            <MdMonths value={batRemaining || ''} readOnly />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-x-6">
                        <div>
                            <MdLabel>Extended Warranty</MdLabel>
                            <MdMonths value={fields.extendedWarrantyMonths} onChange={v => set('extendedWarrantyMonths', v)} />
                        </div>
                    </div>
                </div>
            </MdCard>

            {/* ── Section 5: MOT ───────────────────────────────── */}
            <MdCard>
                <div className="grid grid-cols-3 gap-x-6">
                    <div>
                        <MdLabel>Date of MOT Expiry</MdLabel>
                        <MdInput value={fields.motExpiry} onChange={v => set('motExpiry', v)} type="date" />
                    </div>
                    <div>
                        <MdLabel>Includes 12 Months MOT</MdLabel>
                        <MdRadio value={fields.includes12MonthsMot} onChange={v => set('includes12MonthsMot', v)} options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]} />
                    </div>
                    <div>
                        <MdLabel>Includes MOT Insurance</MdLabel>
                        <MdRadio value={fields.includesMotInsurance} onChange={v => set('includesMotInsurance', v)} options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]} />
                    </div>
                </div>
            </MdCard>

            {/* ── Buttons ──────────────────────────────────────── */}
            <div className="flex items-center gap-3 pt-1">
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-[#2B7CB5] text-white text-[13px] font-semibold rounded hover:bg-[#1f6599] disabled:opacity-60 transition-colors">
                    {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-[#2B7CB5] text-white text-[13px] font-semibold rounded hover:bg-[#1f6599] disabled:opacity-60 transition-colors">
                    Save &amp; Next →
                </button>
            </div>
        </div>
    );
}

/* ─── OptionsTab Component ───────────────────────────────────────────────── */
const VEHICLE_OPTIONS_GROUPS = [
    {
        name: 'Audio and Communications',
        items: [
            { label: 'Satellite Navigation System', price: null },
            { label: 'Premium Sound System', price: null },
            { label: 'DAB Digital Radio', price: null },
            { label: 'Wireless Phone Charging', price: null },
            { label: 'Apple CarPlay / Android Auto', price: null },
            { label: 'Head Unit Display Upgrade', price: null },
        ],
    },
    {
        name: 'Drivers Assistance',
        items: [
            { label: 'Adaptive Cruise Control', price: null },
            { label: 'Parking Sensors - Front & Rear', price: null },
            { label: 'Parking Sensors - Rear', price: null },
            { label: 'Reversing Camera', price: null },
            { label: '360° Surround Camera System', price: null },
            { label: 'Blind Spot Warning', price: null },
            { label: 'Lane Departure Warning', price: null },
            { label: 'Traffic Sign Recognition', price: null },
        ],
    },
    {
        name: 'Exterior',
        items: [
            { label: 'Alloy Wheels - 17in', price: null },
            { label: 'Alloy Wheels - 18in', price: null },
            { label: 'Alloy Wheels - 19in', price: null },
            { label: 'Panoramic Sunroof', price: null },
            { label: 'Privacy Glass', price: null },
            { label: 'Tow Bar', price: null },
            { label: 'Roof Rails', price: null },
            { label: 'LED Lighting Package', price: null },
        ],
    },
    {
        name: 'Illumination',
        items: [
            { label: 'Adaptive LED Headlights', price: null },
            { label: 'Xenon Headlights', price: null },
            { label: 'Matrix LED Headlights', price: null },
        ],
    },
    {
        name: 'Interior',
        items: [
            { label: 'Heated Front Seats', price: null },
            { label: 'Heated Rear Seats', price: null },
            { label: 'Electric Front Seats', price: null },
            { label: 'Leather Upholstery', price: null },
            { label: 'Alcantara Upholstery', price: null },
            { label: 'Technology / Convenience Package', price: null },
            { label: 'Head-Up Display', price: null },
            { label: 'Ambient Lighting', price: null },
            { label: 'Electrically Adjustable Lumbar Support', price: null },
            { label: 'Heated Steering Wheel', price: null },
        ],
    },
    {
        name: 'Paint',
        items: [
            { label: 'Metallic Paint', price: null },
            { label: 'Premium Metallic Paint', price: null },
            { label: 'Solid Colour', price: null },
            { label: 'Specialist / Individual Paint', price: null },
        ],
    },
    {
        name: 'Safety and Security',
        items: [
            { label: 'Active Emergency Braking', price: null },
            { label: 'Driver Assistance Package', price: null },
            { label: 'Rear Side Airbags', price: null },
            { label: 'ISOFIX Child Seat Preparation', price: null },
            { label: 'Keyless Entry', price: null },
            { label: 'Alarm System Upgrade', price: null },
        ],
    },
    {
        name: 'Upholstery',
        items: [
            { label: 'Leather Seat Package', price: null },
            { label: 'Sport Seats', price: null },
            { label: 'Ventilated Front Seats', price: null },
            { label: 'Massaging Front Seats', price: null },
        ],
    },
];

const STANDARD_FEATURES_GROUPS = [
    {
        name: 'Audio and Communications',
        items: ['Bluetooth Interface', 'USB Connectivity', 'DAB Digital Radio', 'Multi-function Steering Wheel'],
    },
    {
        name: 'Exterior',
        items: ['Electric Windows - Front & Rear', 'Heated Rear Windscreen', 'Painted Body-Colour Bumpers'],
    },
    {
        name: 'Interior',
        items: ['Dual-Zone Climate Control', 'Start-Stop System', 'Front & Rear Floor Mats'],
    },
    {
        name: 'Safety and Security',
        items: ['ABS - Anti-Lock Braking System', 'ESP - Electronic Stability Programme', 'Driver & Passenger Airbags', 'ISOFIX Rear Child Seat Mounting', 'Remote Central Locking'],
    },
];


function formatPrice(p: number | null) {
    if (p === null) return '';
    return '£' + p.toLocaleString('en-GB', { minimumFractionDigits: 2 });
}

/* ─── Factory-Fit Detection Map ─────────────────────────────────────────────
 * For each supported UK manufacturer, list the option labels (or substrings)
 * that are typically factory-fitted.  Matching is case-insensitive substring.
 * Supported: BMW, MINI, Fiat, Abarth, Alfa Romeo, Jeep, Chrysler,
 *            Renault, Dacia, Alpine, Volvo
 * ─────────────────────────────────────────────────────────────────────────── */
const FACTORY_FIT_MAKES = [
    'BMW', 'MINI', 'Fiat', 'Abarth', 'Alfa Romeo', 'Jeep', 'Chrysler',
    'Renault', 'Dacia', 'Alpine', 'Volvo',
];

const FACTORY_FIT_MAP: Record<string, string[]> = {
    BMW: [
        'Satellite Navigation', 'Parking Sensor', 'Heated Seats',
        'Comfort Access', 'Cruise Control', 'LED Headlight',
        'Panoramic Sunroof', 'Rear View Camera', 'Bluetooth',
        'DAB', 'iDrive',
    ],
    MINI: [
        'Satellite Navigation', 'Heated Seats', 'Bluetooth',
        'DAB', 'Parking Sensor', 'Cruise Control', 'LED Headlight',
        'JCW Sport', 'Chili Pack',
    ],
    FIAT: [
        'Uconnect', 'Bluetooth', 'DAB', 'Parking Sensor',
        'Climate Control', 'Cruise Control', 'Rear Camera',
    ],
    ABARTH: [
        'Uconnect', 'Bluetooth', 'Parking Sensor', 'Sport Seats',
        'Carbon Fibre', 'Cruise Control',
    ],
    'ALFA ROMEO': [
        'Satellite Navigation', 'Leather Seats', 'Heated Seats',
        'Parking Sensor', 'Bluetooth', 'DAB', 'Cruise Control',
        'Rear Camera', 'Climate Control',
    ],
    JEEP: [
        'Satellite Navigation', 'Heated Seats', 'Parking Sensor',
        'Bluetooth', 'DAB', 'Cruise Control', 'Rear Camera',
        '4WD', 'Climate Control',
    ],
    CHRYSLER: [
        'Satellite Navigation', 'Heated Seats', 'Leather',
        'Bluetooth', 'Parking Sensor', 'Cruise Control',
    ],
    RENAULT: [
        'Satellite Navigation', 'Bluetooth', 'DAB',
        'Parking Sensor', 'Cruise Control', 'Climate Control',
        'Rear Camera', 'LED Headlight',
    ],
    DACIA: [
        'Bluetooth', 'DAB', 'Parking Sensor', 'Cruise Control',
        'Rear Camera',
    ],
    ALPINE: [
        'Satellite Navigation', 'Sport Seats', 'Parking Sensor',
        'Bluetooth', 'DAB', 'LED Headlight', 'Brembo',
    ],
    VOLVO: [
        'Satellite Navigation', 'Heated Seats', 'Leather',
        'Parking Sensor', 'Bluetooth', 'DAB', 'Cruise Control',
        'Rear Camera', 'LED Headlight', 'Pilot Assist',
        'Panoramic Sunroof', 'Climate Control',
    ],
};

/** Returns the list of option labels from VEHICLE_OPTIONS_GROUPS that are
 *  factory-fitted for the given make/model. Also merges in vehicle.features
 *  from AutoTrader so real AT data takes precedence. */
function detectFactoryFitOptions(
    make: string,
    vehicleFeatures: string[]
): Set<string> {
    const result = new Set<string>();
    const makeKey = make.trim().toUpperCase();
    const fitKeywords = FACTORY_FIT_MAP[makeKey] || [];

    // 1. Match using factory-fit keyword map
    VEHICLE_OPTIONS_GROUPS.forEach(g =>
        g.items.forEach(item => {
            const labelLower = item.label.toLowerCase();
            if (fitKeywords.some(kw => labelLower.includes(kw.toLowerCase()))) {
                result.add(item.label);
            }
        })
    );

    // 2. Also match against real AutoTrader vehicle.features strings
    if (vehicleFeatures.length > 0) {
        VEHICLE_OPTIONS_GROUPS.forEach(g =>
            g.items.forEach(item => {
                const labelLower = item.label.toLowerCase();
                if (vehicleFeatures.some(f => {
                    const fl = f.toLowerCase();
                    // Check both directions: label contains feature word, or feature contains label word
                    const labelWords = labelLower.split(' ').filter(w => w.length > 4);
                    return labelWords.some(w => fl.includes(w)) || labelLower.includes(fl.slice(0, 15));
                })) {
                    result.add(item.label);
                }
            })
        );
    }

    return result;
}

function OptionsTab({
    editAttentionGrabber, setEditAttentionGrabber,
    editLongAttentionGrabber, setEditLongAttentionGrabber,
    editDescription, setEditDescription,
    editDescription2, setEditDescription2,
    editFeatures, setEditFeatures,
    saving, onSave,
    vehicleMake, vehicleFeatures, vehicleVrm, vehicleInfo,
    atOptions,
    atStdFeatures,
    atFactoryFitted,
    atLoading,
    atHasData,
    editCustomFeatures,
    setEditCustomFeatures,
}: {
    editAttentionGrabber: string;
    setEditAttentionGrabber: (v: string) => void;
    editLongAttentionGrabber: string;
    setEditLongAttentionGrabber: (v: string) => void;
    editDescription: string;
    setEditDescription: (v: string) => void;
    editDescription2: string;
    setEditDescription2: (v: string) => void;
    editFeatures: string[];
    setEditFeatures: (v: string[]) => void;
    saving: boolean;
    onSave: () => void;
    vehicleMake?: string;
    vehicleFeatures?: string[];
    vehicleVrm?: string;
    atOptions: { name: string; price: number | null; fitted: boolean; category: string }[];
    atStdFeatures: { name: string; category: string }[];
    atFactoryFitted: Set<string>;
    atLoading: boolean;
    atHasData: boolean;
    editCustomFeatures: string[];
    setEditCustomFeatures: React.Dispatch<React.SetStateAction<string[]>>;
    vehicleInfo?: { mileage?: number; bhp?: number; year?: number; derivative?: string; ulezCompliant?: boolean };
}) {
    type ATOption = { name: string; price: number | null; fitted: boolean; category: string };
    const [factoryFitApplied, setFactoryFitApplied] = useState(false);

    // When AT factory-fit data arrives, show the banner once.
    useEffect(() => {
        if (atFactoryFitted.size > 0) setFactoryFitApplied(true);
    }, [atFactoryFitted]);

    // Effective factory-fit detection:
    // - Prefer AutoTrader per-vehicle factoryFitted list when available
    // - Otherwise fall back to our keyword-based make detection (MotorDesk-like)
    const effectiveFactoryFitted = useMemo<Set<string>>(() => {
        if (atFactoryFitted && atFactoryFitted.size > 0) return atFactoryFitted;
        const make = (vehicleMake || '').trim();
        if (!make) return new Set();
        // Only run fallback for known supported makes (keeps it predictable)
        const isSupported = FACTORY_FIT_MAKES.map(m => m.toUpperCase()).includes(make.toUpperCase());
        if (!isSupported) return new Set();
        return detectFactoryFitOptions(make, vehicleFeatures || []);
    }, [atFactoryFitted, vehicleMake, vehicleFeatures]);

    // Build dynamic groups from AT data; fall back to hardcoded if AT has nothing
    // usesATOptionals: show AT optional extras only if AT returned some Optional-type features
    const usesATOptionals = atOptions.length > 0;
    // usesATStandards: show AT standard features if AT returned ANY data at all
    const usesATStandards = atHasData && atStdFeatures.length > 0;

    const dynamicGroups = usesATOptionals
        ? (() => {
            const catMap: Record<string, ATOption[]> = {};
            atOptions.forEach(o => {
                const cat = o.category || 'General';
                if (!catMap[cat]) catMap[cat] = [];
                catMap[cat].push(o);
            });
            return Object.entries(catMap).map(([name, items]) => ({ name, items }));
        })()
        : VEHICLE_OPTIONS_GROUPS.map(g => ({
            name: g.name,
            items: g.items.map(i => ({
                name: i.label,
                price: i.price,
                fitted: !!(i as { label: string; price: number | null; defaultChecked?: boolean }).defaultChecked,
                category: g.name,
            })),
        }));

    const dynamicStdGroups = usesATStandards
        ? (() => {
            const catMap: Record<string, string[]> = {};
            atStdFeatures.forEach(f => {
                const cat = f.category || 'General';
                if (!catMap[cat]) catMap[cat] = [];
                catMap[cat].push(f.name);
            });
            return Object.entries(catMap).map(([name, items]) => ({ name, items }));
        })()
        : STANDARD_FEATURES_GROUPS;


    // ── Checked state ────────────────────────────────────────────────────────
    const buildInitialChecked = () => {
        const map: Record<string, boolean> = {};
        dynamicGroups.forEach(g => g.items.forEach(item => {
            const label = (item as any).name || (item as any).label;
            const wasSaved = (vehicleFeatures || []).includes(label);
            map[label] = wasSaved || effectiveFactoryFitted.has(label) || (item as any).fitted || false;
        }));
        // Include saved features (so we don't lose any prior selections)
        (vehicleFeatures || []).forEach(f => { if (!(f in map)) map[f] = true; });
        // Ensure manual custom features are present (and checked)
        (editCustomFeatures || []).forEach(f => { map[f] = true; });
        return map;
    };

    const [checked, setChecked] = useState<Record<string, boolean>>(() => buildInitialChecked());
    const [filter, setFilter] = useState('');
    const [showPrices, setShowPrices] = useState(false);
    const [showHelpDrawer, setShowHelpDrawer] = useState(false);
    const [standardOpen, setStandardOpen] = useState(true);
    const [customInput, setCustomInput] = useState('');

    // Keep parent `editFeatures` synced with checked options.
    // This is what gets PATCHed to `/api/vehicles` and then pushed to AutoTrader.
    useEffect(() => {
        const selected = Object.entries(checked)
            .filter(([_, v]) => v)
            .map(([k]) => k)
            .sort((a, b) => a.localeCompare(b));
        setEditFeatures(selected);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checked]);

    // Re-sync checked when AT data arrives
    useEffect(() => {
        if (!atHasData) return;
        setChecked(prev => {
            const map: Record<string, boolean> = { ...prev };
            dynamicGroups.forEach(g => g.items.forEach(item => {
                const label = (item as any).name || (item as any).label;
                if (!(label in map)) {
                    const wasSaved = (vehicleFeatures || []).includes(label);
                    map[label] = wasSaved || effectiveFactoryFitted.has(label) || (item as any).fitted || false;
                } else if (effectiveFactoryFitted.has(label)) {
                    map[label] = true;
                }
            }));
            // Also ensure any saved custom features remain checked
            (vehicleFeatures || []).forEach(f => { if (!(f in map)) map[f] = true; });
            return map;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [atHasData, effectiveFactoryFitted, vehicleFeatures]);

    // Long attention grabber is owned by the parent page state

    // Sales channel description linking:
    // - linked if description2 is empty OR equals description (normalized)
    // - once user edits sales description directly, it becomes unlinked
    const normalizeDesc = (s: string) => (s || '').replace(/\r\n/g, '\n');
    const [salesDescLinked, setSalesDescLinked] = useState(() => {
        const d1 = normalizeDesc(editDescription);
        const d2 = normalizeDesc(editDescription2);
        return !d2 || d2 === d1;
    });
    const salesDesc = salesDescLinked ? editDescription : editDescription2;

    const [isAutoDescribing, setIsAutoDescribing] = useState<string | null>(null);
    const [quickInsertOpen, setQuickInsertOpen] = useState(false);
    const [showAgModal, setShowAgModal] = useState(false);
    const [agCapitalise, setAgCapitalise] = useState(true);
    const [agUseCommas, setAgUseCommas] = useState(false);
    const [agCompact, setAgCompact] = useState(false);
    const [showLagModal, setShowLagModal] = useState(false);
    const [lagCapitalise, setLagCapitalise] = useState(false);
    const [lagUseCommas, setLagUseCommas] = useState(false);
    const [lagCompact, setLagCompact] = useState(false);
    const [doneField, setDoneField] = useState<'short' | 'long' | 'web' | null>(null);

    const markDone = (field: 'short' | 'long' | 'web') => {
        setDoneField(field);
        setTimeout(() => setDoneField(null), 3000);
    };

    // Short AG suggestions — abbreviated tokens, greedy fill up to 30 chars
    const agSuggestions = useMemo(() => {
        const abbrevMap: [string, string][] = [
            ['apple carplay', 'CARPLAY'], ['carplay', 'CARPLAY'],
            ['android auto', 'AND AUTO'],
            ['adaptive cruise control', 'ADAPT CRUISE'], ['cruise control', 'CRUISE CTRL'],
            ['full service history', 'FSH'], ['service history', 'SERV HIST'],
            ['satellite navigation', 'SAT NAV'], ['satnav', 'SAT NAV'], ['sat nav', 'SAT NAV'], ['navigation', 'NAV'],
            ['parking sensors', 'PARK SENS'], ['park assist', 'PARK ASST'],
            ['panoramic roof', 'PAN ROOF'], ['panoramic sunroof', 'PAN ROOF'], ['sunroof', 'SUNROOF'],
            ['heated seats', 'HTD SEATS'], ['heated front seats', 'HTD SEATS'],
            ['leather seats', 'LEATHER'], ['leather upholstery', 'LEATHER'],
            ['dab radio', 'DAB'], ['bluetooth', 'BLUETOOTH'],
            ['reverse camera', 'REV CAM'], ['rear camera', 'REV CAM'], ['reversing camera', 'REV CAM'],
            ['head up display', 'HUD'], ['head-up display', 'HUD'],
            ['alloy wheels', 'ALLOYS'], ['keyless entry', 'KEYLESS'], ['keyless start', 'KEYLESS'],
            ['lane assist', 'LANE ASST'], ['blind spot', 'BLIND SPOT'],
            ['wireless charging', 'WIRELESS'], ['power tailgate', 'PWR GATE'],
        ];
        const sep = agCompact ? '|' : agUseCommas ? ', ' : ' | ';
        const featureTokens: string[] = [];
        Object.entries(checked).filter(([_, v]) => v).forEach(([feat]) => {
            const lower = feat.toLowerCase();
            for (const [key, abbrev] of abbrevMap) {
                if (lower.includes(key)) { if (!featureTokens.includes(abbrev)) featureTokens.push(abbrev); return; }
            }
        });
        const dataTokens: string[] = [];
        if (vehicleInfo?.bhp) dataTokens.push(`${vehicleInfo.bhp} BHP`);
        if (vehicleInfo?.mileage) dataTokens.push(`${vehicleInfo.mileage.toLocaleString()} MI`);
        if (vehicleInfo?.ulezCompliant) dataTokens.push('ULEZ');
        if (vehicleInfo?.derivative) { const tok = vehicleInfo.derivative.split(' ')[0]?.toUpperCase(); if (tok && tok.length > 2) dataTokens.push(tok); }
        const allTokens = [...featureTokens, ...dataTokens];
        if (allTokens.length < 3) { ['FSH','SAT NAV','BLUETOOTH','ALLOYS','HTD SEATS','CRUISE CTRL','DAB','PARK SENS'].forEach(f => { if (!allTokens.includes(f)) allTokens.push(f); }); }
        const applyCase = (s: string) => agCapitalise ? s.toUpperCase() : s;
        const results: string[] = [];
        const seen = new Set<string>();
        const tryAdd = (toks: string[]) => {
            if (toks.length < 2) return;
            const s = applyCase(toks.join(sep));
            if (s.length <= 30 && !seen.has(s)) { seen.add(s); results.push(s); }
        };
        // Greedy: for each start, take as many tokens as fit within 30 chars
        for (let start = 0; start < allTokens.length && results.length < 8; start++) {
            const combo: string[] = [];
            for (let j = start; j < allTokens.length; j++) {
                const candidate = applyCase([...combo, allTokens[j]].join(sep));
                if (candidate.length <= 30) combo.push(allTokens[j]); else break;
            }
            tryAdd(combo);
            if (combo.length > 2) tryAdd([...combo].reverse());
            if (combo.length > 3) tryAdd(combo.slice(0, -1));
        }
        return results;
    }, [checked, vehicleInfo, agCapitalise, agUseCommas, agCompact]);

    // Long AG suggestions — full words, greedy fill up to 70 chars
    const lagSuggestions = useMemo(() => {
        const fullMap: [string, string][] = [
            ['apple carplay', 'Apple CarPlay'], ['carplay', 'Apple CarPlay'],
            ['android auto', 'Android Auto'],
            ['adaptive cruise control', 'Adaptive Cruise Control'], ['cruise control', 'Cruise Control'],
            ['full service history', 'Full Service History'], ['service history', 'Service History'],
            ['satellite navigation', 'Satellite Navigation'], ['satnav', 'Sat Nav'], ['sat nav', 'Sat Nav'], ['navigation', 'Navigation'],
            ['parking sensors', 'Parking Sensors'], ['park assist', 'Park Assist'],
            ['panoramic roof', 'Panoramic Roof'], ['panoramic sunroof', 'Panoramic Roof'], ['sunroof', 'Sunroof'],
            ['heated seats', 'Heated Seats'], ['heated front seats', 'Heated Seats'],
            ['leather seats', 'Leather Seats'], ['leather upholstery', 'Leather Seats'],
            ['dab radio', 'DAB Radio'], ['bluetooth', 'Bluetooth'],
            ['reverse camera', 'Reverse Camera'], ['rear camera', 'Reverse Camera'], ['reversing camera', 'Reverse Camera'],
            ['head up display', 'Head Up Display'], ['head-up display', 'Head Up Display'],
            ['alloy wheels', 'Alloys'], ['keyless entry', 'Keyless Entry'], ['keyless start', 'Keyless Start'],
            ['lane assist', 'Lane Assist'], ['blind spot', 'Blind Spot Monitoring'],
            ['wireless charging', 'Wireless Charging'], ['power tailgate', 'Power Tailgate'],
        ];
        const sep = lagCompact ? '|' : lagUseCommas ? ', ' : ' | ';
        const featureTokens: string[] = [];
        Object.entries(checked).filter(([_, v]) => v).forEach(([feat]) => {
            const lower = feat.toLowerCase();
            for (const [key, full] of fullMap) {
                if (lower.includes(key)) { if (!featureTokens.includes(full)) featureTokens.push(full); return; }
            }
        });
        const dataTokens: string[] = [];
        if (vehicleInfo?.derivative) dataTokens.push(vehicleInfo.derivative);
        if (vehicleInfo?.bhp) dataTokens.push(`${vehicleInfo.bhp} BHP`);
        if (vehicleInfo?.mileage) dataTokens.push(`${vehicleInfo.mileage.toLocaleString()} Miles`);
        if (vehicleInfo?.ulezCompliant) dataTokens.push('ULEZ Compliant');
        const allTokens = [...featureTokens, ...dataTokens];
        if (allTokens.length < 4) { ['Cruise Control','Satellite Navigation','Bluetooth','Alloys','Heated Seats','DAB Radio','Parking Sensors','Reverse Camera'].forEach(f => { if (!allTokens.includes(f)) allTokens.push(f); }); }
        const applyCase = (s: string) => lagCapitalise ? s.toUpperCase() : s;
        const results: string[] = [];
        const seen = new Set<string>();
        const tryAdd = (toks: string[]) => {
            if (toks.length < 3) return;
            const s = applyCase(toks.join(sep));
            if (s.length <= 70 && !seen.has(s)) { seen.add(s); results.push(s); }
        };
        for (let start = 0; start < allTokens.length && results.length < 8; start++) {
            const combo: string[] = [];
            for (let j = start; j < allTokens.length; j++) {
                const candidate = applyCase([...combo, allTokens[j]].join(sep));
                if (candidate.length <= 70) combo.push(allTokens[j]); else break;
            }
            tryAdd(combo);
            if (combo.length > 3) tryAdd([...combo].reverse());
            if (combo.length > 4) tryAdd(combo.slice(0, -1));
            if (combo.length > 4) tryAdd(combo.slice(1));
        }
        return results;
    }, [checked, vehicleInfo, lagCapitalise, lagUseCommas, lagCompact]);

    const handleAutoDescribe = (target: 'web') => {
        setIsAutoDescribing(target);
        setTimeout(() => {
            const checkedList = Object.entries(checked).filter(([_, v]) => v).map(([k]) => `• ${k}`).join('\n');
            setEditDescription(`Beautiful ${vehicleMake || ''} with a full service history and long MOT.\n\nKey features include:\n${checkedList}`);
            setIsAutoDescribing(null);
            markDone(target);
        }, 1500);
    };

    const formatCase = (type: 'upper' | 'title' | 'lower') => {
        if (type === 'upper') setEditAttentionGrabber(editAttentionGrabber.toUpperCase());
        if (type === 'lower') setEditAttentionGrabber(editAttentionGrabber.toLowerCase());
        if (type === 'title') {
            setEditAttentionGrabber(editAttentionGrabber.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '));
        }
    };

    const toggleItem = (label: string) => {
        setChecked(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const setGroupAll = (groupName: string, value: boolean) => {
        const group = dynamicGroups.find(g => g.name === groupName);
        if (!group) return;
        const updates: Record<string, boolean> = {};
        group.items.forEach(item => { updates[(item as any).name || (item as any).label] = value; });
        setChecked(prev => ({ ...prev, ...updates }));
    };

    const totalCost = dynamicGroups.reduce((acc, g) => {
        return acc + g.items.reduce((a, item) => {
            const label = (item as any).name || (item as any).label;
            const price = (item as any).price;
            return a + (checked[label] && price ? price : 0);
        }, 0);
    }, 0);

    const filteredGroups = filter.trim()
        ? dynamicGroups
            .map(g => ({
                ...g,
                items: g.items.filter(item => {
                    const label = (item as any).name || (item as any).label;
                    return label.toLowerCase().includes(filter.toLowerCase());
                }),
            }))
            .filter(g => g.items.length > 0)
        : dynamicGroups;

    const knownLabels = useMemo(() => {
        const s = new Set<string>();
        dynamicGroups.forEach(g => g.items.forEach(item => s.add((item as any).name || (item as any).label)));
        return s;
    }, [dynamicGroups]);

    const customLabels = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return (editCustomFeatures || [])
            .map(s => s.trim())
            .filter(Boolean)
            .filter(k => !q || k.toLowerCase().includes(q))
            .sort((a, b) => a.localeCompare(b));
    }, [editCustomFeatures, filter]);

    const displayGroups = useMemo(() => {
        const groups: any[] = [];
        if (customLabels.length > 0) {
            groups.push({
                name: 'Custom Options',
                items: customLabels.map(l => ({ name: l, price: null, fitted: false })),
                isCustom: true,
            });
        }
        groups.push(...filteredGroups);
        return groups;
    }, [customLabels, filteredGroups]);

    // Search suggestions from AutoTrader/generic option list
    const optionSuggestions = useMemo(() => {
        const q = customInput.trim().toLowerCase();
        if (!q) return [];
        // Search across ALL known option labels (from dynamicGroups)
        const all = Array.from(knownLabels);
        const hits = all
            .filter(l => l.toLowerCase().includes(q))
            // Prefer not-yet-selected options first
            .sort((a, b) => {
                const aChecked = !!checked[a];
                const bChecked = !!checked[b];
                if (aChecked !== bChecked) return aChecked ? 1 : -1;
                return a.localeCompare(b);
            });
        return hits.slice(0, 12);
    }, [customInput, knownLabels, checked]);

    const addFromSuggestionsOrCustom = () => {
        const label = customInput.trim().replace(/\s+/g, ' ');
        if (!label) return;

        // If user typed an exact known option label, just select it (NOT custom)
        if (knownLabels.has(label)) {
            setChecked(prev => ({ ...prev, [label]: true }));
            setCustomInput('');
            return;
        }

        // If the user typed something that matches exactly one suggestion, select that
        if (optionSuggestions.length === 1) {
            const suggested = optionSuggestions[0];
            setChecked(prev => ({ ...prev, [suggested]: true }));
            setCustomInput('');
            return;
        }

        // Otherwise treat as true custom option
        addCustomOption();
    };

    const addCustomOption = () => {
        const label = customInput.trim().replace(/\s+/g, ' ');
        if (!label) return;
        setChecked(prev => ({ ...prev, [label]: true }));
        setEditCustomFeatures((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            if (list.includes(label)) return list;
            return [...list, label].sort((a, b) => a.localeCompare(b));
        });
        setCustomInput('');
    };

    const removeCustomOption = (label: string) => {
        setEditCustomFeatures((prev) => (prev || []).filter((x: string) => x !== label));
        setChecked(prev => {
            const next = { ...prev };
            delete next[label];
            return next;
        });
    };


    return (
        <div className="space-y-5 w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold text-slate-800">Vehicle Options &amp; Description</h2>
            </div>

            {/* Loading state */}
            {atLoading && (
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="w-4 h-4 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <p className="text-[12px] text-blue-700 font-medium">Fetching {vehicleMake} options from AutoTrader...</p>
                </div>
            )}

            {/* Factory-fit detection banner — only when AT data has factory-fit info */}
            {!atLoading && factoryFitApplied && atFactoryFitted.size > 0 && (
                <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-[#4D7CFF] flex items-center justify-center flex-shrink-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-[12px] font-bold text-blue-800">
                            Factory-Fit Auto-Detection Active — {vehicleMake}
                        </p>
                        <p className="text-[11px] text-blue-600 mt-0.5 leading-relaxed">
                            {atFactoryFitted.size} optional extra(s) have been automatically pre-selected based on AutoTrader&apos;s factory-fit data. Please review and adjust as needed.
                        </p>
                    </div>
                    <button
                        onClick={() => setFactoryFitApplied(false)}
                        className="text-blue-400 hover:text-blue-600 text-[14px] transition-colors flex-shrink-0 mt-0.5"
                        title="Dismiss"
                    >✕</button>
                </div>
            )}

            {/* No AT data fallback notice */}
            {!atLoading && !atHasData && vehicleMake && vehicleVrm && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    AutoTrader did not return optional extras for this vehicle. Showing a generic list — please review manually.
                </div>
            )}

            {/* Section 1 — Options & Upgrades */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden">


                <div className="border-b border-[#E2E8F0]">
                    <div className="px-5 py-3 flex items-center justify-between border-b border-[#E2E8F0]">
                        <span className="text-[13px] font-bold text-slate-700">Options &amp; Upgrades</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowPrices(p => !p)}
                                className="flex items-center gap-2 px-3 py-1.5 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors bg-white shadow-sm"
                            >
                                {showPrices ? 'Hide Prices' : 'Show Prices'}
                            </button>
                            <button
                                onClick={() => setShowHelpDrawer(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 border rounded text-[11px] font-bold transition-colors shadow-sm ${showHelpDrawer ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-[#E2E8F0] text-slate-500 hover:bg-slate-50'}`}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                Help
                            </button>
                        </div>
                    </div>
                    <input
                        type="text"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="Start typing to filter..."
                        className="w-full px-5 py-3 text-[13px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] border-0 border-b border-[#E2E8F0] transition-colors placeholder-slate-400"
                    />
                </div>

                {/* Add custom option (manual entry) */}
                <div className="px-5 py-3 border-b border-[#E2E8F0] bg-white">
                    <div className="flex items-center gap-3 relative">
                        <input
                            type="text"
                            value={customInput}
                            onChange={e => setCustomInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addFromSuggestionsOrCustom();
                                }
                            }}
                            placeholder="Search an option and press Enter to select (or type custom)..."
                            className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded text-[12px] text-slate-700 focus:outline-none focus:border-[#4D7CFF] placeholder-slate-400"
                        />
                        <button
                            onClick={addFromSuggestionsOrCustom}
                            disabled={!customInput.trim()}
                            className="px-3 py-2 bg-slate-100 text-slate-600 rounded text-[11px] font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                        >
                            Add
                        </button>
                    </div>
                    {/* Suggestions dropdown */}
                    {optionSuggestions.length > 0 && (
                        <div className="mt-2 bg-white border border-[#E2E8F0] rounded-md shadow-sm overflow-hidden">
                            {optionSuggestions.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => {
                                        setChecked(prev => ({ ...prev, [s]: true }));
                                        setCustomInput('');
                                    }}
                                    className="w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 flex items-center justify-between"
                                >
                                    <span className="text-slate-700">{s}</span>
                                    {checked[s] && <span className="text-[10px] font-bold text-emerald-600">Selected</span>}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="text-[10px] text-slate-400 mt-1">
                        Search from the list above. If it doesn&apos;t exist, type it and add as a custom option.
                    </div>
                </div>

                <div className="relative group/scroll">
                    <div id="options-scroll-area" className="overflow-y-auto scroll-smooth" style={{ maxHeight: 520 }}>
                        {displayGroups.map((group: any) => {
                            const groupItems: { label: string; price: number | null; fitted: boolean }[] = group.items.map((item: any) => ({
                                label: (item as any).name || (item as any).label,
                                price: (item as any).price as number | null,
                                fitted: (item as any).fitted as boolean,
                            }));
                            const allChecked = groupItems.every((item) => checked[item.label]);
                            const noneChecked = groupItems.every((item) => !checked[item.label]);
                            return (
                                <div key={group.name}>
                                    {/* Group header */}
                                    <div className="flex items-center justify-between px-5 py-2 bg-slate-50 border-b border-[#E2E8F0]">
                                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{group.name}</span>
                                        <div className="flex items-center gap-1 text-[11px]">
                                            <button
                                                onClick={() => setGroupAll(group.name, true)}
                                                className={`font-semibold transition-colors ${allChecked ? 'text-[#4D7CFF]' : 'text-slate-400 hover:text-[#4D7CFF]'}`}
                                            >Select All</button>
                                            <span className="text-slate-300">/</span>
                                            <button
                                                onClick={() => setGroupAll(group.name, false)}
                                                className={`font-semibold transition-colors ${noneChecked ? 'text-[#4D7CFF]' : 'text-slate-400 hover:text-[#4D7CFF]'}`}
                                            >None</button>
                                        </div>
                                    </div>
                                    {/* Items — 2-col grid */}
                                    <div className="grid grid-cols-2 divide-x divide-[#F1F5F9]">
                                        {groupItems.map((item) => (
                                            <label
                                                key={item.label}
                                                className="flex items-center justify-between px-5 py-2.5 cursor-pointer hover:bg-blue-50/40 transition-colors border-b border-[#F1F5F9]"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div
                                                        onClick={() => toggleItem(item.label)}
                                                        className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors cursor-pointer ${checked[item.label] ? 'bg-[#4D7CFF] border-[#4D7CFF]' : 'bg-white border-slate-300'}`}
                                                    >
                                                        {checked[item.label] && (
                                                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                                                                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <span className="text-[12px] text-slate-700 truncate">{item.label}</span>
                                                    {effectiveFactoryFitted.has(item.label) && (
                                                        <span className="text-[9px] font-bold text-[#4D7CFF] bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded flex-shrink-0">FITTED</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                                                    {showPrices && item.price !== null && item.price > 0 && (
                                                        <span className="text-[12px] font-semibold text-slate-500">{formatPrice(item.price)}</span>
                                                    )}
                                                    {(group as any).isCustom && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeCustomOption(item.label); }}
                                                            className="text-[12px] font-bold text-slate-300 hover:text-red-500 transition-colors"
                                                            title="Remove custom option"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                        {/* Pad odd-count groups */}
                                        {groupItems.length % 2 !== 0 && (
                                            <div className="border-b border-[#F1F5F9]" />
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                    </div>

                    {/* Scroll Arrows */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-100 pointer-events-none">
                        <button
                            onClick={() => document.getElementById('options-scroll-area')?.scrollBy({ top: -100, behavior: 'smooth' })}
                            className="p-1 bg-white border border-slate-200 rounded shadow-md pointer-events-auto hover:bg-slate-50 text-slate-400 hover:text-slate-600"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6" /></svg>
                        </button>
                        <button
                            onClick={() => document.getElementById('options-scroll-area')?.scrollBy({ top: 100, behavior: 'smooth' })}
                            className="p-1 bg-white border border-slate-200 rounded shadow-md pointer-events-auto hover:bg-slate-50 text-slate-400 hover:text-slate-600"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                    </div>
                </div>



                {/* Total */}
                <div className="px-5 py-3 border-t border-[#E2E8F0] flex justify-end bg-slate-50">
                    <span className="text-[13px] font-bold text-slate-800">
                        Total Cost of Selected Options:&nbsp;
                        <span className="text-[#4D7CFF]">{formatPrice(totalCost)}</span>
                    </span>
                </div>
            </div>

            {/* Section 2 — Standard Features */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden">
                <button
                    onClick={() => setStandardOpen(o => !o)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                    <span className="text-[13px] font-bold text-slate-700">Standard Features</span>
                    <svg
                        width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        className={`transition-transform duration-200 text-slate-400 ${standardOpen ? 'rotate-180' : ''}`}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {standardOpen && (
                    <div className="border-t border-[#E2E8F0] overflow-y-auto" style={{ maxHeight: 420 }}>
                        {dynamicStdGroups.map(group => (
                            <div key={group.name}>
                                <div className="flex items-center justify-between px-5 py-2 bg-slate-50 border-b border-[#E2E8F0]">
                                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{group.name}</span>
                                </div>
                                <div className="grid grid-cols-2 divide-x divide-[#F1F5F9]">
                                    {group.items.map((item) => (
                                        <div key={item} className="flex items-center gap-3 px-5 py-2.5 border-b border-[#F1F5F9]">
                                            <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border bg-[#4D7CFF] border-[#4D7CFF]">
                                                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                                                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                            <span className="text-[12px] text-slate-700">{item}</span>
                                        </div>
                                    ))}
                                    {group.items.length % 2 !== 0 && <div className="border-b border-[#F1F5F9]" />}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Section 3 — Short Attention Grabber */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <label className="text-[13px] font-bold text-slate-700">Short Attention Grabber</label>
                        <div className="flex items-center bg-slate-100 rounded p-0.5 border border-slate-200">
                            <button onClick={() => formatCase('upper')} className="px-1.5 py-0.5 text-[9px] font-bold text-slate-500 hover:text-[#4D7CFF] hover:bg-white rounded transition-all">ABC</button>
                            <button onClick={() => formatCase('title')} className="px-1.5 py-0.5 text-[9px] font-bold text-slate-500 hover:text-[#4D7CFF] hover:bg-white rounded transition-all">Abc</button>
                            <button onClick={() => formatCase('lower')} className="px-1.5 py-0.5 text-[9px] font-bold text-slate-500 hover:text-[#4D7CFF] hover:bg-white rounded transition-all">abc</button>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAgModal(true)}
                        className={`px-3 py-1.5 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${doneField === 'short' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        {doneField === 'short' ? (
                            <><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Done!</>
                        ) : 'Auto-Describe'}
                    </button>
                </div>
                <input
                    type="text"
                    value={editAttentionGrabber || 'Satnav, Bluetooth, 17in Alloys'}
                    maxLength={30}
                    onChange={e => setEditAttentionGrabber(e.target.value)}
                    className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-[#4D7CFF] transition-colors"
                />
                <div className="text-right text-[11px] text-slate-400 mt-1">
                    {(editAttentionGrabber || 'Satnav, Bluetooth, 17in Alloys').length} of 30 characters
                </div>
            </div>

            {/* Section 4 — Long Attention Grabber */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <label className="text-[13px] font-bold text-slate-700">Long Attention Grabber</label>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="text-slate-400">
                            <circle cx="12" cy="12" r="10" strokeWidth="2" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
                        </svg>
                    </div>
                    <button
                        onClick={() => setShowLagModal(true)}
                        className={`px-3 py-1.5 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${doneField === 'long' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        {doneField === 'long' ? <><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Done!</> : 'Auto-Describe'}
                    </button>
                </div>
                <input
                    type="text"
                    value={editLongAttentionGrabber}
                    maxLength={70}
                    onChange={e => setEditLongAttentionGrabber(e.target.value)}
                    placeholder="If left blank, Short Attention Grabber will be used automatically"
                    className="w-full border border-[#E2E8F0] rounded px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-[#4D7CFF] transition-colors placeholder-slate-300"
                />
                <div className="flex items-center justify-between mt-1">
                    {!editLongAttentionGrabber && editAttentionGrabber && (
                        <span className="text-[11px] text-slate-400 italic">Will use: &quot;{editAttentionGrabber}&quot;</span>
                    )}
                    {!(!editLongAttentionGrabber && editAttentionGrabber) && <span />}
                    <span className="text-[11px] text-slate-400">{editLongAttentionGrabber.length} of 70 characters</span>
                </div>
            </div>

            {/* Section 5 — Website Description */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                    <label className="text-[13px] font-bold text-slate-700">Website Description</label>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleAutoDescribe('web')}
                            disabled={isAutoDescribing === 'web'}
                            className={`px-3 py-1.5 rounded text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${doneField === 'web' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {isAutoDescribing === 'web' ? <div className="w-3 h-3 border-2 border-[#4D7CFF] border-t-transparent rounded-full animate-spin" /> : doneField === 'web' ? <><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>Done!</> : 'Auto-Describe'}
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setQuickInsertOpen(!quickInsertOpen)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-[11px] font-semibold hover:bg-slate-200 transition-colors flex items-center gap-1"
                            >
                                Quick Insert
                                <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {quickInsertOpen && (
                                <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E2E8F0] rounded-md shadow-lg z-50 py-1">
                                    <button className="w-full text-left px-4 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors">Our History</button>
                                    <button className="w-full text-left px-4 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors">Warranty Details</button>
                                    <button className="w-full text-left px-4 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors border-t border-[#F1F5F9] font-bold text-[#4D7CFF]">Manage Inserts</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Rich text toolbar */}
                <div className="flex flex-wrap items-center gap-0.5 p-2 border border-[#E2E8F0] border-b-0 rounded-t bg-slate-50">
                    {[
                        { icon: 'B', title: 'Bold', cls: 'font-black' },
                        { icon: 'I', title: 'Italic', cls: 'italic' },
                        { icon: 'U', title: 'Underline', cls: 'underline' },
                        { icon: 'S̶', title: 'Strikethrough', cls: '' },
                    ].map(btn => (
                        <button key={btn.title} title={btn.title} className={`w-7 h-7 flex items-center justify-center text-[12px] text-slate-600 rounded hover:bg-slate-200 transition-colors ${btn.cls}`}>{btn.icon}</button>
                    ))}
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    {['≡', '≡', '≡'].map((icon, i) => (
                        <button key={i} className="w-7 h-7 flex items-center justify-center text-[14px] text-slate-600 rounded hover:bg-slate-200 transition-colors">{icon}</button>
                    ))}
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    <button className="w-7 h-7 flex items-center justify-center text-[12px] text-slate-600 rounded hover:bg-slate-200 transition-colors">≔</button>
                    <button className="w-7 h-7 flex items-center justify-center text-[12px] text-slate-600 rounded hover:bg-slate-200 transition-colors">⁙</button>
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    <button className="w-7 h-7 flex items-center justify-center text-[11px] text-slate-600 rounded hover:bg-slate-200 transition-colors">🔗</button>
                    <button className="w-7 h-7 flex items-center justify-center text-[11px] text-slate-600 rounded hover:bg-slate-200 transition-colors">🖼</button>
                    <button className="w-7 h-7 flex items-center justify-center text-[11px] text-slate-600 rounded hover:bg-slate-200 transition-colors font-bold" style={{ color: '#4D7CFF' }}>A</button>
                    <button className="w-7 h-7 flex items-center justify-center text-[12px] text-slate-600 rounded hover:bg-slate-200 transition-colors">Ω</button>
                    <button className="w-7 h-7 flex items-center justify-center text-[11px] text-slate-600 rounded hover:bg-slate-200 transition-colors">⛶</button>
                </div>
                <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    rows={7}
                    className="w-full border border-[#E2E8F0] rounded-b px-4 py-3 text-[13px] text-slate-800 focus:outline-none focus:border-[#4D7CFF] transition-colors resize-none leading-relaxed font-[inherit]"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">Hold CTRL + right-click to correct spelling errors.</p>
            </div>

            {/* Section 6 — Sales Channels Description */}
            <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <label className="text-[13px] font-bold text-slate-700">Sales Channels Description</label>
                        {salesDescLinked ? (
                            <span className="text-[10px] font-bold text-[#4D7CFF] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">🔗 Linked to Website</span>
                        ) : (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">⚡ Unlinked</span>
                        )}
                    </div>
                    <button
                        onClick={() => {
                            setSalesDescLinked(true);
                            setEditDescription2(editDescription);
                        }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-[11px] font-semibold hover:bg-slate-200 transition-colors"
                    >Copy Website Description</button>
                </div>
                {salesDescLinked && (
                    <p className="text-[11px] text-slate-400 mb-2 italic">This is linked to your Website Description. Edit below to unlink permanently.</p>
                )}
                <textarea
                    value={salesDesc}
                    onChange={e => {
                        if (salesDescLinked) {
                            setSalesDescLinked(false);
                            setEditDescription2(e.target.value);
                        } else {
                            setEditDescription2(e.target.value);
                        }
                    }}
                    rows={6}
                    maxLength={3000}
                    className="w-full border border-[#E2E8F0] rounded px-4 py-3 text-[13px] text-slate-800 focus:outline-none focus:border-[#4D7CFF] transition-colors resize-none leading-relaxed"
                />
                <div className="text-right text-[11px] text-slate-400 mt-1">{salesDesc.length} of 3000 characters</div>
            </div>

            {/* Bottom Buttons */}
            <div className="flex gap-3 pb-4">
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-[#4D7CFF] text-white rounded-md font-bold text-[13px] hover:bg-blue-600 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                    {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Save
                </button>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-[#4D7CFF] text-white rounded-md font-bold text-[13px] hover:bg-blue-600 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                    Save &amp; Next →
                </button>
            </div>

            {/* Attention Grabber Modal */}
            {showAgModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowAgModal(false)}>
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[15px] font-bold text-slate-800">Choose Short Attention Grabber</h3>
                            <button onClick={() => setShowAgModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-[14px] transition-colors">✕</button>
                        </div>
                        <div className="space-y-2 mb-5">
                            {agSuggestions.length === 0 ? (
                                <p className="text-[12px] text-slate-400 text-center py-4">No suggestions — add vehicle features and check them first.</p>
                            ) : agSuggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setEditAttentionGrabber(s);
                                        setShowAgModal(false);
                                        markDone('short');
                                    }}
                                    className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg text-[13px] font-bold text-[#4D7CFF] hover:border-[#4D7CFF] hover:bg-blue-50 transition-all text-center"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-5 py-3 border-t border-[#E2E8F0]">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={agCapitalise} onChange={e => setAgCapitalise(e.target.checked)} className="w-4 h-4 accent-[#4D7CFF]" />
                                <span className="text-[12px] text-slate-600">Capitalise</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={agUseCommas} onChange={e => setAgUseCommas(e.target.checked)} className="w-4 h-4 accent-[#4D7CFF]" />
                                <span className="text-[12px] text-slate-600">Use Commas</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={agCompact} onChange={e => setAgCompact(e.target.checked)} className="w-4 h-4 accent-[#4D7CFF]" />
                                <span className="text-[12px] text-slate-600">Compact</span>
                            </label>
                        </div>
                        <div className="flex justify-end mt-4">
                            <button onClick={() => setShowAgModal(false)} className="px-5 py-2 bg-slate-200 text-slate-700 rounded-lg text-[12px] font-semibold hover:bg-slate-300 transition-colors">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Long Attention Grabber Modal */}
            {showLagModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowLagModal(false)}>
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[15px] font-bold text-slate-800">Choose Long Attention Grabber</h3>
                            <button onClick={() => setShowLagModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-[14px] transition-colors">✕</button>
                        </div>
                        <div className="space-y-2 mb-5">
                            {lagSuggestions.length === 0 ? (
                                <p className="text-[12px] text-slate-400 text-center py-4">No suggestions — add vehicle features and check them first.</p>
                            ) : lagSuggestions.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setEditLongAttentionGrabber(s);
                                        setShowLagModal(false);
                                        markDone('long');
                                    }}
                                    className="w-full px-4 py-3 border-2 border-[#E2E8F0] rounded-lg text-[13px] font-bold text-[#4D7CFF] hover:border-[#4D7CFF] hover:bg-blue-50 transition-all text-center"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-5 py-3 border-t border-[#E2E8F0]">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={lagCapitalise} onChange={e => setLagCapitalise(e.target.checked)} className="w-4 h-4 accent-[#4D7CFF]" />
                                <span className="text-[12px] text-slate-600">Capitalise</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={lagUseCommas} onChange={e => setLagUseCommas(e.target.checked)} className="w-4 h-4 accent-[#4D7CFF]" />
                                <span className="text-[12px] text-slate-600">Use Commas</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={lagCompact} onChange={e => setLagCompact(e.target.checked)} className="w-4 h-4 accent-[#4D7CFF]" />
                                <span className="text-[12px] text-slate-600">Compact</span>
                            </label>
                        </div>
                        <div className="flex justify-end mt-4">
                            <button onClick={() => setShowLagModal(false)} className="px-5 py-2 bg-slate-200 text-slate-700 rounded-lg text-[12px] font-semibold hover:bg-slate-300 transition-colors">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Help Drawer */}
            {showHelpDrawer && (
                <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300" onClick={() => setShowHelpDrawer(false)}>
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 ease-out"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 bg-[#4D7CFF] text-white shadow-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                </div>
                                <div>
                                    <div className="text-[15px] font-bold leading-tight">Options &amp; Description</div>
                                    <div className="text-[11px] text-white/70 font-medium">Help Guide &amp; Impact Analysis</div>
                                </div>
                            </div>
                            <button onClick={() => setShowHelpDrawer(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white text-[14px]">✕</button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/30">
                            {/* Overview Section */}
                            <div>
                                <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                    Overview
                                </h3>
                                <p className="text-[12px] text-slate-600 leading-relaxed">
                                    This section allows you to manage how your vehicle is presented across all advertising platforms. From factory-fitted options to marketing descriptions, the data you enter here directly impacts your vehicle's visibility and transparency for potential buyers.
                                </p>
                            </div>

                            {/* What Happens on Save Section */}
                            <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
                                <h3 className="text-[13px] font-bold text-blue-900 mb-4 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    What happens when you save?
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex gap-3">
                                        <div className="mt-1 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">1</div>
                                        <div>
                                            <p className="text-[12px] font-bold text-slate-800">AutoTrader Sync</p>
                                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Your selected Optional and Standard features are instantly pushed to AutoTrader's database, ensuring your stock reflects accurate specifications.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-1 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">2</div>
                                        <div>
                                            <p className="text-[12px] font-bold text-slate-800">Global Description Update</p>
                                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">New Website and Sales Channel descriptions are updated across all connected portals (Website, eBay, Facebook, etc.).</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="mt-1 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">3</div>
                                        <div>
                                            <p className="text-[12px] font-bold text-slate-800">Attention Grabber Refresh</p>
                                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Marketing blurbs are updated, improving your Search Result Page (SRP) performance by highlighting key features.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pro Tips Section */}
                            <div>
                                <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.674a1 1 0 00.922-.627l.338-.844a1 1 0 00-.922-1.329h-4.674a1 1 0 00-.922 1.329l.338.844a1 1 0 00.922.627zM12 2a7 7 0 00-6.91 8.12 1 1 0 00.944.88h11.932a1 1 0 00.944-.88A7 7 0 0012 2z" /></svg>
                                    Expert Tips
                                </h3>
                                <div className="space-y-3">
                                    <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                                        <p className="text-[11px] text-slate-600 italic">"Use the <strong>Auto-Describe</strong> feature to instantly generate professional descriptions based on your selected options. It saves time and ensures high-quality listings."</p>
                                    </div>
                                    <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                                        <p className="text-[11px] text-slate-600 italic">"Keep your <strong>Attention Grabber</strong> punchy. Mention highly desirable features like 'Panoramic Roof' or 'Full Leather' to stand out in search results."</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-200">
                            <button
                                onClick={() => setShowHelpDrawer(false)}
                                className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-[12px] font-bold hover:bg-slate-900 transition-colors shadow-sm"
                            >
                                Got it, thanks!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTabState] = useState<string>(searchParams.get('tab') ?? 'overview');

    const setActiveTab = useCallback((tab: string) => {
        setActiveTabState(tab);
        const params = new URLSearchParams(window.location.search);
        params.set('tab', tab);
        router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    }, [router]);
    const [autoTraderConnected, setAutoTraderConnected] = useState<boolean>(true);
    const [activeImageTab, setActiveImageTab] = useState<'upload' | 'youtube' | 'library'>('upload');
    const [saving, setSaving] = useState(false);
    const [atSyncStatus, setAtSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle');

    // AutoTrader options prefetch (so Options tab is instant)
    type ATOption = { name: string; price: number | null; fitted: boolean; category: string };
    type ATStdFeature = { name: string; category: string };
    const [atOptions, setAtOptions] = useState<ATOption[]>([]);
    const [atStdFeatures, setAtStdFeatures] = useState<ATStdFeature[]>([]);
    const [atFactoryFitted, setAtFactoryFitted] = useState<Set<string>>(new Set());
    const [atLoading, setAtLoading] = useState(false);
    const [atHasData, setAtHasData] = useState(false);

    // Edit states
    const [editPrice, setEditPrice] = useState('');
    const [editForecourtPrice, setEditForecourtPrice] = useState('');
    const [editFields, setEditFields] = useState<Partial<VehicleDetail>>({});
    const [editDescription, setEditDescription] = useState('');
    const [editDescription2, setEditDescription2] = useState('');
    const [editAttentionGrabber, setEditAttentionGrabber] = useState('');
    const [editLongAttentionGrabber, setEditLongAttentionGrabber] = useState('');
    const [editFeatures, setEditFeatures] = useState<string[]>([]);
    const [editCustomFeatures, setEditCustomFeatures] = useState<string[]>([]);
    const [newFeature, setNewFeature] = useState('');
    // Pending tags (manual save)
    const [pendingTags, setPendingTags] = useState<string[]>([]);
    const [workflowStages, setWorkflowStages] = useState<Record<string, { completed: boolean; date: string; notes: string }>>({});
    const [spValuation, setSpValuation] = useState<any>(null);
    const [spValuationLoading, setSpValuationLoading] = useState(false);
    const [spValuationError, setSpValuationError] = useState('');
    const [spShowTrend, setSpShowTrend] = useState(false);
    const [spShowProfit, setSpShowProfit] = useState(false);
    const [showFundingProvider, setShowFundingProvider] = useState(false);
    const [addCostTab, setAddCostTab] = useState<'invoice' | 'without'>('without');
    const [newCostFields, setNewCostFields] = useState({ category: '', date: '', supplier: '', reference: '', cost: '', vatRate: '20' });
    const [vehicleAdditionalCosts, setVehicleAdditionalCosts] = useState<any[]>([]);
    const [expandedCosts, setExpandedCosts] = useState<Record<string, boolean>>({});

    // Taxonomy cascade
    const [taxMakes, setTaxMakes] = useState<{makeId: string; name: string}[]>([]);
    const [taxModels, setTaxModels] = useState<{modelId: string; name: string}[]>([]);
    const [taxGenerations, setTaxGenerations] = useState<{generationId: string; name: string}[]>([]);
    const [taxTrims, setTaxTrims] = useState<string[]>([]);
    const [taxMakeId, setTaxMakeId] = useState('');
    const [taxModelId, setTaxModelId] = useState('');
    const [taxGenerationId, setTaxGenerationId] = useState('');

    const updateField = (field: keyof VehicleDetail, value: any) => {
        setEditFields(prev => ({ ...prev, [field]: value }));
    };

    const SectionTitle = ({ children, rightContent }: { children: React.ReactNode; rightContent?: React.ReactNode }) => (
        <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
            <h2 className="text-[15px] font-semibold text-slate-800 tracking-tight">
                {children}
            </h2>
            {rightContent && <div className="flex items-center gap-2">{rightContent}</div>}
        </div>
    );

    const FieldLabel = ({ children }: { children: React.ReactNode }) => (
        <label className="block text-xs font-semibold text-[#8B98A9] mb-1.5 ml-0.5">
            {children}
        </label>
    );

    const inputClasses = "w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF] transition-colors shadow-sm";

    const TextInput = ({ label, value, field, placeholder }: { label: string; value: string; field: keyof VehicleDetail; placeholder?: string }) => (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <input
                type="text"
                value={(value as string) || ''}
                onChange={(e) => updateField(field, e.target.value)}
                placeholder={placeholder || ''}
                className={inputClasses}
            />
        </div>
    );

    const NumberInput = ({ label, value, field, placeholder }: { label: string; value: any; field: keyof VehicleDetail; placeholder?: string }) => (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <input
                type="number"
                value={value || ''}
                onChange={(e) => updateField(field, e.target.value)}
                placeholder={placeholder || ''}
                className={inputClasses}
            />
        </div>
    );

    const PriceInput = ({ label, value, field, placeholder }: { label: string; value: any; field: keyof VehicleDetail; placeholder?: string }) => (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-[13px]">£</span>
                <input
                    type="number"
                    value={value || ''}
                    onChange={(e) => updateField(field, e.target.value)}
                    placeholder={placeholder || '0'}
                    className={`${inputClasses} pl-7`}
                />
            </div>
        </div>
    );

    const SelectInput = ({ label, value, field, options, placeholder }: { label: string; value: string; field: keyof VehicleDetail; options: string[]; placeholder?: string }) => (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <select
                value={(value as string) || ''}
                onChange={(e) => updateField(field, e.target.value)}
                className={`${inputClasses} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_8px_center] bg-no-repeat pr-10`}
            >
                <option value="">{placeholder || 'Nothing selected'}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );

    const RadioGroup = ({ label, value, field, options }: { label: string; value: string; field: keyof VehicleDetail; options: string[] }) => (
        <div>
            <FieldLabel>{label}</FieldLabel>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                {options.map(o => (
                    <label key={o} className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name={String(field)}
                            checked={value === o}
                            onChange={() => updateField(field, o)}
                            className="w-3.5 h-3.5 text-[#4D7CFF] border-slate-300 focus:ring-[#4D7CFF]"
                        />
                        <span className="text-[13px] text-slate-600">{o}</span>
                    </label>
                ))}
            </div>
        </div>
    );

    // Auto-fill missing fields from AT derivative technical data when vehicle has a derivativeId
    useEffect(() => {
        if (!vehicle) return;
        const derivId = (vehicle as any).derivativeId;
        if (!derivId) return;
        const needsFill = !vehicle.engineSize || !vehicle.fuelType || !vehicle.seats || !vehicle.doors;
        if (!needsFill) return;
        fetch(`/api/vehicles/derivatives?id=${derivId}`)
            .then(r => r.json())
            .then(data => {
                const d = data.derivative;
                if (!d) return;
                setEditFields(prev => ({
                    ...prev,
                    ...(!prev.engineSize && (d.badgeEngineSizeLitres || d.engineCapacityCC) ? { engineSize: d.badgeEngineSizeLitres ? String(d.badgeEngineSizeLitres) : String((d.engineCapacityCC / 1000).toFixed(1)) } : {}),
                    ...(!prev.fuelType && d.fuelType ? { fuelType: d.fuelType } : {}),
                    ...(!prev.seats && d.seats ? { seats: d.seats } : {}),
                    ...(!prev.doors && d.doors ? { doors: d.doors } : {}),
                    ...(!prev.transmission && d.transmissionType ? { transmission: d.transmissionType } : {}),
                    ...(!prev.bodyType && d.bodyType ? { bodyType: d.bodyType } : {}),
                    ...(!prev.drivetrain && d.drivetrain ? { drivetrain: d.drivetrain } : {}),
                    ...(!prev.trim && d.trim ? { trim: d.trim } : {}),
                }));
            })
            .catch(() => {});
    }, [vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch makes whenever vehicleType changes (or on mount with default 'Car').
    // This ensures Van/Bike/etc makes load correctly when type is set.
    useEffect(() => {
        const vt = (editFields.vehicleType as string) || 'Car';
        fetch(`/api/vehicles/taxonomy?resource=makes&vehicleType=${encodeURIComponent(vt)}`)
            .then(r => r.json()).then(d => setTaxMakes(d.makes || [])).catch(() => {});
        // Reset downstream cascade when type changes
        setTaxModels([]); setTaxGenerations([]); setTaxTrims([]);
        setTaxModelId(''); setTaxGenerationId('');
    }, [editFields.vehicleType]); // eslint-disable-line react-hooks/exhaustive-deps

    // Once makes list loads + vehicle has a make, cascade-init the full chain.
    // Depends on both taxMakes (populated above) AND editFields.make (populated
    // after vehicle fetch) so that whichever arrives last triggers the cascade.
    useEffect(() => {
        if (!taxMakes.length || !editFields.make) return;
        // Capture current field values to avoid stale closure inside async callbacks
        const currentMakeName = editFields.make as string;
        const currentModelName = editFields.model as string;
        const currentGenName = editFields.generation as string;
        const currentVehicleType = (editFields.vehicleType as string) || 'Car';

        const make = taxMakes.find((m: any) => m.name === currentMakeName);
        if (!make) return;
        setTaxMakeId(make.makeId);
        fetch(`/api/vehicles/taxonomy?resource=models&makeId=${make.makeId}&vehicleType=${encodeURIComponent(currentVehicleType)}`)
            .then(r => r.json())
            .then(async d => {
                const models = d.models || [];
                setTaxModels(models);
                if (!currentModelName) return;
                const model = models.find((m: any) => m.name === currentModelName);
                if (!model) return;
                setTaxModelId(model.modelId);
                const gRes = await fetch(`/api/vehicles/taxonomy?resource=generations&modelId=${model.modelId}`);
                const gData = await gRes.json();
                const gens = gData.generations || [];
                setTaxGenerations(gens);
                
                let gen = currentGenName ? gens.find((g: any) => g.name === currentGenName) : null;
                
                // --- AUTO-SELECT GENERATION ---
                // If no generation was set explicitly, try to guess it from the vehicle's year
                const vehicleYear = editFields.year ? Number(editFields.year) : undefined;
                if (!gen && vehicleYear && !isNaN(vehicleYear)) {
                    gen = gens.find((g: any) => {
                        const match = g.name.match(/(\d{4})\s*-\s*(\d{4}|present|)/i);
                        if (match) {
                            const start = parseInt(match[1]);
                            const end = match[2] && match[2].toLowerCase() !== 'present' ? parseInt(match[2]) : new Date().getFullYear() + 1;
                            return vehicleYear >= start && vehicleYear <= end;
                        }
                        return false;
                    });
                    if (gen) {
                        setEditFields(prev => ({ ...prev, generation: gen.name }));
                    }
                }

                if (!gen) return;
                setTaxGenerationId(gen.generationId);

                const tRes = await fetch(`/api/vehicles/taxonomy?resource=trims&generationId=${gen.generationId}`);
                const tData = await tRes.json();
                const trims = (tData.trims || []).map((t: any) => t.name).filter((n: any) => typeof n === 'string' && n.length > 0);
                setTaxTrims(trims);
                
                // --- AUTO-SELECT TRIM ---
                // If no trim is set, try to guess it from the derivative string
                const currentTrimName = editFields.trim as string;
                const currentDerivative = editFields.derivative as string;
                if (!currentTrimName && currentDerivative && trims.length > 0) {
                    const derivUpper = currentDerivative.toUpperCase();
                    // Sort by length desc so longer trims (e.g. "S Line Black Edition") match before shorter substrings ("S Line")
                    const sortedTrims = [...trims].sort((a, b) => b.length - a.length);
                    const matchedTrim = sortedTrims.find(t => derivUpper.includes(t.toUpperCase()));
                    if (matchedTrim) {
                        setEditFields(prev => ({ ...prev, trim: matchedTrim }));
                    }
                }
            })
            .catch(() => {});
    }, [taxMakes, editFields.make]); // eslint-disable-line react-hooks/exhaustive-deps

    const dropdownClasses = `${inputClasses} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_8px_center] bg-no-repeat pr-10`;

    // Images
    const [uploading, setUploading] = useState(false);
    const [uploadedImages, setUploadedImages] = useState<{ imageId: string; href: string; label?: string }[]>([]);
    const savedImageIdsRef = useRef<string[]>([]);
    const dragIdx = useRef<number | null>(null);

    // Per-image metadata (group, banner, branding)
    type ImgMeta = { group?: string; banner?: string; bannerColor?: string; branding?: boolean; watermark?: boolean };
    const [imageMetadata, setImageMetadata] = useState<Record<string, ImgMeta>>({});
    const [showGroupsPanel, setShowGroupsPanel] = useState(false);
    const [showHelpSidebar, setShowHelpSidebar] = useState(false);
    const IMAGE_GROUPS = ['Exterior', 'Interior', 'Detail', 'Engine', 'Video', 'Highlight', 'Other'];
    const BANNER_COLORS: { label: string; bg: string; text: string }[] = [
        { label: 'Red', bg: '#DC2626', text: '#fff' },
        { label: 'Green', bg: '#16A34A', text: '#fff' },
        { label: 'Blue', bg: '#2563EB', text: '#fff' },
        { label: 'Black', bg: '#000', text: '#fff' },
        { label: 'Yellow', bg: '#EAB308', text: '#000' },
    ];
    const updateImgMeta = (imageId: string, patch: Partial<ImgMeta>) =>
        setImageMetadata(prev => ({ ...prev, [imageId]: { ...prev[imageId], ...patch } }));
    const saveImageMetadata = async (meta: Record<string, ImgMeta>) => {
        await fetch('/api/vehicles', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: vehicle?._id || id, imageMetadata: meta }),
        }).catch(() => toast.error('Failed to save image settings.'));
    };

    // YouTube
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [youtubeVideos, setYoutubeVideos] = useState<string[]>([]);
    const [youtubeSaving, setYoutubeSaving] = useState(false);
    const extractYoutubeId = (url: string) => {
        const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
        return m ? m[1] : null;
    };
    const handleAddYoutube = async () => {
        const vid = extractYoutubeId(youtubeUrl);
        if (!vid) { toast.error('Invalid YouTube URL. Use format: https://youtube.com/watch?v=xxxxxxxxxx'); return; }
        if (youtubeVideos.includes(vid)) { toast.error('This video is already added.'); return; }
        setYoutubeSaving(true);
        const newList = [...youtubeVideos, vid];
        try {
            const res = await fetch('/api/vehicles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: vehicle?._id || id, youtubeVideoIds: newList }),
            });
            const d = await res.json();
            if (d.ok) { setYoutubeVideos(newList); setYoutubeUrl(''); toast.success('YouTube video added!'); }
            else toast.error(d.error?.message || 'Failed to save video.');
        } catch { toast.error('Network error.'); }
        setYoutubeSaving(false);
    };
    const handleRemoveYoutube = async (vid: string) => {
        const newList = youtubeVideos.filter(v => v !== vid);
        setYoutubeVideos(newList);
        await fetch('/api/vehicles', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: vehicle?._id || id, youtubeVideoIds: newList }),
        }).catch(() => toast.error('Failed to remove video.'));
    };

    // VRM Lookup
    const [lookupVrm, setLookupVrm] = useState('');
    const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupError, setLookupError] = useState('');

    // Vehicle Check
    const [checkData, setCheckData] = useState<any>(null);
    const [checkLoading, setCheckLoading] = useState(false);
    const [checkError, setCheckError] = useState('');
    const [checkLoaded, setCheckLoaded] = useState(false);

    // Deals
    const [deals, setDeals] = useState<Deal[]>([]);
    const [dealsLoading, setDealsLoading] = useState(false);

    /* ─── Data Fetching ────────────────────────────────────────────────────── */
    useEffect(() => {
        const fetchVehicle = async () => {
            try {
                const isATOnly = id.startsWith('at-');
                let data: any = null;
                if (isATOnly) {
                    const atId = id.replace('at-', '');
                    const res = await fetch(`/api/vehicles/autotrader-stock/${atId}`);
                    data = await res.json();
                } else {
                    const res = await fetch(`/api/vehicles/${id}`);
                    data = await res.json();
                }

                if (data.ok && data.vehicle) {
                    const v = data.vehicle;
                    // ── AT-Compliant Image ID Extraction ──────────────────────────────────
                    // AT CDN URL format: https://m[-qa].atcdn.co.uk/a/media/{resize}/{imageId}.jpg
                    // The imageId is always the filename (32-char hex). We extract it from any available URL.
                    const extractAtImageId = (url: string): string | null => {
                        if (!url) return null;
                        // Match 32-char hex string as the filename (AT imageId format)
                        const match = url.match(/\/([a-f0-9]{32})(?:\.jpg)?(?:\?|$)/i);
                        return match ? match[1] : null;
                    };

                    // 1. Try media.images objects first (proper AT format with real IDs)
                    let mediaImages: { imageId: string; href: string }[] = (v.media?.images || [])
                        .filter((img: any) => img && img.imageId && !String(img.imageId).startsWith('img-'))
                        .map((img: any) => ({
                            imageId: img.imageId as string,
                            href: (img.href as string)?.replace('{resize}', 'w800h600') ||
                                `https://m.atcdn.co.uk/a/media/w800h600/${img.imageId}.jpg`,
                        }));

                    // 2. If no media.images with real IDs, extract imageIds from flat images[] URLs
                    if (mediaImages.length === 0 && (v.images || []).length > 0) {
                        mediaImages = (v.images as any[])
                            .map((img: any) => {
                                const rawUrl = typeof img === 'string' ? img : (img.href || '');
                                const imageId = extractAtImageId(rawUrl);
                                if (!imageId) return null;
                                // Normalize to w800h600 for display
                                const href = rawUrl
                                    .replace('{resize}', 'w800h600')
                                    .replace(/\/w\d+h\d+\//, '/w800h600/');
                                return { imageId, href };
                            })
                            .filter((x): x is { imageId: string; href: string } => x !== null);
                    }

                    // 3. Last resort: reconstruct from imageIds[] when both media.images and images[] are empty
                    //    This handles newly uploaded images on local vehicles (no stockId).
                    if (mediaImages.length === 0 && Array.isArray(v.imageIds) && v.imageIds.length > 0) {
                        mediaImages = (v.imageIds as string[])
                            .filter((imageId: string) => imageId && !imageId.startsWith('img-'))
                            .map((imageId: string) => ({
                                imageId,
                                href: `https://m.atcdn.co.uk/a/media/w800h600/${imageId}.jpg`,
                            }));
                    }

                    // Deduplicate by imageId (coerce to String for type safety)
                    // to prevent React duplicate-key warnings
                    mediaImages = Array.from(
                        new Map(mediaImages.map(img => [String(img.imageId), img])).values()
                    );

                    // Deduplicate flat images[] fallback by URL
                    const rawFlatImages: string[] = Array.from(
                        new Set(
                            (v.images || []).map((img: any) =>
                                typeof img === 'string'
                                    ? img.replace('{resize}', 'w800h600')
                                    : (img.href?.replace('{resize}', 'w800h600') || '')
                            ).filter(Boolean)
                        )
                    );

                    // Fallback: if there are no images arrays but a primaryImage exists, show it.
                    // This helps when the AT cache only stores primaryImage + imagesCount.
                    if (rawFlatImages.length === 0 && v.primaryImage) {
                        const primary = String(v.primaryImage)
                            .replace('{resize}', 'w800h600')
                            .replace(/\/w\d+h\d+\//, '/w800h600/');
                        if (primary) rawFlatImages.push(primary);
                    }

                    // Helper: coerce AT object fields like {name:"Petrol"} → "Petrol"
                    const strVal = (x: any): string => {
                        if (!x) return '';
                        if (typeof x === 'string') return x;
                        if (typeof x === 'object' && x.name) return String(x.name);
                        return String(x);
                    };

                    const vehicleData: VehicleDetail = {
                        ...v,
                        // Normalise status to our local values. AT cache may have stored 'Live'
                        // (an old AT-internal value) — treat it as 'In Stock'. Local DB records
                        // always carry an explicit status from our enum.
                        status: (() => {
                            const s = v.status;
                            if (!s || s === 'Live' || s === 'LIVE' || s === 'FORECOURT' || s === 'PUBLISHED') return 'In Stock';
                            if (s === 'SOLD') return 'Sold';
                            if (s === 'SALE_IN_PROGRESS') return 'Reserved';
                            return typeof s === 'object' ? (s as any).name || 'In Stock' : s;
                        })(),
                        // Normalise fields that AT may return as {name: "..."} objects
                        make:         strVal(v.make),
                        model:        strVal(v.model),
                        derivative:   strVal(v.derivative),
                        fuelType:     strVal(v.fuelType),
                        transmission: strVal(v.transmission),
                        bodyType:     strVal(v.bodyType),
                        colour:       strVal(v.colour),
                        engineSize:   strVal(v.engineSize),
                        generation:   strVal(v.generation),
                        trim:         strVal(v.trim),
                        drivetrain:   strVal(v.drivetrain),
                        vehicleType:  strVal(v.vehicleType),
                        emissionClass: strVal(v.emissionClass),
                        colourName:   strVal(v.colourName),
                        exteriorFinish: strVal(v.exteriorFinish),
                        interiorUpholstery: strVal(v.interiorUpholstery),
                        driverPosition: strVal(v.driverPosition),
                        condition:    strVal(v.condition),
                        interiorCondition: strVal(v.interiorCondition),
                        exteriorCondition: strVal(v.exteriorCondition),
                        tyreCondition: strVal(v.tyreCondition),
                        doors:        v.doors && typeof v.doors === 'object' ? Number((v.doors as any).name) : v.doors,
                        seats:        v.seats && typeof v.seats === 'object' ? Number((v.seats as any).name) : v.seats,
                        year:         v.year && typeof v.year === 'object' ? Number((v.year as any).name) : v.year,
                        vrm: v.vrm || v.vehicle?.registration || v.registration || '',
                        images: mediaImages.length > 0
                            ? mediaImages.map(m => m.href)
                            : rawFlatImages,
                        imageIds: mediaImages.map(m => m.imageId),
                        features: (v.features || []).map((f: any) => (typeof f === 'string' ? f : f.name)).filter(Boolean),
                        responseMetrics: v.responseMetrics || null,
                        history: v.history || null,
                        check: v.check || null,
                        description: advertDescriptionToPlainText(
                            v.description || v.adverts?.retailAdverts?.description || ''
                        ),
                        description2: advertDescriptionToPlainText(
                            v.description2 || v.adverts?.retailAdverts?.description2 || ''
                        ),
                        attentionGrabber: v.attentionGrabber || v.adverts?.retailAdverts?.attentionGrabber || '',
                        longAttentionGrabber: v.longAttentionGrabber || '',
                        customFeatures: (v.customFeatures || []).filter(Boolean),
                        technicalSpecs: v.technicalSpecs || {},
                        manualSpecs: v.manualSpecs || {},
                    };
                    setVehicle(vehicleData);

                    // Auto-populate technicalSpecs for existing vehicles that predate the lookup-on-create fix.
                    // Runs in the background — does NOT block page render.
                    const savedSpecs = v.technicalSpecs || {};
                    // Re-fetch if specs missing OR if sector/axles absent (added in a later version of the extractor)
                    const specsIncomplete = !savedSpecs.sector || !savedSpecs.axles;
                    const hasTechSpecs = Object.keys(savedSpecs).length > 0 && !specsIncomplete;
                    const vrmForLookup = v.vrm || '';
                    if (!hasTechSpecs && vrmForLookup && !id.startsWith('at-')) {
                        fetch(`/api/vehicles/lookup?vrm=${encodeURIComponent(vrmForLookup)}`)
                            .then(r => r.json())
                            .then(lookupData => {
                                if (!lookupData.ok) return;
                                const specs = lookupData.vehicle?.technicalSpecs;
                                if (!specs || Object.keys(specs).length === 0) return;
                                // Persist to DB — also save vin if missing
                                const vinFromLookup = lookupData.vehicle?.vin || '';
                                const patchBody: Record<string, any> = { id: v._id || id, technicalSpecs: specs };
                                if (!v.vin && vinFromLookup) patchBody.vin = vinFromLookup;
                                fetch('/api/vehicles', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(patchBody),
                                });
                                // Update local state so Specification tab re-renders immediately
                                setVehicle(prev => prev ? {
                                    ...prev,
                                    technicalSpecs: specs,
                                    ...(!prev.vin && vinFromLookup ? { vin: vinFromLookup } : {}),
                                } : null);
                                if (!v.vin && vinFromLookup) {
                                    setEditFields(prev => ({ ...prev, vin: vinFromLookup }));
                                }
                            })
                            .catch(() => {}); // Silently fail — specs are nice-to-have
                    }
                    // Auto-populate VIN + Engine Number via vehicle-check if either is missing
                    if ((!v.vin || !v.engineNumber) && vrmForLookup && !id.startsWith('at-')) {
                        fetch(`/api/vehicles/vehicle-check?vrm=${encodeURIComponent(vrmForLookup)}`)
                            .then(r => r.json())
                            .then(checkData => {
                                const vinFromCheck = checkData?.vehicle?.vin || '';
                                const engineNumberFromCheck = checkData?.vehicle?.engineNumber || '';
                                const updates: Record<string, string> = {};
                                if (!v.vin && vinFromCheck) updates.vin = vinFromCheck;
                                if (!v.engineNumber && engineNumberFromCheck) updates.engineNumber = engineNumberFromCheck;
                                if (!Object.keys(updates).length) return;
                                fetch('/api/vehicles', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: v._id || id, ...updates }),
                                });
                                setVehicle(prev => prev ? { ...prev, ...updates } : null);
                                setEditFields(prev => ({ ...prev, ...updates }));
                            })
                            .catch(() => {});
                    }

                    setEditPrice(String(v.price || ''));
                    setEditForecourtPrice(String(v.forecourtPrice || ''));
                    setEditFields({
                        make: vehicleData.make,
                        model: vehicleData.model,
                        derivative: vehicleData.derivative,
                        year: vehicleData.year,
                        mileage: vehicleData.mileage,
                        colour: vehicleData.colour,
                        fuelType: vehicleData.fuelType,
                        transmission: vehicleData.transmission,
                        bodyType: vehicleData.bodyType,
                        vehicleType: vehicleData.vehicleType || 'Car',
                        generation: vehicleData.generation || '',
                        trim: vehicleData.trim || '',
                        engineSize: vehicleData.engineSize || '',
                        seats: vehicleData.seats,
                        doors: vehicleData.doors,
                        driverPosition: vehicleData.driverPosition || 'Right',
                        drivetrain: vehicleData.drivetrain || 'Front Wheel Drive',
                        colourName: vehicleData.colourName || '',
                        exteriorFinish: vehicleData.exteriorFinish || '',
                        interiorUpholstery: vehicleData.interiorUpholstery || '',
                        purchasePrice: vehicleData.purchasePrice,
                        retailPrice: vehicleData.retailPrice,
                        priceOnApplication: vehicleData.priceOnApplication || false,
                        atPriceOnApplication: vehicleData.atPriceOnApplication || false,
                        purchaseDate: vehicleData.purchaseDate || '',
                        supplierName: vehicleData.supplierName || '',
                        supplierInvoiceNo: vehicleData.supplierInvoiceNo || '',
                        vatType: vehicleData.vatType || 'Margin',
                        fundingProvider: vehicleData.fundingProvider || '',
                        fundingAmount: vehicleData.fundingAmount,
                        vin: vehicleData.vin || '',
                        referenceId: vehicleData.referenceId || '',
                        engineNumber: vehicleData.engineNumber || '',
                        newKeeperReference: vehicleData.newKeeperReference || '',
                        keyReference: vehicleData.keyReference || '',
                        dueInDate: vehicleData.dueInDate || '',
                        dateOnForecourt: vehicleData.dateOnForecourt || '',
                        location: vehicleData.location || '',
                        origin: vehicleData.origin || 'UK Vehicle',
                        saleOrReturn: vehicleData.saleOrReturn || false,
                        demonstrator: vehicleData.demonstrator || false,
                        trade: vehicleData.trade || false,
                        stockNotes: vehicleData.stockNotes || '',
                        vatStatus: vehicleData.vatStatus || 'Marginal',
                        reservePaymentAmount: vehicleData.reservePaymentAmount,
                        quantityAvailable: vehicleData.quantityAvailable,
                        dateInStock: vehicleData.dateInStock || '',
                        keyTags: vehicleData.keyTags || '',
                        serviceHistory: vehicleData.serviceHistory || 'Full',
                        previousOwners: vehicleData.history?.previousOwners || vehicleData.previousOwners || 1,
                    });
                    setEditDescription(vehicleData.description || '');
                    setEditDescription2(vehicleData.description2 || '');
                    setEditAttentionGrabber(vehicleData.attentionGrabber || '');
                    setEditLongAttentionGrabber(vehicleData.longAttentionGrabber || '');
                    setEditFeatures(vehicleData.features);
                    setEditCustomFeatures(vehicleData.customFeatures || []);
                    setPendingTags(vehicleData.tags || []);
                    setVehicleAdditionalCosts(vehicleData.vehicleAdditionalCosts || []);
                    const defaultStages = ['purchased', 'inspected', 'valeted', 'photographed', 'advertised', 'readyForSale'];
                    const savedStages = vehicleData.workflowStages || {};
                    const mergedStages: Record<string, { completed: boolean; date: string; notes: string }> = {};
                    defaultStages.forEach(s => {
                        const saved = savedStages[s] || {};
                        mergedStages[s] = { completed: (saved as any).completed ?? false, date: (saved as any).date ?? '', notes: (saved as any).notes ?? '' };
                    });
                    setWorkflowStages(mergedStages);

                    // Set uploaded images — include rawFlatImages too, extracting imageId from URL
                    // This prevents plain-URL AT images from being lost when saving
                    const flatAsImages = rawFlatImages
                        .map((url: string, idx: number) => {
                            const match = url.match(/\/([a-f0-9]{32})(?:\.jpg)?(?:\?|$)/i);
                            const extractedId = match ? match[1] : '';
                            const imageId = extractedId || `url-${idx}`;
                            // Skip if already in mediaImages to avoid duplicates (when we have real ids)
                            if (extractedId && mediaImages.some((m: { imageId: string; href: string }) => m.imageId === extractedId)) return null;
                            return { imageId, href: url };
                        })
                        .filter((x: { imageId: string; href: string } | null): x is { imageId: string; href: string } => x !== null);
                    setUploadedImages([...mediaImages, ...flatAsImages]);
                    // Track "saved" baseline so we can warn on refresh if unsaved
                    savedImageIdsRef.current = mediaImages.map(m => String(m.imageId)).filter(Boolean);
                    // Load saved YouTube video IDs
                    if (Array.isArray(vehicleData.youtubeVideoIds)) {
                        setYoutubeVideos(vehicleData.youtubeVideoIds);
                    }
                    if (vehicleData.imageMetadata && typeof vehicleData.imageMetadata === 'object') {
                        setImageMetadata(vehicleData.imageMetadata);
                    }
                } else {
                    const errorMsg = typeof data.error === 'string' ? data.error : (data.error?.message || 'Failed to fetch vehicle details');
                    setError(errorMsg);
                }
            } catch {
                setError('An unexpected error occurred');
            } finally {
                setLoading(false);
            }
        };
        fetchVehicle();
    }, [id]);

    // Warn user if they try to refresh/close with unsaved image changes
    useEffect(() => {
        const isRealAtId = (s: string) => /^[a-f0-9]{32}$/i.test(String(s || ''));
        const hasUnsaved = () => {
            const baseline = new Set((savedImageIdsRef.current || []).filter(isRealAtId));
            const current = uploadedImages.map(i => i.imageId).filter(isRealAtId);
            if (current.length !== baseline.size) return true;
            for (const id of current) if (!baseline.has(id)) return true;
            return false;
        };

        const handler = (e: BeforeUnloadEvent) => {
            if (!hasUnsaved()) return;
            e.preventDefault();
            // Chrome requires returnValue to be set
            e.returnValue = '';
        };

        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [uploadedImages]);

    // Prefetch options as soon as we know the VRM
    useEffect(() => {
        const vrm = vehicle?.vrm?.trim();
        if (!vrm) return;
        let cancelled = false;
        setAtLoading(true);
        fetch(`/api/vehicles/optional-extras?vrm=${encodeURIComponent(vrm)}`)
            .then(async r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(d => {
                if (cancelled) return;
                if (d.ok) {
                    setAtOptions(d.optionalExtras || []);
                    setAtStdFeatures(d.standardFeatures || []);
                    setAtFactoryFitted(new Set(d.factoryFitted || []));
                    setAtHasData(!!(d.hasData || (d.optionalExtras?.length > 0) || (d.standardFeatures?.length > 0)));
                } else {
                    setAtOptions([]);
                    setAtStdFeatures([]);
                    setAtFactoryFitted(new Set());
                    setAtHasData(false);
                }
            })
            .catch(() => {
                if (cancelled) return;
                setAtOptions([]);
                setAtStdFeatures([]);
                setAtFactoryFitted(new Set());
                setAtHasData(false);
            })
            .finally(() => {
                if (cancelled) return;
                setAtLoading(false);
            });
        return () => { cancelled = true; };
    }, [vehicle?.vrm]);

    // Fetch real deals when stockId is known
    useEffect(() => {
        if (!vehicle?.stockId) return;
        setDealsLoading(true);
        fetch(`/api/deals/stock/${vehicle.stockId}`)
            .then(r => r.json())
            .then(d => { if (d.ok) setDeals(d.deals || []); })
            .catch(() => { })
            .finally(() => setDealsLoading(false));
    }, [vehicle?.stockId]);

    // Hide competitors tab if AT account is not connected for this tenant.
    useEffect(() => {
        if (!vehicle?.vrm) return;
        let cancelled = false;
        const checkAutoTraderConnection = async () => {
            try {
                const res = await fetch(`/api/vehicles/competitors?vrm=${encodeURIComponent(vehicle.vrm)}&pageSize=1`);
                const data = await res.json();
                const msg = String(data?.error?.message || '').toLowerCase();
                const notConnected = msg.includes('not configured')
                    || msg.includes('not set')
                    || msg.includes('credentials');
                if (!cancelled) setAutoTraderConnected(!notConnected);
            } catch {
                // Keep visible on transient network issues.
            }
        };
        checkAutoTraderConnection();
        return () => { cancelled = true; };
    }, [vehicle?.vrm]);

    useEffect(() => {
        if (!autoTraderConnected && activeTab === 'competitors') {
            setActiveTab('overview');
        }
    }, [autoTraderConnected, activeTab]);

    /* ─── Save Handlers ────────────────────────────────────────────────────── */
    const patchVehicle = useCallback(async (updates: Record<string, any>) => {
        setSaving(true);
        setAtSyncStatus('syncing');
        try {
            const vehicleId = vehicle?._id || id;
            const res = await fetch('/api/vehicles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: vehicleId, ...updates }),
            });
            const data = await res.json();
            if (data.ok) {
                setVehicle(prev => prev ? { ...prev, ...updates } : null);
                setAtSyncStatus('success');
                toast.success('Saved & synced to AutoTrader ✓');
                // Auto-reset badge after 5 seconds
                setTimeout(() => setAtSyncStatus('idle'), 5000);
                return true;
            } else {
                const errorMsg = typeof data.error === 'string' ? data.error : (data.error?.message || 'Save failed');
                setAtSyncStatus('failed');
                toast.error(errorMsg);
                return false;
            }
        } catch {
            setAtSyncStatus('failed');
            toast.error('Network error');
            return false;
        } finally {
            setSaving(false);
        }
    }, [vehicle, id]);

    const handleSaveVehicleFields = () => {
        const payload = {
            ...editFields,
            year: Number(editFields.year) || undefined,
            mileage: Number(editFields.mileage) || undefined,
            seats: Number(editFields.seats) || undefined,
            doors: Number(editFields.doors) || undefined,
            purchasePrice: Number(editFields.purchasePrice) || undefined,
            retailPrice: Number(editFields.retailPrice) || undefined,
            previousOwners: Number(editFields.previousOwners) || undefined,
            fundingAmount: editFields.fundingAmount !== undefined ? Number(editFields.fundingAmount) || 0 : undefined,
            price: Number(editPrice),
            forecourtPrice: Number(editForecourtPrice) || undefined,
            status: vehicle?.status || 'In Stock',
            tags: pendingTags,
        };
        patchVehicle(payload);
    };

    const handleSaveWorkflow = () => patchVehicle({ workflowStages });
    const handleSaveContent = () => patchVehicle({
        description: editDescription,
        description2: editDescription2,
        attentionGrabber: editAttentionGrabber,
        longAttentionGrabber: editLongAttentionGrabber,
        features: editFeatures,
        customFeatures: editCustomFeatures,
    });

    const handleSaveImages = async () => {
        // Only send valid AutoTrader imageIds (32 hex). UI may contain URL-only placeholders.
        const isRealAtId = (s: string) => /^[a-f0-9]{32}$/i.test(String(s || ''));
        const imageIds = uploadedImages.map(i => i.imageId).filter(isRealAtId);
        const ok = await patchVehicle({ imageIds });
        if (ok) {
            savedImageIdsRef.current = imageIds;
        }
    };

    const handleStatusChange = (newStatus: string) => {
        // Only update local state — user must click Save Updates to persist
        setVehicle(prev => prev ? { ...prev, status: newStatus } : null);
    };

    const [savingChannel, setSavingChannel] = useState<string | null>(null);

    // chanKey → AT channel name mapping
    const CHAN_KEY_TO_AT: Record<string, string> = {
        atAdvertStatus:         'autotrader',
        advertiserAdvertStatus: 'advertiser',
        locatorAdvertStatus:    'locator',
        exportAdvertStatus:     'export',
        profileAdvertStatus:    'profile',
    };

    // Instantly toggle a single channel on AT and persist. Includes advert text so
    // description/attention grabber stay in sync each time a channel is toggled.
    const toggleAndSave = async (chanKey: string) => {
        if (!vehicle) return;
        if (!vehicle.stockId) {
            alert('No AutoTrader stock ID — create the stock record on AutoTrader first.');
            return;
        }
        if (savingChannel) return; // prevent concurrent saves

        const channelName = CHAN_KEY_TO_AT[chanKey];
        if (!channelName) return;

        const current = vehicle[chanKey as keyof VehicleDetail] as string;
        const next = current === 'PUBLISHED' ? 'NOT_PUBLISHED' : 'PUBLISHED';

        // Optimistic update
        setVehicle(prev => prev ? { ...prev, [chanKey]: next } : null);
        setSavingChannel(chanKey);
        try {
            const res = await fetch(`/api/vehicles/autotrader-stock/${vehicle.stockId}/advertise`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channels: { [channelName]: next },
                    attentionGrabber: (vehicle.attentionGrabber || '').trim().slice(0, 30) || undefined,
                    description: (vehicle.description || vehicle.description2 || '').trim().slice(0, 4000) || undefined,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || 'Failed to update channel');

            const actual = data.actualStatuses || {};
            const localUpdates: Partial<VehicleDetail> = {
                [chanKey]: actual[chanKey] || next,
            };
            setVehicle(prev => prev ? { ...prev, ...localUpdates } : null);
            await patchVehicle(localUpdates);

            if (data.warnings?.length > 0) {
                const msgs = data.warnings.map((w: any) =>
                    `${w.channel}: ${w.status}${w.message ? ` — ${w.message}` : ''}`
                ).join('\n');
                alert(`Channel update warning:\n\n${msgs}`);
            }
        } catch (err: any) {
            // Revert optimistic update on failure
            setVehicle(prev => prev ? { ...prev, [chanKey]: current } : null);
            alert(err.message || 'Failed to update channel');
        } finally {
            setSavingChannel(null);
        }
    };

    const handleCreateAtStock = async () => {
        if (!vehicle?._id && !vehicle?.id) return;
        setSaving(true);
        try {
            const res = await fetch('/api/vehicles/autotrader-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId: vehicle._id || vehicle.id }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error?.message || 'Failed to create AutoTrader stock');
            if (data.stockId) {
                setVehicle(prev => prev ? { ...prev, stockId: data.stockId } : null);
                toast.success('AutoTrader stock created successfully');
            } else {
                toast.success('Stock pushed to AutoTrader (no stockId returned yet — refresh to sync)');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to create AutoTrader stock');
        } finally {
            setSaving(false);
        }
    };

    /* ─── Image Upload ─────────────────────────────────────────────────────── */
    const handleImageUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        const results: { imageId: string; href: string }[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('vehicleType', 'Car');
            try {
                const res = await fetch('/api/vehicles/images', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.ok && data.imageId) {
                    results.push({ imageId: data.imageId, href: data.href?.replace('{resize}', 'w800h600') || `https://m.atcdn.co.uk/a/media/w800h600/${data.imageId}.jpg` });
                    toast.success(`Image ${i + 1}/${files.length} uploaded`);
                } else {
                    const errorMsg = typeof data.error === 'string' ? data.error : (data.error?.message || 'Unknown error');
                    toast.error(`Upload failed: ${errorMsg}`);
                }
            } catch {
                toast.error(`Upload error for image ${i + 1}`);
            }
        }

        // Reset file input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (results.length > 0) {
            // Add to local state only — user must click Save to push to AutoTrader
            setUploadedImages(prev => [...prev, ...results]);
            toast.success(`${results.length} image${results.length > 1 ? 's' : ''} ready — click Save to push to AutoTrader`);
        }
        setUploading(false);
    };

    const removeImage = (imageId: string) => {
        // Only remove from local state — user must click Save to persist the removal
        setUploadedImages(prev => prev.filter(i => i.imageId !== imageId));
    };

    /* ─── VRM Lookup ───────────────────────────────────────────────────────── */
    const handleVrmLookup = async () => {
        if (!lookupVrm.trim()) return;
        setLookupLoading(true);
        setLookupResult(null);
        setLookupError('');
        try {
            const res = await fetch(`/api/vehicles/lookup?vrm=${encodeURIComponent(lookupVrm.trim())}`);
            const data = await res.json();
            if (data.ok) {
                setLookupResult(data.vehicle);
            } else {
                setLookupError(data.error?.message || 'Vehicle not found');
            }
        } catch {
            setLookupError('Lookup failed. Please try again.');
        } finally {
            setLookupLoading(false);
        }
    };

    /* ─── Loading / Error ──────────────────────────────────────────────────── */
    if (loading) {
        return (
            <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
                    <p className="text-slate-500 font-medium">Loading vehicle dashboard...</p>
                </div>
            </div>
        );
    }

    if (error || !vehicle) {
        return (
            <div className="min-h-screen bg-[#F0F4F8] flex flex-col items-center justify-center p-4">
                <div className="bg-white p-10 rounded-[32px] shadow-2xl max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">⚠</div>
                    <h1 className="text-2xl font-black text-slate-900 mb-2">Vehicle Not Found</h1>
                    <p className="text-slate-500 mb-8">{error || 'The vehicle might have been removed or sync is required.'}</p>
                    <Link href="/app/vehicles" className="block w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all text-center">
                        Return to Inventory
                    </Link>
                </div>
            </div>
        );
    }

    const statusOption = LIFECYCLE_OPTIONS.find(o => o.value === vehicle.status);
    const metrics = vehicle.responseMetrics;
    const visibleTabGroups = TAB_GROUPS.map(group => ({
        ...group,
        tabs: group.tabs.filter(tab => autoTraderConnected || tab.id !== 'competitors'),
    })).filter(group => group.tabs.length > 0);

    /* ─── Render ───────────────────────────────────────────────────────────── */
    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} />

            {/* ─── Full-width Breadcrumb Bar (MotorDesk SS2 style) ─────────── */}
            <div className="w-full px-4 py-2 flex items-center gap-1.5 text-[12px] text-slate-400 font-medium border-b border-slate-100 bg-white">
                <a href="/app/vehicles" className="hover:text-[#4D7CFF] transition-colors">Vehicles</a>
                <span className="text-slate-300">/</span>
                <span className="text-slate-500">{vehicle.status}</span>
                <span className="text-slate-300">/</span>
                <span className="text-[#4D7CFF] font-semibold">{(vehicle.vrm || (vehicle as any).registration || (vehicle as any).vehicle?.registration || 'UNREG').toUpperCase()}</span>
            </div>

            {/* ─── Main Layout structure: Sidebar + Content ──────────────── */}
            <div className="flex w-full min-h-screen">

                {/* ─── Sidebar Navigation ──────────────────────────────────── */}
                <aside className="w-64 shrink-0 bg-white border-r border-slate-200 py-5 hidden md:block">
                    {/* VRM Badge in Sidebar */}
                    <div className="mb-6 px-4">
                        <div className="bg-[#FFD700] rounded-md border border-slate-900 flex items-stretch overflow-hidden h-12 shadow-sm">
                            <div className="bg-[#003399] w-8 flex items-center justify-center flex-col text-white font-black text-[8px] leading-none px-1">
                                <div>🇬🇧</div>
                                <div className="mt-4">UK</div>
                            </div>
                            <div className="flex-1 flex items-center justify-center font-black text-2xl text-slate-900 tracking-widest font-mono">
                                {(vehicle.vrm || (vehicle as any).registration || (vehicle as any).vehicle?.registration || 'UNREG').toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <nav className="px-3">
                        {visibleTabGroups.map((group, gi) => (
                            <div key={gi}>
                                {group.tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-[9px] text-[13px] font-medium transition-all rounded-md ${
                                            activeTab === tab.id
                                                ? 'text-[#4D7CFF] font-semibold border-l-[3px] border-[#4D7CFF] bg-[#F0F4FF] rounded-l-none pl-[9px]'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-l-[3px] border-transparent'
                                        }`}
                                    >
                                        <span className={activeTab === tab.id ? 'text-[#4D7CFF]' : 'text-slate-400'}>
                                            {tab.icon}
                                        </span>
                                        {tab.label}
                                    </button>
                                ))}
                                {gi < visibleTabGroups.length - 1 && (
                                    <div className="my-2 border-t border-slate-100" />
                                )}
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* ─── Content ────────────────────────────────────────────────── */}
                <main className="flex-1 min-w-0 overflow-x-hidden bg-[#F8FAFC]">

                    {/* Mobile Tab Navigation */}
                    <div className="md:hidden bg-white border-b border-slate-200 px-3 py-2 overflow-x-auto no-scrollbar">
                        <div className="flex gap-1 min-w-max">
                            {visibleTabGroups.flatMap(g => g.tabs).map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-[#4D7CFF] text-white'
                                            : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                                >
                                    <span>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-4 sm:px-6 py-3">

                        {activeTab === 'overview' && (
                            <div className="space-y-6">
                                {/* ─── Vehicle Overview Bar ─────────────────────────────────── */}
                                <div className="bg-white rounded-lg border border-[#E2E8F0] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                    <div className="flex items-center gap-5 min-w-0">
                                        <div className="w-20 h-14 flex items-center justify-center shrink-0">
                                            <img
                                                src={`https://vehapi.com/apis/logo-api/img/logo/${textValue(vehicle.make).toLowerCase().replace(/\s+/g, '-')}.png`}
                                                alt={`${textValue(vehicle.make)} logo`}
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    const makeSlug = textValue(vehicle.make).toLowerCase().replace(/\s+/g, '');
                                                    const fallbacks = [
                                                        `https://www.carlogos.org/car-logos/${makeSlug}-logo.png`,
                                                        `https://logo.clearbit.com/${makeSlug}.com`,
                                                    ];
                                                    const currentSrc = target.src;
                                                    const idx = fallbacks.findIndex(f => f === currentSrc);
                                                    if (idx === -1) {
                                                        target.src = fallbacks[0];
                                                    } else if (idx < fallbacks.length - 1) {
                                                        target.src = fallbacks[idx + 1];
                                                    } else {
                                                        target.style.display = 'none';
                                                        target.parentElement!.innerHTML = `<span class="text-2xl font-black text-slate-300">${textValue(vehicle.make).charAt(0).toUpperCase()}</span>`;
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <h1 className="text-[17px] font-bold text-slate-800 leading-snug">
                                                {textValue(vehicle.make)} {textValue(vehicle.model)} {textValue(vehicle.derivative)}
                                            </h1>
                                            <div className="flex items-center flex-wrap gap-2 mt-1.5 text-[12px] font-medium text-slate-500">
                                                <span>{vehicle.year}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span>{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : '0 miles'}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span>{textValue(vehicle.fuelType) || 'Unknown'}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span>{textValue(vehicle.transmission) || 'Unknown'}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span className="text-slate-800 font-bold">£{vehicle.price?.toLocaleString() || 'POA'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                                        <div className="flex items-center gap-2">
                                            {[
                                                { label: 'Added', value: vehicle.createdAt ? formatDistanceToNow(new Date(vehicle.createdAt)) : 'N/A' },
                                                { label: 'For Sale', value: vehicle.createdAt ? formatDistanceToNow(new Date(vehicle.createdAt)) : 'N/A' },
                                                { label: 'Price Change', value: vehicle.updatedAt ? formatDistanceToNow(new Date(vehicle.updatedAt)) : 'N/A' },
                                            ].map(m => (
                                                <div key={m.label} className="bg-[#F8FAFC] border border-slate-100 rounded-lg px-4 py-2.5 min-w-[100px] text-center">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{m.label}</div>
                                                    <div className="text-[13px] font-bold text-slate-700 whitespace-nowrap">{m.value}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="h-10 w-px bg-slate-100 mx-2 hidden md:block"></div>
                                        <div className="flex items-center gap-2">
                                            {/* Coloured status badge */}
                                            {(() => {
                                                const s = vehicle.status;
                                                const badge =
                                                    s === 'In Stock'
                                                        ? { label: s, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
                                                        : s === 'Draft'
                                                        ? { label: 'Draft', cls: 'bg-slate-100 text-slate-500 border-slate-200' }
                                                        : s === 'Reserved'
                                                        ? { label: 'Reserved', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
                                                        : s === 'Sold'
                                                        ? { label: 'Sold', cls: 'bg-red-100 text-red-600 border-red-200' }
                                                        : { label: s || 'Unknown', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
                                                return (
                                                    <span className={`inline-flex items-center px-3 h-10 rounded-md border text-[12px] font-bold whitespace-nowrap ${badge.cls}`}>
                                                        {badge.label}
                                                    </span>
                                                );
                                            })()}
                                            <select
                                                value={vehicle.status || 'In Stock'}
                                                onChange={(e) => handleStatusChange(e.target.value)}
                                                className="h-10 px-4 pr-10 bg-white border border-[#E2E8F0] rounded-md text-[13px] font-bold text-slate-700 shadow-sm focus:outline-none focus:border-[#4D7CFF] appearance-none cursor-pointer"
                                                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem', backgroundRepeat: 'no-repeat' }}
                                            >
                                                <option value="Draft">Draft</option>
                                                <option value="In Stock">In Stock</option>
                                                <option value="Reserved">Reserved</option>
                                                <option value="Sold">Sold</option>
                                            </select>
                                            <button
                                                onClick={handleSaveVehicleFields}
                                                disabled={saving}
                                                className="h-10 px-6 bg-[#4D7CFF] text-white rounded-md text-[13px] font-bold hover:bg-blue-600 transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                                            >
                                                {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
                                                Save Updates
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2 space-y-6">
                                        {/* Status Action Card */}
                                        {(() => {
                                            const s = vehicle.status;
                                            const cfg =
                                                s === 'In Stock'
                                                    ? { bg: 'bg-[#F1FCF6]', border: 'border-[#BDE7D3]', hover: 'hover:border-green-300', iconColor: 'text-green-600', textColor: 'text-[#147D4E]', subColor: 'text-[#147D4E]/70', title: 'In Stock', sub: 'This vehicle is currently in stock and available for sale.' }
                                                    : s === 'Reserved'
                                                    ? { bg: 'bg-amber-50', border: 'border-amber-200', hover: 'hover:border-amber-300', iconColor: 'text-amber-600', textColor: 'text-amber-800', subColor: 'text-amber-700/70', title: 'Vehicle Reserved', sub: 'This vehicle is currently marked as reserved.' }
                                                    : s === 'Sold'
                                                    ? { bg: 'bg-red-50', border: 'border-red-200', hover: 'hover:border-red-300', iconColor: 'text-red-600', textColor: 'text-red-800', subColor: 'text-red-700/70', title: 'Vehicle Sold', sub: 'This vehicle has been marked as sold.' }
                                                    : s === 'Draft'
                                                    ? { bg: 'bg-slate-50', border: 'border-slate-200', hover: 'hover:border-slate-300', iconColor: 'text-slate-400', textColor: 'text-slate-700', subColor: 'text-slate-500', title: 'Draft', sub: 'This vehicle is saved as a draft and not yet listed.' }
                                                    : { bg: 'bg-[#F1FCF6]', border: 'border-[#BDE7D3]', hover: 'hover:border-green-300', iconColor: 'text-green-600', textColor: 'text-[#147D4E]', subColor: 'text-[#147D4E]/70', title: s || 'Unknown Status', sub: 'Update the status using the dropdown above.' };
                                            return (
                                                <div className={`${cfg.bg} border ${cfg.border} rounded-lg p-5 flex items-center justify-between shadow-sm ${cfg.hover} transition-colors`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 bg-white rounded-full flex items-center justify-center ${cfg.iconColor} shadow-sm text-lg`}>
                                                            ↻
                                                        </div>
                                                        <div>
                                                            <div className={`text-[15px] font-bold ${cfg.textColor}`}>{cfg.title}</div>
                                                            <div className={`text-[12px] font-medium ${cfg.subColor}`}>{cfg.sub}</div>
                                                        </div>
                                                    </div>
                                                    <button className="px-6 py-2 bg-[#4D7CFF] text-white rounded-md text-[13px] font-bold hover:bg-blue-600 transition-all">
                                                        Sell Vehicle
                                                    </button>
                                                </div>
                                            );
                                        })()}

                                        {/* Advert Suggestions */}
                                        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-6 overflow-hidden">
                                            <SectionTitle>Advert Suggestions</SectionTitle>
                                            <div className="space-y-4">
                                                {[
                                                    { title: 'Add Interior Details', desc: 'Interior details help customers find their perfect vehicle more easily.', tab: 'vehicle' },
                                                    { title: 'Add a Video', desc: 'Adding a video will help sell your vehicle faster.', tab: 'images' },
                                                    { title: 'Improve Description', desc: 'Consider improving your description to inform customers.', tab: 'vehicle' },
                                                    { title: 'Add ULEZ Compliance', desc: 'ULEZ compliance data is important to help customers find the right vehicle.', tab: 'vehicle' }
                                                ].map((s, idx) => (
                                                    <div key={idx} className="flex gap-4 p-4 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-50 group cursor-pointer" onClick={() => setActiveTab(s.tab)}>
                                                        <div className="w-2 h-2 rounded-full bg-[#4D7CFF] mt-1.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"></div>
                                                        <div className="flex-1">
                                                            <div className="text-[14px] font-bold text-[#4D7CFF] hover:underline">{s.title}</div>
                                                            <div className="text-[12px] text-slate-500 font-medium mt-0.5 leading-relaxed">{s.desc}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Performance Chart Placeholder */}
                                        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-6">
                                            <div className="flex items-center justify-between mb-8">
                                                <SectionTitle>Performance</SectionTitle>
                                                <select className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 outline-none tracking-wide">
                                                    <option>PAST WEEK</option>
                                                    <option>PAST MONTH</option>
                                                </select>
                                            </div>
                                            <div className="h-48 flex items-end justify-between gap-1 px-2 border-b border-slate-100 pb-2 mb-8">
                                                {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                                                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                                        <div className="w-full bg-[#4D7CFF]/10 rounded-t-sm relative flex flex-col justify-end min-h-[20px]" style={{ height: `${h}%` }}>
                                                            <div className="w-full bg-[#4D7CFF] rounded-t-sm h-1/3 opacity-40 group-hover:opacity-100 transition-opacity"></div>
                                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-all">{h}</div>
                                                        </div>
                                                        <div className="text-[9px] font-bold text-slate-300 transform -rotate-45 md:rotate-0 mt-2">
                                                            {['18 Mar', '19 Mar', '20 Mar', '21 Mar', '22 Mar', '23 Mar', '24 Mar'][i]}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#4D7CFF]"></div> Leads</div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-indigo-400"></div> Appointments</div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-sky-400"></div> Searches</div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-purple-400"></div> Views</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-5">

                                        {/* ── Leads ── */}
                                        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-[14px] font-bold text-slate-800">Leads</h3>
                                                <a href="/app/leads" className="text-[11px] font-bold text-[#4D7CFF] border border-[#DCE4FF] rounded px-2.5 py-1 hover:bg-blue-50 transition-colors uppercase tracking-wider">Create Lead</a>
                                            </div>
                                            {deals.length > 0 ? (
                                                <div className="space-y-2">
                                                    {deals.slice(0, 3).map((d, j) => (
                                                        <div key={j} className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded border border-transparent hover:border-slate-100 transition-all cursor-pointer">
                                                            <div>
                                                                <div className="text-[12px] font-bold text-[#4D7CFF]">Lead #{j + 1}</div>
                                                                <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Enquiry</div>
                                                            </div>
                                                            <div className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">Open</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-6 text-center bg-slate-50/30 rounded border border-dashed border-slate-100">
                                                    <div className="text-[11px] font-bold text-slate-300 italic">No leads yet</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Tags ── */}
                                        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-[14px] font-bold text-slate-800">Tags</h3>
                                                <button
                                                    onClick={() => {
                                                        const tag = window.prompt('Enter tag name');
                                                        if (tag?.trim()) {
                                                            if (!pendingTags.includes(tag.trim())) {
                                                                setPendingTags(prev => [...prev, tag.trim()]);
                                                            }
                                                        }
                                                    }}
                                                    className="text-[11px] font-bold text-[#4D7CFF] border border-[#DCE4FF] rounded px-2.5 py-1 hover:bg-blue-50 transition-colors uppercase tracking-wider"
                                                >Edit Tags</button>
                                            </div>
                                            {pendingTags.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {pendingTags.map((tag, ti) => (
                                                        <span key={ti} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded text-[11px] font-semibold">
                                                            {tag}
                                                            <button onClick={() => setPendingTags(prev => prev.filter((_, i) => i !== ti))} className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors text-[10px]">✕</button>
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-4 text-center border border-dashed border-slate-100 rounded">
                                                    <div className="text-[11px] text-slate-300 italic font-bold">No tags — click Edit Tags to add</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Deals ── */}
                                        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-[14px] font-bold text-slate-800">Deals</h3>
                                                <button onClick={() => setActiveTab('sales')} className="text-[11px] font-bold text-[#4D7CFF] border border-[#DCE4FF] rounded px-2.5 py-1 hover:bg-blue-50 transition-colors uppercase tracking-wider">Create Deal</button>
                                            </div>
                                            <div className="py-6 text-center bg-slate-50/30 rounded border border-dashed border-slate-100">
                                                <div className="text-[11px] font-bold text-slate-300 italic">No deals yet</div>
                                            </div>
                                        </div>

                                        {/* ── Orders ── */}
                                        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-[14px] font-bold text-slate-800">Orders</h3>
                                                <button className="text-[11px] font-bold text-[#4D7CFF] border border-[#DCE4FF] rounded px-2.5 py-1 hover:bg-blue-50 transition-colors uppercase tracking-wider">Create Order</button>
                                            </div>
                                            <div className="py-6 text-center bg-slate-50/30 rounded border border-dashed border-slate-100">
                                                <div className="text-[11px] font-bold text-slate-300 italic">No orders yet</div>
                                            </div>
                                        </div>

                                        {/* ── Vehicle Invoices ── */}
                                        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-[14px] font-bold text-slate-800">Vehicle Invoices</h3>
                                                <button onClick={() => setActiveTab('sales')} className="text-[11px] font-bold text-[#4D7CFF] border border-[#DCE4FF] rounded px-2.5 py-1 hover:bg-blue-50 transition-colors uppercase tracking-wider">Sell Vehicle</button>
                                            </div>
                                            <div className="py-6 text-center bg-slate-50/30 rounded border border-dashed border-slate-100">
                                                <div className="text-[11px] font-bold text-slate-300 italic">No invoices yet</div>
                                            </div>
                                        </div>

                                        {/* ── Condition Reports ── */}
                                        <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-[14px] font-bold text-slate-800">Condition Reports</h3>
                                                <button onClick={() => setActiveTab('conditionReport')} className="text-[11px] font-bold text-[#4D7CFF] border border-[#DCE4FF] rounded px-2.5 py-1 hover:bg-blue-50 transition-colors uppercase tracking-wider">Add Report</button>
                                            </div>
                                            <div className="py-6 text-center bg-slate-50/30 rounded border border-dashed border-slate-100">
                                                <div className="text-[11px] font-bold text-slate-300 italic">No condition reports yet</div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ VEHICLE TAB ══════════════════════════════════════════ */}
                        {activeTab === 'vehicle' && (
                            <div className="space-y-6 w-full">

                                {/* ─── Vehicle Details Section ────────────────────────────── */}
                                <div className="bg-white rounded-lg border border-[#E2E8F0] p-6 shadow-sm">
                                    <SectionTitle
                                        rightContent={
                                            <>
                                                <button onClick={() => (document.getElementById('vehicleHelpDrawer') as HTMLDivElement)?.classList.remove('hidden')} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors">
                                                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" /></svg>
                                                    Help
                                                </button>
                                                <button className="p-1 px-2 border border-[#E2E8F0] rounded text-[#4D7CFF] hover:bg-slate-50 text-[10px]">🔗</button>
                                                <div className="px-3 py-1.5 text-[11px] font-semibold text-[#4D7CFF] border border-[#DCE4FF] rounded bg-blue-50/50 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#4D7CFF]"></span>On Site</div>
                                                <div className="px-4 py-1.5 text-[11px] font-semibold text-white bg-[#41B4DF] rounded">Draft</div>
                                                {/* ─── AutoTrader Sync Status Badge ─── */}
                                                {atSyncStatus === 'syncing' && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded animate-pulse">
                                                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                        Syncing AT...
                                                    </div>
                                                )}
                                                {atSyncStatus === 'success' && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                                        AT Synced
                                                    </div>
                                                )}
                                                {atSyncStatus === 'failed' && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 rounded">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                                        AT Sync Failed
                                                    </div>
                                                )}
                                            </>
                                        }
                                    >
                                        Vehicle Details
                                    </SectionTitle>

                                    {/* Vehicle Type */}
                                    <div className="mb-6">
                                        <SelectInput label="Vehicle Type" value={editFields.vehicleType as string} field="vehicleType" options={VEHICLE_TYPES} placeholder="Select type" />
                                    </div>

                                    {/* Manufacturer & Model */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                        <div>
                                            <FieldLabel>Manufacturer</FieldLabel>
                                            <select
                                                value={textValue(editFields.make) || ''}
                                                onChange={e => {
                                                    const found = taxMakes.find(m => m.name === e.target.value);
                                                    updateField('make', e.target.value);
                                                    updateField('model', '');
                                                    updateField('generation', '');
                                                    updateField('trim', '');
                                                    setTaxMakeId(found?.makeId || '');
                                                    setTaxModelId(''); setTaxGenerationId('');
                                                    setTaxModels([]); setTaxGenerations([]); setTaxTrims([]);
                                                    if (found?.makeId) {
                                                        const vt = encodeURIComponent((editFields.vehicleType as string) || 'Car');
                                                        fetch(`/api/vehicles/taxonomy?resource=models&makeId=${found.makeId}&vehicleType=${vt}`)
                                                            .then(r => r.json()).then(d => setTaxModels(d.models || [])).catch(() => {});
                                                    }
                                                }}
                                                className={dropdownClasses}
                                            >
                                                <option value="">Select manufacturer</option>
                                                {editFields.make && !taxMakes.find(m => m.name === textValue(editFields.make)) && (
                                                    <option key="__current_make" value={textValue(editFields.make)}>{textValue(editFields.make)}</option>
                                                )}
                                                {taxMakes.map((m, i) => <option key={m.makeId || `make_${i}`} value={m.name}>{m.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <FieldLabel>Model</FieldLabel>
                                            <select
                                                value={textValue(editFields.model) || ''}
                                                onChange={e => {
                                                    const found = taxModels.find(m => m.name === e.target.value);
                                                    updateField('model', e.target.value);
                                                    updateField('generation', '');
                                                    updateField('trim', '');
                                                    setTaxModelId(found?.modelId || '');
                                                    setTaxGenerationId('');
                                                    setTaxGenerations([]); setTaxTrims([]);
                                                    if (found?.modelId) {
                                                        fetch(`/api/vehicles/taxonomy?resource=generations&modelId=${found.modelId}`)
                                                            .then(r => r.json()).then(d => setTaxGenerations(d.generations || [])).catch(() => {});
                                                    }
                                                }}
                                                className={dropdownClasses}
                                            >
                                                <option value="">Select model</option>
                                                {editFields.model && !taxModels.find(m => m.name === textValue(editFields.model)) && (
                                                    <option key="__current_model" value={textValue(editFields.model)}>{textValue(editFields.model)}</option>
                                                )}
                                                {taxModels.map((m, i) => <option key={m.modelId || `model_${i}`} value={m.name}>{m.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Generation & Trim */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                        <div>
                                            <FieldLabel>Generation</FieldLabel>
                                            <select
                                                value={textValue(editFields.generation) || ''}
                                                onChange={e => {
                                                    const found = taxGenerations.find(g => g.name === e.target.value);
                                                    updateField('generation', e.target.value);
                                                    updateField('trim', '');
                                                    setTaxGenerationId(found?.generationId || '');
                                                    setTaxTrims([]);
                                                    if (found?.generationId) {
                                                        fetch(`/api/vehicles/taxonomy?resource=trims&generationId=${found.generationId}`)
                                                            .then(r => r.json()).then(d => setTaxTrims((d.trims || []).map((t: any) => t.name).filter((n: any) => typeof n === 'string' && n.length > 0))).catch(() => {});
                                                    }
                                                }}
                                                className={dropdownClasses}
                                            >
                                                <option value="">Select generation</option>
                                                {editFields.generation && !taxGenerations.find(g => g.name === textValue(editFields.generation)) && (
                                                    <option key="__current_gen" value={textValue(editFields.generation)}>{textValue(editFields.generation)}</option>
                                                )}
                                                {taxGenerations.map((g, i) => <option key={g.generationId || `gen_${i}`} value={g.name}>{g.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <FieldLabel>Trim</FieldLabel>
                                            <select
                                                value={textValue(editFields.trim) || ''}
                                                onChange={e => updateField('trim', e.target.value)}
                                                className={dropdownClasses}
                                            >
                                                <option value="">Select trim</option>
                                                {editFields.trim && !taxTrims.includes(textValue(editFields.trim)) && (
                                                    <option key="__current_trim" value={textValue(editFields.trim)}>{textValue(editFields.trim)}</option>
                                                )}
                                                {taxTrims.map((t, i) => <option key={`trim_${i}_${t}`} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Engine Size & Fuel */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                                        <TextInput label="Engine Size" value={editFields.engineSize as string} field="engineSize" placeholder="e.g. 2.0" />
                                        <SelectInput label="Fuel Type" value={editFields.fuelType as string} field="fuelType" options={FUEL_TYPES} placeholder="Select fuel type" />
                                    </div>

                                    {/* Transmission, Driver Position, Drivetrain — Radio Groups */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2 mt-4">
                                        <RadioGroup label="Transmission" value={editFields.transmission as string} field="transmission" options={TRANSMISSIONS} />
                                        <RadioGroup label="Driver Position" value={editFields.driverPosition as string} field="driverPosition" options={['Right', 'Left', 'Central']} />
                                        <div>
                                            <FieldLabel>Drivetrain</FieldLabel>
                                            <div className="flex flex-wrap gap-x-5 gap-y-2">
                                                {['Front Wheel Drive', 'Rear Wheel Drive', 'Four Wheel Drive', 'Other'].map(o => (
                                                    <label key={o} className="flex items-center gap-2 cursor-pointer group">
                                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${editFields.drivetrain === o ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 group-hover:border-indigo-300'}`}>
                                                            {editFields.drivetrain === o && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                        </div>
                                                        <span className="text-sm font-bold text-slate-600">{o}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Derivative — Smart Dropdown */}
                                <DerivativeSelector
                                    currentDerivative={editFields.derivative as string}
                                    make={editFields.make as string}
                                    model={editFields.model as string}
                                    generation={editFields.generation as string}
                                    generationId={taxGenerationId}
                                    fuelType={editFields.fuelType as string}
                                    engineSize={editFields.engineSize as string}
                                    onChange={(derivativeLabel) => setEditFields(prev => ({ ...prev, derivative: derivativeLabel }))}
                                    onAutoComplete={(fields) => setEditFields(prev => ({ ...prev, ...fields }))}
                                />

                                {/* ─── Body & Appearance Section ─────────────────────────── */}
                                <div className="bg-white rounded-lg border border-[#E2E8F0] p-6 shadow-sm">

                                    {/* Body Type, Seats, Doors */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                                        <SelectInput label="Body Type" value={editFields.bodyType as string} field="bodyType" options={BODY_TYPES} placeholder="Select body type" />
                                        <NumberInput label="Seats" value={editFields.seats} field="seats" placeholder="e.g. 5" />
                                        <NumberInput label="Doors" value={editFields.doors} field="doors" placeholder="e.g. 5" />
                                    </div>

                                    {/* Colour & Colour Name */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                        <SelectInput label="Colour" value={editFields.colour as string} field="colour" options={COLOURS} placeholder="Select colour" />
                                        <TextInput label="Colour Name" value={editFields.colourName as string} field="colourName" placeholder="e.g. Black" />
                                    </div>

                                    {/* Exterior Finish & Interior Upholstery */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                        <SelectInput label="Exterior Finish" value={editFields.exteriorFinish as string} field="exteriorFinish" options={EXTERIOR_FINISHES} />
                                        <SelectInput label="Interior Upholstery" value={editFields.interiorUpholstery as string} field="interiorUpholstery" options={INTERIOR_UPHOLSTERIES} />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <SelectInput label="Interior Colour" value={(editFields as any).interiorColour as string} field={"interiorColour" as any} options={COLOURS} />
                                    </div>
                                </div>

                                {/* ─── Mileage & Date Section ─────────────────────────────── */}
                                <div className="bg-white rounded-lg border border-[#E2E8F0] p-6 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <FieldLabel>Mileage</FieldLabel>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={editFields.mileage || ''}
                                                    onChange={(e) => updateField('mileage', e.target.value)}
                                                    placeholder="e.g. 12,500"
                                                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF] transition-colors shadow-sm pr-20"
                                                />
                                                <button className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[#4D7CFF] font-bold px-2 py-1 border border-[#DCE4FF] rounded bg-white hover:bg-slate-50 flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                    Convert
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <FieldLabel>Date First Registered</FieldLabel>
                                            <input
                                                type="date"
                                                value={(editFields as any).dateFirstRegistered || ''}
                                                onChange={(e) => updateField('dateFirstRegistered' as any, e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF] transition-colors shadow-sm uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Floating Action Bar within the Tab Content */}
                                <div className="flex justify-start gap-2 pt-4">
                                    <button
                                        onClick={handleSaveVehicleFields}
                                        disabled={saving}
                                        className="px-6 py-2.5 bg-[#4D7CFF] text-white rounded-md text-[13px] font-bold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                                        {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        onClick={handleSaveVehicleFields}
                                        disabled={saving}
                                        className="px-6 py-2.5 bg-[#4D7CFF] text-white rounded-md text-[13px] font-bold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        Save &amp; Next -&gt;
                                    </button>
                                </div>
                            </div>
                        )}




                        {/* ─── Vehicle Details Help Drawer ───────────────────────────── */}
                        <div id="vehicleHelpDrawer" className="hidden fixed inset-0 z-50 flex justify-end" onClick={() => document.getElementById('vehicleHelpDrawer')?.classList.add('hidden')}>
                            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between px-5 py-4 bg-[#4D7CFF] text-white">
                                    <div className="flex items-center gap-2">
                                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" /></svg>
                                        <div className="text-[14px] font-bold">Vehicle Details — Help</div>
                                    </div>
                                    <button onClick={() => document.getElementById('vehicleHelpDrawer')?.classList.add('hidden')} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors text-white text-[12px]">✕</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-700">

                                    <div>
                                        <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">Overview</h2>
                                        <p className="text-[12px] leading-relaxed text-slate-600">The Vehicle Details section lists all basic vehicle information — make, model, transmission, colour, and upholstery. This data is pushed to AutoTrader and used to populate your advert.</p>
                                    </div>

                                    <div>
                                        <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">✅ What&apos;s Currently Built</h2>
                                        <ul className="space-y-1.5 text-[12px] text-slate-600">
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Vehicle Type</strong> — Cars, Vans, Motorcycles etc.</span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Manufacturer &amp; Model</strong> — free-text, sourced from AutoTrader stock</span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Generation &amp; Trim</strong> — e.g. Estate (2019-2024), Sport</span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Engine Size &amp; Fuel Type</strong> — petrol, diesel, EV, hybrid etc.</span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Transmission</strong> — Manual / Automatic / Semi-Auto</span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Driver Position</strong> — Right / Left / Central</span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Drivetrain</strong> — FWD / RWD / 4WD</span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Derivative</strong> — full derivative string from AutoTrader</span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Body Type, Seats, Doors</strong></span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Colour, Colour Name, Exterior Finish</strong></span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Interior Upholstery &amp; Interior Colour</strong></span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Retail Price</strong> — £ input linked to AT advert</span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Mileage</strong></span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Service History &amp; Previous Owners</strong></span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Key Tags</strong> — custom internal tags</span></li>
                                            <li className="flex gap-2"><span className="text-green-500 font-bold">•</span><span><strong>Save &amp; Save Next</strong> — saves all fields back to AT via PATCH</span></li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">⚡ The Derivative</h2>
                                        <p className="text-[12px] leading-relaxed text-slate-600 mb-2">The <strong>Derivative</strong> is the most important field. It determines the correct vehicle spec, standard &amp; optional extras in subsequent sections. On AutoTrader, selecting the correct derivative unlocks pre-filled specifications.</p>
                                        <p className="text-[12px] leading-relaxed text-slate-600">Currently the derivative is shown as a <strong>free-text field</strong> populated from the AT stock record. MotorDesk provides a smart derivative <em>dropdown</em> that auto-selects once Make + Model + Generation + one extra field (fuel or engine) is entered.</p>
                                    </div>

                                    <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                                        <div className="text-[12px] font-bold text-orange-700 mb-3">🚧 Coming Soon — Future Work</div>
                                        <div className="space-y-3 text-[11px] text-orange-800">

                                            <div>
                                                <div className="font-bold mb-0.5">Auto-Population from VRM</div>
                                                <div className="text-orange-700 leading-relaxed">When a VRM is entered, automatically populate all vehicle fields (make, model, derivative, colour, engine, fuel etc.) from AutoTrader&apos;s vehicle lookup. Currently all fields come pre-filled from AT stock but are not re-lookupable on demand. <strong>Requires:</strong> AT VRM lookup endpoint integration.</div>
                                            </div>


                                            <div>
                                                <div className="font-bold mb-0.5">Year of Manufacture / Registration</div>
                                                <div className="text-orange-700 leading-relaxed">Dedicated year field for filtering and display. Currently derived from the vehicle record but not shown as an editable field.</div>
                                            </div>

                                            <div>
                                                <div className="font-bold mb-0.5">CAP Code / EAN</div>
                                                <div className="text-orange-700 leading-relaxed">Industry-standard CAP code for valuations and Glass&apos;s lookups. <strong>Requires:</strong> CAP HPI integration.</div>
                                            </div>

                                            <div>
                                                <div className="font-bold mb-0.5">VIN / Chassis Number Entry</div>
                                                <div className="text-orange-700 leading-relaxed">Editable VIN field for manual entry/verification. Currently shown in Vehicle Check but not editable here.</div>
                                            </div>

                                            <div>
                                                <div className="font-bold mb-0.5">Condition / Accident History Fields</div>
                                                <div className="text-orange-700 leading-relaxed">Fields for recording vehicle condition grade (Excellent/Good/Fair) and whether the vehicle has had any accident damage repaired.</div>
                                            </div>

                                            <div>
                                                <div className="font-bold mb-0.5">V5C / Registration Document Upload</div>
                                                <div className="text-orange-700 leading-relaxed">Attach a scanned copy of the V5C document to the vehicle record. <strong>Requires:</strong> document storage integration.</div>
                                            </div>

                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* ═══ IMAGES TAB ══════════════════════════════════════════ */}
                        {activeTab === 'images' && (
                            <div className="space-y-6">
                                {/* ─── Header & Badges ───────────────────────────────────── */}
                                <div className="bg-white rounded-lg border border-[#E2E8F0] p-6 shadow-sm">
                                    <SectionTitle
                                        rightContent={
                                            <>
                                                <button onClick={() => setShowHelpSidebar(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] rounded text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors">
                                                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" /></svg>
                                                    Help
                                                </button>
                                                <div className="px-3 py-1.5 text-[11px] font-bold text-[#4D7CFF] border border-[#DCE4FF] rounded bg-blue-50/50 flex items-center gap-1.5 shadow-sm uppercase tracking-wider">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#4D7CFF] animate-pulse"></span>
                                                    On Site
                                                </div>
                                                <div className="px-3 py-1.5 text-[11px] font-bold text-white bg-[#4D7CFF] rounded shadow-sm uppercase tracking-wider">
                                                    For Sale
                                                </div>
                                            </>
                                        }
                                    >
                                        Vehicle Images & Videos
                                    </SectionTitle>

                                    {/* ─── Sub-Navigation & Utilities ─────────────────────── */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                                        <div className="flex items-center gap-8">
                                            {['upload', 'youtube', 'library'].map(tab => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setActiveImageTab(tab as any)}
                                                    className={`relative pb-4 text-[13px] font-bold transition-all ${activeImageTab === tab ? 'text-[#4D7CFF]' : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                                    {activeImageTab === tab && (
                                                        <div className="absolute bottom-0 left-0 w-full h-1 bg-[#4D7CFF] rounded-full"></div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button key="Groups" onClick={() => setShowGroupsPanel(true)} className="px-3 py-1.5 border border-[#DCE4FF] rounded text-[11px] font-bold text-[#4D7CFF] hover:bg-blue-50 transition-colors bg-white shadow-sm">Groups</button>
                                            <button key="Photo Guide" className="px-3 py-1.5 border border-[#DCE4FF] rounded text-[11px] font-bold text-[#4D7CFF] hover:bg-blue-50 transition-colors bg-white shadow-sm">Photo Guide</button>
                                            <button key="Backgrounds" className="px-3 py-1.5 border border-[#DCE4FF] rounded text-[11px] font-bold text-[#4D7CFF] hover:bg-blue-50 transition-colors bg-white shadow-sm">Backgrounds</button>
                                        </div>
                                    </div>

                                    {/* ─── Tab Content ────────────────────────────────────── */}
                                    {activeImageTab === 'upload' && (
                                        <div className="space-y-6">
                                            {/* Drop zone */}
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => { e.preventDefault(); handleImageUpload(e.dataTransfer.files); }}
                                                className="bg-white rounded border border-dashed border-[#E2E8F0] p-10 text-center cursor-pointer hover:border-[#4D7CFF] hover:bg-blue-50/20 transition-all"
                                            >
                                                <p className="text-[13px] font-medium text-slate-500 italic">Drop image/video files, or click to browse.</p>
                                                {uploading && <div className="mt-4 text-[#4D7CFF] font-bold text-[11px] animate-pulse">UPLOADING TO AUTOTRADER CDN...</div>}
                                            </div>

                                            {/* Image Grid */}
                                            {uploadedImages.length > 0 && (
                                                <div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                                                        {uploadedImages.map((img, i) => {
                                                            const meta = imageMetadata[img.imageId] || {};
                                                            const bannerColor = BANNER_COLORS.find(c => c.bg === meta.bannerColor) || BANNER_COLORS[0];
                                                            const handleDragStart = () => { dragIdx.current = i; };
                                                            const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
                                                            const handleDrop = () => {
                                                                if (dragIdx.current === null || dragIdx.current === i) return;
                                                                setUploadedImages(prev => {
                                                                    const arr = [...prev];
                                                                    const [moved] = arr.splice(dragIdx.current!, 1);
                                                                    arr.splice(i, 0, moved);
                                                                    dragIdx.current = null;
                                                                    return arr;
                                                                });
                                                            };
                                                            return (
                                                                <div key={String(img.imageId)} className="rounded border border-[#E2E8F0] bg-slate-100 overflow-hidden shadow-sm">
                                                                    {/* Image tile */}
                                                                    <div
                                                                        draggable
                                                                        onDragStart={handleDragStart}
                                                                        onDragOver={handleDragOver}
                                                                        onDrop={handleDrop}
                                                                        className="relative group aspect-[4/3] overflow-hidden cursor-grab active:cursor-grabbing select-none"
                                                                    >
                                                                        <img src={img.href} alt={`Car image ${i + 1}`} className="w-full h-full object-cover pointer-events-none"
                                                                            onError={(e) => { const cur = e.currentTarget.src; if (cur.includes('w800h600')) e.currentTarget.src = cur.replace('w800h600', 'w480h360'); else if (cur.includes('w480h360')) e.currentTarget.src = cur.replace('w480h360', 'w300h225'); }}
                                                                        />
                                                                        {/* Banner overlay */}
                                                                        {meta.banner && (
                                                                            <div className="absolute bottom-0 left-0 right-0 py-1 text-center text-[10px] font-bold" style={{ backgroundColor: meta.bannerColor || '#DC2626', color: bannerColor.text }}>{meta.banner}</div>
                                                                        )}
                                                                        {/* Position badge */}
                                                                        <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">#{i + 1}</div>
                                                                        {/* Group badge */}
                                                                        {meta.group && <div className="absolute top-1 right-1 bg-[#4D7CFF]/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">{meta.group}</div>}
                                                                        {/* Delete */}
                                                                        <button onClick={(e) => { e.stopPropagation(); removeImage(img.imageId); }} className="absolute bottom-1 right-1 bg-red-500 text-white w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm">
                                                                            <svg width="9" height="9" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg>
                                                                        </button>
                                                                    </div>
                                                                    {/* Per-image controls */}
                                                                    <div className="p-2 bg-white border-t border-slate-100 space-y-1.5">
                                                                        {/* Group selector — only updates local state, Save button saves */}
                                                                        <select value={meta.group || ''} onChange={e => { const m = { ...imageMetadata, [img.imageId]: { ...meta, group: e.target.value || undefined } }; setImageMetadata(m); }}
                                                                            className="w-full text-[10px] font-semibold text-slate-600 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-[#4D7CFF] bg-white">
                                                                            <option value="">— Group —</option>
                                                                            {IMAGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                                                        </select>
                                                                        {/* Banner text */}
                                                                        <div className="flex gap-1">
                                                                            <input type="text" value={meta.banner || ''} onChange={e => updateImgMeta(img.imageId, { banner: e.target.value })}
                                                                                placeholder="Banner text"
                                                                                className="flex-1 text-[10px] border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-[#4D7CFF]"
                                                                            />
                                                                            {/* Color picker */}
                                                                            <div className="flex gap-0.5">
                                                                                {BANNER_COLORS.map(c => (
                                                                                    <button key={c.bg} title={c.label} onClick={() => { const m = { ...imageMetadata, [img.imageId]: { ...meta, bannerColor: c.bg } }; setImageMetadata(m); }}
                                                                                        className={`w-4 h-4 rounded-sm border-2 transition-all ${meta.bannerColor === c.bg ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                                                                                        style={{ backgroundColor: c.bg }} />
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                        {/* Branding toggle */}
                                                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                                                            <div className={`w-7 h-4 rounded-full transition-colors relative ${meta.branding ? 'bg-[#4D7CFF]' : 'bg-slate-200'}`}
                                                                                onClick={() => { const m = { ...imageMetadata, [img.imageId]: { ...meta, branding: !meta.branding } }; setImageMetadata(m); }}>
                                                                                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${meta.branding ? 'left-3.5' : 'left-0.5'}`} />
                                                                            </div>
                                                                            <span className="text-[10px] font-semibold text-slate-500">Branding</span>
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Action Bar — matches MotorDesk */}
                                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={handleSaveImages}
                                                                disabled={saving}
                                                                className="px-5 py-2 bg-[#4D7CFF] text-white rounded text-[13px] font-bold hover:bg-blue-600 transition-all shadow-sm flex items-center gap-2"
                                                            >
                                                                {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={handleSaveImages}
                                                                disabled={saving}
                                                                className="px-5 py-2 bg-[#4D7CFF] text-white rounded text-[13px] font-bold hover:bg-blue-600 transition-all shadow-sm"
                                                            >
                                                                Save &amp; Next -&gt;
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    uploadedImages.forEach(img => {
                                                                        const a = document.createElement('a');
                                                                        a.href = img.href;
                                                                        a.download = `${img.imageId}.jpg`;
                                                                        a.target = '_blank';
                                                                        a.click();
                                                                    });
                                                                }}
                                                                className="px-4 py-2 border border-[#E2E8F0] text-slate-600 rounded text-[13px] font-bold hover:bg-slate-50 transition-all shadow-sm"
                                                            >
                                                                Download Images
                                                            </button>
                                                            <button
                                                                onClick={() => setUploadedImages([])}
                                                                className="px-4 py-2 bg-red-500 text-white rounded text-[13px] font-bold hover:bg-red-600 transition-all shadow-sm"
                                                            >
                                                                Remove All
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Photography Tips Section */}
                                            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                                                <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                                <div>
                                                    <div className="text-[13px] font-bold text-blue-700">Photography Tips &amp; Guide</div>
                                                    <div className="text-[12px] text-blue-600 mt-0.5">
                                                        For tips and guidance taking great vehicle photos, please visit the{' '}
                                                        <a href="https://www.autotrader.co.uk" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-blue-800">AutoTrader Blog</a>.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ─── Groups Panel Modal ───────────────────────────────── */}
                                    {showGroupsPanel && (
                                        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-12 px-4" onClick={() => setShowGroupsPanel(false)}>
                                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                                                {/* Header */}
                                                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                                                    <div>
                                                        <div className="text-[15px] font-bold text-slate-800">Photo Groups</div>
                                                        <div className="text-[11px] text-slate-400 mt-0.5">Assign groups so customers can easily jump to interior, exterior, or highlight photos.</div>
                                                    </div>
                                                    <button onClick={() => setShowGroupsPanel(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-500">✕</button>
                                                </div>
                                                {/* Group legend */}
                                                <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-slate-50 bg-slate-50">
                                                    {IMAGE_GROUPS.map(g => (
                                                        <span key={g} className="px-2.5 py-1 bg-[#4D7CFF]/10 text-[#4D7CFF] text-[10px] font-bold rounded-full">{g}</span>
                                                    ))}
                                                </div>
                                                {/* Image grid */}
                                                <div className="overflow-y-auto flex-1 p-6">
                                                    {uploadedImages.length === 0 ? (
                                                        <div className="text-center py-16 text-slate-400 text-[13px]">No images uploaded yet.</div>
                                                    ) : (
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                            {uploadedImages.map((img, i) => {
                                                                const meta = imageMetadata[img.imageId] || {};
                                                                return (
                                                                    <div key={img.imageId} className="rounded-lg border border-slate-100 overflow-hidden shadow-sm">
                                                                        <div className="relative aspect-[4/3] bg-slate-100">
                                                                            <img src={img.href} alt="" className="w-full h-full object-cover"
                                                                                onError={(e) => { const cur = e.currentTarget.src; if (cur.includes('w800h600')) e.currentTarget.src = cur.replace('w800h600', 'w480h360'); }}
                                                                            />
                                                                            <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">#{i + 1}</div>
                                                                        </div>
                                                                        <div className="p-2 bg-white">
                                                                            <select value={meta.group || ''} onChange={e => { const m = { ...imageMetadata, [img.imageId]: { ...meta, group: e.target.value || undefined } }; setImageMetadata(m); }}
                                                                                className="w-full text-[11px] font-semibold text-slate-700 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4D7CFF] bg-white">
                                                                                <option value="">— No Group —</option>
                                                                                {IMAGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Footer */}
                                                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
                                                    <button onClick={() => setShowGroupsPanel(false)} className="px-4 py-2 text-[13px] font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                                                    <button onClick={async () => { await saveImageMetadata(imageMetadata); toast.success('Groups saved!'); setShowGroupsPanel(false); }}
                                                        className="px-5 py-2 bg-[#4D7CFF] text-white rounded text-[13px] font-bold hover:bg-blue-600 transition-all shadow-sm">
                                                        Save Changes
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeImageTab === 'youtube' && (
                                        <div className="space-y-6">
                                            {/* URL Input */}
                                            <div className="bg-slate-50 rounded-lg border border-[#E2E8F0] p-5">
                                                <div className="text-[13px] font-bold text-slate-700 mb-1">YouTube Video URL</div>
                                                <div className="text-[11px] text-slate-400 mb-4">URL must be in the format: https://youtube.com/watch?v=xxxxxxxxxx — Shorts are not supported.</div>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="url"
                                                        value={youtubeUrl}
                                                        onChange={e => setYoutubeUrl(e.target.value)}
                                                        placeholder="https://youtube.com/watch?v=xxxxxxxxxx"
                                                        className="flex-1 bg-white border border-[#E2E8F0] rounded px-3 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF] transition-colors"
                                                    />
                                                    <button
                                                        onClick={handleAddYoutube}
                                                        disabled={youtubeSaving || !youtubeUrl.trim()}
                                                        className="px-5 py-2 bg-red-600 text-white rounded text-[13px] font-bold hover:bg-red-700 transition-all shadow-sm flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                                                    >
                                                        {youtubeSaving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '▶'}
                                                        Add Video
                                                    </button>
                                                </div>
                                                {/* Preview of entered URL */}
                                                {extractYoutubeId(youtubeUrl) && (
                                                    <div className="mt-4 flex items-center gap-4">
                                                        <img
                                                            src={`https://img.youtube.com/vi/${extractYoutubeId(youtubeUrl)}/mqdefault.jpg`}
                                                            alt="Video thumbnail"
                                                            className="w-32 h-20 object-cover rounded border border-[#E2E8F0]"
                                                        />
                                                        <div>
                                                            <div className="text-[11px] font-bold text-emerald-600 mb-1">✓ Valid YouTube URL</div>
                                                            <div className="text-[11px] text-slate-500">Video ID: <span className="font-mono font-bold text-slate-700">{extractYoutubeId(youtubeUrl)}</span></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Saved Videos Grid */}
                                            {youtubeVideos.length > 0 && (
                                                <div>
                                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{youtubeVideos.length} Video{youtubeVideos.length !== 1 ? 's' : ''} Added</div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                        {youtubeVideos.map(vid => (
                                                            <div key={vid} className="relative group rounded border border-[#E2E8F0] overflow-hidden bg-slate-100 aspect-video shadow-sm">
                                                                <img
                                                                    src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`}
                                                                    alt="YouTube thumbnail"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                {/* YouTube play icon overlay */}
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center opacity-80">
                                                                        <span className="text-white text-[10px] ml-0.5">▶</span>
                                                                    </div>
                                                                </div>
                                                                <a href={`https://youtube.com/watch?v=${vid}`} target="_blank" rel="noopener noreferrer"
                                                                    className="absolute inset-0"
                                                                />
                                                                <button
                                                                    onClick={e => { e.preventDefault(); handleRemoveYoutube(vid); }}
                                                                    className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm z-10"
                                                                >
                                                                    <svg width="10" height="10" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {youtubeVideos.length === 0 && (
                                                <div className="py-12 text-center">
                                                    <div className="text-4xl mb-3">📹</div>
                                                    <div className="text-[13px] font-semibold text-slate-400">No YouTube videos added yet</div>
                                                    <div className="text-[11px] text-slate-300 mt-1">Paste a YouTube URL above to get started</div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {activeImageTab === 'library' && (
                                        <div className="py-20 text-center text-slate-400 italic font-medium animate-pulse">Image Library Placeholder</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ─── Help Sidebar ────────────────────────────────────── */}
                        {showHelpSidebar && (
                            <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowHelpSidebar(false)}>
                                <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#4D7CFF] text-white">
                                        <div className="flex items-center gap-2">
                                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" /></svg>
                                            <div className="text-[14px] font-bold">Vehicle Images &amp; Videos — Help</div>
                                        </div>
                                        <button onClick={() => setShowHelpSidebar(false)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors text-white text-[12px]">✕</button>
                                    </div>
                                    {/* Scrollable content */}
                                    <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-700">

                                        {/* Overview */}
                                        <div>
                                            <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">Overview</h2>
                                            <p className="text-[12px] leading-relaxed text-slate-600">
                                                To upload images/photos and videos of your vehicles for sale, go to the <strong>Images &amp; Videos</strong> section for the relevant vehicle. You can also jump here by selecting the <em>&apos;X Images&apos;</em> or <em>&apos;X Videos&apos;</em> buttons from the Vehicles → Browse Vehicles page.
                                            </p>
                                        </div>

                                        {/* Uploading */}
                                        <div>
                                            <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">📤 Uploading Images &amp; Videos</h2>
                                            <ul className="space-y-2 text-[12px] text-slate-600">
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>Under the <strong>Upload</strong> tab, drag and drop photo or video files into the drop area, or click to browse files from your device.</span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span><strong>Multiple files</strong> can be uploaded at once — hold Ctrl or Cmd when selecting.</span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>On mobile, you can take a photo directly — though for best results, take photos in your camera app first, then select multiple to upload.</span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>Files are uploaded directly to <strong>AutoTrader&apos;s CDN</strong> and linked to your advert.</span></li>
                                            </ul>
                                        </div>

                                        {/* Reordering */}
                                        <div>
                                            <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">🔀 Re-Ordering Images</h2>
                                            <ul className="space-y-2 text-[12px] text-slate-600">
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>Simply <strong>drag and drop</strong> any image card to a new position in the grid.</span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>The <strong>#1</strong> position image is your primary/featured image shown on search results.</span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>After reordering, press <strong>Save</strong> to push the new order to AutoTrader.</span></li>
                                            </ul>
                                        </div>

                                        {/* Groups */}
                                        <div>
                                            <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">🗂 Photo Groups</h2>
                                            <ul className="space-y-2 text-[12px] text-slate-600">
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>Assign each image a <strong>Group</strong> (Exterior, Interior, Detail, Engine, Video, Highlight, Other) using the dropdown below each image or via the <strong>Groups</strong> button.</span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>The <strong>Groups button</strong> opens a focused panel to quickly set all groups at once, then press <em>Save Changes</em>.</span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>Grouped photos help customers jump to the photos that matter to them (e.g. jump straight to Interior shots).</span></li>
                                            </ul>
                                        </div>

                                        {/* Banner/Ribbon */}
                                        <div>
                                            <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">🏷 Banner / Ribbon</h2>
                                            <ul className="space-y-2 text-[12px] text-slate-600">
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>Type text in the <strong>Banner text</strong> field below any image to show a coloured ribbon at the bottom of that image (e.g. <em>&quot;Low Mileage&quot;</em>, <em>&quot;1 Owner&quot;</em>).</span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>Pick a <strong>colour swatch</strong> (Red, Green, Blue, Black, Yellow) for the banner background.</span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>The banner preview is visible live on the image card.</span></li>
                                            </ul>
                                        </div>

                                        {/* YouTube */}
                                        <div>
                                            <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">▶ YouTube Videos</h2>
                                            <ul className="space-y-2 text-[12px] text-slate-600">
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>Switch to the <strong>Youtube</strong> tab and paste a full YouTube URL: <code className="bg-slate-100 px-1 rounded text-[10px]">https://youtube.com/watch?v=xxxxxxxxxx</code></span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>A <strong>thumbnail preview</strong> appears instantly to confirm the video is valid before saving.</span></li>
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>Press <strong>Add Video</strong> to save. Multiple videos can be added.</span></li>
                                                <li className="flex gap-2"><span className="text-orange-500] font-bold mt-0.5">⚠</span><span><strong>YouTube Shorts</strong> are not supported — only standard watch URLs.</span></li>
                                            </ul>
                                        </div>

                                        {/* Branding */}
                                        <div>
                                            <h2 className="text-[13px] font-bold text-slate-800 mb-2 pb-1.5 border-b border-slate-100">🏢 Branding</h2>
                                            <ul className="space-y-2 text-[12px] text-slate-600">
                                                <li className="flex gap-2"><span className="text-[#4D7CFF] font-bold mt-0.5">•</span><span>Toggle <strong>Branding</strong> on/off per image to record which images should have your dealer branding/watermark applied.</span></li>
                                                <li className="flex gap-2"><span className="text-slate-400 font-bold mt-0.5">ℹ</span><span>Actual watermark overlay requires an image processing integration (e.g. Cloudinary). The toggle currently saves your <em>preference</em> for future use.</span></li>
                                            </ul>
                                        </div>

                                        {/* Tips */}
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                            <div className="text-[12px] font-bold text-blue-700 mb-2">📸 Photography Tips</div>
                                            <ul className="space-y-1.5 text-[11px] text-blue-700">
                                                <li>• Shoot in natural daylight where possible</li>
                                                <li>• Use at least 10-20 images per vehicle</li>
                                                <li>• Always include: front 3/4, rear 3/4, driver seat, dashboard, rear seats, boot, engine bay, wheels</li>
                                                <li>• Make the #1 image a clean front 3/4 shot on a plain background</li>
                                                <li>• Minimum recommended size: 1280 × 960 pixels</li>
                                                <li>• AutoTrader max image size: 20 MB per image</li>
                                            </ul>
                                        </div>

                                        {/* Future Work */}
                                        <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                                            <div className="text-[12px] font-bold text-orange-700 mb-3">🚧 Coming Soon — Future Work</div>
                                            <div className="space-y-3 text-[11px] text-orange-800">

                                                <div>
                                                    <div className="font-bold mb-0.5">Background Removal</div>
                                                    <div className="text-orange-700 leading-relaxed">Automatically remove/replace image backgrounds with plain white or custom backdrop. <strong>Requires:</strong> <code className="bg-orange-100 px-1 rounded">remove.bg API</code> or <code className="bg-orange-100 px-1 rounded">Cloudinary AI</code>. UI button (Backgrounds) exists but not connected.</div>
                                                </div>

                                                <div>
                                                    <div className="font-bold mb-0.5">Image Templates / Dealer Frames</div>
                                                    <div className="text-orange-700 leading-relaxed">Dealer-branded overlays/frames (border, logo corner, colour strip) per image. <strong>Requires:</strong> Canvas-based or Cloudinary transformation pipeline per dealer template.</div>
                                                </div>

                                                <div>
                                                    <div className="font-bold mb-0.5">Branding / Watermarking (Live)</div>
                                                    <div className="text-orange-700 leading-relaxed">Apply dealer logo watermark when Branding toggle is ON. <strong>Requires:</strong> Dealer logo in settings + image compositing via Cloudinary or server-side sharp. Toggle currently saves preference only — no image modification yet.</div>
                                                </div>

                                                <div>
                                                    <div className="font-bold mb-0.5">Image Library</div>
                                                    <div className="text-orange-700 leading-relaxed">Shared dealer library to reuse stock/dealership photos across vehicles. <strong>Requires:</strong> Dealer-scoped media storage (S3/Cloudinary) + Library tab UI (placeholder exists).</div>
                                                </div>

                                                <div>
                                                    <div className="font-bold mb-0.5">360° Spin View (Exterior &amp; Interior)</div>
                                                    <div className="text-orange-700 leading-relaxed">Upload a sequence of images for draggable 360° spin viewer. <strong>Requires:</strong> 360 image sequence upload + JS viewer (e.g. <code className="bg-orange-100 px-1 rounded">pannellum</code> / <code className="bg-orange-100 px-1 rounded">three.js</code>). AutoTrader supports 360 via separate API endpoint.</div>
                                                </div>

                                                <div>
                                                    <div className="font-bold mb-0.5">Bulk Background Replace</div>
                                                    <div className="text-orange-700 leading-relaxed">Replace backgrounds on all images in one click. <strong>Requires:</strong> Background removal API + server-side batch processing queue.</div>
                                                </div>

                                                <div>
                                                    <div className="font-bold mb-0.5">AutoTrader Ad Score (Images)</div>
                                                    <div className="text-orange-700 leading-relaxed">Per-image quality score from AT image assessment API. <strong>Requires:</strong> AT Image Quality Assessment endpoint (separate AT API capability).</div>
                                                </div>

                                                <div>
                                                    <div className="font-bold mb-0.5">Photo Guide (Interactive)</div>
                                                    <div className="text-orange-700 leading-relaxed">In-app shot-by-shot guide showing dealers how to position the camera for each required photo. <strong>Requires:</strong> Shot guide layout design + illustration assets. Button exists but opens nothing.</div>
                                                </div>

                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ OPTIONS TAB — Vehicle Options & Description ════════ */}
                        {activeTab === 'options' && (
                            <OptionsTab
                                editAttentionGrabber={editAttentionGrabber}
                                setEditAttentionGrabber={setEditAttentionGrabber}
                                editLongAttentionGrabber={editLongAttentionGrabber}
                                setEditLongAttentionGrabber={setEditLongAttentionGrabber}
                                editDescription={editDescription}
                                setEditDescription={setEditDescription}
                                editDescription2={editDescription2}
                                setEditDescription2={setEditDescription2}
                                editFeatures={editFeatures}
                                setEditFeatures={setEditFeatures}
                                saving={saving}
                                onSave={handleSaveContent}
                                vehicleMake={textValue(vehicle?.make)}
                                vehicleFeatures={vehicle?.features || []}
                                vehicleVrm={vehicle?.vrm}
                                vehicleInfo={{
                                    mileage: vehicle?.mileage ? Number(vehicle.mileage) : undefined,
                                    bhp: (vehicle as any)?.technicalSpecs?.enginePowerBHP ?? undefined,
                                    year: vehicle?.year ? Number(vehicle.year) : undefined,
                                    derivative: vehicle?.derivative || undefined,
                                    ulezCompliant: (vehicle as any)?.technicalSpecs?.ulezCompliant ?? undefined,
                                }}
                                atOptions={atOptions}
                                atStdFeatures={atStdFeatures}
                                atFactoryFitted={atFactoryFitted}
                                atLoading={atLoading}
                                atHasData={atHasData}
                                editCustomFeatures={editCustomFeatures}
                                setEditCustomFeatures={setEditCustomFeatures}
                            />
                        )}


                        {/* ═══ HISTORY TAB ══════════════════════════════════════════ */}
                        {activeTab === 'history' && vehicle && (
                            <HistoryTab
                                vehicle={vehicle}
                                saving={saving}
                                onSave={(updates) => patchVehicle(updates)}
                                onVinFound={(vin, engineNumber) => {
                                    const patch: Record<string, string> = {};
                                    if (vin) patch.vin = vin;
                                    if (engineNumber) patch.engineNumber = engineNumber;
                                    patchVehicle(patch);
                                    setVehicle(prev => prev ? { ...prev, ...patch } : null);
                                    setEditFields(prev => ({ ...prev, ...patch }));
                                }}
                            />
                        )}

                        {/* ═══ CHANNELS TAB ═════════════════════════════════════════ */}
                        {activeTab === 'salesChannels' && vehicle && (
                            <div className="space-y-5 w-full">

                                {/* ── AutoTrader Channel Card (MotorDesk Style) ── */}
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                    {/* Header row */}
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
                                        <div className="flex items-center gap-3">
                                            {/* AutoTrader Logo-style badge */}
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FF6B00]/10 rounded-lg border border-[#FF6B00]/20">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l1.5-5h11L19 13M5 13H3v3h1m15-3h2v3h-1M5 13h14M7 16v1m10-1v1"/>
                                                    <circle cx="7.5" cy="17.5" r="1.5"/>
                                                    <circle cx="16.5" cy="17.5" r="1.5"/>
                                                </svg>
                                                <span className="text-[13px] font-extrabold text-[#FF6B00] tracking-tight">AutoTrader</span>
                                            </div>
                                            {/* Published / Unpublished badge */}
                                            {vehicle.atAdvertStatus === 'PUBLISHED' ? (
                                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-extrabold uppercase tracking-wide shadow-sm">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                                    Published
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-wide">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                    Not Published
                                                </span>
                                            )}
                                        </div>
                                        {/* Big publish toggle */}
                                        <button
                                            onClick={() => toggleAndSave('atAdvertStatus')}
                                            disabled={savingChannel === 'atAdvertStatus'}
                                            className={`relative w-14 h-7 rounded-full transition-all duration-300 shadow-inner focus:outline-none disabled:opacity-60 ${
                                                vehicle.atAdvertStatus === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-slate-200'
                                            }`}
                                            title={vehicle.atAdvertStatus === 'PUBLISHED' ? 'Click to unpublish from AutoTrader' : 'Click to publish to AutoTrader'}
                                        >
                                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
                                                vehicle.atAdvertStatus === 'PUBLISHED' ? 'left-8' : 'left-1'
                                            }`} />
                                        </button>
                                    </div>

                                    {/* Advert Performance Metrics */}
                                    {vehicle.responseMetrics && (
                                        <div className="px-6 py-5">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                                                </svg>
                                                Advert Performance
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {/* Score */}
                                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Score</div>
                                                    <div className="text-[22px] font-extrabold text-slate-800 leading-none">
                                                        {vehicle.responseMetrics.performanceRating?.score != null
                                                            ? `${vehicle.responseMetrics.performanceRating.score}%`
                                                            : '—'}
                                                    </div>
                                                </div>
                                                {/* Rating */}
                                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Rating</div>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                            vehicle.responseMetrics.performanceRating?.rating?.toLowerCase().includes('above')
                                                                ? 'bg-emerald-500'
                                                                : vehicle.responseMetrics.performanceRating?.rating?.toLowerCase().includes('below')
                                                                ? 'bg-red-400'
                                                                : 'bg-amber-400'
                                                        }`} />
                                                        <span className="text-[13px] font-bold text-slate-700">
                                                            {vehicle.responseMetrics.performanceRating?.rating || '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Advert Views */}
                                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Advert Views</div>
                                                    <div className="flex gap-4">
                                                        <div>
                                                            <div className="text-[9px] text-slate-400 mb-0.5">Yesterday</div>
                                                            <div className="text-[18px] font-extrabold text-slate-800">
                                                                {vehicle.responseMetrics.yesterday?.advertViews ?? '—'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[9px] text-slate-400 mb-0.5">Past Week</div>
                                                            <div className="text-[18px] font-extrabold text-slate-800">
                                                                {vehicle.responseMetrics.lastWeek?.advertViews ?? '—'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Search Views */}
                                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Search Views</div>
                                                    <div className="flex gap-4">
                                                        <div>
                                                            <div className="text-[9px] text-slate-400 mb-0.5">Yesterday</div>
                                                            <div className="text-[18px] font-extrabold text-slate-800">
                                                                {vehicle.responseMetrics.yesterday?.searchViews ?? '—'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[9px] text-slate-400 mb-0.5">Past Week</div>
                                                            <div className="text-[18px] font-extrabold text-slate-800">
                                                                {vehicle.responseMetrics.lastWeek?.searchViews ?? '—'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* No metrics placeholder when not published or no metrics */}
                                    {!vehicle.responseMetrics && vehicle.atAdvertStatus === 'PUBLISHED' && (
                                        <div className="px-6 py-5">
                                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-[12px] text-blue-700 font-medium">
                                                📊 Advert performance data will appear here once metrics are available from AutoTrader (usually within 24 hours of publishing).
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer — Create / Save & Publish / Save & Unpublish */}
                                    <div className="flex items-center justify-between px-6 py-4 bg-slate-50/60 border-t border-[#E2E8F0]">
                                        <div className="text-[11px] text-slate-400 font-medium">
                                            {vehicle.stockId
                                                ? <span>Stock ID: <span className="font-mono font-bold text-slate-500">{vehicle.stockId.substring(0, 12)}…</span></span>
                                                : <span className="text-amber-600">⚠ Not yet pushed to AutoTrader</span>
                                            }
                                        </div>
                                        {vehicle.stockId ? (
                                            <button
                                                onClick={async () => {
                                                    if (!vehicle.stockId) return;
                                                    setSaving(true);
                                                    try {
                                                        // Push latest advert text to AT without changing channel statuses
                                                        const res = await fetch(`/api/vehicles/autotrader-stock/${vehicle.stockId}/advertise`, {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                channels: {
                                                                    autotrader: vehicle.atAdvertStatus         || 'NOT_PUBLISHED',
                                                                    advertiser: vehicle.advertiserAdvertStatus  || 'NOT_PUBLISHED',
                                                                    locator:    vehicle.locatorAdvertStatus     || 'NOT_PUBLISHED',
                                                                    export:     vehicle.exportAdvertStatus      || 'NOT_PUBLISHED',
                                                                    profile:    vehicle.profileAdvertStatus     || 'NOT_PUBLISHED',
                                                                },
                                                                attentionGrabber: (vehicle.attentionGrabber || '').trim().slice(0, 30) || undefined,
                                                                description: (vehicle.description || vehicle.description2 || '').trim().slice(0, 4000) || undefined,
                                                            }),
                                                        });
                                                        const d = await res.json();
                                                        if (!d.ok) throw new Error(d.error || 'Failed');
                                                    } catch (err: any) {
                                                        alert(err.message || 'Failed to update advert text');
                                                    } finally {
                                                        setSaving(false);
                                                    }
                                                }}
                                                disabled={saving}
                                                className="flex items-center gap-2 px-5 py-2 rounded-md text-[13px] font-bold bg-slate-700 text-white hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
                                            >
                                                {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                                Update Advert Text
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleCreateAtStock}
                                                disabled={saving}
                                                className="flex items-center gap-2 px-5 py-2 rounded-md text-[13px] font-bold bg-[#FF6B00] text-white hover:bg-orange-600 transition-all shadow-sm disabled:opacity-50"
                                            >
                                                {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                                Push to AutoTrader
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* ── Other Advertising Channels ── */}
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b border-[#E2E8F0]">
                                        <h3 className="text-[13px] font-bold text-slate-700">Other Channels</h3>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Toggle each channel on/off. Click <strong>Save & Publish</strong> above to apply all changes.</p>
                                    </div>
                                    <div className="divide-y divide-slate-50">
                                        {[
                                            { key: 'advertiserAdvertStatus', label: 'Advertiser Website', desc: 'Your own dealer website', icon: '🌐' },
                                            { key: 'locatorAdvertStatus', label: 'Manufacturer Locator', desc: 'Manufacturer used vehicle locators', icon: '🏭' },
                                            { key: 'exportAdvertStatus', label: 'Export / 3rd Party', desc: 'Export to other 3rd party sites', icon: '📤' },
                                            { key: 'profileAdvertStatus', label: 'Retailer Profile', desc: 'AutoTrader retailer store page', icon: '🏪' },
                                        ].map(chan => {
                                            const isLive = vehicle[chan.key as keyof VehicleDetail] === 'PUBLISHED';
                                            return (
                                                <div key={chan.key} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xl grayscale opacity-60">{chan.icon}</span>
                                                        <div>
                                                            <div className="text-[13px] font-bold text-slate-700">{chan.label}</div>
                                                            <div className="text-[11px] font-medium text-slate-400">{chan.desc}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {isLive && (
                                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                                ON
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => toggleAndSave(chan.key)}
                                                            disabled={savingChannel === chan.key}
                                                            className={`relative w-11 h-6 rounded-full transition-all duration-300 disabled:opacity-60 ${isLive ? 'bg-[#4D7CFF]' : 'bg-slate-200'}`}
                                                        >
                                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${isLive ? 'left-6' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                            </div>
                        )}



                        {/* ═══ VRM LOOKUP TAB ══════════════════════════════════════ */}
                        {activeTab === 'vehicleCheck' && (
                            <VehicleCheckTab vehicle={vehicle} checkData={checkData} checkLoading={checkLoading} checkError={checkError} checkLoaded={checkLoaded}
                                onLoad={async () => {
                                    if (!vehicle?.vrm || checkLoaded) return;
                                    setCheckLoading(true);
                                    setCheckError('');
                                    try {
                                        const res = await fetch(`/api/vehicles/vehicle-check?vrm=${encodeURIComponent(vehicle.vrm)}`);
                                        const d = await res.json();
                                        if (d.ok) { setCheckData(d); setCheckLoaded(true); }
                                        else setCheckError(d.error?.message || 'Failed to load vehicle check data.');
                                    } catch { setCheckError('Network error — please try again.'); }
                                    setCheckLoading(false);
                                }}
                                onRefresh={async () => {
                                    // Refresh ignores checkLoaded guard
                                    setCheckLoaded(false);
                                    setCheckData(null);
                                    setCheckLoading(true);
                                    setCheckError('');
                                    try {
                                        const res = await fetch(`/api/vehicles/vehicle-check?vrm=${encodeURIComponent(vehicle?.vrm || '')}`);
                                        const d = await res.json();
                                        if (d.ok) { setCheckData(d); setCheckLoaded(true); }
                                        else setCheckError(d.error?.message || 'Failed to load vehicle check data.');
                                    } catch { setCheckError('Network error — please try again.'); }
                                    setCheckLoading(false);
                                }}
                            />
                        )}

                        {/* ═══ SILENT SALESMAN TAB ═══════════════════════════════════ */}
                        {activeTab === 'silentSalesman' && vehicle && (
                            <SilentSalesmanTab vehicle={vehicle} routeVehicleId={id} />
                        )}


                        {/* ═══ COMPETITORS TAB ══════════════════════════════════════ */}
                        {activeTab === 'competitors' && vehicle && (
                            <CompetitorsTab vehicle={vehicle} />
                        )}


                        {/* ═══ CONDITION REPORT TAB ═════════════════════════════════ */}
                        {activeTab === 'conditionReport' && vehicle && (
                            <ConditionReportTab
                                vehicleId={id}
                                vehicleMileage={typeof vehicle.mileage === 'number' ? vehicle.mileage : undefined}
                                vehicleMake={textValue(vehicle.make)}
                                vehicleModel={textValue(vehicle.model)}
                                vehicleVRM={vehicle.vrm}
                                vehicleMotExpiry={vehicle.motExpiry ?? ''}
                                vehicleColour={textValue(vehicle.colour)}
                                vehicleFuelType={textValue(vehicle.fuelType)}
                                vehicleTransmission={textValue(vehicle.transmission)}
                                vehicleEngineSize={textValue(vehicle.engineSize)}
                                vehicleYear={vehicle.year}
                                vehicleBodyType={textValue(vehicle.bodyType)}
                                vehicleDoors={vehicle.doors}
                                vehicleSeats={vehicle.seats}
                            />
                        )}

                        {/* ═══ SPECIFICATION TAB ════════════════════════════════════ */}
                        {activeTab === 'specification' && vehicle && (
                            <SpecificationTab vehicle={vehicle} />
                        )}

                        {/* ═══ SETTINGS TAB ═════════════════════════════════════════ */}
                        {activeTab === 'settings' && vehicle && (
                            <VehicleSettingsTab
                                vehicle={vehicle}
                                onVehicleUpdate={updates => setVehicle(prev => prev ? { ...prev, ...updates } : null)}
                            />
                        )}

                        {/* ═══ CHECKLIST TAB ════════════════════════════════════════ */}
                        {activeTab === 'checklist' && vehicle && (
                            <VehicleChecklistTab vehicleId={vehicle._id ?? vehicle.id} />
                        )}

                        {/* ═══ JOB BOARDS TAB ═══════════════════════════════════════ */}
                        {activeTab === 'jobBoards' && vehicle && (
                            <VehicleJobsTab
                                vehicle={{
                                    _id: vehicle._id ?? vehicle.id,
                                    make: textValue(vehicle.make),
                                    model: textValue(vehicle.model),
                                    derivative: textValue(vehicle.derivative),
                                    vrm: vehicle.vrm || '',
                                }}
                            />
                        )}

                        {/* ═══ DOCUMENTS TAB ════════════════════════════════════════ */}
                        {activeTab === 'documents' && vehicle && (
                            <VehicleDocumentsTab vehicleId={vehicle._id ?? vehicle.id} />
                        )}

                        {/* ═══ TEST DRIVE TAB ═══════════════════════════════════════ */}
                        {activeTab === 'testDrive' && vehicle && (
                            <VehicleTestDriveTab
                                vehicleId={vehicle._id ?? vehicle.id}
                                vehicleVRM={vehicle.vrm}
                                vehicleStatus={vehicle.status}
                            />
                        )}

                        {/* ═══ APPOINTMENTS TAB ═════════════════════════════════════ */}
                        {activeTab === 'appointments' && vehicle && (
                            <VehicleAppointmentsTab
                                vehicleId={vehicle._id ?? vehicle.id}
                                vehicleVRM={vehicle.vrm}
                                vehicleStatus={vehicle.status}
                            />
                        )}

                        {/* ═══ LEADS & DEALS TAB ════════════════════════════════════ */}
                        {activeTab === 'leadsDeals' && vehicle && (
                            <VehicleLeadsDealsTab
                                vehicleId={vehicle._id ?? vehicle.id}
                                stockId={vehicle.stockId}
                            />
                        )}

                        {/* ═══ RESERVE VEHICLE TAB ══════════════════════════════════ */}
                        {activeTab === 'reserveVehicle' && vehicle && (
                            <VehicleReserveTab
                                vehicleId={vehicle._id ?? vehicle.id}
                                vehicleStatus={vehicle.status}
                                onStatusChange={(newStatus) => setVehicle(v => v ? { ...v, status: newStatus } : v)}
                            />
                        )}

                        {/* ═══ PURCHASE & COSTS TAB ════════════════════════════════ */}
                        {activeTab === 'purchaseCosts' && vehicle && (() => {
                            const purchasePrice = Number(editFields.purchasePrice) || 0;
                            const vatType = (editFields.vatType as string) || 'Margin';
                            const purchaseVat = vatType === 'Standard' ? parseFloat((purchasePrice - purchasePrice / 1.2).toFixed(2)) : 0;
                            const purchaseTotal = purchasePrice;
                            const additionalTotal = vehicleAdditionalCosts.reduce((s, c) => s + (c.cost || 0), 0);
                            const additionalVat = vehicleAdditionalCosts.reduce((s, c) => s + (c.vat || 0), 0);
                            const additionalGrandTotal = vehicleAdditionalCosts.reduce((s, c) => s + (c.total || 0), 0);
                            const newCostCost = parseFloat(newCostFields.cost) || 0;
                            const newCostVatRate = parseFloat(newCostFields.vatRate) || 0;
                            const newCostVat = parseFloat((newCostCost * newCostVatRate / 100).toFixed(2));
                            const newCostTotal = parseFloat((newCostCost + newCostVat).toFixed(2));
                            const COST_CATEGORIES = ['Advertising', 'Bodywork', 'Buyers Fee', 'Delivery', 'Electric Charge', 'Finance', 'Fuel', 'Insurance', 'MOT', 'Paint', 'Part Exchange', 'Photography', 'Preparation', 'Reconditioning', 'Service', 'Sourcing Fee', 'Tinting', 'Tyres', 'Valeting', 'Warranty', 'Other'];
                            return (
                                <div className="space-y-6 max-w-4xl">
                                    {/* ── Purchase Details ── */}
                                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                        <div className="p-6 space-y-5">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <div>
                                                    <FieldLabel>Purchase Date</FieldLabel>
                                                    <input type="date" value={(editFields.purchaseDate as string) || ''} onChange={e => updateField('purchaseDate', e.target.value)} className={inputClasses} />
                                                </div>
                                                <div>
                                                    <FieldLabel>Name of Supplier</FieldLabel>
                                                    <input type="text" value={(editFields.supplierName as string) || ''} onChange={e => updateField('supplierName', e.target.value)} placeholder="Start typing to search..." className={inputClasses} />
                                                </div>
                                                <div>
                                                    <FieldLabel>Supplier Invoice No.</FieldLabel>
                                                    <input type="text" value={(editFields.supplierInvoiceNo as string) || ''} onChange={e => updateField('supplierInvoiceNo', e.target.value)} className={inputClasses} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <div>
                                                    <FieldLabel>Purchase Price</FieldLabel>
                                                    <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-white">
                                                        <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                        <input type="number" value={editFields.purchasePrice || ''} onChange={e => updateField('purchasePrice', e.target.value)} placeholder="0.00" className="flex-1 px-2 py-2 text-[13px] text-slate-800 focus:outline-none bg-transparent" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <FieldLabel>Purchase VAT <span className="text-[10px] text-slate-400 font-normal ml-1">({vatType})</span></FieldLabel>
                                                    <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-slate-50">
                                                        <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                        <span className="flex-1 px-2 py-2 text-[13px] text-slate-500">{purchaseVat.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <FieldLabel>Purchase Total</FieldLabel>
                                                    <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-slate-50">
                                                        <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                        <span className="flex-1 px-2 py-2 text-[13px] font-semibold text-slate-800">{purchaseTotal.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <div>
                                                    <FieldLabel>VAT Type</FieldLabel>
                                                    <select value={vatType} onChange={e => updateField('vatType', e.target.value)} className={`${inputClasses} appearance-none`}>
                                                        <option value="Margin">Margin</option>
                                                        <option value="Standard">Standard</option>
                                                        <option value="Zero Rated">Zero Rated</option>
                                                    </select>
                                                </div>
                                            </div>
                                            {/* Create Purchase Invoice CTA */}
                                            <div className="flex items-center justify-between bg-[#F0F7FF] border border-[#C5DDFF] rounded-lg px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <svg className="w-5 h-5 text-[#4D7CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                                                    <div>
                                                        <div className="text-[13px] font-semibold text-[#4D7CFF]">Create Purchase Invoice</div>
                                                        <div className="text-[12px] text-slate-500">Would you like to create a purchase invoice using the above values?</div>
                                                    </div>
                                                </div>
                                                <button onClick={handleSaveVehicleFields} disabled={saving} className="px-5 py-2.5 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-bold hover:bg-blue-600 transition-all shadow-sm whitespace-nowrap">
                                                    Create Purchase
                                                </button>
                                            </div>
                                            {/* Funding Provider collapsible */}
                                            <div>
                                                <button onClick={() => setShowFundingProvider(p => !p)} className="flex items-center gap-2 text-[13px] font-semibold text-[#4D7CFF] hover:text-blue-700 transition-colors">
                                                    <svg className={`w-3 h-3 transition-transform ${showFundingProvider ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 4.707a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                                                    {showFundingProvider ? 'Hide' : 'Show'} Funding Provider
                                                </button>
                                                {showFundingProvider && (
                                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5 pl-1">
                                                        <div>
                                                            <FieldLabel>Funding Provider</FieldLabel>
                                                            <input type="text" value={(editFields.fundingProvider as string) || ''} onChange={e => updateField('fundingProvider', e.target.value)} placeholder="Start typing to search..." className={inputClasses} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <FieldLabel>Funding Amount</FieldLabel>
                                                                <button onClick={() => updateField('fundingAmount', purchaseTotal)} className="text-[11px] font-semibold text-[#4D7CFF] border border-[#DCE4FF] rounded px-2 py-0.5 hover:bg-blue-50 transition-colors">Use Purchase Total</button>
                                                            </div>
                                                            <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-white">
                                                                <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                                <input type="number" value={editFields.fundingAmount || ''} onChange={e => updateField('fundingAmount', e.target.value)} placeholder="" className="flex-1 px-2 py-2 text-[13px] text-slate-800 focus:outline-none bg-transparent" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Additional Costs ── */}
                                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                            <h3 className="text-[15px] font-bold text-slate-800">Additional Costs</h3>
                                        </div>
                                        {/* Tabs */}
                                        <div className="border-b border-slate-100">
                                            <div className="flex px-6">
                                                {(['without', 'invoice'] as const).map(tab => (
                                                    <button key={tab} onClick={() => setAddCostTab(tab)} className={`px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors ${addCostTab === tab ? 'border-[#4D7CFF] text-[#4D7CFF]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                                        {tab === 'invoice' ? 'Create Purchase Invoice' : 'Add Without Invoice'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-6">
                                            {addCostTab === 'invoice' && (
                                                <div className="space-y-4">
                                                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center text-[13px] text-slate-400 italic">
                                                        Drop image or PDF file, or click to browse.
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 border-t border-slate-200" />
                                                        <span className="text-[12px] text-slate-400 font-semibold">OR</span>
                                                        <div className="flex-1 border-t border-slate-200" />
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <button className="px-5 py-2.5 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-bold hover:bg-blue-600 transition-all shadow-sm">Create Purchase</button>
                                                    </div>
                                                </div>
                                            )}

                                            {addCostTab === 'without' && (
                                                <div className="space-y-5">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        <div>
                                                            <FieldLabel>Category</FieldLabel>
                                                            <select value={newCostFields.category} onChange={e => setNewCostFields(p => ({ ...p, category: e.target.value }))} className={`${inputClasses} appearance-none`}>
                                                                <option value="">Start typing...</option>
                                                                {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <FieldLabel>Date</FieldLabel>
                                                            <input type="date" value={newCostFields.date} onChange={e => setNewCostFields(p => ({ ...p, date: e.target.value }))} className={inputClasses} />
                                                        </div>
                                                        <div>
                                                            <FieldLabel>Supplier</FieldLabel>
                                                            <input type="text" value={newCostFields.supplier} onChange={e => setNewCostFields(p => ({ ...p, supplier: e.target.value }))} className={inputClasses} />
                                                        </div>
                                                        <div>
                                                            <FieldLabel>Reference</FieldLabel>
                                                            <input type="text" value={newCostFields.reference} onChange={e => setNewCostFields(p => ({ ...p, reference: e.target.value }))} className={inputClasses} />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <div>
                                                            <FieldLabel>Cost</FieldLabel>
                                                            <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-white">
                                                                <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                                <input type="number" value={newCostFields.cost} onChange={e => setNewCostFields(p => ({ ...p, cost: e.target.value }))} placeholder="" className="flex-1 px-2 py-2 text-[13px] text-slate-800 focus:outline-none bg-transparent" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <FieldLabel>VAT</FieldLabel>
                                                                <select value={newCostFields.vatRate} onChange={e => setNewCostFields(p => ({ ...p, vatRate: e.target.value }))} className="text-[11px] border border-slate-200 rounded px-1 py-0.5 text-slate-600">
                                                                    <option value="0">0%</option>
                                                                    <option value="5">5%</option>
                                                                    <option value="20">20%</option>
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-slate-50">
                                                                <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                                <span className="flex-1 px-2 py-2 text-[13px] text-slate-500">{newCostVat.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <FieldLabel>Total</FieldLabel>
                                                            <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-slate-50">
                                                                <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                                <span className="flex-1 px-2 py-2 text-[13px] font-semibold text-slate-800">{newCostTotal.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={async () => {
                                                                if (!newCostFields.cost) return;
                                                                const entry = { id: Date.now().toString(), category: newCostFields.category || 'Other', date: newCostFields.date, supplier: newCostFields.supplier, reference: newCostFields.reference, cost: newCostCost, vatRate: newCostVatRate, vat: newCostVat, total: newCostTotal };
                                                                const updated = [...vehicleAdditionalCosts, entry];
                                                                setVehicleAdditionalCosts(updated);
                                                                setNewCostFields({ category: '', date: '', supplier: '', reference: '', cost: '', vatRate: '20' });
                                                                await patchVehicle({ vehicleAdditionalCosts: updated });
                                                            }}
                                                            disabled={!newCostFields.cost || saving}
                                                            className="px-5 py-2.5 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-bold hover:bg-blue-600 transition-all shadow-sm disabled:opacity-50"
                                                        >
                                                            Add Additional Cost
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Costs list */}
                                            {vehicleAdditionalCosts.length > 0 && (
                                                <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden">
                                                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                                                        <div className="flex gap-2">
                                                            <button onClick={() => { const all: Record<string, boolean> = {}; vehicleAdditionalCosts.forEach(c => { all[c.id] = true; }); setExpandedCosts(all); }} className="text-[11px] font-semibold text-slate-500 border border-slate-200 rounded px-2 py-1 hover:bg-white transition-colors">Expand All</button>
                                                            <button onClick={() => setExpandedCosts({})} className="text-[11px] font-semibold text-slate-500 border border-slate-200 rounded px-2 py-1 hover:bg-white transition-colors">Collapse All</button>
                                                        </div>
                                                        <div className="hidden md:grid grid-cols-3 gap-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider pr-2" style={{width: '360px'}}>
                                                            <span className="text-right">Cost</span>
                                                            <span className="text-right">VAT</span>
                                                            <span className="text-right">Total</span>
                                                        </div>
                                                    </div>
                                                    {vehicleAdditionalCosts.map((item, idx) => (
                                                        <div key={item.id} className="border-b border-slate-100 last:border-0">
                                                            <div className="flex items-center px-4 py-3 hover:bg-slate-50 cursor-pointer" onClick={() => setExpandedCosts(p => ({ ...p, [item.id]: !p[item.id] }))}>
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    <svg className={`w-3 h-3 text-[#4D7CFF] flex-shrink-0 transition-transform ${expandedCosts[item.id] ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 4.707a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                                                                    <span className="text-[13px] font-semibold text-[#4D7CFF] truncate">Additional Cost</span>
                                                                    <span className="text-[12px] text-slate-500 truncate">{item.category}</span>
                                                                    {item.supplier && <span className="text-[12px] text-slate-400 truncate">{item.supplier}</span>}
                                                                </div>
                                                                <div className="hidden md:grid grid-cols-3 gap-4 text-[13px] flex-shrink-0" style={{width: '360px'}}>
                                                                    <div className="flex items-center gap-1 justify-end"><span className="text-slate-400 text-[11px]">£</span><span className="text-slate-700">{item.cost.toFixed(2)}</span></div>
                                                                    <div className="flex items-center gap-1 justify-end"><span className="text-slate-400 text-[11px]">£</span><span className="text-slate-700">{item.vat.toFixed(2)}</span></div>
                                                                    <div className="flex items-center gap-1 justify-end"><span className="text-slate-400 text-[11px]">£</span><span className="font-semibold text-slate-800">{item.total.toFixed(2)}</span></div>
                                                                </div>
                                                            </div>
                                                            {expandedCosts[item.id] && (
                                                                <div className="px-8 pb-3 pt-1 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                                                    <div className="text-[12px] text-slate-500 space-y-0.5">
                                                                        {item.date && <div>Date: {item.date}</div>}
                                                                        {item.reference && <div>Reference: {item.reference}</div>}
                                                                        <div>VAT Rate: {item.vatRate}%</div>
                                                                    </div>
                                                                    <button onClick={async () => { const updated = vehicleAdditionalCosts.filter((_, i) => i !== idx); setVehicleAdditionalCosts(updated); await patchVehicle({ vehicleAdditionalCosts: updated }); }} className="text-[12px] font-semibold text-red-500 border border-red-200 rounded px-3 py-1 hover:bg-red-50 transition-colors">Remove</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center px-4 py-3 bg-slate-50 border-t border-slate-200">
                                                        <span className="flex-1 text-[13px] font-bold text-slate-700">Total Additional Costs</span>
                                                        <div className="hidden md:grid grid-cols-3 gap-4 text-[13px] flex-shrink-0" style={{width: '360px'}}>
                                                            <div className="flex items-center gap-1 justify-end"><span className="text-slate-400 text-[11px]">£</span><span className="font-bold text-slate-800">{additionalTotal.toFixed(2)}</span></div>
                                                            <div className="flex items-center gap-1 justify-end"><span className="text-slate-400 text-[11px]">£</span><span className="font-bold text-slate-800">{additionalVat.toFixed(2)}</span></div>
                                                            <div className="flex items-center gap-1 justify-end"><span className="text-slate-400 text-[11px]">£</span><span className="font-bold text-slate-800">{additionalGrandTotal.toFixed(2)}</span></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Stand In Value */}
                                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                        <div className="grid grid-cols-3 divide-x divide-[#E2E8F0]">
                                            {[
                                                { label: 'Stand In Value Cost', value: (purchaseTotal + additionalTotal).toFixed(2) },
                                                { label: 'Stand In Value VAT',  value: (purchaseVat + additionalVat).toFixed(2) },
                                                { label: 'Stand In Value Total', value: (purchaseTotal + additionalGrandTotal).toFixed(2) },
                                            ].map(item => (
                                                <div key={item.label} className="p-5">
                                                    <div className="text-[12px] font-semibold text-slate-500 mb-3">{item.label}</div>
                                                    <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden bg-slate-50">
                                                        <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                        <span className="flex-1 px-2 py-2 text-[13px] font-semibold text-slate-800">{item.value}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Save / Save & Next */}
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={handleSaveVehicleFields} disabled={saving} className="px-6 py-2.5 bg-[#4D7CFF] text-white rounded-md text-[13px] font-bold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2">
                                            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                            {saving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button onClick={() => { handleSaveVehicleFields(); setActiveTab('stockPrice'); }} disabled={saving} className="px-6 py-2.5 bg-[#4D7CFF] text-white rounded-md text-[13px] font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
                                            Save &amp; Next -&gt;
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ═══ STOCK & PRICE TAB ════════════════════════════════════ */}
                        {activeTab === 'stockPrice' && vehicle && (() => {
                            const websitePrice = Number(editPrice) || 0;
                            const salesChannelPrice = Number(editForecourtPrice) || websitePrice;
                            const reserveAmt = Number(editFields.reservePaymentAmount) || 0;
                            const purchasePrice = Number(vehicle.purchasePrice) || 0;
                            const additionalCostTotal = vehicleAdditionalCosts.reduce((s: number, c: any) => s + (c.cost || 0), 0);
                            const grossProfit = websitePrice - purchasePrice;
                            const marginalVat = (editFields.vatStatus as string) === 'Marginal' && grossProfit > 0 ? parseFloat((grossProfit / 6).toFixed(2)) : 0;
                            const netProfit = grossProfit - marginalVat - additionalCostTotal;
                            const retailVal = spValuation?.valuations?.find((v: any) => v.valuationType === 'Retail')?.amountGBP || 0;
                            const pricePosition = retailVal > 0 ? Math.min(Math.round((websitePrice / retailVal) * 100), 100) : 0;
                            const priceIndicator = pricePosition <= 95 ? { label: 'Great Price', color: '#00C896' } : pricePosition <= 105 ? { label: 'Good Price', color: '#00C896' } : pricePosition <= 115 ? { label: 'Fair Price', color: '#F59E0B' } : { label: 'High Price', color: '#EF4444' };
                            const loadValuation = async () => {
                                setSpValuationLoading(true);
                                setSpValuationError('');
                                try {
                                    const res = await fetch('/api/vehicles/valuation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ vrm: vehicle.vrm, mileage: vehicle.mileage, condition: vehicle.condition || 'Good', derivativeId: (vehicle as any).derivativeId, registeredDate: (vehicle as any).dateOfRegistration, features: vehicle.features, optionalExtras: atOptions.filter(o => o.fitted).map(o => o.name) }) });
                                    const d = await res.json();
                                    if (d.ok) {
                                        setSpValuation(d);
                                    } else {
                                        setSpValuationError(d.error?.message || 'Valuation not available for this vehicle.');
                                    }
                                } catch {
                                    setSpValuationError('Network error — please try again.');
                                }
                                setSpValuationLoading(false);
                            };
                            return (
                                <div className="space-y-5 max-w-4xl">
                                    {/* ── Stock Details ── */}
                                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                        <div className="p-6 space-y-5">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <TextInput label="Reference ID" value={editFields.referenceId as string} field="referenceId" placeholder="" />
                                                <div>
                                                    <FieldLabel>Stock ID</FieldLabel>
                                                    <input type="text" readOnly value={vehicle.stockId || (vehicle as any)._id?.slice(-8)?.toUpperCase() || ''} className={`${inputClasses} bg-slate-50 cursor-default`} />
                                                </div>
                                                <TextInput label="Location" value={editFields.location as string} field="location" placeholder="Start typing to search..." />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <TextInput label="VIN" value={editFields.vin as string} field="vin" placeholder="" />
                                                <TextInput label="Engine Number" value={editFields.engineNumber as string} field="engineNumber" placeholder="" />
                                                <TextInput label="New Keeper Reference (V5C)" value={editFields.newKeeperReference as string} field="newKeeperReference" placeholder="" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <TextInput label="Key Reference" value={editFields.keyReference as string} field="keyReference" placeholder="" />
                                                <div>
                                                    <FieldLabel>Due In Date</FieldLabel>
                                                    <input type="date" value={(editFields.dueInDate as string) || ''} onChange={e => updateField('dueInDate', e.target.value)} className={inputClasses} />
                                                </div>
                                                <div>
                                                    <FieldLabel>Date On Forecourt</FieldLabel>
                                                    <input type="date" value={(editFields.dateOnForecourt as string) || ''} onChange={e => updateField('dateOnForecourt', e.target.value)} className={inputClasses} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                                {[
                                                    { label: 'Sale or Return', field: 'saleOrReturn' as keyof VehicleDetail },
                                                    { label: 'Demonstrator', field: 'demonstrator' as keyof VehicleDetail },
                                                    { label: 'Trade', field: 'trade' as keyof VehicleDetail },
                                                ].map(item => (
                                                    <div key={item.field}>
                                                        <FieldLabel>{item.label}</FieldLabel>
                                                        <div className="flex gap-5 mt-1">
                                                            {[{ label: 'Yes', val: true }, { label: 'No', val: false }].map(o => (
                                                                <label key={o.label} className="flex items-center gap-2 cursor-pointer">
                                                                    <input type="radio" checked={!!(editFields as any)[item.field] === o.val} onChange={() => updateField(item.field, o.val)} className="w-4 h-4 text-[#4D7CFF]" />
                                                                    <span className="text-[13px] text-slate-700">{o.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div>
                                                    <FieldLabel>Origin</FieldLabel>
                                                    <div className="flex gap-5 mt-1">
                                                        {['UK Vehicle', 'Import'].map(o => (
                                                            <label key={o} className="flex items-center gap-2 cursor-pointer">
                                                                <input type="radio" checked={(editFields.origin as string) === o} onChange={() => updateField('origin', o)} className="w-4 h-4 text-[#4D7CFF]" />
                                                                <span className="text-[13px] text-slate-700">{o}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <FieldLabel>Notes</FieldLabel>
                                                <textarea value={(editFields.stockNotes as string) || ''} onChange={e => updateField('stockNotes', e.target.value)} rows={4} className={`${inputClasses} resize-y`} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── VAT Status ── */}
                                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
                                        <div className="text-[13px] font-semibold text-slate-700 mb-3">VAT Status</div>
                                        <div className="flex gap-6">
                                            {['Marginal', 'VAT Qualifying'].map(o => (
                                                <label key={o} className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" checked={(editFields.vatStatus as string) === o} onChange={() => updateField('vatStatus', o)} className="w-4 h-4 text-[#4D7CFF]" />
                                                    <span className="text-[13px] text-slate-700">{o}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── Valuation ── */}
                                    <div className="rounded-xl overflow-hidden border border-emerald-200" style={{background: '#F0FDF9'}}>
                                        <div className="px-6 py-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>
                                                <span className="text-[15px] font-bold text-emerald-800">Valuation</span>
                                            </div>
                                            <button onClick={loadValuation} disabled={spValuationLoading} className="text-[12px] font-semibold text-emerald-700 border border-emerald-300 rounded px-3 py-1 hover:bg-emerald-50 transition-colors flex items-center gap-1.5">
                                                {spValuationLoading ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : null}
                                                {spValuation ? 'Refresh Valuation' : 'Load Valuation'}
                                            </button>
                                        </div>
                                        {spValuationError && !spValuation && (
                                            <div className="px-6 pb-5 flex items-center gap-3 text-[13px] text-red-600 bg-red-50 border-t border-red-100 py-3">
                                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                                {spValuationError}
                                            </div>
                                        )}
                                        {spValuation ? (
                                            <>
                                                <div className="text-[12px] text-emerald-600 px-6 pb-3">Based on date first registered, mileage, condition and optional extras.</div>
                                                <div className="grid grid-cols-3 gap-4 px-6 pb-4">
                                                    {[
                                                        { label: 'Trade Valuation', key: 'Trade' },
                                                        { label: 'Part Ex Valuation', key: 'PartExchange' },
                                                        { label: 'Retail Valuation', key: 'Retail' },
                                                    ].map(item => {
                                                        const val = spValuation.valuations?.find((v: any) => v.valuationType === item.key);
                                                        return (
                                                            <div key={item.key} className="rounded-xl p-5 text-center" style={{background: '#00B67A'}}>
                                                                <div className="text-[11px] text-white/80 mb-1">AutoTrader</div>
                                                                <div className="text-[11px] font-bold text-white mb-3">{item.label}</div>
                                                                <div className="text-[22px] font-bold text-white">{val?.amountGBP ? `£${val.amountGBP.toLocaleString()}` : '—'}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="px-6 pb-4">
                                                    <button onClick={() => setSpShowTrend(p => !p)} className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700">
                                                        <svg className={`w-3 h-3 transition-transform ${spShowTrend ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 4.707a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                                                        Show Valuation Trend
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="px-6 pb-5 text-[13px] text-emerald-600">Click &quot;Load Valuation&quot; to fetch AT Trade, Part Ex &amp; Retail valuations.</div>
                                        )}
                                    </div>

                                    {/* ── Vehicle Metrics ── */}
                                    {spValuation?.metrics && (
                                        <div className="rounded-xl overflow-hidden border border-teal-200" style={{background: '#F0FDFA'}}>
                                            <div className="px-6 py-4 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                                                    <span className="text-[15px] font-bold text-teal-800">Vehicle Metrics</span>
                                                </div>
                                            </div>
                                            <div className="text-[12px] text-teal-600 px-6 pb-3">Market insights powered by AutoTrader.</div>
                                            <div className="grid grid-cols-3 gap-4 px-6 pb-5">
                                                {[
                                                    { label: 'Live Market', value: spValuation.metrics.vehicleMetrics?.liveRetailPercentage != null ? `${spValuation.metrics.vehicleMetrics.liveRetailPercentage}%` : '—' },
                                                    { label: 'Retail Rating', value: spValuation.metrics.rating != null ? `${spValuation.metrics.rating} / 100` : '—' },
                                                    { label: 'Days to Sell', value: spValuation.metrics.daysToSell != null ? String(spValuation.metrics.daysToSell) : '—' },
                                                ].map(item => (
                                                    <div key={item.label} className="rounded-xl p-5 text-center text-white" style={{background: '#0E9F9F'}}>
                                                        <div className="text-[12px] text-white/80 mb-2">{item.label}</div>
                                                        <div className="text-[24px] font-bold">{item.value}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Pricing ── */}
                                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                        <div className="p-6 space-y-5">
                                            {retailVal > 0 && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-slate-50 rounded-lg p-4">
                                                        <div className="text-[12px] font-semibold text-slate-500 mb-2 text-center">Price Position</div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                                                <div className="h-full rounded-full transition-all" style={{width: `${pricePosition}%`, background: priceIndicator.color}} />
                                                            </div>
                                                            <span className="text-[13px] font-bold text-slate-700">{pricePosition}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50 rounded-lg p-4 flex flex-col items-center justify-center">
                                                        <div className="text-[12px] font-semibold text-slate-500 mb-2">Price Indicator</div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full" style={{background: priceIndicator.color}} />
                                                            <span className="text-[15px] font-bold text-slate-800">{priceIndicator.label}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <FieldLabel>Website Price</FieldLabel>
                                                        {retailVal > 0 && <button onClick={() => setEditPrice(String(retailVal))} className="text-[11px] font-semibold text-[#4D7CFF] border border-[#DCE4FF] rounded px-2 py-0.5 hover:bg-blue-50 transition-colors">Use Valuation</button>}
                                                    </div>
                                                    <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-white">
                                                        <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                        <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="flex-1 px-2 py-2 text-[13px] text-slate-800 focus:outline-none" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <FieldLabel>Sales Channel Price <span className="text-[10px] text-slate-400 font-normal">(AT / forecourt)</span></FieldLabel>
                                                    <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-white">
                                                        <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                        <input type="number" value={editForecourtPrice} onChange={e => setEditForecourtPrice(e.target.value)} placeholder={String(websitePrice || '')} className="flex-1 px-2 py-2 text-[13px] text-slate-800 focus:outline-none" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <FieldLabel>Reserve Payment Amount</FieldLabel>
                                                    <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-white">
                                                        <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                        <input type="number" value={editFields.reservePaymentAmount || ''} onChange={e => updateField('reservePaymentAmount', e.target.value)} placeholder="250.00" className="flex-1 px-2 py-2 text-[13px] text-slate-800 focus:outline-none" />
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Show Profit Calculations */}
                                            <div>
                                                <button onClick={() => setSpShowProfit(p => !p)} className="flex items-center gap-2 text-[13px] font-semibold text-[#4D7CFF]">
                                                    <svg className={`w-3 h-3 transition-transform ${spShowProfit ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 4.707a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                                                    Show Profit Calculations
                                                </button>
                                                {spShowProfit && (
                                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5">
                                                        {[
                                                            { label: 'Gross Profit', value: grossProfit.toFixed(2), sub: 'Website Price minus Purchase Price exc. VAT' },
                                                            { label: 'Marginal VAT', value: marginalVat.toFixed(2), sub: '1/6th of Gross Profit' },
                                                            { label: 'Net Profit after VAT & Additional Costs', value: netProfit.toFixed(2), sub: 'Gross Profit minus Marginal VAT minus Additional Costs exc. VAT' },
                                                        ].map(item => (
                                                            <div key={item.label}>
                                                                <div className="text-[12px] font-semibold text-slate-600 mb-2">{item.label}</div>
                                                                <div className="flex items-center gap-2 border border-[#E2E8F0] rounded-md overflow-hidden shadow-sm bg-slate-50">
                                                                    <span className="px-3 text-slate-400 font-semibold text-[13px] border-r border-[#E2E8F0] py-2">£</span>
                                                                    <span className="flex-1 px-2 py-2 text-[13px] font-semibold text-slate-800">{item.value}</span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-400 mt-1 italic">{item.sub}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Quantity Available (To Order only) ── */}
                                    {vehicle.status === 'To Order' && (
                                        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
                                            <div className="max-w-xs">
                                                <FieldLabel>Quantity Available</FieldLabel>
                                                <input type="number" value={editFields.quantityAvailable || ''} onChange={e => updateField('quantityAvailable', e.target.value)} className={inputClasses} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Save / Save & Next */}
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={handleSaveVehicleFields} disabled={saving} className="px-6 py-2.5 bg-[#4D7CFF] text-white rounded-md text-[13px] font-bold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2">
                                            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                            {saving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button onClick={() => { handleSaveVehicleFields(); setActiveTab('salesChannels'); }} disabled={saving} className="px-6 py-2.5 bg-[#4D7CFF] text-white rounded-md text-[13px] font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
                                            Save &amp; Next -&gt;
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ═══ WORKFLOW TAB ═════════════════════════════════════════ */}
                        {activeTab === 'workflow' && vehicle && (() => {
                            const STAGES = [
                                { key: 'purchased',    label: 'Purchased',       icon: '🛒' },
                                { key: 'inspected',    label: 'Inspection',      icon: '🔍' },
                                { key: 'valeted',      label: 'Valeting',        icon: '✨' },
                                { key: 'photographed', label: 'Photography',     icon: '📷' },
                                { key: 'advertised',   label: 'Advertised',      icon: '📢' },
                                { key: 'readyForSale', label: 'Ready for Sale',  icon: '✅' },
                            ];
                            const completedCount = STAGES.filter(s => workflowStages[s.key]?.completed).length;
                            return (
                                <div className="space-y-5 max-w-3xl">
                                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                            <h3 className="text-[14px] font-semibold text-slate-800">Vehicle Workflow</h3>
                                            <span className="text-[12px] font-semibold text-slate-400">{completedCount}/{STAGES.length} completed</span>
                                        </div>
                                        <div className="p-4">
                                            <div className="flex items-center gap-1 mb-6 px-2">
                                                {STAGES.map((s, i) => (
                                                    <div key={s.key} className="flex items-center flex-1">
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${workflowStages[s.key]?.completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                                            {workflowStages[s.key]?.completed ? '✓' : i + 1}
                                                        </div>
                                                        {i < STAGES.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${workflowStages[s.key]?.completed ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-3">
                                                {STAGES.map(stage => {
                                                    const s = workflowStages[stage.key] || { completed: false, date: '', notes: '' };
                                                    return (
                                                        <div key={stage.key} className={`rounded-lg border p-4 transition-colors ${s.completed ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                                                            <div className="flex items-start gap-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={s.completed}
                                                                    onChange={e => setWorkflowStages(prev => ({ ...prev, [stage.key]: { ...prev[stage.key], completed: e.target.checked } }))}
                                                                    className="mt-0.5 w-4 h-4 text-emerald-500 rounded border-slate-300 focus:ring-emerald-400"
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className="text-[14px]">{stage.icon}</span>
                                                                        <span className={`text-[13px] font-semibold ${s.completed ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>{stage.label}</span>
                                                                        {s.completed && <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded-full">Done</span>}
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                        <div>
                                                                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Date Completed</label>
                                                                            <input type="date" value={s.date || ''} onChange={e => setWorkflowStages(prev => ({ ...prev, [stage.key]: { ...prev[stage.key], date: e.target.value } }))} className={inputClasses} />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Notes</label>
                                                                            <input type="text" value={s.notes || ''} placeholder="Optional notes..." onChange={e => setWorkflowStages(prev => ({ ...prev, [stage.key]: { ...prev[stage.key], notes: e.target.value } }))} className={inputClasses} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={handleSaveWorkflow} disabled={saving} className="px-6 py-2.5 bg-[#4D7CFF] text-white rounded-md text-[13px] font-bold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2">
                                            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                            {saving ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ═══ SELL VEHICLE TAB ═════════════════════════════════════ */}
                        {activeTab === 'sellVehicle' && vehicle && (
                            <VehicleSellTab
                                vehicleId={vehicle._id ?? vehicle.id}
                                vehiclePrice={vehicle.price}
                                vehicleName={`${textValue(vehicle.make)} ${textValue(vehicle.model)} ${textValue(vehicle.derivative)}`}
                                vehicleStatus={vehicle.status}
                                onStatusChange={(newStatus) => setVehicle(v => v ? { ...v, status: newStatus } : v)}
                                onNavigateToReserve={() => setActiveTab('reserveVehicle')}
                            />
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

// Remove PreviewModal component below
