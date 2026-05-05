import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Tenant from '@/models/Tenant';
import { withErrorHandler } from '@/lib/api-handler';

async function meHandler(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;

    if (!token) {
        return NextResponse.json(
            { ok: false, error: { message: 'Not authenticated.', code: 'UNAUTHORIZED' } },
            { status: 401 }
        );
    }

    const session = await verifyAccessToken(token);
    if (!session) {
        return NextResponse.json(
            { ok: false, error: { message: 'Invalid or expired token.', code: 'UNAUTHORIZED' } },
            { status: 401 }
        );
    }

    let tenantName: string | null = null;
    let dealerPostcode: string | null = null;
    if (session.tenantId) {
        await connectToDatabase();
        const tenant = await Tenant.findById(session.tenantId).select('name autoTraderConfig businessProfile');
        tenantName = tenant?.name ?? null;
        dealerPostcode =
            (tenant as any)?.autoTraderConfig?.postcode ||
            (tenant as any)?.businessProfile?.postcode ||
            null;
    }

    return NextResponse.json({
        ok: true,
        session: {
            userId: session.userId,
            role: session.role,
            tenantId: session.tenantId ?? null,
            tenantName,
            name: session.name ?? null,
            dealerPostcode,
        },
    });
}

export const GET = withErrorHandler(meHandler);
