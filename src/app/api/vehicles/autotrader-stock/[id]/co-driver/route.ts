import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { AutoTraderClient } from '@/lib/autotrader';
import { withErrorHandler } from '@/lib/api-handler';

async function generateDescription(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: stockId } = await params;

    const client = new AutoTraderClient(session.tenantId);
    await client.init();

    const description = await client.generateCoDriverDescription(stockId);

    if (!description) {
        return NextResponse.json(
            { ok: false, error: 'Co-Driver returned no description. Ensure derivativeId, firstRegistrationDate and batteryRangeMiles (EV only) are set on this stock item.' },
            { status: 422 }
        );
    }

    return NextResponse.json({ ok: true, description });
}

export const POST = withErrorHandler(generateDescription);
