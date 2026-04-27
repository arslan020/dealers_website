import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { verifyAccessToken } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';
import Tenant from '@/models/Tenant';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';
import mongoose from 'mongoose';
import { renderSilentSalesmanPdf } from '@/lib/silent-salesman/pdf';
import { enrichAtCacheStockRow, mergeLiveAdvertsOntoVehicleDoc } from '@/lib/at-stock-enrich';

async function resolveVehicleDoc(tenantId: string, rawId: string): Promise<{ doc: any; routeId: string; vrm: string } | null> {
    const tid = new mongoose.Types.ObjectId(tenantId);
    const tenantIdStr = String(tenantId);

    // MongoDB document by _id
    if (mongoose.isValidObjectId(rawId)) {
        const v = await Vehicle.findOne({ _id: new mongoose.Types.ObjectId(rawId), tenantId: tid }).lean() as any;
        if (v) {
            const rid = String(v._id);
            let doc = v;
            if (v.stockId) doc = await mergeLiveAdvertsOntoVehicleDoc(tenantIdStr, String(v.stockId), v);
            return { doc, routeId: rid, vrm: doc.vrm || '' };
        }
    }

    // App URL uses at-{stockId}; also support plain AT stock id
    const atStockId = rawId.startsWith('at-') ? rawId.slice(3) : rawId;

    const byStock = await Vehicle.findOne({
        tenantId: tid,
        $or: [{ stockId: atStockId }, { stockId: rawId }, { externalStockId: atStockId }],
    }    ).lean() as any;
    if (byStock) {
        const rid = byStock.stockId ? `at-${byStock.stockId}` : String(byStock._id);
        let doc = byStock;
        if (byStock.stockId) doc = await mergeLiveAdvertsOntoVehicleDoc(tenantIdStr, String(byStock.stockId), byStock);
        return { doc, routeId: rid, vrm: doc.vrm || '' };
    }

    const cache = await AutoTraderStockCache.findOne({ tenantId: tid }).lean() as any;
    const stock: any[] = Array.isArray(cache?.stock) ? cache.stock : [];
    const cached = stock.find((s: any) => s?.id === atStockId || s?.stockId === atStockId || s?.id === rawId);
    if (cached) {
        const doc = await enrichAtCacheStockRow(tenantIdStr, cached);
        const vrm =
            doc.vrm ||
            doc.vehicle?.registration ||
            doc.registration ||
            '';
        return { doc, routeId: `at-${doc.id || atStockId}`, vrm };
    }

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
    const options = body?.options || {};

    if (!vehicleId) {
        return NextResponse.json({ ok: false, error: { message: 'vehicleId is required.' } }, { status: 400 });
    }

    await connectToDatabase();
    const resolved = await resolveVehicleDoc(String(session.tenantId), String(vehicleId));

    if (!resolved) {
        return NextResponse.json({ ok: false, error: { message: 'Vehicle not found.' } }, { status: 404 });
    }

    const vehicle = { ...resolved.doc, _silentSalesmanRouteId: resolved.routeId };

    const tenantDoc = await Tenant.findById(session.tenantId).select('name').lean() as { name?: string } | null;

    let pdfBuffer: Buffer;
    try {
        pdfBuffer = await renderSilentSalesmanPdf({
            vehicle,
            tenantId: String(session.tenantId),
            tenantName: tenantDoc?.name || 'Dealership',
            options,
            publicBaseUrl: process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || '',
        });
    } catch (e: any) {
        console.error('[Silent Salesman PDF]', e?.message, e?.stack?.slice?.(0, 500));
        return NextResponse.json(
            { ok: false, error: { message: e?.message || 'PDF generation failed.' } },
            { status: 500 }
        );
    }

    return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="silent-salesman-${resolved.vrm || vehicleId}.pdf"`,
            'Cache-Control': 'no-store',
        },
    });
}

export const POST = withErrorHandler(postHandler);

