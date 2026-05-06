import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

type Params = { params: Promise<{ dealId: string }> };

/**
 * POST /api/deals/[dealId]/part-exchange
 * Add a part exchange to an existing deal on AutoTrader.
 * AT docs: POST /part-exchange?advertiserId=
 * Body: { vehicle: { registration, odometerReadingMiles, outstandingFinance? }, advertiser?: { conditionRating?, offer? } }
 * Capability: Part Exchange Updates
 */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { dealId } = await params;
        const body = await req.json();
        const { vehicle, advertiser } = body;

        if (!vehicle?.registration || !vehicle?.odometerReadingMiles) {
            return NextResponse.json(
                { ok: false, error: 'vehicle.registration and vehicle.odometerReadingMiles are required.' },
                { status: 400 }
            );
        }

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const payload: any = {
            dealId,
            vehicle: {
                registration: String(vehicle.registration).trim().toUpperCase(),
                odometerReadingMiles: Number(vehicle.odometerReadingMiles),
            },
        };

        if (vehicle.outstandingFinance?.lender && vehicle.outstandingFinance?.amountGBP) {
            payload.vehicle.outstandingFinance = {
                lender: String(vehicle.outstandingFinance.lender).trim(),
                amountGBP: Number(vehicle.outstandingFinance.amountGBP),
            };
        }

        if (advertiser) {
            payload.advertiser = {};
            if (advertiser.conditionRating) payload.advertiser.conditionRating = advertiser.conditionRating;
            if (advertiser.offer?.amountGBP) payload.advertiser.offer = { amountGBP: Number(advertiser.offer.amountGBP) };
        }

        const result = await client.addPartExchange(payload);
        return NextResponse.json({ ok: true, result });

    } catch (error: any) {
        console.error('[PX POST]', error.message, error.data);
        const msg = error.data
            ? (typeof error.data === 'object' ? JSON.stringify(error.data) : String(error.data))
            : error.message || 'Failed to add part exchange.';
        return NextResponse.json({ ok: false, error: msg }, { status: error.status || 500 });
    }
}
