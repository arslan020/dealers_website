import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/vehicles/autotrader-stock/{id}/summary
 * Real-time state snapshot for a stock item.
 * AT docs (Jan 2026): GET /stock/{stockId}/summary?advertiserId=
 * Returns: lifecycleState, reservation status, advert publish statuses.
 * Capability: Stock Sync
 */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id: stockId } = await params;

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const data = await client.getStockSummary(stockId);

        return NextResponse.json({ ok: true, summary: data });
    } catch (error: any) {
        console.error('[Stock Summary]', error.message);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to fetch stock summary.' },
            { status: 500 }
        );
    }
}
