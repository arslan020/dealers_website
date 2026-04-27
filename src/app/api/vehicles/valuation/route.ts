import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

const CONDITION_MAP: Record<string, 'Excellent' | 'Great' | 'Good' | 'Fair' | 'Poor'> = {
    Excellent: 'Excellent',
    Good: 'Good',
    Average: 'Fair',
    Poor: 'Poor',
    New: 'Excellent',
    Fair: 'Fair',
};

async function getVehicleValuation(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session || !session.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const body = await req.json();
    const { vrm, mileage, condition, derivativeId: providedDerivativeId, registeredDate: providedRegDate, features } = body;

    if (!vrm || !mileage) {
        return NextResponse.json({ ok: false, error: { message: 'VRM and mileage are required.', code: 'VALIDATION_ERROR' } }, { status: 400 });
    }

    const conditionRating = CONDITION_MAP[condition] ?? 'Good';
    const odometerReadingMiles = parseInt(mileage);

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        let derivativeId = providedDerivativeId;
        let firstRegistrationDate = providedRegDate;

        // Only do taxonomy lookup if derivativeId not provided
        if (!derivativeId) {
            const lookupResponse = await client.get('/taxonomy/vehicles', { vrm: vrm.toUpperCase().replace(/\s/g, '') });
            const vehicle = Array.isArray(lookupResponse) ? lookupResponse[0] : (lookupResponse.vehicle || lookupResponse);
            if (!vehicle || !vehicle.derivativeId) {
                return NextResponse.json({ ok: false, error: { message: 'Vehicle details not found for valuation.', code: 'NOT_FOUND' } }, { status: 404 });
            }
            derivativeId = vehicle.derivativeId;
            firstRegistrationDate = firstRegistrationDate || vehicle.firstRegistrationDate || (vehicle.registrationYear ? `${vehicle.registrationYear}-01-01` : undefined);
        }

        if (!firstRegistrationDate) {
            firstRegistrationDate = '2000-01-01'; // fallback
        }

        const featuresPayload = Array.isArray(features) && features.length > 0
            ? features.map((f: any) => (typeof f === 'string' ? { name: f } : { name: f.name ?? f }))
            : undefined;

        // Fetch valuations + vehicle metrics in parallel
        const [valuationResponse, metricsResponse] = await Promise.allSettled([
            client.getValuation({
                vehicle: { derivativeId, firstRegistrationDate, odometerReadingMiles },
                conditionRating,
                ...(featuresPayload && { features: featuresPayload }),
            }),
            client.get('/vehicles', {
                registration: vrm.toUpperCase().replace(/\s/g, ''),
                advertiserId: client.dealerId || '',
                vehicleMetrics: 'true',
                odometerReadingMiles: String(odometerReadingMiles),
            }),
        ]);

        const valuations = valuationResponse.status === 'fulfilled' ? valuationResponse.value?.valuations : null;
        // rating & daysToSell are top-level in the /vehicles response, vehicleMetrics is nested
        const metricsRaw = metricsResponse.status === 'fulfilled' ? metricsResponse.value : null;
        const metricsData = metricsRaw ? {
            vehicleMetrics: metricsRaw.vehicleMetrics ?? null,
            rating: metricsRaw.rating ?? null,
            daysToSell: metricsRaw.daysToSell ?? null,
        } : null;

        if (!valuations) {
            const errMsg = valuationResponse.status === 'rejected' ? valuationResponse.reason?.message : 'No valuation data returned.';
            return NextResponse.json({ ok: false, error: { message: errMsg || 'Failed to fetch valuation.' } }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            valuations,
            metrics: metricsData ?? null,
        });

    } catch (error: any) {
        console.error('[Valuation API Error]', error.message);
        return NextResponse.json({
            ok: false,
            error: { message: error.message || 'Failed to fetch valuation from AutoTrader.' }
        }, { status: 500 });
    }
}

export const POST = withErrorHandler(getVehicleValuation);
