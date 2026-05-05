import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

async function getVehicleValuation(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session || !session.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const body = await req.json();
    const {
        vrm, mileage, derivativeId, features, price,
        firstRegistrationDate: frd,
        registeredDate,       // alias sent by quick-check page
        conditionRating: cr,
        condition,            // alias sent by quick-check page
    } = body;

    const firstRegistrationDate = frd || registeredDate;

    // AT docs: accepted values are title-case — Excellent, Great, Good, Fair, Poor
    const CONDITION_MAP: Record<string, string> = {
        excellent: 'Excellent', great: 'Great', good: 'Good',
        fair: 'Fair', poor: 'Poor', average: 'Fair', new: 'Excellent',
    };
    const conditionRating = CONDITION_MAP[(cr || condition || '').toLowerCase()];

    if (!mileage) {
        return NextResponse.json({ ok: false, error: { message: 'mileage is required.', code: 'VALIDATION_ERROR' } }, { status: 400 });
    }
    if (!vrm && !derivativeId) {
        return NextResponse.json({ ok: false, error: { message: 'vrm or derivativeId is required.', code: 'VALIDATION_ERROR' } }, { status: 400 });
    }

    const odometerReadingMiles = parseInt(mileage);

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        let valuationsObj: any;
        let metricsRaw: any = {};

        if (derivativeId && firstRegistrationDate) {
            // AT docs: POST /valuations — supports feature adjustment, condition rating, price indicator
            const payload: any = {
                vehicle: { derivativeId, firstRegistrationDate, odometerReadingMiles },
            };
            if (conditionRating) payload.conditionRating = conditionRating;
            // features: pass array of { name } objects; empty array = base valuation; omitted = market value
            if (Array.isArray(features)) {
                payload.features = features.map((f: any) => ({ name: typeof f === 'string' ? f : f.name }));
            }
            // price: triggers priceIndicatorRating in retail response
            if (price != null) {
                payload.adverts = { retailAdverts: { price: { amountGBP: Number(price) } } };
            }

            const registration = vrm ? (vrm as string).toUpperCase().replace(/\s/g, '') : null;
            const [valuationRes, metricsRes] = await Promise.all([
                client.post('/valuations', payload, { advertiserId: client.dealerId! }),
                registration ? client.get('/vehicles', {
                    registration,
                    advertiserId: client.dealerId!,
                    valuations: 'true',
                    vehicleMetrics: 'true',
                    odometerReadingMiles: String(odometerReadingMiles),
                }) : Promise.resolve(null),
            ]);
            valuationsObj = valuationRes?.valuations;
            metricsRaw = metricsRes ?? {};
        } else {
            // Fallback: VRM-based lookup with valuations — no feature/condition adjustment
            const registration = (vrm as string).toUpperCase().replace(/\s/g, '');
            const response = await client.get('/vehicles', {
                registration,
                advertiserId: client.dealerId!,
                valuations: 'true',
                vehicleMetrics: 'true',
                odometerReadingMiles: String(odometerReadingMiles),
            });
            valuationsObj = response?.valuations;
            metricsRaw = response ?? {};
        }

        if (!valuationsObj) {
            return NextResponse.json({
                ok: false,
                error: { message: 'Valuation not available for this vehicle.' }
            }, { status: 404 });
        }

        // Normalise to array format for the frontend
        const valuationsArray = [
            {
                valuationType: 'Trade',
                amountGBP: valuationsObj.trade?.amountGBP ?? null,
            },
            {
                valuationType: 'PartExchange',
                amountGBP: valuationsObj.partExchange?.amountGBP ?? null,
            },
            {
                valuationType: 'Retail',
                amountGBP: valuationsObj.retail?.amountGBP ?? null,
                priceIndicatorRating: valuationsObj.retail?.priceIndicatorRating ?? null,
                priceIndicatorRatingBands: valuationsObj.retail?.priceIndicatorRatingBands ?? null,
            },
            {
                valuationType: 'Private',
                amountGBP: valuationsObj.private?.amountGBP ?? null,
            },
        ].filter(v => v.amountGBP != null);

        if (valuationsArray.length === 0) {
            return NextResponse.json({
                ok: false,
                error: { message: 'Valuation not available for this vehicle.' }
            }, { status: 404 });
        }

        const vm = metricsRaw?.vehicleMetrics;
        const ratingRaw    = metricsRaw?.rating    ?? vm?.rating;
        const daysToSellRaw = metricsRaw?.daysToSell ?? vm?.daysToSell;
        const metrics = (vm || ratingRaw != null || daysToSellRaw != null) ? {
            vehicleMetrics: vm ?? null,
            rating:     typeof ratingRaw    === 'object' ? (ratingRaw?.value     ?? null) : (ratingRaw     ?? null),
            daysToSell: typeof daysToSellRaw === 'object' ? (daysToSellRaw?.value ?? null) : (daysToSellRaw ?? null),
        } : null;

        return NextResponse.json({ ok: true, valuations: valuationsArray, metrics });

    } catch (error: any) {
        console.error('[Valuation API Error]', error.message);
        return NextResponse.json({
            ok: false,
            error: { message: error.message || 'Failed to fetch valuation from AutoTrader.' }
        }, { status: 500 });
    }
}

export const POST = withErrorHandler(getVehicleValuation);
