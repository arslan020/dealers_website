'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface VehicleItem {
    _id: string;
    make: string;
    vehicleModel: string;
    derivative: string;
    vrm: string;
    status: string;
    price: number;
    primaryImage?: string;
    imagesCount: number;
    videosCount: number;
    createdAt: string;
    updatedAt: string;
    tenantId: string;
    source: 'local' | 'autotrader' | 'merged';
    isLiveOnAT: boolean;
    atStatus: string;
    websitePublished: boolean;
}

export default function AdvertisingPage() {
    const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [pendingAd, setPendingAd] = useState<Record<string, Partial<VehicleItem>>>({});
    const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

    // Response Metrics state
    const [metricsMap, setMetricsMap] = useState<Record<string, any>>({});
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [metricsUnavailable, setMetricsUnavailable] = useState(false);

    const fetchVehicles = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            // In advertising page, we often want to see all stock that could be advertised
            params.append('status', 'All'); 

            const res = await fetch(`/api/vehicles?${params.toString()}`);
            const data = await res.json();
            if (data.ok) {
                setVehicles(data.vehicles);
            }
        } catch (err) {
            console.error('Failed to fetch vehicles:', err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        fetchVehicles();
    }, [fetchVehicles]);

    useEffect(() => {
        async function fetchMetrics() {
            setMetricsLoading(true);
            try {
                const res = await fetch('/api/vehicles/autotrader-stock/analytics?type=responseMetrics');
                const data = await res.json();
                if (!data.ok) { setMetricsUnavailable(true); return; }
                const map: Record<string, any> = {};
                for (const r of data.results || []) {
                    const vrm = r.vehicle?.vrm || r.vehicle?.registration || r.vehicle?.registrationNumber;
                    const metrics = r.vehicle?.responseMetrics;
                    if (vrm && metrics) map[vrm.toUpperCase()] = metrics;
                }
                setMetricsMap(map);
            } catch {
                setMetricsUnavailable(true);
            } finally {
                setMetricsLoading(false);
            }
        }
        fetchMetrics();
    }, []);

    const handleUpdateVehicle = async (id: string, updates: Partial<VehicleItem>) => {
        try {
            // Local optimistic update
            setVehicles(prev => prev.map(v => v._id === id ? { ...v, ...updates } : v));

            const res = await fetch('/api/vehicles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates })
            });
            const data = await res.json();
            if (!data.ok) {
                fetchVehicles();
                alert(data.error || 'Failed to update vehicle');
            }
        } catch (err) {
            console.error('Update Error:', err);
            fetchVehicles();
        }
    };

    // Update local pending state only (no API call)
    const setPendingAdField = (id: string, updates: Partial<VehicleItem>) => {
        setPendingAd(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
    };

    // Save pending changes for a specific row
    const handleSaveAdRow = async (id: string) => {
        const updates = pendingAd[id];
        if (!updates || Object.keys(updates).length === 0) return;
        setSavingRows(prev => ({ ...prev, [id]: true }));
        await handleUpdateVehicle(id, updates);
        setPendingAd(prev => { const next = { ...prev }; delete next[id]; return next; });
        setSavingRows(prev => ({ ...prev, [id]: false }));
    };

    const handleSyncAT = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/vehicles/autotrader-stock?force=true');
            if (res.ok) {
                await fetchVehicles();
            }
        } catch (err) {
            console.error('Sync failed:', err);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">
            {/* Header Section */}
            <div className="bg-white border-b border-slate-200">
                <div className="px-4 sm:px-6 py-4 sm:py-6 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            Advertising Management
                            <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-blue-100">Live Sync</span>
                        </h1>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Multi-channel distribution powered by AutoTrader Connect</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleSyncAT}
                            disabled={syncing}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ${
                                syncing ? 'bg-slate-100 text-slate-400 animate-pulse' : 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-200'
                            }`}
                        >
                            <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            {syncing ? 'Syncing...' : 'Refresh Stock'}
                        </button>
                    </div>
                </div>

                <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 border-t border-slate-100">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                            <input
                                type="text"
                                placeholder="SEARCH BY VRM, MAKE OR MODEL..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-80 bg-white border border-slate-200 rounded-xl px-4 py-2 pl-10 text-[10px] font-black uppercase tracking-widest text-slate-800 placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all shadow-sm"
                            />
                            <svg className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {vehicles.length} Total Vehicles in inventory
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="p-3 sm:p-6">
                <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 divide-x divide-slate-100">
                                    <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded border-slate-300" /></th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-left">Vehicle Details</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-center w-32">Website</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-center w-48">AutoTrader</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-center w-32">For Sale</th>
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-center w-52">
                                        AT Performance
                                        {metricsLoading && <span className="ml-1 text-[8px] text-slate-300 animate-pulse">Loading…</span>}
                                    </th>
                                    <th className="px-6 py-4 text-right pr-6 w-32"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && !syncing ? (
                                    <tr><td colSpan={7} className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] animate-pulse">Loading Inventory...</td></tr>
                                ) : vehicles.length === 0 ? (
                                    <tr><td colSpan={7} className="py-20 text-center text-slate-300 font-bold uppercase text-[10px] tracking-[0.2em]">No vehicles available for advertising</td></tr>
                                ) : (
                                    vehicles.map(vehicle => (
                                        <tr key={vehicle._id} className="hover:bg-blue-50/30 transition-colors group divide-x divide-slate-50">
                                            <td className="px-4 py-4 text-center"><input type="checkbox" className="rounded border-slate-300" /></td>
                                            <td className="px-6 py-4 min-w-[350px]">
                                                <div className="flex gap-5">
                                                    <div className="w-20 h-14 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                                                        {vehicle.primaryImage ? (
                                                            <img src={vehicle.primaryImage} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-300 uppercase text-[8px] font-black">No Image</div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-[12px] font-black text-slate-800 leading-tight">
                                                            {vehicle.make} {vehicle.vehicleModel}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-black text-slate-900 tracking-wider bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{vehicle.vrm}</span>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tabular-nums">£{vehicle.price.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex gap-2 mt-2">
                                                            <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-500 rounded text-[8px] font-black uppercase tracking-widest">{vehicle.status}</span>
                                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black uppercase tracking-widest border border-blue-100">Updated {formatDistanceToNow(new Date(vehicle.updatedAt))} ago</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-2 py-4">
                                                <div className="flex items-center justify-center">
                                                    {/* Toggle only updates local pending state */}
                                                    <button
                                                        onClick={() => {
                                                            const current = pendingAd[vehicle._id]?.websitePublished ?? vehicle.websitePublished;
                                                            setPendingAdField(vehicle._id, { websitePublished: !current });
                                                        }}
                                                        className={`w-12 h-6 rounded-full transition-all relative ${
                                                            (pendingAd[vehicle._id]?.websitePublished ?? vehicle.websitePublished)
                                                                ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                                                                : 'bg-slate-200'
                                                        }`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${
                                                            (pendingAd[vehicle._id]?.websitePublished ?? vehicle.websitePublished) ? 'left-7' : 'left-1'
                                                        }`} />
                                                    </button>
                                                </div>
                                            </td>

                                            <td className="px-4 py-4">
                                                <div className="flex items-center justify-center">
                                                    <div className="relative w-full max-w-[150px]">
                                                        <select
                                                            value={pendingAd[vehicle._id]?.atStatus ?? vehicle.atStatus ?? 'No'}
                                                            onChange={(e) => setPendingAdField(vehicle._id, { atStatus: e.target.value })}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 appearance-none outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 cursor-pointer pr-10 shadow-sm"
                                                        >
                                                            <option value="Yes">Published: Yes</option>
                                                            <option value="Profile Only">Profile Only</option>
                                                            <option value="No">Published: No</option>
                                                        </select>
                                                        <svg className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-4 py-4 text-center">
                                                <span className="text-[10px] font-black text-slate-600 tabular-nums">
                                                    {vehicle.atStatus === 'Yes' ? formatDistanceToNow(new Date(vehicle.updatedAt)) + ' ago' : '—'}
                                                </span>
                                            </td>

                                            <td className="px-4 py-4 text-center">
                                                {(() => {
                                                    const m = metricsMap[vehicle.vrm?.toUpperCase()];
                                                    if (metricsUnavailable) return <span className="text-[9px] text-slate-300 font-bold">N/A</span>;
                                                    if (metricsLoading) return <span className="text-[9px] text-slate-300 animate-pulse">…</span>;
                                                    if (!m) return <span className="text-[9px] text-slate-300 font-bold">—</span>;
                                                    const rating = m.performanceRating?.rating || 'NONE';
                                                    const ratingColors: Record<string, string> = {
                                                        EXCELLENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                                        ABOVE_AVERAGE: 'bg-blue-100 text-blue-700 border-blue-200',
                                                        'ABOVE AVERAGE': 'bg-blue-100 text-blue-700 border-blue-200',
                                                        BELOW_AVERAGE: 'bg-amber-100 text-amber-700 border-amber-200',
                                                        'BELOW AVERAGE': 'bg-amber-100 text-amber-700 border-amber-200',
                                                        LOW: 'bg-red-100 text-red-700 border-red-200',
                                                        NONE: 'bg-slate-100 text-slate-500 border-slate-200',
                                                    };
                                                    const cls = ratingColors[rating] || ratingColors.NONE;
                                                    return (
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${cls}`}>
                                                                {rating.replace(/_/g, ' ')}
                                                            </span>
                                                            <div className="flex gap-2 text-[9px] font-bold text-slate-500 tabular-nums">
                                                                <span title="Yesterday advert views">👁 {m.yesterday?.advertViews ?? '—'}</span>
                                                                <span title="Yesterday search views">🔍 {(m.yesterday?.searchViews ?? 0) >= 1000 ? ((m.yesterday.searchViews / 1000).toFixed(1) + 'k') : (m.yesterday?.searchViews ?? '—')}</span>
                                                            </div>
                                                            <div className="flex gap-2 text-[8px] text-slate-400 tabular-nums">
                                                                <span>7d: {m.lastWeek?.advertViews ?? '—'} views</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            <td className="px-4 py-4 text-right pr-6 min-w-[160px]">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Save button — only active when there are pending changes */}
                                                    <button
                                                        onClick={() => handleSaveAdRow(vehicle._id)}
                                                        disabled={savingRows[vehicle._id] || !pendingAd[vehicle._id]}
                                                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                                            pendingAd[vehicle._id]
                                                                ? 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
                                                                : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                                                        }`}
                                                    >
                                                        {savingRows[vehicle._id] ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <Link href={`/app/vehicles/${vehicle._id}`} className="px-4 py-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 hover:text-slate-600 transition-all">
                                                        Manage
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Promotional Footer */}
                <div className="mt-10 bg-slate-900 rounded-[2.5rem] p-12 text-center text-white relative overflow-hidden shadow-2xl shadow-blue-900/10 border border-slate-800">
                    <div className="relative z-10 max-w-2xl mx-auto">
                        <div className="flex justify-center gap-3 mb-6">
                            <div className="w-12 h-1 bg-blue-500 rounded-full"></div>
                        </div>
                        <h2 className="text-3xl font-black mb-4 tracking-tight">Expand Your Reach</h2>
                        <p className="text-slate-400 font-medium mb-10 leading-relaxed text-sm">Want to sync your stock with eBay Motors and Facebook Marketplace too? Your AutoTrader Connect integration supports multi-channel distribution automatically.</p>
                    </div>
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full -mr-48 -mt-48 blur-3xl opacity-50"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full -ml-48 -mb-48 blur-3xl opacity-50"></div>
                </div>
            </div>
        </div>
    );
}
