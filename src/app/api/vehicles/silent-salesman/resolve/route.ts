import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { verifyAccessToken } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';
import mongoose from 'mongoose';
import { pickSilentSalesmanDescriptionFromVehicle } from '@/lib/silent-salesman/vehicle-fields';
import { enrichAtCacheStockRow, mergeLiveAdvertsOntoVehicleDoc } from '@/lib/at-stock-enrich';

async function resolveVehicleDoc(tenantId: string, rawId: string): Promise<any | null> {
    const tid = new mongoose.Types.ObjectId(tenantId);

    // MongoDB document by _id
    if (mongoose.isValidObjectId(rawId)) {
        const v = await Vehicle.findOne({ _id: new mongoose.Types.ObjectId(rawId), tenantId: tid })
            .select('description description2 attentionGrabber longAttentionGrabber stockId')
            .lean() as any;
        if (v) return v;
    }

    // App URL uses at-{stockId}; also support plain AT stock id
    const atStockId = rawId.startsWith('at-') ? rawId.slice(3) : rawId;

    const byStock = await Vehicle.findOne({
        tenantId: tid,
        $or: [{ stockId: atStockId }, { stockId: rawId }, { externalStockId: atStockId }],
    })
        .select('description description2 attentionGrabber longAttentionGrabber stockId')
        .lean() as any;
    if (byStock) return byStock;

    const cache = await AutoTraderStockCache.findOne({ tenantId: tid }).lean() as any;
    const stock: any[] = Array.isArray(cache?.stock) ? cache.stock : [];
    const cached = stock.find((s: any) => s?.id === atStockId || s?.stockId === atStockId || s?.id === rawId);
    if (cached) return cached;

    return null;
}

async function postHandler(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.' } }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const vehicleId = body?.vehicleId as string | undefined;
    if (!vehicleId) {
        return NextResponse.json({ ok: false, error: { message: 'vehicleId is required.' } }, { status: 400 });
    }

    await connectToDatabase();
    const doc = await resolveVehicleDoc(String(session.tenantId), String(vehicleId));

    if (!doc) {
        return NextResponse.json({ ok: false, error: { message: 'Vehicle not found.' } }, { status: 404 });
    }

    const tenantIdStr = String(session.tenantId);
    let enriched = doc as any;
    if (enriched.stockId) {
        enriched = await mergeLiveAdvertsOntoVehicleDoc(tenantIdStr, String(enriched.stockId), enriched);
    } else if (enriched.id && !enriched._id) {
        enriched = await enrichAtCacheStockRow(tenantIdStr, enriched);
    }

    const out = {
        description: pickSilentSalesmanDescriptionFromVehicle(enriched),
        description2: '',
        attentionGrabber: enriched?.attentionGrabber || enriched?.adverts?.retailAdverts?.attentionGrabber || '',
        longAttentionGrabber: enriched?.longAttentionGrabber || enriched?.vehicle?.longAttentionGrabber || '',
    };

    return NextResponse.json({ ok: true, vehicle: out });
}

export const POST = withErrorHandler(postHandler);

