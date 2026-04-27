import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { AutoTraderClient } from '@/lib/autotrader';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // ── Fetch ALL stock from AutoTrader (up to 200 per page) ──────────────
        const stockData = await client.get('/stock', {
            advertiserId: client.dealerId!,
            pageSize: '200',
            page: '1',
        });

        const allStock: any[] = stockData.results || stockData.vehicles || stockData.stock || [];

        // ── Count by lifecycleState ────────────────────────────────────────────
        let totalVehicles   = allStock.length;
        let draftVehicles   = 0; // DUE_IN
        let forSaleVehicles = 0; // FORECOURT
        let reservedVehicles = 0; // SALE_IN_PROGRESS
        let soldVehicles    = 0; // SOLD
        let overageVehicles = 0; // FORECOURT > 90 days

        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let totalForSaleDays = 0;
        let forSaleCount = 0;
        let totalSoldDays = 0;
        let soldCount = 0;
        let monthlyRevenue = 0;

        for (const v of allStock) {
            const state: string = v.metadata?.lifecycleState || '';

            if (state === 'DUE_IN')              draftVehicles++;
            else if (state === 'FORECOURT')       forSaleVehicles++;
            else if (state === 'SALE_IN_PROGRESS') reservedVehicles++;
            else if (state === 'SOLD')             soldVehicles++;

            // Avg days for sale (FORECOURT vehicles)
            if (state === 'FORECOURT') {
                const dateOnForecourt = v.metadata?.dateOnForecourt
                    ? new Date(v.metadata.dateOnForecourt)
                    : null;
                if (dateOnForecourt) {
                    const days = (now.getTime() - dateOnForecourt.getTime()) / (1000 * 60 * 60 * 24);
                    totalForSaleDays += days;
                    forSaleCount++;
                    if (dateOnForecourt < ninetyDaysAgo) overageVehicles++;
                }
            }

            // Avg days sold in + monthly revenue (SOLD vehicles)
            if (state === 'SOLD') {
                const stockInDate = v.metadata?.dateOnForecourt
                    ? new Date(v.metadata.dateOnForecourt)
                    : null;
                // lastUpdatedByAdvertiser is more reliable than lastUpdated for sold date
                const soldDate = v.metadata?.lastUpdatedByAdvertiser
                    ? new Date(v.metadata.lastUpdatedByAdvertiser)
                    : v.metadata?.lastUpdated
                    ? new Date(v.metadata.lastUpdated)
                    : null;

                if (stockInDate && soldDate) {
                    const days = (soldDate.getTime() - stockInDate.getTime()) / (1000 * 60 * 60 * 24);
                    totalSoldDays += days;
                    soldCount++;
                }

                // Revenue: use soldPrice (actual sale price), not forecourtPrice (listing price)
                if (soldDate && soldDate >= startOfMonth) {
                    const price =
                        v.adverts?.soldPrice?.amountGBP ||
                        v.adverts?.retailAdverts?.soldPrice?.amountGBP ||
                        v.adverts?.retailAdverts?.suppliedPrice?.amountGBP ||
                        v.adverts?.forecourtPrice?.amountGBP ||
                        0;
                    monthlyRevenue += price;
                }
            }
        }

        const avgDaysForSale = forSaleCount > 0 ? Math.round(totalForSaleDays / forSaleCount) : 0;
        const avgDaysSold    = soldCount > 0    ? Math.round(totalSoldDays / soldCount)    : 0;

        // ── Supplement reserved count from local DB (no AT propagation delay) ──
        try {
            await connectToDatabase();
            const localReservedCount = await Vehicle.countDocuments({
                tenantId: session.tenantId,
                status: 'Reserved',
            });
            if (localReservedCount > reservedVehicles) {
                const extra = localReservedCount - reservedVehicles;
                reservedVehicles = localReservedCount;
                forSaleVehicles = Math.max(0, forSaleVehicles - extra);
            }
        } catch {
            // Local DB unavailable — use AT data as-is
        }

        // ── Deals: new leads = in-progress deals ─────────────────────────────
        let newLeads = 0;
        let totalBuyers = 0;
        try {
            const dealsData = await client.getDeals({ pageSize: '200' });
            const deals: any[] = dealsData.results || dealsData.deals || [];
            const buyerEmails = new Set<string>();

            for (const deal of deals) {
                const status = deal.advertiserDealStatus || '';
                if (status === 'In Progress') newLeads++;
                if (deal.consumer?.emailAddress) buyerEmails.add(deal.consumer.emailAddress);
            }
            totalBuyers = buyerEmails.size;
        } catch {
            // Deals capability may not be enabled — silently skip
        }

        return NextResponse.json({
            ok: true,
            source: 'autotrader',
            stats: {
                totalVehicles,
                draftVehicles,
                forSaleVehicles,
                reservedVehicles,
                soldVehicles,
                overageVehicles,
                avgDaysForSale,
                avgDaysSold,
                monthlyRevenue,
                totalBuyers,
                newLeads,
            },
        });
    } catch (err: any) {
        console.error('[AT Dashboard Stats]', err.message);
        const isConfig = err.message?.includes('not configured') || err.message?.includes('not set');
        return NextResponse.json(
            {
                ok: false,
                error: isConfig
                    ? 'AutoTrader is not connected. Please configure it in Settings.'
                    : err.message || 'Failed to fetch AutoTrader data.',
                code: isConfig ? 'NOT_CONFIGURED' : 'API_ERROR',
            },
            { status: isConfig ? 400 : 500 }
        );
    }
}
