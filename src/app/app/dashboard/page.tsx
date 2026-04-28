import { getSession } from '@/lib/session';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import type { VehicleStats } from '@/components/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const session = await getSession();

    let vehicleStats: VehicleStats = {
        totalVehicles: 0,
        draftVehicles: 0,
        forSaleVehicles: 0,
        reservedVehicles: 0,
        soldVehicles: 0,
        overageVehicles: 0,
        totalStandInValue: 0,
        totalWebsitePrice: 0,
        estProfit: 0,
        soldStandInValue: 0,
        soldWebsitePrice: 0,
    };

    try {
        if (!session?.tenantId) throw new Error('No tenantId');
        await connectToDatabase();

        const [localVehicles, atCache] = await Promise.all([
            Vehicle.find(
                { tenantId: session.tenantId },
                { vrm: 1, stockId: 1, status: 1, purchasePrice: 1, price: 1, forecourtPrice: 1 }
            ).lean() as Promise<any[]>,
            AutoTraderStockCache.findOne({ tenantId: session.tenantId }).lean() as Promise<any>,
        ]);

        const validLocal = localVehicles.filter((v: any) =>
            !(v.stockId && (v.vrm === 'PENDING' || v.make === 'Unknown'))
        );

        const localVrmSet = new Set(validLocal.map((v: any) => v.vrm?.toUpperCase()).filter(Boolean));
        const localStockIdSet = new Set(validLocal.map((v: any) => v.stockId).filter(Boolean));

        const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);

        for (const v of validLocal) {
            vehicleStats.totalVehicles++;
            const status: string = v.status || '';
            if (status === 'In Stock') {
                vehicleStats.forSaleVehicles++;
                vehicleStats.totalStandInValue += v.purchasePrice || 0;
                vehicleStats.totalWebsitePrice += v.forecourtPrice || v.price || 0;
            } else if (status === 'Draft') {
                vehicleStats.draftVehicles++;
                vehicleStats.totalStandInValue += v.purchasePrice || 0;
                vehicleStats.totalWebsitePrice += v.forecourtPrice || v.price || 0;
            } else if (status === 'Reserved') {
                vehicleStats.reservedVehicles++;
                vehicleStats.totalStandInValue += v.purchasePrice || 0;
                vehicleStats.totalWebsitePrice += v.forecourtPrice || v.price || 0;
            } else if (status === 'Sold') {
                vehicleStats.soldVehicles++;
                vehicleStats.soldStandInValue += v.purchasePrice || 0;
                vehicleStats.soldWebsitePrice += v.forecourtPrice || v.price || 0;
            }
        }

        // Add AT-cache-only vehicles
        for (const atv of (atCache?.stock || [])) {
            const vrm = atv.vrm?.toUpperCase();
            if (localVrmSet.has(vrm) || localStockIdSet.has(atv.id)) continue;
            vehicleStats.totalVehicles++;
            const s = atv.status || 'In Stock';
            if (s === 'In Stock')      vehicleStats.forSaleVehicles++;
            else if (s === 'Draft')    vehicleStats.draftVehicles++;
            else if (s === 'Reserved') vehicleStats.reservedVehicles++;
            else if (s === 'Sold')     vehicleStats.soldVehicles++;

            // AT cache overage: vehicles on forecourt > 90 days
            if (s === 'In Stock') {
                const onForecourt = atv.metadata?.dateOnForecourt
                    ? new Date(atv.metadata.dateOnForecourt) : null;
                if (onForecourt && onForecourt < ninetyDaysAgo) vehicleStats.overageVehicles++;
            }
        }

        vehicleStats.estProfit = vehicleStats.totalWebsitePrice - vehicleStats.totalStandInValue;

    } catch (err: any) {
        console.error('[Dashboard] DB fetch failed:', err.message);
    }

    return <DashboardClient vehicleStats={vehicleStats} />;
}
