import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';
import mongoose from 'mongoose';

type Params = { params: Promise<{ dealId: string }> };

/**
 * GET /api/deals/[dealId]
 * Fetch a single deal with all components from AutoTrader.
 * Capability: Deal Sync
 */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
        }

        const { dealId } = await params;
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const data = await client.getDeal(dealId);

        // Normalize partExchange shape from AT deal response
        if (data.partExchange && typeof data.partExchange === 'object') {
            const px = data.partExchange;
            const pxId = px.partExchangeId ?? px.id ?? undefined;
            const vrm = px.vehicle?.registration ?? px.vrm ?? undefined;
            // Only treat as a real PX if AT gave us an ID or a registration
            if (pxId || vrm) {
                data.partExchange = {
                    partExchangeId: pxId,
                    vrm,
                    make: px.vehicle?.make ?? px.make,
                    model: px.vehicle?.model ?? px.model,
                    odometerReadingMiles: px.vehicle?.odometerReadingMiles,
                    colour: px.vehicle?.colour,
                    firstRegistrationDate: px.vehicle?.firstRegistrationDate,
                    outstandingFinance: px.vehicle?.outstandingFinance,
                    features: px.vehicle?.features,
                    consumerCondition: px.consumer?.conditionRating,
                    consumerValuation: px.consumer?.partExchangeValuation
                        ? { amountGBP: px.consumer.partExchangeValuation.amountGBP, expires: px.consumer.partExchangeValuation.expires }
                        : undefined,
                    advertiserCondition: px.advertiser?.conditionRating,
                    offerPrice: px.advertiser?.offer ?? px.offerPrice,
                };
            } else {
                data.partExchange = null;
            }
        }

        // Enrich stock with VRM from local Vehicle DB
        const stockId = data.stock?.stockId;
        if (stockId) {
            await connectToDatabase();
            const vehicle = await Vehicle.findOne(
                { stockId, tenantId: new mongoose.Types.ObjectId(session.tenantId) },
                { vrm: 1, make: 1, model: 1, year: 1, mileage: 1, images: 1 }
            ).lean() as any;
            if (vehicle) {
                data.stock = {
                    ...data.stock,
                    vrm: vehicle.vrm || data.stock?.vrm,
                    make: vehicle.make || data.stock?.make,
                    model: vehicle.model || data.stock?.model,
                    year: vehicle.year || data.stock?.year,
                    mileage: vehicle.mileage || data.stock?.mileage,
                    image: vehicle.images?.[0] || null,
                };
            }
        }

        return NextResponse.json({ ok: true, deal: data });
    } catch (error: any) {
        console.error('[Deal GET]', error.message);
        return NextResponse.json({ ok: false, error: { message: error.message || 'Failed to fetch deal.' } }, { status: 500 });
    }
}

/**
 * PATCH /api/deals/[dealId]
 * Update a deal status (Complete / Cancel / Reserve).
 * Body: { advertiserDealStatus: 'Complete' | 'Cancelled' | ... } (AT docs use "Complete" to finish a deal)
 * Capability: Deal Updates
 */
export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
        }

        const { dealId } = await params;
        const body = (await req.json()) as Record<string, unknown>;

        if (!body || Object.keys(body).length === 0) {
            return NextResponse.json({ ok: false, error: { message: 'Request body is empty.', code: 'VALIDATION_ERROR' } }, { status: 400 });
        }

        // AutoTrader "Complete deal" uses advertiserDealStatus: "Complete" (not "Completed")
        if (body.advertiserDealStatus === 'Completed') {
            body.advertiserDealStatus = 'Complete';
        }

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.updateDeal(dealId, body);

        return NextResponse.json({ ok: true, result });
    } catch (error: any) {
        console.error('[Deal PATCH]', error.message);
        return NextResponse.json({ ok: false, error: { message: error.message || 'Failed to update deal.' } }, { status: 500 });
    }
}
