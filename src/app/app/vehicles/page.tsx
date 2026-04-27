'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AddVehicleButton } from '@/components/vehicles/AddVehicleButton';

interface VehicleItem {
    _id: string;
    make: string;
    model: string;
    vehicleModel?: string;
    derivative: string;
    vrm: string;
    status: string;
    price: number;
    mileage?: number;
    year?: string | number;
    fuelType?: string;
    transmission?: string;
    colour?: string;
    bodyType?: string;
    seats?: number;
    primaryImage?: string;
    imagesCount: number;
    videosCount: number;
    createdAt: string;
    updatedAt: string;
    tenantId: string;
    source: 'local' | 'autotrader' | 'merged';
    isLiveOnAT: boolean;
    atStatus: string;
    stockId?: string;
    websitePublished: boolean;
    atAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
}

function StatusBadge({ status }: { status: string }) {
    const s = status || '';
    let cls = 'bg-blue-600 text-white';
    if (s === 'Draft') cls = 'bg-teal-500 text-white';
    if (s === 'Reserved') cls = 'bg-green-500 text-white';
    if (s === 'Sold') cls = 'bg-slate-500 text-white';
    if (s === 'Complete') cls = 'bg-slate-400 text-white';
    if (s === 'Deleted') cls = 'bg-red-400 text-white';
    return (
        <span className={`px-3 py-0.5 rounded text-[11px] font-semibold ${cls}`}>
            {s === 'In Stock' ? 'For Sale' : s}
        </span>
    );
}

function formatDateGB(dateStr?: string) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB');
}

