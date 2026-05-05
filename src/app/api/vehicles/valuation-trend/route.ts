import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

const CONDITION_MAP: Record<string, string> = {
    Excellent: 'EXCELLENT',
    Great: 'GREAT',
    Good: 'GOOD',
    Average: 'FAIR',
    Fair: 'FAIR',
    Poor: 'POOR',
    New: 'EXCELLENT',
};

async function getValuationTrend(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.' } }, { status: 401 });
    }

    const body = await req.json();
    const { derivativeId, mileage, condition, features } = body;
    const firstRegistrationDate = body.firstRegistrationDate || body.registeredDate;

    if (!derivativeId || !mileage) {
        return NextResponse.json({ ok: false, error: { message: 'derivativeId and mileage required.' } }, { status: 400 });
    }
    if (!firstRegistrationDate) {
        return NextResponse.json({ ok: false, error: { message: 'firstRegistrationDate required.' } }, { status: 400 });
    }

    const conditionRating = CONDITION_MAP[condition] ?? 'GOOD';
    const odometerReadingMiles = parseInt(mileage);

    // Build 6-month past window → current
    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 6);
    const startMileage = Math.max(0, odometerReadingMiles - 6000); // rough estimate

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const payload: any = {
            vehicle: {
                derivativeId,
                firstRegistrationDate,
            },
            conditionRating,
            valuations: {
                markets: ['retail', 'trade', 'partExchange', 'private'],
                frequency: 'month',
                start: { date: fmt(startDate), odometerReadingMiles: startMileage },
                end: { date: fmt(now), odometerReadingMiles },
            },
        };
        // features: array of { name } — adjusts valuation for vehicle spec
        if (Array.isArray(features)) {
            payload.features = features.map((f: any) => ({ name: typeof f === 'string' ? f : f.name }));
        }

        const data = await client.post('/valuations/trends', payload, { advertiserId: client.dealerId! });

        return NextResponse.json({ ok: true, trend: data.valuations ?? [] });
    } catch (error: any) {
        console.error('[Valuation Trend Error]', error.message);
        return NextResponse.json({ ok: false, error: { message: error.message || 'Failed to fetch trend.' } }, { status: 500 });
    }
}

export const POST = withErrorHandler(getValuationTrend);
