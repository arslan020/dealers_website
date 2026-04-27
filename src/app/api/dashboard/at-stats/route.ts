import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

async function getATStats(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // Fetch all stock
        let allStock: any[] = [];
        let page = 1;
        while (true) {
            const data = await client.get('/stock', {
                advertiserId: client.dealerId!,
                pageSize: '200',
                page: String(page),
            });
            const results: any[] = data.results || data.vehicles || data.stock || [];
            allStock = allStock.concat(results);
            const total = data.totalResults || data.total || results.length;
            if (allStock.length >= total || results.length < 200) break;
            page++;
        }

        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let totalForSaleDays = 0, forSaleCount = 0;
        let totalSoldDays = 0, soldCount = 0;
        let monthlyRevenue = 0;
        let overageVehicles = 0;

        for (const v of allStock) {
            const state: string = v.metadata?.lifecycleState || '';

            if (state === 'FORECOURT') {
                const dateOnForecourt = v.metadata?.dateOnForecourt ? new Date(v.metadata.dateOnForecourt) : null;
                if (dateOnForecourt) {
                    totalForSaleDays += (now.getTime() - dateOnForecourt.getTime()) / (1000 * 60 * 60 * 24);
                    forSaleCount++;
                    if (dateOnForecourt < ninetyDaysAgo) overageVehicles++;
                }
            }

            if (state === 'SOLD') {
                const stockInDate = v.metadata?.dateOnForecourt ? new Date(v.metadata.dateOnForecourt) : null;
                const soldDate = v.metadata?.lastUpdatedByAdvertiser
                    ? new Date(v.metadata.lastUpdatedByAdvertiser)
                    : v.metadata?.lastUpdated ? new Date(v.metadata.lastUpdated) : null;

                if (stockInDate && soldDate) {
                    totalSoldDays += (soldDate.getTime() - stockInDate.getTime()) / (1000 * 60 * 60 * 24);
                    soldCount++;
                }
                if (soldDate && soldDate >= startOfMonth) {
                    monthlyRevenue +=
                        v.adverts?.soldPrice?.amountGBP ||
                        v.adverts?.retailAdverts?.soldPrice?.amountGBP ||
                        v.adverts?.retailAdverts?.suppliedPrice?.amountGBP || 0;
                }
            }
        }

        // Fetch deals for leads count
        let newLeads = 0;
        try {
            let deals: any[] = [];
            let dp = 1;
            while (true) {
                const d = await client.getDeals({ pageSize: '200', page: String(dp) });
                const pd: any[] = d.results || d.deals || [];
                deals = deals.concat(pd);
                const td = d.totalResults || d.total || pd.length;
                if (deals.length >= td || pd.length < 200) break;
                dp++;
            }
            for (const deal of deals) {
                if ((deal.advertiserDealStatus || '') === 'In Progress') newLeads++;
            }
        } catch { /* deals not available */ }

        return NextResponse.json({
            ok: true,
            avgDaysForSale: forSaleCount > 0 ? Math.round(totalForSaleDays / forSaleCount) : 0,
            avgDaysSold: soldCount > 0 ? Math.round(totalSoldDays / soldCount) : 0,
            monthlyRevenue,
            newLeads,
            overageVehicles,
        });

    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export const GET = withErrorHandler(getATStats);
