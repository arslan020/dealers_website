import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

type Params = { params: Promise<{ dealId: string }> };

/**
 * POST /api/deals/[dealId]/finance
 * Create a finance application for a deal.
 * AT docs: POST /finance/applications?advertiserId=
 * Minimum required: applicant.{title,firstName,lastName,email} + financeTerms.{productType,termMonths,estimatedAnnualMileage,cashPrice,deposit}
 * Capability: Finance Updates (BETA)
 */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const { dealId } = await params;
        const body = await req.json();

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.createFinanceApplication({ ...body, dealId });
        return NextResponse.json({ ok: true, application: result });
    } catch (err: any) {
        console.error('[Finance POST]', err.message, err.data);
        const msg = err.data ? JSON.stringify(err.data) : err.message;
        return NextResponse.json({ ok: false, error: msg }, { status: err.status || 500 });
    }
}

/**
 * GET /api/deals/[dealId]/finance?applicationId=xxx
 * Fetch a finance application by its ID.
 * AT docs: GET /finance/applications/{applicationId}?advertiserId=
 * Capability: Deal Sync (BETA)
 */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const applicationId = new URL(req.url).searchParams.get('applicationId');
        if (!applicationId) return NextResponse.json({ ok: false, error: 'applicationId query param required' }, { status: 400 });

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.getFinanceApplication(applicationId);
        return NextResponse.json({ ok: true, application: result });
    } catch (err: any) {
        console.error('[Finance GET]', err.message);
        return NextResponse.json({ ok: false, error: err.message }, { status: err.status || 500 });
    }
}
