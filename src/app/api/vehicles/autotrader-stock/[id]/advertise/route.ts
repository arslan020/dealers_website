import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { AutoTraderClient } from '@/lib/autotrader';
import { withErrorHandler } from '@/lib/api-handler';

async function updateAdvertisingStatus(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSession();
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: stockId } = params;
    const body = await req.json();
    const { channel = 'autotrader', status } = body;

    if (!status) {
        return NextResponse.json({ ok: false, error: 'Status is required' }, { status: 400 });
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.updateStockAdvertiseStatus(stockId, channel, status);

        return NextResponse.json({ ok: true, result });
    } catch (error: any) {
        console.error(`[AutoTrader Advertise API Error] StockId: ${stockId}`, error);
        return NextResponse.json({ 
            ok: false, 
            error: error.message || 'Failed to update advertising status' 
        }, { status: 500 });
    }
}

export const PATCH = withErrorHandler(updateAdvertisingStatus);
