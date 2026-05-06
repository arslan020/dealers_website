import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Tenant from '@/models/Tenant';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';

async function updateTenantConfig(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session || session.role !== 'DEALER_ADMIN') {
        return NextResponse.json({ ok: false, error: { message: 'Forbidden.', code: 'FORBIDDEN' } }, { status: 403 });
    }

    const { autoTraderConfig } = await req.json();

    if (!autoTraderConfig) {
        return NextResponse.json({ ok: false, error: { message: 'Config is missing.', code: 'VALIDATION_ERROR' } }, { status: 400 });
    }

    await connectToDatabase();

    const tenant = await Tenant.findByIdAndUpdate(
        session.tenantId,
        { $set: { autoTraderConfig } },
        { returnDocument: 'after' }
    );

    if (!tenant) {
        return NextResponse.json({ ok: false, error: { message: 'Tenant not found.', code: 'NOT_FOUND' } }, { status: 404 });
    }

    return NextResponse.json({ ok: true, config: tenant.autoTraderConfig });
}

export const PATCH = withErrorHandler(updateTenantConfig);

