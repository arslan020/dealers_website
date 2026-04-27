import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * GET /api/vehicles/taxonomy?resource=makes|models|generations|derivatives
 *
 * Navigates the AutoTrader vehicle taxonomy hierarchy:
 *   makes:       ?resource=makes&vehicleType=Car
 *   models:      ?resource=models&makeId=xxx&vehicleType=Car
 *   generations: ?resource=generations&modelId=xxx
 *   derivatives: ?resource=derivatives&generationId=xxx[&fuelType=][&engineSize=]
 *
 * AT docs: Taxonomy API — /taxonomy/makes, /taxonomy/models, /taxonomy/generations, /taxonomy/derivatives
 * Capability: Vehicle Taxonomy
 */
async function handleTaxonomy(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const resource = searchParams.get('resource');

    if (!resource || !['makes', 'models', 'generations', 'derivatives'].includes(resource)) {
        return NextResponse.json(
            { ok: false, error: 'resource param required: makes | models | generations | derivatives' },
            { status: 400 }
        );
    }

    const client = new AutoTraderClient(session.tenantId);
    await client.init();

    try {
        let data: any;

        if (resource === 'makes') {
            const vehicleType = searchParams.get('vehicleType') || 'Car';
            data = await client.getTaxonomyMakes(vehicleType);
            return NextResponse.json({ ok: true, makes: data?.makes || [] });
        }

        if (resource === 'models') {
            const makeId = searchParams.get('makeId');
            if (!makeId) return NextResponse.json({ ok: false, error: 'makeId required for models' }, { status: 400 });
            const vehicleType = searchParams.get('vehicleType') || 'Car';
            data = await client.getTaxonomyModels(makeId, vehicleType);
            return NextResponse.json({ ok: true, models: data?.models || [] });
        }

        if (resource === 'generations') {
            const modelId = searchParams.get('modelId');
            if (!modelId) return NextResponse.json({ ok: false, error: 'modelId required for generations' }, { status: 400 });
            data = await client.getTaxonomyGenerations(modelId);
            return NextResponse.json({ ok: true, generations: data?.generations || [] });
        }

        if (resource === 'derivatives') {
            const generationId = searchParams.get('generationId') || undefined;
            const fuelType = searchParams.get('fuelType') || undefined;
            const engineSize = searchParams.get('engineSize') || undefined;
            const make = searchParams.get('make') || undefined;
            const model = searchParams.get('model') || undefined;
            data = await client.searchDerivatives({ generationId, fuelType, engineSize, make, model });
            return NextResponse.json({ ok: true, derivatives: data?.derivatives || data?.derivative || [] });
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
