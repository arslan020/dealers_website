import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * PATCH /api/vehicles/autotrader-stock/[id]/update
 * Updates any fields on an existing AT stock record (price, description, colour, etc.)
 * Body: partial stock payload matching AT schema (vehicle, adverts, media etc.)
 * Capability: Stock Updates | Price Updates
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;

        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
        }

        const { id: stockId } = await params;
        const body = await req.json();

        if (!body || Object.keys(body).length === 0) {
            return NextResponse.json({ ok: false, error: { message: 'Request body is empty.', code: 'VALIDATION_ERROR' } }, { status: 400 });
        }

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.updateStock(stockId, body);

        return NextResponse.json({ ok: true, result });
    } catch (error: any) {
        console.error('[AT Update Stock]', error.message);
        return NextResponse.json({ ok: false, error: { message: error.message || 'Failed to update stock.' } }, { status: 500 });
    }
}
