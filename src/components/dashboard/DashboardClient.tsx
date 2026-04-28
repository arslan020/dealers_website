'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardCalendar } from './DashboardCalendar';

type TabView = 'default' | 'calendar' | 'columns' | 'classic';
type TimePeriod = '7' | '14' | '31' | 'week' | '2weeks' | 'month';

export interface VehicleStats {
    totalVehicles: number;
    draftVehicles: number;
    forSaleVehicles: number;
    reservedVehicles: number;
    soldVehicles: number;
    overageVehicles: number;
    totalStandInValue: number;
    totalWebsitePrice: number;
    estProfit: number;
    soldStandInValue: number;
    soldWebsitePrice: number;
}

interface FinancialStats {
    totalSales: number;
    revenue: number;
    purchases: number;
    balance: number;
    vehiclesAdded: number;
    prevTotalSales: number;
    prevPurchases: number;
    prevBalance: number;
    prevVehiclesAdded: number;
    dailyData: { date: string; sales: number; purchases: number }[];
}

interface ATStats {
    avgDaysForSale: number;
    avgDaysSold: number;
    overageVehicles: number;
}

const PERIOD_DAYS: Record<TimePeriod, number> = {
    '7': 7, '14': 14, '31': 31, 'week': 7, '2weeks': 14, 'month': 30,
};

const PERIOD_LABELS: Record<TimePeriod, string> = {
    '7': '7 Days', '14': '14 Days', '31': '31 Days', 'week': 'Week', '2weeks': '2 Weeks', 'month': 'Month',
};

