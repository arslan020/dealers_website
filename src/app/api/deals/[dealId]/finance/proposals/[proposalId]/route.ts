import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

type Params = { params: Promise<{ dealId: string; proposalId: string }> };

/**
 * PATCH /api/deals/[dealId]/finance/proposals/[proposalId]?applicationId=xxx
 * Update a finance proposal:
 *   - Set active:   body = { active: true }
 *   - Mark paid out: body = { paidOutDate: "YYYY-MM-DD" }
 * AT docs: PATCH /finance/applications/{applicationId}/proposals/{proposalId}?advertiserId=
 * Note: paidOutDate cannot be set when proposal status is BROKER_APPROVED.
 * Capability: Finance Updates (BETA)
 */
export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const applicationId = new URL(req.url).searchParams.get('applicationId');
        if (!applicationId) return NextResponse.json({ ok: false, error: 'applicationId required' }, { status: 400 });

        const { proposalId } = await params;
        const body = await req.json();

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.updateFinanceProposal(applicationId, proposalId, body);
        return NextResponse.json({ ok: true, proposal: result });
    } catch (err: any) {
        console.error('[Proposal PATCH]', err.message, err.data);
        const msg = err.data ? JSON.stringify(err.data) : err.message;
        return NextResponse.json({ ok: false, error: msg }, { status: err.status || 500 });
    }
}
