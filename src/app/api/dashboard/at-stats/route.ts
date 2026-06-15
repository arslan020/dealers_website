import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';
import { ATCache } from '@/lib/at-cache';
import connectToDatabase from '@/lib/db';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';
import Lead from '@/models/Lead';

const AT_STATS_TTL = 900; // 15 minutes
const STOCK_CACHE_TTL_MS = 15 * 60 * 1000;

async function getATStats(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const cacheKey = `dashboard:at-stats:${session.tenantId}`;
    const cached = ATCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    try {
        await connectToDatabase();
        const now = new Date();

        // Reuse AutoTraderStockCache (MongoDB) — same data vehicles page syncs every 5 min.
        // This avoids a redundant AT /stock call on every dashboard refresh.
        let allStock: any[] = [];
        let client: AutoTraderClient | null = null;

        const mongoCache = await AutoTraderStockCache.findOne({ tenantId: session.tenantId }).lean() as any;
        const cacheAgeMs = mongoCache?.fetchedAt
            ? now.getTime() - new Date(mongoCache.fetchedAt).getTime()
            : Infinity;

        if (mongoCache?.stock?.length && cacheAgeMs <= STOCK_CACHE_TTL_MS) {
            allStock = mongoCache.stock;
        } else {
            // Cache stale or absent — fetch fresh from AT
            client = new AutoTraderClient(session.tenantId);
            await client.init();
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
        }

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

        // Count active leads from local DB — no AT call needed
        let newLeads = 0;
        try {
            newLeads = await Lead.countDocuments({
                tenantId: session.tenantId,
                status: { $in: ['NEW_LEAD', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
            });
        } catch { /* leads not available */ }

        const result = {
            ok: true,
            avgDaysForSale: forSaleCount > 0 ? Math.round(totalForSaleDays / forSaleCount) : 0,
            avgDaysSold: soldCount > 0 ? Math.round(totalSoldDays / soldCount) : 0,
            monthlyRevenue,
            newLeads,
            overageVehicles,
        };
        ATCache.set(cacheKey, result, AT_STATS_TTL);
        return NextResponse.json(result);

    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export const GET = withErrorHandler(getATStats);
