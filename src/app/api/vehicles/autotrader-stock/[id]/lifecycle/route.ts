import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * PATCH /api/vehicles/autotrader-stock/[id]/lifecycle
 * Changes the lifecycle state of a stock item on AutoTrader.
 * Body: { lifecycleState: 'FORECOURT' | 'SALE_IN_PROGRESS' | 'SOLD' | 'WASTEBIN' | 'DUE_IN' | 'DELETED' }
 * Capability: Availability Updates
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
        const { lifecycleState } = body;

        const validStates = ['DUE_IN', 'FORECOURT', 'SALE_IN_PROGRESS', 'SOLD', 'WASTEBIN', 'DELETED'];
        if (!lifecycleState || !validStates.includes(lifecycleState)) {
            return NextResponse.json({
                ok: false,
                error: {
                    message: `Invalid lifecycleState. Must be one of: ${validStates.join(', ')}`,
                    code: 'VALIDATION_ERROR',
                }
            }, { status: 400 });
        }

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.updateLifecycleState(stockId, lifecycleState);

        return NextResponse.json({ ok: true, result });
    } catch (error: any) {
        console.error('[AT Lifecycle Update]', error.message);
        return NextResponse.json({ ok: false, error: { message: error.message || 'Failed to update lifecycle.' } }, { status: 500 });
    }
}