function fmtCurrency(val: number) {
    if (val === 0) return '£0';
    if (Math.abs(val) >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `£${(val / 1_000).toFixed(1)}k`;
    return `£${Math.round(val).toLocaleString()}`;
}

function pctChange(current: number, prev: number) {
    if (prev === 0 && current === 0) return null;
    if (prev === 0) return { pct: 100, up: true, prevLabel: '£0' };
    const pct = Math.abs(Math.round(((current - prev) / prev) * 100));
    return { pct, up: current >= prev, prevLabel: fmtCurrency(prev) };
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
    if (data.length < 2) return <div className="w-20 h-8" />;
    const max = Math.max(...data, 0.01);
    const min = Math.min(...data, 0);
    const range = max - min || 0.01;
    const W = 80, H = 32;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = H - ((v - min) / range) * (H - 6) - 3;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible shrink-0">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
                strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

function MetricCard({ label, period, value, prevValue, sparkData, color, loading }: {
    label: string; period: string; value: number; prevValue: number;
    sparkData: number[]; color: string; loading: boolean;
}) {
    const trend = pctChange(value, prevValue);
    return (
        <div className="px-4 py-4 border-b border-slate-100 last:border-b-0">
            <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-tight">{label}</p>
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{period}</p>
                </div>
                <Sparkline data={sparkData} color={color} />
            </div>
            {loading ? (
                <div className="w-16 h-7 bg-slate-100 rounded-lg animate-pulse mt-2" />
            ) : (
                <p className="text-[22px] font-black leading-tight mt-1" style={{ color }}>
                    {fmtCurrency(value)}
                </p>
            )}
            {!loading && trend && (
                <p className={`text-[10px] font-semibold mt-0.5 ${trend.up ? 'text-emerald-600' : 'text-red-500'}`}>
                    {trend.up ? '↑' : '↓'}{trend.pct}% from {trend.prevLabel}
                </p>
            )}
            {!loading && !trend && (
                <p className="text-[10px] text-slate-400 mt-0.5">No previous data</p>
            )}
        </div>
    );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-b-0">
            <span className="text-[12px] text-slate-600">{label}</span>
            <span className={`text-[12px] font-bold ${highlight ? 'text-[#4D7CFF]' : 'text-slate-800'}`}>{value}</span>
        </div>
    );
}

export function DashboardClient({ vehicleStats }: { vehicleStats: VehicleStats }) {
    const [tab, setTab] = useState<TabView>('default');
    const [period, setPeriod] = useState<TimePeriod>('7');
    const [showVAT, setShowVAT] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [financials, setFinancials] = useState<FinancialStats | null>(null);
    const [atStats, setAtStats] = useState<ATStats | null>(null);
    const [loadingFin, setLoadingFin] = useState(true);
    const [loadingAT, setLoadingAT] = useState(true);
    const [tick, setTick] = useState(0);

    const fetchFinancials = useCallback(async () => {
        setLoadingFin(true);
        try {
            const r = await fetch(`/api/dashboard/financial-stats?days=${PERIOD_DAYS[period]}`);
            const d = await r.json();
            if (d.ok) setFinancials(d);
        } catch { /* ignore */ }
        setLoadingFin(false);
    }, [period]);

    useEffect(() => { fetchFinancials(); }, [fetchFinancials, tick]);

    useEffect(() => {
        setLoadingAT(true);
        fetch('/api/dashboard/at-stats')
            .then(r => r.json())
            .then(d => { if (d.ok) setAtStats(d); })
            .catch(() => { })
            .finally(() => setLoadingAT(false));
    }, [tick]);

    useEffect(() => {
        if (!autoRefresh) return;
        const id = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(id);
    }, [autoRefresh]);

    const periodLabel = `PAST ${PERIOD_LABELS[period].toUpperCase()}`;
    const salesSpark = financials?.dailyData.map(d => d.sales) ?? [];
    const purchasesSpark = financials?.dailyData.map(d => d.purchases) ?? [];
    const balanceSpark = financials?.dailyData.map(d => d.sales - d.purchases) ?? [];

    const tabs: { key: TabView; label: string }[] = [
        { key: 'default', label: 'Default' },
        { key: 'calendar', label: 'Calendar' },
        { key: 'columns', label: 'Columns' },
        { key: 'classic', label: 'Classic' },
    ];

    const periods: { key: TimePeriod; label: string }[] = [
        { key: '7', label: '7 Days' },
        { key: '14', label: '14 Days' },
        { key: '31', label: '31 Days' },
        { key: 'week', label: 'Week' },
        { key: '2weeks', label: '2 Weeks' },
        { key: 'month', label: 'Month' },
    ];

    return (
        <div className="w-full pb-16" suppressHydrationWarning>

            {/* ── Top control bar ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                {/* Left: View tabs + VAT toggle + Refresh */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 flex-wrap">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                                tab === t.key
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                    <div className="w-px h-4 bg-slate-300 mx-0.5" />
                    <button onClick={() => setShowVAT(false)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                            !showVAT ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Exc. VAT
                    </button>
                    <button onClick={() => setShowVAT(true)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                            showVAT ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Inc. VAT
                    </button>
                    <div className="w-px h-4 bg-slate-300 mx-0.5" />
                    <button onClick={() => setAutoRefresh(v => !v)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                            autoRefresh ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Refresh {autoRefresh ? 'On' : 'Off'}
                    </button>
                </div>

                {/* Right: Time period tabs */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                    {periods.map(p => (
                        <button key={p.key} onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                                period === p.key
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Calendar-only view ───────────────────────────────────────────── */}
            {tab === 'calendar' && <DashboardCalendar />}

            {/* ── Default / Columns / Classic — 3-column layout ───────────────── */}
            {tab !== 'calendar' && (
                <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr_260px] gap-4 items-start">

                    {/* LEFT: Financial Metric Cards */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
                        <MetricCard
                            label="Total Sales" period={periodLabel}
                            value={financials?.totalSales ?? 0}
                            prevValue={financials?.prevTotalSales ?? 0}
                            sparkData={salesSpark} color="#4D7CFF" loading={loadingFin}
                        />
                        <MetricCard
                            label="Revenue" period={periodLabel}
                            value={financials?.revenue ?? 0}
                            prevValue={financials?.prevTotalSales ?? 0}
                            sparkData={salesSpark} color="#059669" loading={loadingFin}
                        />
                        <MetricCard
                            label="Purchases" period={periodLabel}
                            value={financials?.purchases ?? 0}
                            prevValue={financials?.prevPurchases ?? 0}
                            sparkData={purchasesSpark} color="#ea580c" loading={loadingFin}
                        />
                        <MetricCard
                            label="Balance" period={periodLabel}
                            value={financials?.balance ?? 0}
                            prevValue={financials?.prevBalance ?? 0}
                            sparkData={balanceSpark} color="#7c3aed" loading={loadingFin}
                        />
                        <MetricCard
                            label="Vehicles Added" period={periodLabel}
                            value={financials?.vehiclesAdded ?? 0}
                            prevValue={financials?.prevVehiclesAdded ?? 0}
                            sparkData={salesSpark.map(() => financials?.vehiclesAdded ?? 0)}
                            color="#0891b2" loading={loadingFin}
                        />
                    </div>

                    {/* CENTER: Calendar */}
                    <div className="min-w-0">
                        <DashboardCalendar />
                    </div>

                    {/* RIGHT: Vehicle Stats */}
                    <div className="space-y-4">
                        {/* Current Vehicles */}
                        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <p className="text-[12px] font-bold text-slate-700">Current Vehicles</p>
                            </div>
                            <div className="px-4 py-1">
                                <StatRow label="Total Vehicles" value={String(vehicleStats.totalVehicles)} highlight />
                                <StatRow label="Draft" value={String(vehicleStats.draftVehicles)} />
                                <StatRow label="For Sale" value={String(vehicleStats.forSaleVehicles)} />
                                <StatRow label="Reserved" value={String(vehicleStats.reservedVehicles)} />
                                <StatRow
                                    label="Average Days For Sale"
                                    value={loadingAT ? '—' : `${atStats?.avgDaysForSale ?? 0} days`}
                                />
                                <StatRow
                                    label="Total Overage"
                                    value={loadingAT ? '—' : `${atStats?.overageVehicles ?? vehicleStats.overageVehicles} vehicles`}
                                />
                                <StatRow
                                    label="Total Stand-In Value"
                                    value={fmtCurrency(vehicleStats.totalStandInValue)}
                                />
                                <StatRow
                                    label="Total Website Price"
                                    value={fmtCurrency(vehicleStats.totalWebsitePrice)}
                                />
                                <StatRow
                                    label="Est. Profit exc. VAT"
                                    value={fmtCurrency(vehicleStats.estProfit)}
                                />
                            </div>
                        </div>

                        {/* Sold Vehicles */}
                        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <p className="text-[12px] font-bold text-slate-700">Sold Vehicles</p>
                            </div>
                            <div className="px-4 py-1">
                                <StatRow label="Total Sold" value={String(vehicleStats.soldVehicles)} highlight />
                                <StatRow
                                    label="Average Days Sold In"
                                    value={loadingAT ? '—' : `${atStats?.avgDaysSold ?? 0} days`}
                                />
                                <StatRow
                                    label="Total Stand-In Value"
                                    value={fmtCurrency(vehicleStats.soldStandInValue)}
                                />
                                <StatRow
                                    label="Total Sold Price"
                                    value={fmtCurrency(vehicleStats.soldWebsitePrice)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
