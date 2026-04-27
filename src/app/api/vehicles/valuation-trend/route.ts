import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

const CONDITION_MAP: Record<string, string> = {
    Excellent: 'EXCELLENT',
    Good: 'GOOD',
    Average: 'FAIR',
    Poor: 'POOR',
    New: 'EXCELLENT',
    Fair: 'FAIR',
};

async function getValuationTrend(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.' } }, { status: 401 });
    }

    const { derivativeId, firstRegistrationDate, mileage, condition } = await req.json();
    if (!derivativeId || !mileage) {
        return NextResponse.json({ ok: false, error: { message: 'derivativeId and mileage required.' } }, { status: 400 });
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

        const payload = {
            vehicle: {
                derivativeId,
                firstRegistrationDate: firstRegistrationDate || '2000-01-01',
            },
            conditionRating,
            valuations: {
                markets: ['retail', 'trade', 'partExchange'],
                frequency: 'month',
                start: { date: fmt(startDate), odometerReadingMiles: startMileage },
                end: { date: fmt(now), odometerReadingMiles },
            },
        };

        const data = await client.post('/valuations/trends', payload, { advertiserId: client.dealerId! });

        return NextResponse.json({ ok: true, trend: data.valuations ?? [] });
    } catch (error: any) {
        console.error('[Valuation Trend Error]', error.message);
        return NextResponse.json({ ok: false, error: { message: error.message || 'Failed to fetch trend.' } }, { status: 500 });
    }
}

export const POST = withErrorHandler(getValuationTrend);
