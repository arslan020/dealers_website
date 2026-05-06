import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * GET /api/deals/[dealId]/finance/proposals?applicationId=xxx
 * List all proposals for a finance application.
 * AT docs: GET /finance/applications/{applicationId}/proposals?advertiserId=
 * Capability: Finance Updates (BETA)
 */
export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const applicationId = new URL(req.url).searchParams.get('applicationId');
        if (!applicationId) return NextResponse.json({ ok: false, error: 'applicationId required' }, { status: 400 });

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.getFinanceProposals(applicationId);
        const proposals = Array.isArray(result) ? result : result?.results ?? [];
        return NextResponse.json({ ok: true, proposals });
    } catch (err: any) {
        console.error('[Proposals GET]', err.message);
        return NextResponse.json({ ok: false, error: err.message }, { status: err.status || 500 });
    }
}

/**
 * POST /api/deals/[dealId]/finance/proposals?applicationId=xxx
 * Send a new proposal to a lender using a quoteId.
 * AT docs: POST /finance/applications/{applicationId}/proposals?advertiserId=
 * Body: { quoteId }
 * Capability: Finance Updates (BETA)
 */
export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const applicationId = new URL(req.url).searchParams.get('applicationId');
        if (!applicationId) return NextResponse.json({ ok: false, error: 'applicationId required' }, { status: 400 });

        const { quoteId } = await req.json();
        if (!quoteId) return NextResponse.json({ ok: false, error: 'quoteId required' }, { status: 400 });

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.sendFinanceProposal(applicationId, quoteId);
        return NextResponse.json({ ok: true, proposal: result });
    } catch (err: any) {
        console.error('[Proposals POST]', err.message, err.data);
        const msg = err.data ? JSON.stringify(err.data) : err.message;
        return NextResponse.json({ ok: false, error: msg }, { status: err.status || 500 });
    }
}
