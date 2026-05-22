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
        registeredDate,
        conditionRating: cr,
        condition,
        optionalExtras,
        standardFeatures,
        stockId,
    } = body;

    const firstRegistrationDate = frd || registeredDate;

    const CONDITION_MAP: Record<string, string> = {
        excellent: 'Excellent', great: 'Great', good: 'Good',
        fair: 'Fair', poor: 'Poor', average: 'Fair', new: 'Excellent',
    };
    const conditionRating = CONDITION_MAP[(cr || condition || '').toLowerCase()];

    if (mileage == null || mileage === '') {
        return NextResponse.json({ ok: false, error: { message: 'mileage is required.', code: 'VALIDATION_ERROR' } }, { status: 400 });
    }
    if (!vrm && !derivativeId && !stockId) {
        return NextResponse.json({ ok: false, error: { message: 'vrm, derivativeId or stockId is required.', code: 'VALIDATION_ERROR' } }, { status: 400 });
    }

    const odometerReadingMiles = parseInt(mileage);

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        let valuationsObj: any;
        let metricsRaw: any = {};
        let trend: any = null;
        let trendLine: any = null;

        if (stockId) {
            // AT docs: stock endpoint gives feature-adjusted valuation + sparse trend (plus30/60/90).
            // BUT: stock endpoint does NOT return private valuation, and trendedValuations is future-only.
            // Fetch stock first, then use derivativeId from stock item as fallback if not in request body.
            // Then parallel: POST /valuations (private) + POST /valuations/trends (rich historical chart).

            const featureNames = new Set<string>();
            if (Array.isArray(standardFeatures)) standardFeatures.forEach((f: any) => { const n = typeof f === 'string' ? f : f.name; if (n) featureNames.add(n); });
            if (Array.isArray(optionalExtras))   optionalExtras.forEach((f: any)   => { const n = typeof f === 'string' ? f : f.name; if (n) featureNames.add(n); });
            if (Array.isArray(features))          features.forEach((f: any)          => { const n = typeof f === 'string' ? f : f.name; if (n) featureNames.add(n); });
            const featuresArr = featureNames.size > 0 ? [...featureNames].map(name => ({ name })) : undefined;

            // Fetch stock first so we can extract derivativeId/firstRegistrationDate if not in request body
            const stockRes = await client.get('/stock', {
                advertiserId: client.dealerId!,
                stockId: String(stockId),
                valuations:        'true',
                trendedValuations: 'true',
                vehicleMetrics:    'true',
            });
            const item = stockRes?.results?.[0] ?? stockRes;
            const atVehicle = item?.vehicle ?? {};

            // Use request body values, fall back to what AT stock item has
            const resolvedDerivId   = derivativeId        || atVehicle.derivativeId        || null;
            const resolvedRegDate   = firstRegistrationDate || atVehicle.firstRegistrationDate || null;

            let valResP: Promise<any>    = Promise.resolve(null);
            let trendsResP: Promise<any> = Promise.resolve(null);

            if (resolvedDerivId && resolvedRegDate) {
                const valPayload: any = { vehicle: { derivativeId: resolvedDerivId, firstRegistrationDate: resolvedRegDate, odometerReadingMiles } };
                if (conditionRating) valPayload.conditionRating = conditionRating;  // title case: "Good" — correct for /valuations
                if (featuresArr)     valPayload.features = featuresArr;
                if (price != null)   valPayload.adverts = { retailAdverts: { price: { amountGBP: Number(price) } } };
                valResP = client.post('/valuations', valPayload, { advertiserId: client.dealerId! }).catch(() => null);

                const nowD = new Date();
                const startDate = new Date(nowD.getTime() - 91 * 86400000).toISOString().slice(0, 10);
                const endDate   = new Date(nowD.getTime() + 91 * 86400000).toISOString().slice(0, 10);
                const trendsPayload: any = {
                    vehicle: { derivativeId: resolvedDerivId, firstRegistrationDate: resolvedRegDate },
                    valuations: {
                        markets: ['retail', 'trade', 'partExchange', 'private'],
                        frequency: 'week',
                        start: { date: startDate, odometerReadingMiles },
                        end:   { date: endDate,   odometerReadingMiles },
                    },
                };
                // AT docs: /valuations/trends conditionRating must be UPPERCASE ("GOOD", not "Good")
                if (conditionRating) trendsPayload.conditionRating = conditionRating.toUpperCase();
                if (featuresArr)     trendsPayload.features = featuresArr;
                trendsResP = client.post('/valuations/trends', trendsPayload, { advertiserId: client.dealerId! }).catch(() => null);
            }

            const [valRes, trendsRes] = await Promise.all([valResP, trendsResP]);

            // Stock returns adjusted (feature-aware) and marketAverage — prefer adjusted
            const v = item?.valuations;
            if (v) {
                const src = v.adjusted ?? v.marketAverage ?? v;
                valuationsObj = {
                    retail:      { amountGBP: src.retail?.amountGBP ?? null, priceIndicatorRating: item?.adverts?.retailAdverts?.priceIndicatorRating ?? null },
                    trade:       { amountGBP: src.trade?.amountGBP ?? null },
                    partExchange:{ amountGBP: src.partExchange?.amountGBP ?? null },
                    // Stock endpoint doesn't return private — use POST /valuations result
                    private:     { amountGBP: src.private?.amountGBP ?? valRes?.valuations?.private?.amountGBP ?? null },
                };
            }
            metricsRaw = { vehicleMetrics: item?.vehicleMetrics ?? null };
            trend = item?.trendedValuations ?? null;
            // Rich trend (historical + future) takes priority over sparse stock trend
            trendLine = trendsRes?.valuations ?? null;

        } else if (derivativeId && firstRegistrationDate) {
            // AT docs: POST /valuations with all features for accurate feature-adjusted valuation
            const payload: any = {
                vehicle: { derivativeId, firstRegistrationDate, odometerReadingMiles },
            };
            if (conditionRating) payload.conditionRating = conditionRating;

            // AT docs: include standard features + factory-fitted optional extras + dealer features
            const featureNames = new Set<string>();
            if (Array.isArray(standardFeatures)) {
                standardFeatures.forEach((f: any) => { const n = typeof f === 'string' ? f : f.name; if (n) featureNames.add(n); });
            }
            if (Array.isArray(optionalExtras)) {
                optionalExtras.forEach((f: any) => { const n = typeof f === 'string' ? f : f.name; if (n) featureNames.add(n); });
            }
            if (Array.isArray(features)) {
                features.forEach((f: any) => { const n = typeof f === 'string' ? f : f.name; if (n) featureNames.add(n); });
            }
            if (featureNames.size > 0) {
                payload.features = [...featureNames].map(name => ({ name }));
            }
            if (price != null) {
                payload.adverts = { retailAdverts: { price: { amountGBP: Number(price) } } };
            }

            // AT docs: POST /vehicle-metrics — dedicated metrics endpoint.
            const metricsPayload: any = {
                vehicle: { derivativeId, firstRegistrationDate, odometerReadingMiles },
            };
            if (payload.features)  metricsPayload.features = payload.features;
            if (price != null) {
                metricsPayload.adverts = { retailAdverts: { price: { amountGBP: Number(price) } } };
            }

            // AT docs: POST /valuations/trends — 6-month range (3 months back → 3 months forward), monthly.
            // Returns full array of { date, retail, trade, partExchange } points for chart.
            const nowD = new Date();
            const startDate = new Date(nowD.getTime() - 91 * 86400000).toISOString().slice(0, 10);
            const endDate   = new Date(nowD.getTime() + 91 * 86400000).toISOString().slice(0, 10);
            const trendsPayload: any = {
                vehicle: { derivativeId, firstRegistrationDate },
                valuations: {
                    markets: ['retail', 'trade', 'partExchange', 'private'],
                    frequency: 'week',
                    start: { date: startDate, odometerReadingMiles },
                    end:   { date: endDate,   odometerReadingMiles },
                },
            };
            // AT docs: /valuations/trends conditionRating must be UPPERCASE ("GOOD", not "Good")
            if (conditionRating) trendsPayload.conditionRating = conditionRating.toUpperCase();
            if (payload.features) trendsPayload.features = payload.features;

            const [valuationRes, metricsRes, trendsRes] = await Promise.all([
                client.post('/valuations', payload, { advertiserId: client.dealerId! }),
                client.post('/vehicle-metrics', metricsPayload, { advertiserId: client.dealerId! }),
                client.post('/valuations/trends', trendsPayload, { advertiserId: client.dealerId! }).catch(() => null),
            ]);
            valuationsObj = valuationRes?.valuations;
            metricsRaw = metricsRes ?? {};
            trendLine = trendsRes?.valuations ?? null;

        } else {
            // Fallback: VRM only — no feature adjustment
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

        const vmRaw = metricsRaw?.vehicleMetrics;
        // POST /vehicle-metrics returns: vehicleMetrics.retail (no national wrapper)
        // GET /stock?vehicleMetrics=true returns: vehicleMetrics.national.retail
        // Support both shapes so either path works correctly.
        const vmRetail = vmRaw?.retail ?? vmRaw?.national?.retail ?? {};
        const vm = vmRaw ? {
            ...vmRaw,
            liveRetailAdverts:    vmRetail.liveRetailAdverts    ?? vmRaw.liveRetailAdverts    ?? null,
            totalRetailAdverts:   vmRetail.totalRetailAdverts   ?? vmRaw.totalRetailAdverts   ?? null,
            liveRetailPercentage: vmRetail.liveRetailPercentage ?? vmRaw.liveRetailPercentage ?? null,
            forecastedDaysToSell: vmRetail.forecastedDaysToSell ?? vmRaw.forecastedDaysToSell ?? null,
        } : null;
        const ratingRaw     = vmRetail.rating     ?? vmRaw?.rating;
        const daysToSellRaw = vmRetail.daysToSell ?? vmRaw?.daysToSell;
        const metrics = (vm || ratingRaw != null || daysToSellRaw != null) ? {
            vehicleMetrics: vm ?? null,
            rating:     typeof ratingRaw     === 'object' ? (ratingRaw?.value     ?? null) : (ratingRaw     ?? null),
            daysToSell: typeof daysToSellRaw === 'object' ? (daysToSellRaw?.value ?? null) : (daysToSellRaw ?? null),
        } : null;

        // trendedValuations is only available via the stock endpoint for items that already exist in AT stock.
        // When no stockId is present the vehicle is not yet in stock, so there is nothing to trend — skip the call.
        // (The stockId path above already fetches trendedValuations in a single combined call.)

        return NextResponse.json({ ok: true, valuations: valuationsArray, metrics, trend, trendLine });

    } catch (error: any) {
        console.error('[Valuation API Error]', error.message);
        return NextResponse.json({
            ok: false,
            error: { message: error.message || 'Failed to fetch valuation from AutoTrader.' }
        }, { status: 500 });
    }
}

export const POST = withErrorHandler(getVehicleValuation);
