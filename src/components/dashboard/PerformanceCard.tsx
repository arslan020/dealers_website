'use client';

import { useEffect, useState } from 'react';

type ATStats = {
    avgDaysForSale: number;
    avgDaysSold: number;
    monthlyRevenue: number;
    newLeads: number;
    overageVehicles: number;
};

export function PerformanceCard({ onOverageUpdate }: { onOverageUpdate?: (n: number) => void }) {
    const [stats, setStats] = useState<ATStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard/at-stats')
            .then(r => r.json())
            .then(d => {
                if (d.ok) {
                    setStats(d);
                    onOverageUpdate?.(d.overageVehicles);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const items = [
        {
            label: 'Avg Days\nFor Sale',
            value: stats ? String(stats.avgDaysForSale) : null,
            color: '#4D7CFF',
            bg: 'bg-blue-50',
            iconColor: 'text-[#4D7CFF]',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
        },
        {
            label: 'Avg Days\nSold In',
            value: stats ? String(stats.avgDaysSold) : null,
            color: '#059669',
            bg: 'bg-emerald-50',
            iconColor: 'text-emerald-500',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            label: 'New\nLeads',
            value: stats ? String(stats.newLeads) : null,
            color: '#f59e0b',
            bg: 'bg-amber-50',
            iconColor: 'text-amber-500',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            ),
        },
        {
            label: 'Monthly\nRevenue',
            value: stats
                ? stats.monthlyRevenue > 0
                    ? `£${(stats.monthlyRevenue / 1000).toFixed(0)}k`
                    : '—'
                : null,
            color: '#7c3aed',
            bg: 'bg-violet-50',
            iconColor: 'text-violet-500',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
    ];

    return (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-[#F1F5F9] flex items-center justify-between">
                <p className="text-[12px] font-bold text-slate-700 uppercase tracking-widest">Performance</p>
                {loading && (
                    <svg className="animate-spin w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                )}
            </div>
            <div className="grid grid-cols-4 divide-x divide-[#F1F5F9] h-[calc(100%-45px)]">
                {items.map(item => (
                    <div key={item.label} className="flex flex-col items-center justify-center py-5 gap-1 px-3">
                        <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mb-2 ${item.iconColor}`}>
                            {item.icon}
                        </div>
                        {loading || item.value === null ? (
                            <div className="w-10 h-8 bg-slate-100 rounded animate-pulse mb-1" />
                        ) : (
                            <span className="text-[34px] font-black leading-none" style={{ color: item.color }}>
                                {item.value}
                            </span>
                        )}
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-center whitespace-pre-line">
                            {item.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
