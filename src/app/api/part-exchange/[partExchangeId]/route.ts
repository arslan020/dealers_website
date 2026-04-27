import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

type Params = { params: Promise<{ partExchangeId: string }> };

function auth(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    return token ? verifyAccessToken(token) : null;
}

/**
 * GET /api/part-exchange/[partExchangeId]
 * Fetch full part exchange details from AutoTrader.
 * Capability: Deal Sync
 *
 * PATCH /api/part-exchange/[partExchangeId]
 * Update condition rating, offer amount, or outstanding finance on an existing PX.
 * Body: { dealId, vehicle?: { outstandingFinance? }, advertiser?: { conditionRating?, offer? } }
 * Capability: Part Exchange Updates
 */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const session = await auth(req);
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const { partExchangeId } = await params;
        const client = new AutoTraderClient(session.tenantId);
        await client.init();
        const data = await client.getPartExchange(partExchangeId);
        return NextResponse.json({ ok: true, partExchange: data });
    } catch (err: any) {
        console.error('[GET /api/part-exchange/[id]]', err.message);
        const status = err.status === 404 ? 404 : 500;
        return NextResponse.json({ ok: false, error: err.message || 'Failed to fetch part exchange.' }, { status });
    }
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const session = await auth(req);
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const { partExchangeId } = await params;
        const body = await req.json();

        if (!body.dealId) return NextResponse.json({ ok: false, error: 'dealId is required.' }, { status: 400 });

        const client = new AutoTraderClient(session.tenantId);
        await client.init();
        const data = await client.updatePartExchange(partExchangeId, body);
        return NextResponse.json({ ok: true, partExchange: data });
    } catch (err: any) {
        console.error('[PATCH /api/part-exchange/[id]]', err.message);
        const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
        return NextResponse.json({ ok: false, error: err.message || 'Failed to update part exchange.' }, { status });
    }
}
