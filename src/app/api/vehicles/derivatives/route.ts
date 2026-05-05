import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * GET /api/vehicles/derivatives
 * Search AutoTrader for derivatives matching make/model/generation/fuelType/engineSize.
 * Returns a list of derivative options for the smart dropdown.
 *
 * Query params: make, model, generation, fuelType, engineSize
 *
 * GET /api/vehicles/derivatives?id={derivativeId}
 * Fetch full details for a single derivative (for auto-complete all fields).
 */
async function handleDerivatives(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session || !session.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const derivativeId = searchParams.get('id');

    const client = new AutoTraderClient(session.tenantId);
    await client.init();

    // ── Single derivative detail (for auto-complete) ─────────────────────────
    if (derivativeId) {
        try {
            const data = await client.getDerivativeById(derivativeId);
            return NextResponse.json({ ok: true, derivative: data });
        } catch (err: any) {
            console.error('[Derivatives] getDerivativeById error:', err.message);
            return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
        }
    }

    // ── Derivative search ─────────────────────────────────────────────────────
    const make         = searchParams.get('make')         || undefined;
    const model        = searchParams.get('model')        || undefined;
    const generation   = searchParams.get('generation')   || undefined;
    const fuelType     = searchParams.get('fuelType')     || undefined;
    const transmission = searchParams.get('transmission') || undefined;
    const trim         = searchParams.get('trim')         || undefined;
    const vehicleType  = searchParams.get('vehicleType')  || undefined;
    const generationId = searchParams.get('generationId') || undefined;

    if (!make && !model && !generationId) {
        return NextResponse.json({ ok: false, error: 'At least make, model, or generationId is required' }, { status: 400 });
    }

    try {
        const data = await client.searchDerivatives({ make, model, generation, fuelType, transmission, trim, vehicleType, generationId });

        // AT list response: { derivative: [{derivativeId, name}] } (no filters)
        //                or { derivatives: [{derivativeId, name, introduced, discontinued}] } (with filters)
        // Technical fields (fuelType, transmissionType, etc.) are only in GET /taxonomy/derivatives/{id}
        const raw = data?.derivatives || data?.derivative || [];
        const derivatives = raw.map((d: any) => ({
            id: d.derivativeId,
            label: d.name || '',
            generation: d.generationName || null,
            introduced: d.introduced || null,
            discontinued: d.discontinued || null,
        }));

        return NextResponse.json({ ok: true, derivatives });

    } catch (err: any) {
        console.error('[Derivatives] searchDerivatives error:', err.message);
        if (err.message?.includes('404') || err.message?.includes('not found') || err.message?.includes('400')) {
            return NextResponse.json({ ok: true, derivatives: [], note: 'Derivative search unavailable — try providing more specific filters.' });
        }
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export const GET = withErrorHandler(handleDerivatives);
