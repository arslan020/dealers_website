import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';
import { withErrorHandler } from '@/lib/api-handler';
import { mergeLiveAdvertsOntoVehicleDoc } from '@/lib/at-stock-enrich';

/**
 * GET /api/vehicles/[id]
 * Fetches a single local vehicle by its MongoDB _id.
 */
async function getVehicleById(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    await connectToDatabase();

    const vehicle = await Vehicle.findOne({ _id: id, tenantId }).lean();

    if (!vehicle) {
        return NextResponse.json({ ok: false, error: 'Vehicle not found' }, { status: 404 });
    }

    let out = vehicle as any;
    if (out.stockId) {
        out = await mergeLiveAdvertsOntoVehicleDoc(tenantId, String(out.stockId), out);
    }

    return NextResponse.json({ ok: true, vehicle: out });
}

export const GET = withErrorHandler(
    (req: NextRequest, context: any) => getVehicleById(req, context)
);