function VehiclesContent() {
    const searchParams = useSearchParams();

    const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Single active tab — covers all filter groups
    const [activeTab, setActiveTab] = useState<string>(() => {
        const urlStatus = searchParams.get('status');
        if (urlStatus) return urlStatus === 'For Sale' ? 'forsale' : urlStatus.toLowerCase();
        const urlStockType = searchParams.get('stockType');
        if (urlStockType === 'To Order') return 'toOrder';
        if (urlStockType === 'In Stock') return 'inStock';
        const urlVehicleType = searchParams.get('vehicleType');
        if (urlVehicleType) return urlVehicleType;
        const urlSpecial = searchParams.get('special');
        if (urlSpecial) return urlSpecial;
        return 'all';
    });
    const [viewMode, setViewMode] = useState<'browse' | 'pricing' | 'advertising'>('browse');

    // Filter panel
    const [showFilter, setShowFilter] = useState(false);
    const [filterMake, setFilterMake] = useState('');
    const [filterModel, setFilterModel] = useState('');
    const [filterReg, setFilterReg] = useState('');
    const [filterFuel, setFilterFuel] = useState('');
    const [filterBodyType, setFilterBodyType] = useState('');
    const [filterTransmission, setFilterTransmission] = useState<string[]>([]);

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 25;

    // Pending ad changes
    const [pendingAd, setPendingAd] = useState<Record<string, Partial<VehicleItem>>>({});
    const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});


    const fetchVehicles = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ status: 'All' });
            if (searchQuery) params.append('search', searchQuery);
            const res = await fetch(`/api/vehicles?${params}`);
            const data = await res.json();
            if (data.ok) setVehicles(data.vehicles);
        } catch (err) {
            console.error('Failed to fetch vehicles:', err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

    const handleUpdateVehicle = async (id: string, updates: Partial<VehicleItem>) => {
        setVehicles(prev => prev.map(v => v._id === id ? { ...v, ...updates } : v));
        try {
            await fetch('/api/vehicles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates }),
            });
        } catch { fetchVehicles(); }
    };

    const handleDelete = async (id: string, make: string, vrm: string) => {
        if (!confirm(`Delete ${make} (${vrm})?`)) return;
        try {
            const res = await fetch(`/api/vehicles?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.ok) setVehicles(prev => prev.filter(v => v._id !== id));
        } catch {}
    };

    const handleSaveAdRow = async (id: string) => {
        const updates = pendingAd[id];
        if (!updates) return;
        setSavingRows(prev => ({ ...prev, [id]: true }));
        await handleUpdateVehicle(id, updates);
        setPendingAd(prev => { const n = { ...prev }; delete n[id]; return n; });
        setSavingRows(prev => ({ ...prev, [id]: false }));
    };

    // Filtered vehicles
    const filteredVehicles = useMemo(() => {
        const now = Date.now();
        return vehicles.filter(v => {
            const vAny = v as any;
            const displayStatus = v.status === 'In Stock' ? 'For Sale' : v.status;

            switch (activeTab) {
                case 'all':
                    if (!['Draft', 'For Sale', 'Reserved', 'Complete'].includes(displayStatus) &&
                        !['Draft', 'In Stock', 'Reserved', 'Complete'].includes(v.status)) return false;
                    break;
                case 'inStock':
                    if (v.status !== 'In Stock' && displayStatus !== 'For Sale') return false;
                    break;
                case 'toOrder':
                    if (vAny.stockType !== 'To Order' && v.status !== 'To Order') return false;
                    break;
                case 'customer':
                    if (vAny.vehicleType !== 'customer' && v.status !== 'Customer') return false;
                    break;
                case 'courtesy':
                    if (vAny.vehicleType !== 'courtesy' && v.status !== 'Courtesy') return false;
                    break;
                case 'latest': {
                    const days = (now - new Date(v.createdAt).getTime()) / 86400000;
                    if (days > 30) return false;
                    break;
                }
                case 'overage': {
                    const days = (now - new Date(v.createdAt).getTime()) / 86400000;
                    if (days <= 90) return false;
                    break;
                }
                case 'demo':
                    if (vAny.vehicleType !== 'demo' && v.status !== 'Demo') return false;
                    break;
                case 'draft':
                    if (v.status !== 'Draft') return false;
                    break;
                case 'forsale':
                    if (v.status !== 'In Stock' && displayStatus !== 'For Sale') return false;
                    break;
                case 'reserved':
                    if (v.status !== 'Reserved') return false;
                    break;
                case 'sold':
                    if (v.status !== 'Sold') return false;
                    break;
                case 'complete':
                    if (v.status !== 'Complete') return false;
                    break;
                case 'deleted':
                    if (v.status !== 'Deleted') return false;
                    break;
            }

            if (filterMake && v.make?.toLowerCase() !== filterMake.toLowerCase()) return false;
            if (filterModel && !v.model?.toLowerCase().includes(filterModel.toLowerCase())) return false;
            if (filterReg && !v.vrm?.toLowerCase().includes(filterReg.toLowerCase())) return false;
            if (filterFuel && v.fuelType?.toLowerCase() !== filterFuel.toLowerCase()) return false;
            if (filterBodyType && v.bodyType?.toLowerCase() !== filterBodyType.toLowerCase()) return false;
            if (filterTransmission.length > 0 && !filterTransmission.includes(v.transmission || '')) return false;
            return true;
        });
    }, [vehicles, activeTab, filterMake, filterModel, filterReg, filterFuel, filterBodyType, filterTransmission]);

    const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
    const pagedVehicles = filteredVehicles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const allPageSelected = pagedVehicles.length > 0 && pagedVehicles.every(v => selectedIds.has(v._id));
    const toggleAll = () => {
        if (allPageSelected) {
            setSelectedIds(prev => { const n = new Set(prev); pagedVehicles.forEach(v => n.delete(v._id)); return n; });
        } else {
            setSelectedIds(prev => { const n = new Set(prev); pagedVehicles.forEach(v => n.add(v._id)); return n; });
        }
    };
    const toggleId = (id: string) =>
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const toggleTransmission = (t: string) =>
        setFilterTransmission(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

    const clearFilters = () => {
        setFilterMake(''); setFilterModel(''); setFilterReg('');
        setFilterFuel(''); setFilterBodyType(''); setFilterTransmission([]);
    };

    const [importing, setImporting] = useState(false);
    async function handleImportFromAT() {
        if (!confirm('Import all vehicles from AutoTrader into the database? Existing vehicles (same VRM) will be updated.')) return;
        setImporting(true);
        try {
            const res = await fetch('/api/vehicles/import-from-at', { method: 'POST' });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success(`Imported ${data.imported} new, updated ${data.updated} vehicles from AutoTrader.`);
            fetchVehicles();
        } catch (err: any) {
            toast.error(err.message || 'Import failed');
        } finally {
            setImporting(false);
        }
    }

    const downloadCSV = () => {
        const target = selectedIds.size > 0 ? filteredVehicles.filter(v => selectedIds.has(v._id)) : filteredVehicles;
        const headers = ['VRM', 'Make', 'Model', 'Derivative', 'Status', 'Price', 'Mileage'];
        const rows = target.map(v => [v.vrm, v.make, v.model, v.derivative, v.status, v.price, v.mileage || '']);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'vehicles.csv'; a.click();
    };

    const downloadExcel = () => {
        const target = selectedIds.size > 0 ? filteredVehicles.filter(v => selectedIds.has(v._id)) : filteredVehicles;
        const headers = ['VRM', 'Make', 'Model', 'Derivative', 'Status', 'Price', 'Mileage'];
        const rows = target.map(v => [v.vrm, v.make, v.model, v.derivative, v.status, v.price, v.mileage || '']);
        const table = `<table><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([table], { type: 'application/vnd.ms-excel' }));
        a.download = 'vehicles.xls'; a.click();
    };

    const uniqueMakes = Array.from(new Set(vehicles.map(v => v.make).filter(Boolean))).sort();
    const uniqueModels = Array.from(new Set(vehicles.filter(v => !filterMake || v.make === filterMake).map(v => v.model).filter(Boolean))).sort();

    return (
        <div className="flex flex-col min-h-screen bg-[#f0f2f5]">

            {/* ── Single Tab Row (MotorDesk style) ─────────────────────────── */}
            <div className="bg-white border-b border-slate-200">
                <div className="px-4 flex items-center gap-0 overflow-x-auto no-scrollbar">
                    {/* Stock type */}
                    {[{ id: 'all', label: 'All' }, { id: 'inStock', label: 'In Stock' }, { id: 'toOrder', label: 'To Order' }].map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                            className={`px-3 py-3 text-[13px] whitespace-nowrap transition-colors shrink-0 ${
                                activeTab === tab.id ? 'font-bold text-slate-900 border-b-2 border-slate-800' : 'font-medium text-slate-400 hover:text-slate-600'
                            }`}>{tab.label}</button>
                    ))}
                    <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />
                    {/* Vehicle type */}
                    {[{ id: 'customer', label: 'Customer' }, { id: 'courtesy', label: 'Courtesy' }].map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                            className={`px-3 py-3 text-[13px] whitespace-nowrap transition-colors shrink-0 ${
                                activeTab === tab.id ? 'font-bold text-slate-900 border-b-2 border-slate-800' : 'font-medium text-slate-400 hover:text-slate-600'
                            }`}>{tab.label}</button>
                    ))}
                    <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />
                    {/* View mode — blue underline, independent of filter tabs */}
                    {(['browse', 'advertising'] as const).map(v => (
                        <button key={v} onClick={() => setViewMode(v)}
                            className={`px-3 py-3 text-[13px] whitespace-nowrap transition-colors capitalize shrink-0 ${
                                viewMode === v ? 'font-bold text-blue-600 border-b-2 border-blue-500' : 'font-medium text-slate-400 hover:text-slate-600'
                            }`}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
                    ))}
                    <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />
                    {/* Special filters */}
                    {[{ id: 'latest', label: 'Latest' }, { id: 'overage', label: 'Overage' }, { id: 'demo', label: 'Demo' }].map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                            className={`px-3 py-3 text-[13px] whitespace-nowrap transition-colors shrink-0 ${
                                activeTab === tab.id ? 'font-bold text-slate-900 border-b-2 border-slate-800' : 'font-medium text-slate-400 hover:text-slate-600'
                            }`}>{tab.label}</button>
                    ))}
                    <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />
                    {/* Status tabs */}
                    {[
                        { id: 'draft', label: 'Draft' }, { id: 'forsale', label: 'For Sale' },
                        { id: 'reserved', label: 'Reserved' }, { id: 'sold', label: 'Sold' },
                        { id: 'complete', label: 'Complete' }, { id: 'deleted', label: 'Deleted' },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                            className={`px-3 py-3 text-[13px] whitespace-nowrap transition-colors shrink-0 ${
                                activeTab === tab.id ? 'font-bold text-slate-900 border-b-2 border-slate-800' : 'font-medium text-slate-400 hover:text-slate-600'
                            }`}>{tab.label}</button>
                    ))}
                </div>
            </div>

            {/* ── Toolbar ──────────────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-bold text-slate-800 mr-1">{filteredVehicles.length} Vehicles</span>
                    <AddVehicleButton className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-teal-500 text-teal-600 rounded-lg text-[12px] font-semibold hover:bg-teal-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        Add Vehicle
                    </AddVehicleButton>
                    <button
                        onClick={handleImportFromAT}
                        disabled={importing}
                        className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-blue-500 text-blue-600 rounded-lg text-[12px] font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        {importing ? 'Importing…' : 'Import from AT'}
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-teal-500 text-teal-600 rounded-lg text-[12px] font-semibold hover:bg-teal-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Locations
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-teal-500 text-teal-600 rounded-lg text-[12px] font-semibold hover:bg-teal-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18" /></svg>
                        Columns
                    </button>
                    <button
                        onClick={() => setShowFilter(p => !p)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 border-2 rounded-lg text-[12px] font-semibold transition-colors ${
                            showFilter ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-teal-500 text-teal-600 hover:bg-teal-50'
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                        Filter
                    </button>
                </div>
                <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-64 border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-blue-400"
                />
            </div>

            {/* ── Filter Panel ─────────────────────────────────────────────── */}
            {showFilter && (
                <div className="bg-white border-b border-slate-200 px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[13px] font-bold text-blue-600">▼ Vehicle</span>
                        <button
                            onClick={clearFilters}
                            className="px-3 py-1.5 bg-slate-600 text-white text-[12px] font-semibold rounded hover:bg-slate-700"
                        >
                            Clear Filters
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                        {/* Registration */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Registration</label>
                            <div className="flex rounded overflow-hidden border-2 border-slate-800 w-48">
                                <div className="bg-blue-700 flex flex-col items-center justify-center px-2">
                                    <span className="text-white text-[8px] font-black">UK</span>
                                </div>
                                <input
                                    value={filterReg}
                                    onChange={e => setFilterReg(e.target.value.toUpperCase())}
                                    className="flex-1 bg-yellow-400 px-2 py-1.5 text-[13px] font-black text-slate-900 outline-none uppercase placeholder:text-yellow-600"
                                    placeholder=""
                                />
                            </div>
                        </div>
                        {/* Vehicle Type */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Vehicle Type</label>
                            <select className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option>Nothing selected</option>
                                <option>Car</option><option>Van</option><option>Motorcycle</option>
                            </select>
                        </div>
                        {/* Manufacturer */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Manufacturer</label>
                            <select value={filterMake} onChange={e => { setFilterMake(e.target.value); setFilterModel(''); }}
                                className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option value="">Nothing selected</option>
                                {uniqueMakes.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        {/* Model */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Model</label>
                            <select value={filterModel} onChange={e => setFilterModel(e.target.value)}
                                className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option value="">Nothing selected</option>
                                {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        {/* Generation */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Generation</label>
                            <select className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option>Nothing selected</option>
                            </select>
                        </div>
                        {/* Trim */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Trim</label>
                            <select className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option>Nothing selected</option>
                            </select>
                        </div>
                        {/* Derivative */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Derivative</label>
                            <select className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option>Nothing selected</option>
                                {Array.from(new Set(vehicles.map(v => v.derivative).filter(Boolean))).sort().map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>
                        {/* Engine Size */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Engine Size</label>
                            <div className="flex items-center gap-2">
                                <input type="number" className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none" />
                                <span className="text-slate-400 text-[12px] shrink-0">to</span>
                                <input type="number" className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none" />
                            </div>
                        </div>
                        {/* Fuel */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Fuel</label>
                            <select value={filterFuel} onChange={e => setFilterFuel(e.target.value)}
                                className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option value="">Nothing selected</option>
                                <option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option>
                            </select>
                        </div>
                        {/* Transmission */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Transmission</label>
                            <div className="flex gap-4 mt-1">
                                {['Automatic', 'Manual'].map(t => (
                                    <label key={t} className="flex items-center gap-2 text-[13px] cursor-pointer">
                                        <input type="checkbox" checked={filterTransmission.includes(t)} onChange={() => toggleTransmission(t)} className="rounded border-slate-300" />
                                        {t}
                                    </label>
                                ))}
                            </div>
                        </div>
                        {/* Body Type */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Body Type</label>
                            <select value={filterBodyType} onChange={e => setFilterBodyType(e.target.value)}
                                className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option value="">Nothing selected</option>
                                <option>Saloon</option><option>Hatchback</option><option>Estate</option>
                                <option>SUV</option><option>Coupe</option><option>Convertible</option>
                            </select>
                        </div>
                        {/* Drivetrain */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Drivetrain</label>
                            <div className="grid grid-cols-2 gap-y-1 gap-x-2">
                                {['Front Wheel Drive', 'Rear Wheel Drive', 'Four Wheel Drive', 'Belt Drive', 'Chain Drive', 'Other'].map(d => (
                                    <label key={d} className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                                        <input type="checkbox" className="rounded border-slate-300" /> {d}
                                    </label>
                                ))}
                            </div>
                        </div>
                        {/* Driver Position */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Driver Position</label>
                            <select className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option>Nothing selected</option>
                                <option>Left Hand Drive</option><option>Right Hand Drive</option>
                            </select>
                        </div>
                        {/* Colour */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Colour</label>
                            <select className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option>Nothing selected</option>
                                {['Black', 'White', 'Silver', 'Grey', 'Blue', 'Red', 'Green', 'Yellow', 'Orange', 'Brown'].map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        {/* Colour Name */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Colour Name</label>
                            <input type="text" className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400" />
                        </div>
                        {/* Seats */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Seats</label>
                            <div className="flex items-center gap-2">
                                <input type="number" className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none" />
                                <span className="text-slate-400 text-[12px] shrink-0">to</span>
                                <input type="number" className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none" />
                            </div>
                        </div>
                        {/* Doors */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Doors</label>
                            <div className="flex items-center gap-2">
                                <input type="number" className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none" />
                                <span className="text-slate-400 text-[12px] shrink-0">to</span>
                                <input type="number" className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none" />
                            </div>
                        </div>
                        {/* Interior Upholstery */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Interior Upholstery</label>
                            <select className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option>Nothing selected</option>
                                <option>Leather</option><option>Cloth</option><option>Alcantara</option>
                            </select>
                        </div>
                        {/* Interior Colour */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Interior Colour</label>
                            <select className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option>Nothing selected</option>
                                <option>Black</option><option>Beige</option><option>Grey</option>
                            </select>
                        </div>
                        {/* Exterior Finish */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Exterior Finish</label>
                            <select className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option>Nothing selected</option>
                                <option>Metallic</option><option>Solid</option><option>Pearl</option>
                            </select>
                        </div>
                        {/* Wheelbase */}
                        <div>
                            <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Wheelbase</label>
                            <select className="w-full border border-slate-200 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400">
                                <option>Nothing selected</option>
                                <option>Short</option><option>Standard</option><option>Long</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Table area ───────────────────────────────────────────────── */}
            <div className="flex-1 bg-white">
                {/* Table top bar: bulk actions only */}
                {selectedIds.size > 0 && (
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-[12px] font-semibold rounded hover:bg-blue-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            Edit
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500 text-white text-[12px] font-semibold rounded hover:bg-pink-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Remove
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-[12px] font-semibold rounded hover:bg-green-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            Share
                        </button>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-white">
                                <th className="px-4 py-3 w-10">
                                    <input type="checkbox" checked={allPageSelected} onChange={toggleAll} className="rounded border-slate-300" />
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">
                                    SUMMARY ▲
                                </th>
                                {viewMode === 'browse' && (
                                    <>
                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-28">MILEAGE ⇅</th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-36">CHECKLIST ⇅</th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-32">VIDEOS ⇅</th>
                                    </>
                                )}
                                {viewMode === 'pricing' && (
                                    <>
                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-40">SALE PRICE</th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-40">STAND IN</th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-36">PRICE POSITION</th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-36">INDICATOR</th>
                                    </>
                                )}
                                {viewMode === 'advertising' && (
                                    <>
                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-28">WEBSITE</th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-36">AUTOTRADER</th>
                                        <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-32">FOR SALE</th>
                                    </>
                                )}
                                <th className="w-28"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={8} className="py-20 text-center text-slate-400 text-[13px] animate-pulse">Loading vehicles…</td></tr>
                            ) : pagedVehicles.length === 0 ? (
                                <tr><td colSpan={8} className="py-20 text-center text-slate-300 text-[13px]">No vehicles found</td></tr>
                            ) : pagedVehicles.map(vehicle => (
                                <tr
                                    key={vehicle._id}
                                    className={`transition-colors ${selectedIds.has(vehicle._id) ? 'bg-blue-50' : 'hover:bg-slate-50/60'}`}
                                >
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(vehicle._id)}
                                            onChange={() => toggleId(vehicle._id)}
                                            className="rounded border-slate-300"
                                        />
                                    </td>

                                    {/* Summary */}
                                    <td className="px-4 py-3 min-w-[380px]">
                                        <div className="flex gap-3">
                                            <div className="w-16 h-12 bg-slate-100 rounded overflow-hidden shrink-0 border border-slate-200">
                                                {vehicle.primaryImage
                                                    ? <img src={vehicle.primaryImage} alt="" className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full flex items-center justify-center text-slate-300 text-[9px] font-bold">No Image</div>
                                                }
                                            </div>
                                            <div className="min-w-0">
                                                <Link
                                                    href={`/app/vehicles/${vehicle._id}`}
                                                    className="text-[13px] font-semibold text-blue-600 hover:underline leading-tight block truncate max-w-[380px]"
                                                >
                                                    {vehicle.make} {vehicle.vehicleModel || vehicle.model} {vehicle.derivative
                                                        ? (vehicle.derivative.length > 45 ? vehicle.derivative.substring(0, 45) + '…' : vehicle.derivative)
                                                        : ''}
                                                </Link>
                                                <div className="text-[12px] text-slate-500 mt-0.5">
                                                    <span className="font-bold text-slate-700">{vehicle.vrm}</span>
                                                    {vehicle.mileage ? <span> | {vehicle.mileage.toLocaleString()} miles</span> : null}
                                                    {vehicle.createdAt ? <span> | {formatDateGB(vehicle.createdAt)}</span> : null}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                    <StatusBadge status={vehicle.status} />
                                                    <button className="px-2.5 py-0.5 border border-blue-300 text-blue-500 rounded text-[11px] font-medium hover:bg-blue-50">
                                                        0 Suggestions
                                                    </button>
                                                    <Link href={`/app/vehicles/${vehicle._id}?tab=images`} className="px-2.5 py-0.5 border border-blue-300 text-blue-500 rounded text-[11px] font-medium hover:bg-blue-50">
                                                        {vehicle.imagesCount || 0} {vehicle.imagesCount === 1 ? 'Image' : 'Images'}
                                                    </Link>
                                                    <Link href={`/app/vehicles/${vehicle._id}?tab=images`} className="px-2.5 py-0.5 border border-blue-300 text-blue-500 rounded text-[11px] font-medium hover:bg-blue-50">
                                                        {vehicle.videosCount || 0} Videos
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Browse columns */}
                                    {viewMode === 'browse' && (
                                        <>
                                            <td className="px-4 py-3 text-center text-[13px] text-slate-700">
                                                {vehicle.mileage ? vehicle.mileage.toLocaleString() : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button className="px-2.5 py-1 border border-blue-200 text-blue-500 rounded-full text-[11px] font-medium hover:bg-blue-50 whitespace-nowrap">
                                                    No Checklist
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${
                                                    (vehicle.videosCount || 0) > 0
                                                        ? 'bg-blue-500 text-white'
                                                        : 'border border-blue-200 text-blue-500 hover:bg-blue-50'
                                                }`}>
                                                    {vehicle.videosCount || 0} Videos
                                                </button>
                                            </td>
                                        </>
                                    )}

                                    {/* Pricing columns */}
                                    {viewMode === 'pricing' && (
                                        <>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center border border-slate-200 rounded overflow-hidden w-36 mx-auto">
                                                    <span className="px-2 py-1.5 text-slate-400 border-r border-slate-200 text-[13px]">£</span>
                                                    <input
                                                        type="number"
                                                        defaultValue={vehicle.price || ''}
                                                        onBlur={e => { if (e.target.value) handleUpdateVehicle(vehicle._id, { price: parseFloat(e.target.value) }); }}
                                                        className="flex-1 px-2 py-1.5 text-[13px] outline-none w-0"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center border border-slate-200 rounded overflow-hidden w-36 mx-auto">
                                                    <span className="px-2 py-1.5 text-slate-400 border-r border-slate-200 text-[13px]">£</span>
                                                    <input type="number" className="flex-1 px-2 py-1.5 text-[13px] outline-none w-0" />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-[12px] text-slate-400 italic">No data.</td>
                                            <td className="px-4 py-3 text-center text-[12px] text-slate-400 italic">No data.</td>
                                        </>
                                    )}

                                    {/* Advertising columns */}
                                    {viewMode === 'advertising' && (
                                        <>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => {
                                                        const cur = pendingAd[vehicle._id]?.websitePublished ?? vehicle.websitePublished;
                                                        setPendingAd(prev => ({ ...prev, [vehicle._id]: { ...prev[vehicle._id], websitePublished: !cur } }));
                                                    }}
                                                    className={`w-10 h-5 rounded-full relative transition-colors mx-auto block ${
                                                        (pendingAd[vehicle._id]?.websitePublished ?? vehicle.websitePublished) ? 'bg-blue-500' : 'bg-slate-200'
                                                    }`}
                                                >
                                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                                                        (pendingAd[vehicle._id]?.websitePublished ?? vehicle.websitePublished) ? 'left-5' : 'left-0.5'
                                                    }`} />
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded text-[11px] font-semibold ${vehicle.isLiveOnAT ? 'bg-green-100 text-green-700' : 'text-slate-400'}`}>
                                                    {vehicle.isLiveOnAT ? 'Published' : '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-[12px] text-slate-500">
                                                {vehicle.atStatus === 'Yes' ? formatDateGB(vehicle.updatedAt) : '—'}
                                            </td>
                                        </>
                                    )}

                                    {/* Row actions */}
                                    <td className="px-3 py-3 text-right pr-4">
                                        <div className="flex items-center justify-end gap-1">
                                            {viewMode === 'advertising' && pendingAd[vehicle._id] && (
                                                <button
                                                    onClick={() => handleSaveAdRow(vehicle._id)}
                                                    disabled={savingRows[vehicle._id]}
                                                    className="px-2 py-1.5 text-[10px] font-bold bg-green-500 text-white rounded hover:bg-green-600 mr-1"
                                                >
                                                    {savingRows[vehicle._id] ? '…' : 'Save'}
                                                </button>
                                            )}
                                            <Link
                                                href={`/app/vehicles/${vehicle._id}?tab=sellVehicle`}
                                                title="Sell"
                                                className="w-9 h-9 bg-emerald-500 hover:bg-emerald-600 text-white rounded flex items-center justify-center transition-colors shadow-sm"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                            </Link>
                                            <Link
                                                href={`/app/vehicles/${vehicle._id}`}
                                                title="Edit"
                                                className="w-9 h-9 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center justify-center transition-colors shadow-sm"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(vehicle._id, vehicle.make, vehicle.vrm)}
                                                title="Delete"
                                                className="w-9 h-9 bg-pink-500 hover:bg-pink-600 text-white rounded flex items-center justify-center transition-colors shadow-sm"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Bottom bar: bulk actions + show/CSV/Excel + pagination ───── */}
            {/* bottom bar */}
            <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    {selectedIds.size > 0 && (
                        <>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-[12px] font-semibold rounded hover:bg-blue-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                Edit
                            </button>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500 text-white text-[12px] font-semibold rounded hover:bg-pink-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Remove
                            </button>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-[12px] font-semibold rounded hover:bg-green-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                Share
                            </button>
                        </>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] text-slate-500">Show</span>
                        <select className="border border-slate-200 rounded px-2 py-1 text-[12px] focus:outline-none">
                            <option>25</option><option>50</option><option>100</option>
                        </select>
                        <button onClick={downloadCSV} className="px-3 py-1.5 bg-slate-500 text-white text-[12px] font-semibold rounded hover:bg-slate-600">
                            CSV
                        </button>
                        <button onClick={downloadExcel} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 text-[12px] font-semibold rounded hover:bg-slate-50">
                            Excel
                        </button>
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 rounded border border-slate-200 disabled:opacity-40"
                    >
                        Previous
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const p = Math.max(1, currentPage - 2) + i;
                        if (p > totalPages) return null;
                        return (
                            <button
                                key={p}
                                onClick={() => setCurrentPage(p)}
                                className={`w-8 h-8 text-[12px] font-bold rounded transition-colors ${
                                    currentPage === p ? 'bg-blue-500 text-white' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'
                                }`}
                            >
                                {p}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 rounded border border-slate-200 disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function VehiclesPage() {
    return (
        <>
            <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
            <Suspense fallback={<div className="p-10 text-center text-slate-400 text-[13px]">Loading…</div>}>
                <VehiclesContent />
            </Suspense>
        </>
    );
}
