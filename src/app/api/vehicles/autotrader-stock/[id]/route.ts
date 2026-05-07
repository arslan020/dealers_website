import { NextRequest, NextResponse } from 'next/server';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';
import Vehicle from '@/models/Vehicle';
import connectDB from '@/lib/db';
import { AutoTraderClient } from '@/lib/autotrader';
import { extractLiveStockPayload } from '@/lib/at-stock-enrich';

// AT owns these fields — never let local Vehicle doc override them
const AT_OWNED_FIELDS = new Set([
    'id', 'stockId', 'make', 'model', 'derivative', 'vrm', 'year',
    'vehicle', 'media', 'technicalSpecs', 'availability', 'lifecycleState',
    'advertiserCreatedDate', 'createdAt', 'updatedAt', 'tenantId',
    '__v', '__t',
    'adverts', 'metadata',
]);

/**
 * GET /api/vehicles/autotrader-stock/[id]
 * Fetches live from AT (source of truth). Falls back to cache only if AT is unreachable.
 * Local Vehicle doc fields (settings, content, images, history) are merged on top.
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

        let vehicle: any = null;
        let fromCache = false;

        // 1. Fetch directly from AT — AT is source of truth
        try {
            const client = new AutoTraderClient(tenantId);
            await client.init();
            const raw = await client.getStockItem(id);
            const live = extractLiveStockPayload(raw);
            if (live) {
                const toStr = (val: any): string => {
                    if (!val) return '';
                    if (typeof val === 'string') return val;
                    if (typeof val === 'object') return val.name || val.value || '';
                    return String(val);
                };
                vehicle = {
                    id: live.id || live.stockId || id,
                    vrm: toStr(live.vehicle?.vrm || live.vehicle?.registrationNumber),
                    make: toStr(live.vehicle?.make),
                    model: toStr(live.vehicle?.model),
                    derivative: toStr(live.vehicle?.derivative),
                    year: toStr(live.vehicle?.yearOfManufacture),
                    mileage: live.vehicle?.odometerReadingMiles || 0,
                    price: live.adverts?.forecourtPrice?.amountGBP || live.adverts?.retailAdverts?.suppliedPrice?.amountGBP || 0,
                    fuelType: toStr(live.vehicle?.fuelType),
                    transmission: toStr(live.vehicle?.transmissionType),
                    colour: toStr(live.vehicle?.colour),
                    engineSize: toStr(live.vehicle?.engineSizeCc),
                    bodyType: toStr(live.vehicle?.bodyType),
                    adverts: live.adverts,
                    features: live.features || [],
                    technicalSpecs: live.vehicle || {},
                    media: live.media,
                    metadata: live.metadata || {},
                };
            }
        } catch {
            // AT unreachable — fall through to cache
        }

        // 2. Fall back to cache only if AT fetch failed
        if (!vehicle) {
            const cache = await AutoTraderStockCache.findOne({ tenantId });
            const cached = cache?.stock?.find((v: any) => v.id === id);
            if (cached) {
                vehicle = cached;
                fromCache = true;
            }
        }

        if (!vehicle) {
            return NextResponse.json({
                ok: false,
                error: 'Vehicle not found. Please refresh sync.'
            }, { status: 404 });
        }

        // 3. Merge local Vehicle doc (non-AT-owned fields only)
        const localDoc = await Vehicle.findOne({ stockId: id, tenantId }).lean() as any;
        if (localDoc) {
            for (const [key, value] of Object.entries(localDoc)) {
                if (AT_OWNED_FIELDS.has(key)) continue;
                if (key.startsWith('$')) continue;
                if (value !== undefined && value !== null) {
                    vehicle[key] = value;
                }
            }
        }

        return NextResponse.json({ ok: true, vehicle, fromCache });

    } catch (error: any) {
        console.error('[AutoTrader Detail API] Error:', error);
        return NextResponse.json({
            ok: false,
            error: 'Failed to fetch vehicle details.'
        }, { status: 500 });
    }
}
