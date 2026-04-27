import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * GET /api/vehicles/autotrader-stock/analytics?type=responseMetrics|trendedValuations|vehicleMetrics
 *
 * Fetches extended stock analytics from AutoTrader:
 *   - responseMetrics:     advertising performance (views, leads, ratings) per stock item
 *   - trendedValuations:   30/60/90 day valuation trends per stock item
 *   - vehicleMetrics:      supply/demand/daysToSell national + local metrics per stock item
 *
 * AT docs:
 *   GET /stock?responseMetrics=true      Capability: Response Metrics
 *   GET /stock?trendedValuations=true    Capability: Trended Valuations
 *   GET /stock?vehicleMetrics=true       Capability: Vehicle Metrics
 */
export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'responseMetrics';
        const page = searchParams.get('page') || '1';
        const pageSize = searchParams.get('pageSize') || '200';

        const validTypes = ['responseMetrics', 'trendedValuations', 'vehicleMetrics'];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { ok: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
                { status: 400 }
            );
        }

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        let data: any;
        if (type === 'responseMetrics') {
            data = await client.getStockWithResponseMetrics(page, pageSize);
        } else if (type === 'trendedValuations') {
            data = await client.getStockWithTrendedValuations(page, pageSize);
        } else {
            data = await client.getStockWithVehicleMetrics(page, pageSize);
        }

        return NextResponse.json({
            ok: true,
            type,
            results: data?.results || [],
            totalResults: data?.totalResults ?? 0,
        });
    } catch (error: any) {
        console.error('[Stock Analytics]', error.message);

        // Gracefully handle capability-not-enabled errors
        const isCapabilityError =
            error.message?.includes('403') ||
            error.message?.includes('capability') ||
            error.message?.includes('not enabled');

        if (isCapabilityError) {
            return NextResponse.json({
                ok: false,
                error: 'This AutoTrader capability is not enabled on your account.',
                code: 'CAPABILITY_NOT_ENABLED',
            }, { status: 403 });
        }

        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to fetch stock analytics.' },
            { status: 500 }
        );
    }
}
