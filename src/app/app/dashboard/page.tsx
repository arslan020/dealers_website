import { DashboardCalendar } from '@/components/dashboard/DashboardCalendar';
import { PerformanceCard } from '@/components/dashboard/PerformanceCard';
import { AddVehicleButton } from '@/components/vehicles/AddVehicleButton';
import { getSession } from '@/lib/session';
import connectToDatabase from '@/lib/db';
import User from '@/models/User';
import Vehicle from '@/models/Vehicle';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await getSession();
    const name = session?.name ?? 'User';
    const firstName = name.split(' ')[0];

    let permissions = session?.permissions;
    if (session?.role === 'EMPLOYEE') {
        await connectToDatabase();
        const user = await User.findById(session.userId).select('permissions').lean();
        if (user) permissions = user.permissions;
    }

    const isAuthorized = (key: string) => {
        if (session?.role === 'SUPER_ADMIN' || session?.role === 'DEALER_ADMIN') return true;
        return (permissions as any)?.[key] !== false;
    };

    const today = new Date();
    const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening';

    // ── Stock counts from local DB + AT cache (instant, no AT API call) ─────
    let stats = {
        totalVehicles: 0,
        draftVehicles: 0,
        forSaleVehicles: 0,
        reservedVehicles: 0,
        soldVehicles: 0,
        overageVehicles: 0,
    };

    try {
        if (!session?.tenantId) throw new Error('No tenantId');
        await connectToDatabase();

        const localVehicles = await Vehicle.find(
            { tenantId: session.tenantId },
            { _id: 1, vrm: 1, stockId: 1, status: 1 }
        ).lean() as any[];

        const validLocal = localVehicles.filter((v: any) =>
            !(v.stockId && (v.vrm === 'PENDING' || v.make === 'Unknown'))
        );

        const localVrmSet = new Set(validLocal.map((v: any) => v.vrm?.toUpperCase()).filter(Boolean));
        const localStockIdSet = new Set(validLocal.map((v: any) => v.stockId).filter(Boolean));

        for (const v of validLocal) {
            stats.totalVehicles++;
            if (v.status === 'In Stock')      stats.forSaleVehicles++;
            else if (v.status === 'Draft')    stats.draftVehicles++;
            else if (v.status === 'Reserved') stats.reservedVehicles++;
            else if (v.status === 'Sold')     stats.soldVehicles++;
        }

        // Add AT-cache-only vehicles (not in local DB)
        const atCache = await AutoTraderStockCache.findOne({ tenantId: session.tenantId }).lean() as any;
        for (const atv of (atCache?.stock || [])) {
            const vrm = atv.vrm?.toUpperCase();
            if (localVrmSet.has(vrm) || localStockIdSet.has(atv.id)) continue;
            stats.totalVehicles++;
            const s = atv.status || 'In Stock';
            if (s === 'In Stock')      stats.forSaleVehicles++;
            else if (s === 'Draft')    stats.draftVehicles++;
            else if (s === 'Reserved') stats.reservedVehicles++;
            else if (s === 'Sold')     stats.soldVehicles++;
        }
    } catch (err: any) {
        console.error('[Dashboard] Local DB fetch failed:', err.message);
    }

    return (
        <div className="w-full pb-16 space-y-6" suppressHydrationWarning>

            {/* ─── Header ─────────────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-[20px] font-bold text-slate-800" suppressHydrationWarning>
                        {greeting}, <span className="text-[#4D7CFF]">{firstName}</span>
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <AddVehicleButton className="flex items-center gap-1.5 px-4 py-2 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-bold hover:bg-blue-600 transition-colors shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        Add Vehicle
                    </AddVehicleButton>
                    <Link href="/app/deals" className="flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E2E8F0] text-slate-700 rounded-lg text-[13px] font-bold hover:bg-slate-50 transition-colors shadow-sm">
                        View Deals
                    </Link>
                </div>
            </div>


            {/* ─── 2 Summary Cards ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Card 1 — Stock Overview */}
                <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 pt-4 pb-3 border-b border-[#F1F5F9]">
                        <p className="text-[12px] font-bold text-slate-700 uppercase tracking-widest">Stock Overview</p>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-[#F1F5F9]">
                        {[
                            { label: 'Total',    value: stats.totalVehicles,    color: '#334155' },
                            { label: 'For Sale', value: stats.forSaleVehicles,  color: '#4D7CFF' },
                            { label: 'Draft',    value: stats.draftVehicles,    color: '#94a3b8' },
                        ].map(s => (
                            <div key={s.label} className="flex flex-col items-center justify-center py-5 gap-1">
                                <span className="text-[34px] font-black leading-none" style={{ color: s.color }}>{s.value}</span>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-[#F1F5F9] border-t border-[#F1F5F9]">
                        {[
                            { label: 'Reserved', value: stats.reservedVehicles, color: '#7c3aed' },
                            { label: 'Sold',     value: stats.soldVehicles,     color: '#059669' },
                            { label: 'Overage',  value: stats.overageVehicles,  color: '#ea580c' },
                        ].map(s => (
                            <div key={s.label} className="flex flex-col items-center justify-center py-5 gap-1">
                                <span className="text-[34px] font-black leading-none" style={{ color: s.color }}>{s.value}</span>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Card 2 — Performance (loads from AT in background) */}
                <PerformanceCard />

            </div>

            {/* ─── Appointments ───────────────────────────────────────────────────── */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                    <h2 className="text-[14px] font-bold text-slate-800">Appointments</h2>
                    <Link href="/app/analytics" className="text-[12px] font-semibold text-[#4D7CFF] hover:underline">
                        View Analytics →
                    </Link>
                </div>
                <div className="p-5">
                    <DashboardCalendar />
                </div>
            </div>

        </div>
    );
}
