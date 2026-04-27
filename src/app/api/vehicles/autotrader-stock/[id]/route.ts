import { NextRequest, NextResponse } from 'next/server';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';
import Vehicle from '@/models/Vehicle';
import connectDB from '@/lib/db';
import { enrichAtCacheStockRow } from '@/lib/at-stock-enrich';

// AT owns these fields — never let local Vehicle doc override them
const AT_OWNED_FIELDS = new Set([
    'id', 'stockId', 'make', 'model', 'derivative', 'vrm', 'year',
    'vehicle', 'media', 'technicalSpecs', 'availability', 'lifecycleState',
    'advertiserCreatedDate', 'createdAt', 'updatedAt', 'tenantId',
    '__v', '__t',
]);

/**
 * GET /api/vehicles/autotrader-stock/[id]
 * Cache row + live GET /stock?stockId= merge so retail description matches MotorDesk / AT portal.
 * Local Vehicle doc fields (settings, content, images, history, specs) are merged on top.
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const tenantId = request.headers.get('x-tenant-id');

        if (!tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const cache = await AutoTraderStockCache.findOne({ tenantId });

        if (!cache || !cache.stock) {
            return NextResponse.json({
                ok: false,
                error: 'No stock data found. Please refresh sync first.'
            }, { status: 404 });
        }

        const vehicle = cache.stock.find((v: any) => v.id === id);

        if (!vehicle) {
            return NextResponse.json({
                ok: false,
                error: 'Vehicle not found in cache. It might have been removed or sync is required.'
            }, { status: 404 });
        }

        const enriched = await enrichAtCacheStockRow(tenantId, vehicle);

        // Merge all locally-saved fields from Vehicle collection onto the AT data.
        // AT_OWNED_FIELDS are never overridden — everything else (settings, content,
        // images, history, specs, channel statuses) takes the local value when present.
        const localDoc = await Vehicle.findOne({ stockId: id, tenantId }).lean() as any;
        if (localDoc) {
            for (const [key, value] of Object.entries(localDoc)) {
                if (AT_OWNED_FIELDS.has(key)) continue;
                if (key.startsWith('$')) continue; // mongoose internals
                if (value !== undefined && value !== null) {
                    (enriched as any)[key] = value;
                }
            }
        }

        return NextResponse.json({ ok: true, vehicle: enriched });

    } catch (error: any) {
        console.error('[AutoTrader Detail API] Error:', error);
        return NextResponse.json({
            ok: false,
            error: 'Failed to fetch vehicle details.'
        }, { status: 500 });
    }
}
