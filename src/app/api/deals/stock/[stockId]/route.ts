import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * GET /api/deals/stock/[stockId]
 * Returns all AutoTrader deals associated with a specific stock item.
 * Used by the vehicle detail page to show real deal data.
 * Capability: Deal Sync
 */
async function getDealsByStockId(
    req: NextRequest,
    context: { params: Promise<{ stockId: string }> }
) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { stockId } = await context.params;

    if (!stockId) {
        return NextResponse.json({ ok: false, error: 'stockId is required' }, { status: 400 });
    }

    const client = new AutoTraderClient(tenantId);
    await client.init();

    // Fetch all deals and filter by stockId client-side
    // AT API does not have a direct filter for stockId in the list endpoint
    const data = await client.getDeals({ pageSize: '50' });
    const allDeals: any[] = data.results || [];

    const vehicleDeals = allDeals.filter((d: any) => d.stock?.stockId === stockId);

    const shaped = vehicleDeals.map((d: any) => ({
        dealId: d.dealId,
        created: d.created,
        lastUpdated: d.lastUpdated,
        advertiserDealStatus: d.advertiserDealStatus,
        consumerDealStatus: d.consumerDealStatus,
        consumer: {
            firstName: d.consumer?.firstName || '',
            lastName: d.consumer?.lastName || '',
            email: d.consumer?.email || '',
            phone: d.consumer?.phone || '',
            type: d.consumer?.type || 'Private',
        },
        price: d.price,
        reservation: d.reservation,
        buyingSignals: d.buyingSignals,
        messages: d.messages ? { id: d.messages.messagesId ?? d.messages.id, lastUpdated: d.messages.lastUpdated } : null,
    }));

    return NextResponse.json({ ok: true, deals: shaped, total: shaped.length });
}

export const GET = withErrorHandler(
    (req: NextRequest, context: any) => getDealsByStockId(req, context)
);
