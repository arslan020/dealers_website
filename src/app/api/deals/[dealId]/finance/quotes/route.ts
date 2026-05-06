import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * POST /api/deals/[dealId]/finance/quotes?applicationId=xxx
 * Generate personalised lender quotes for a finance application.
 * AT docs: POST /finance/applications/{applicationId}/quotes?advertiserId=
 * Returns up to 3 lender quotes. Application status becomes "Quoted".
 * Note: consent.softCheck must be set before calling this.
 * Capability: Finance Updates (BETA)
 */
export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const applicationId = new URL(req.url).searchParams.get('applicationId');
        if (!applicationId) return NextResponse.json({ ok: false, error: 'applicationId query param required' }, { status: 400 });

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.getFinanceQuotes(applicationId);
        // AT returns an array of quotes or a single object — normalise to array
        const quotes = Array.isArray(result) ? result : result?.results ?? (result ? [result] : []);
        return NextResponse.json({ ok: true, quotes });
    } catch (err: any) {
        console.error('[Finance Quotes POST]', err.message, err.data);
        const msg = err.data ? JSON.stringify(err.data) : err.message;
        return NextResponse.json({ ok: false, error: msg }, { status: err.status || 500 });
    }
}
