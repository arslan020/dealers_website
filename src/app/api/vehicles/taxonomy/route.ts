import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

const VALID_FACETS = [
    'fuelTypes', 'transmissionTypes', 'bodyTypes', 'trims', 'doors',
    'drivetrains', 'wheelbaseTypes', 'cabTypes', 'axleConfigurations',
    'badgeEngineSizes', 'styles', 'subStyles', 'endLayouts', 'bedroomLayouts',
    'vehicleTypes',
];

/**
 * GET /api/vehicles/taxonomy?resource=makes|models|generations|derivatives|features|prices|{facet}
 *
 * AT docs: Taxonomy API
 * Capability: Vehicle Taxonomy / Vehicle Equipment
 */
async function handleTaxonomy(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const resource = searchParams.get('resource');

    const validResources = ['makes', 'models', 'generations', 'derivatives', 'features', 'prices', ...VALID_FACETS];
    if (!resource || !validResources.includes(resource)) {
        return NextResponse.json(
            { ok: false, error: `resource param required: ${validResources.join(' | ')}` },
            { status: 400 }
        );
    }

    const client = new AutoTraderClient(session.tenantId);
    await client.init();

    try {
        if (resource === 'makes') {
            const vehicleType = searchParams.get('vehicleType') || 'Car';
            const make = searchParams.get('make') || undefined;
            const data = await client.getTaxonomyMakes(vehicleType);
            const makes = make
                ? (data?.makes || []).filter((m: any) => m.name?.toLowerCase().includes(make.toLowerCase()))
                : (data?.makes || []);
            return NextResponse.json({ ok: true, makes });
        }

        if (resource === 'models') {
            const makeId = searchParams.get('makeId');
            if (!makeId) return NextResponse.json({ ok: false, error: 'makeId required for models' }, { status: 400 });
            const vehicleType = searchParams.get('vehicleType') || 'Car';
            const data = await client.getTaxonomyModels(makeId, vehicleType);
            return NextResponse.json({ ok: true, models: data?.models || [] });
        }

        if (resource === 'generations') {
            const modelId = searchParams.get('modelId');
            if (!modelId) return NextResponse.json({ ok: false, error: 'modelId required for generations' }, { status: 400 });
            const data = await client.getTaxonomyGenerations(modelId);
            return NextResponse.json({ ok: true, generations: data?.generations || [] });
        }

        if (resource === 'derivatives') {
            const generationId = searchParams.get('generationId') || undefined;
            const fuelType     = searchParams.get('fuelType')     || undefined;
            const transmission = searchParams.get('transmission')  || undefined;
            const trim         = searchParams.get('trim')          || undefined;
            const vehicleType  = searchParams.get('vehicleType')   || undefined;
            const make         = searchParams.get('make')          || undefined;
            const model        = searchParams.get('model')         || undefined;
            const data = await client.searchDerivatives({ generationId, fuelType, transmission, trim, vehicleType, make, model });
            return NextResponse.json({ ok: true, derivatives: data?.derivatives || data?.derivative || [] });
        }

        if (resource === 'features') {
            const derivativeId  = searchParams.get('derivativeId');
            const effectiveDate = searchParams.get('effectiveDate');
            if (!derivativeId || !effectiveDate) {
                return NextResponse.json({ ok: false, error: 'derivativeId and effectiveDate required for features' }, { status: 400 });
            }
            const data = await client.getTaxonomyFeatures(derivativeId, effectiveDate);
            return NextResponse.json({ ok: true, features: data?.features || [] });
        }

        if (resource === 'prices') {
            const derivativeId  = searchParams.get('derivativeId');
            if (!derivativeId) {
                return NextResponse.json({ ok: false, error: 'derivativeId required for prices' }, { status: 400 });
            }
            const effectiveDate = searchParams.get('effectiveDate') || undefined;
            const data = await client.getTaxonomyPrices(derivativeId, effectiveDate);
            return NextResponse.json({ ok: true, prices: data?.prices || [] });
        }

        // ── Facets: fuelTypes, transmissionTypes, trims, bodyTypes, etc. ──────
        if (VALID_FACETS.includes(resource)) {
            const filters: Record<string, string> = {};
            ['generationId', 'modelId', 'makeId', 'vehicleType', 'fuelType', 'transmission', 'trim', 'productionStatus']
                .forEach(k => { const v = searchParams.get(k); if (v) filters[k] = v; });
            const data = await client.getTaxonomyFacet(resource, filters);
            return NextResponse.json({ ok: true, [resource]: data?.[resource] || [] });
        }

        return NextResponse.json({ ok: false, error: 'Unknown resource' }, { status: 400 });

    } catch (error: any) {
        console.error('[Taxonomy]', resource, error.message);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to fetch taxonomy data.' },
            { status: 500 }
        );
    }
}

export const GET = withErrorHandler(handleTaxonomy);
