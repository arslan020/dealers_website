import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * POST /api/vehicles/vehicle-metrics
 * Get AT vehicle metrics for a specific vehicle (supply, demand, daysToSell, retailRating).
 *
 * Body: { derivativeId, firstRegistrationDate, odometerReadingMiles, price? }
 *
 * AT docs: POST /vehicle-metrics?advertiserId=
 * Returns: national + local retail rating, daysToSell, supply/demand, marketCondition.
 * Capability: Vehicle Metrics / Retail Rating
 */
async function getVehicleMetrics(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { derivativeId, firstRegistrationDate, odometerReadingMiles, price } = body;

    if (!derivativeId || !firstRegistrationDate || odometerReadingMiles == null) {
        return NextResponse.json(
            { ok: false, error: 'derivativeId, firstRegistrationDate and odometerReadingMiles are required.' },
            { status: 400 }
        );
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const payload: any = {
            vehicle: { derivativeId, firstRegistrationDate, odometerReadingMiles },
        };
        if (price) payload.price = price;

        const data = await client.getVehicleMetrics(payload);

        return NextResponse.json({ ok: true, vehicleMetrics: data });
    } catch (error: any) {
        console.error('[Vehicle Metrics]', error.message);

        const isCapabilityError =
            error.message?.includes('403') || error.message?.includes('capability');
        if (isCapabilityError) {
            return NextResponse.json({
                ok: false,
                error: 'Vehicle Metrics capability is not enabled on your AutoTrader account.',
                code: 'CAPABILITY_NOT_ENABLED',
            }, { status: 403 });
        }

        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to fetch vehicle metrics.' },
            { status: 500 }
        );
    }
}

export const POST = withErrorHandler(getVehicleMetrics);
