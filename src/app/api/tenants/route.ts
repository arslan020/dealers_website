import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Tenant from '@/models/Tenant';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';

// GET /api/tenants — SUPER_ADMIN only
async function getTenantsHandler(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;
    if (!session || session.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ ok: false, error: { message: 'Forbidden.', code: 'FORBIDDEN' } }, { status: 403 });
    }

    await connectToDatabase();
    const tenants = await Tenant.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, tenants });
}

// POST /api/tenants — SUPER_ADMIN creates a new tenant + dealer admin
async function createTenantHandler(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;
    if (!session || session.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ ok: false, error: { message: 'Forbidden.', code: 'FORBIDDEN' } }, { status: 403 });
    }

    const { name, plan, adminName, adminEmail, adminPassword, atDealerId } = await req.json();

    if (!name || !adminName || !adminEmail || !adminPassword) {
        return NextResponse.json(
            { ok: false, error: { message: 'name, adminName, adminEmail, adminPassword are required.', code: 'VALIDATION_ERROR' } },
            { status: 400 }
        );
    }

    await connectToDatabase();

    // Create tenant
    const tenantData: any = {
        name,
        plan: plan || 'trial',
        status: 'active',
        createdBy: session.userId,
    };

    if (atDealerId) {
        tenantData.autoTraderConfig = {
            dealerId: atDealerId
        };
    }

    const tenant = await Tenant.create(tenantData);

    // Create the dealer admin user for this tenant
    const passwordHash = await hashPassword(adminPassword);
    const adminUser = await User.create({
        email: adminEmail,
        passwordHash,
        name: adminName,
        role: 'DEALER_ADMIN',
        tenantId: tenant._id,
    });

    return NextResponse.json({
        ok: true,
        tenant,
        adminUser: { id: adminUser._id, email: adminUser.email, name: adminUser.name },
    }, { status: 201 });
}

export const GET = withErrorHandler(getTenantsHandler);
export const POST = withErrorHandler(createTenantHandler);
