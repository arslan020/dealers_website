import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * GET /api/vehicles/optional-extras?vrm=XX
 *
 * Fetches vehicle-specific optional extras from AutoTrader for a given VRM.
 *
 * AT API: GET /vehicles?registration=VRM&features=true&advertiserId=XXX
 * Response structure (from AT docs):
 * {
 *   "vehicle": { ... },
 *   "features": [                   <-- AT top-level key, NOT under vehicle
 *     {
 *       "name": "17in Alloy Wheels",
 *       "type": "Optional",         // "Standard" or "Optional"
 *       "category": "Exterior",
 *       "basicPrice": 750.00,       // ex-VAT price
 *       "vatPrice": 150.00,
 *       "factoryFitted": true,      // true/false/null (null = data unavailable for this OEM)
 *       "rarityRating": "Rare",
 *       "valueRating": null
 *     }
 *   ]
 * }
 */
async function handleOptionalExtras(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session || !session.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const vrm = searchParams.get('vrm')?.toUpperCase().replace(/\s/g, '');

    if (!vrm) {
        return NextResponse.json({ ok: false, error: 'VRM is required' }, { status: 400 });
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // AT returns { vehicle: {...}, features: [...] } at the TOP LEVEL
        // features[] is a sibling of vehicle, NOT nested inside it
        const responseData = await client.lookupVehicle(vrm);
        const v = responseData.vehicle;

        if (!v) {
            return NextResponse.json({ ok: false, error: 'Vehicle not found on AutoTrader' }, { status: 404 });
        }

        // Features are at response top level
        const rawFeatures: any[] = responseData.features || [];
        console.log(`[Optional Extras] VRM=${vrm}, AT returned ${rawFeatures.length} features`);

        const optionalExtras: {
            name: string;
            price: number | null;
            fitted: boolean;
            category: string;
            rarityRating: string | null;
            valueRating: string | null;
        }[] = [];
        const standardFeatures: { name: string; category: string }[] = [];
        const factoryFitted: string[] = [];

        rawFeatures.forEach((f: any) => {
            const name: string = f.name || '';
            if (!name) return;

            // AT type field is exactly "Standard" or "Optional"
            const isOptional: boolean = f.type === 'Optional';
            const category: string = f.category || 'Other';

            // Total displayed price = basicPrice (ex-VAT) + vatPrice
            const basicPrice = typeof f.basicPrice === 'number' ? f.basicPrice : null;
            const vatPrice = typeof f.vatPrice === 'number' ? f.vatPrice : null;
            const totalPrice: number | null =
                basicPrice !== null && vatPrice !== null
                    ? basicPrice + vatPrice
                    : basicPrice;

            // factoryFitted: true = factory-fitted to this specific vehicle
            // factoryFitted: null = OEM doesn't provide this data
            const isFitted: boolean = f.factoryFitted === true;

            if (isFitted) factoryFitted.push(name);

            if (isOptional) {
                optionalExtras.push({
                    name,
                    price: totalPrice,
                    fitted: isFitted,
                    category,
                    rarityRating: f.rarityRating || null,
                    valueRating: f.valueRating || null,
                });
            } else {
                // type === "Standard"
                standardFeatures.push({ name, category });
            }
        });

        return NextResponse.json({
            ok: true,
            make: v.make || '',
            model: v.model || '',
            derivative: v.derivative || '',
            optionalExtras,
            standardFeatures,
            factoryFitted: [...new Set(factoryFitted)],
            hasData: rawFeatures.length > 0,
            totalFeatureCount: rawFeatures.length,
        });

    } catch (err: any) {
        console.error('[Optional Extras] Error:', err.message);
        return NextResponse.json({
            ok: true,
            make: '',
            model: '',
            derivative: '',
            optionalExtras: [],
            standardFeatures: [],
            factoryFitted: [],
            hasData: false,
            note: err.message,
        });
    }
}

export const GET = withErrorHandler(handleOptionalExtras);
