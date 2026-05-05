import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { AutoTraderClient } from '@/lib/autotrader';
import { withErrorHandler } from '@/lib/api-handler';

const CHANNEL_KEY_MAP: Record<string, string> = {
    autotrader: 'autotraderAdvert',
    advertiser: 'advertiserAdvert',
    locator:    'locatorAdvert',
    export:     'exportAdvert',
    profile:    'profileAdvert',
};

// Reverse map: AT key → local status field
const AT_KEY_TO_LOCAL: Record<string, string> = {
    autotraderAdvert:  'atAdvertStatus',
    advertiserAdvert:  'advertiserAdvertStatus',
    locatorAdvert:     'locatorAdvertStatus',
    exportAdvert:      'exportAdvertStatus',
    profileAdvert:     'profileAdvertStatus',
};

/**
 * PATCH /api/vehicles/autotrader-stock/[id]/advertise
 *
 * Accepts all 5 channels in one request and sends a single PATCH to AT.
 * Returns actual AT statuses (PUBLISHED | NOT_PUBLISHED | CAPPED | REJECTED)
 * so the caller can display CAPPED/REJECTED feedback and update local DB.
 *
 * Body: {
 *   channels: {
 *     autotrader?: 'PUBLISHED' | 'NOT_PUBLISHED',
 *     advertiser?: 'PUBLISHED' | 'NOT_PUBLISHED',
 *     locator?:    'PUBLISHED' | 'NOT_PUBLISHED',
 *     export?:     'PUBLISHED' | 'NOT_PUBLISHED',
 *     profile?:    'PUBLISHED' | 'NOT_PUBLISHED',
 *   }
 * }
 *
 * Capability: Stock Updates
 */
async function updateAdvertisingStatus(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: stockId } = await params;
    const body = await req.json();
    const { channels } = body;

    if (!channels || typeof channels !== 'object' || Object.keys(channels).length === 0) {
        return NextResponse.json({ ok: false, error: 'channels object is required' }, { status: 400 });
    }

    // Validate statuses
    for (const [ch, status] of Object.entries(channels)) {
        if (!CHANNEL_KEY_MAP[ch]) {
            return NextResponse.json({ ok: false, error: `Invalid channel: ${ch}` }, { status: 400 });
        }
        if (status !== 'PUBLISHED' && status !== 'NOT_PUBLISHED') {
            return NextResponse.json({ ok: false, error: `Invalid status for ${ch}: ${status}` }, { status: 400 });
        }
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // Build single retailAdverts patch with all requested channels
        const retailAdverts: Record<string, { status: string }> = {};
        for (const [ch, status] of Object.entries(channels)) {
            retailAdverts[CHANNEL_KEY_MAP[ch]] = { status: status as string };
        }

        const result = await client.patch(
            `/stock/${stockId}`,
            { adverts: { retailAdverts } },
            { advertiserId: client.dealerId! }
        );

        // Extract actual statuses AT returned (may be CAPPED or REJECTED)
        const atRetailAdverts = result?.adverts?.retailAdverts || {};
        const actualStatuses: Record<string, string> = {};
        const warnings: { channel: string; status: string; message?: string }[] = [];

        for (const [atKey, localKey] of Object.entries(AT_KEY_TO_LOCAL)) {
            const atAdvert = atRetailAdverts[atKey];
            if (!atAdvert) continue;
            const actualStatus = atAdvert.status;
            actualStatuses[localKey] = actualStatus;

            // Flag CAPPED or REJECTED back to caller
            if (actualStatus === 'CAPPED' || actualStatus === 'REJECTED') {
                warnings.push({
                    channel: atKey,
                    status: actualStatus,
                    message: atAdvert.message || undefined,
                });
            }
        }

        return NextResponse.json({ ok: true, result, actualStatuses, warnings });
    } catch (error: any) {
        console.error(`[AutoTrader Advertise] StockId: ${stockId}`, error.message);
        return NextResponse.json({
            ok: false,
            error: error.message || 'Failed to update advertising status',
        }, { status: 500 });
    }
}

export const PATCH = withErrorHandler(updateAdvertisingStatus);
