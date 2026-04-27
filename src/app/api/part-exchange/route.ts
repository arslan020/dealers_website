import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

function auth(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    return token ? verifyAccessToken(token) : null;
}

/**
 * GET /api/part-exchange?settlementLenders=1
 * Returns configured settlement lenders for outstanding finance.
 * Capability: Part Exchange Updates
 *
 * POST /api/part-exchange
 * Adds a part exchange to an existing AT deal.
 * Body: { dealId, vehicle: { registration, odometerReadingMiles, outstandingFinance? }, advertiser? }
 * Capability: Part Exchange Updates
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth(req);
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const client = new AutoTraderClient(session.tenantId);
        await client.init();
        const data = await client.getSettlementLenders();
        return NextResponse.json({ ok: true, settlementLenders: data.settlementLenders || [] });
    } catch (err: any) {
        // 403 = Part Exchange Updates capability not enabled on this AT account
        if (err.status === 403) {
            return NextResponse.json({ ok: true, settlementLenders: [], warning: 'Part Exchange Updates capability not enabled on AutoTrader account.' });
        }
        console.error('[GET /api/part-exchange]', err.message);
        return NextResponse.json({ ok: false, error: err.message || 'Failed to fetch settlement lenders.' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth(req);
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { dealId, vehicle, advertiser } = body;

        if (!dealId) return NextResponse.json({ ok: false, error: 'dealId is required.' }, { status: 400 });
        if (!vehicle?.registration) return NextResponse.json({ ok: false, error: 'vehicle.registration is required.' }, { status: 400 });
        if (typeof vehicle?.odometerReadingMiles !== 'number') return NextResponse.json({ ok: false, error: 'vehicle.odometerReadingMiles is required.' }, { status: 400 });

        const client = new AutoTraderClient(session.tenantId);
        await client.init();
        const data = await client.addPartExchange({ dealId, vehicle, advertiser });
        return NextResponse.json({ ok: true, partExchange: data });
    } catch (err: any) {
        console.error('[POST /api/part-exchange]', err.message);
        const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
        return NextResponse.json({ ok: false, error: err.message || 'Failed to add part exchange.' }, { status });
    }
}
