import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import User from '@/models/User';
import Tenant from '@/models/Tenant';
import { comparePassword, signAccessToken, signRefreshToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';

async function loginHandler(req: NextRequest) {
    const { email, password } = await req.json();

    if (!email || !password) {
        return NextResponse.json(
            { ok: false, error: { message: 'Email and password are required.', code: 'VALIDATION_ERROR' } },
            { status: 400 }
        );
    }

    await connectToDatabase();

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) {
        return NextResponse.json(
            { ok: false, error: { message: 'Invalid credentials or account is inactive.', code: 'UNAUTHORIZED' } },
            { status: 401 }
        );
    }

    // Verify password
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
        return NextResponse.json(
            { ok: false, error: { message: 'Invalid credentials.', code: 'UNAUTHORIZED' } },
            { status: 401 }
        );
    }

    // For dealer roles: check tenant exists and is active
    if (user.role !== 'SUPER_ADMIN') {
        if (!user.tenantId) {
            return NextResponse.json(
                { ok: false, error: { message: 'No dealership associated with this account.', code: 'NO_TENANT' } },
                { status: 403 }
            );
        }
        const tenant = await Tenant.findById(user.tenantId);
        if (!tenant || tenant.status === 'suspended') {
            return NextResponse.json(
                { ok: false, error: { message: 'Your dealership account is suspended.', code: 'TENANT_SUSPENDED' } },
                { status: 403 }
            );
        }
    }

    const tokenPayload = {
        userId: user._id.toString(),
        role: user.role,
        tenantId: user.tenantId?.toString(),
        name: user.name,
        permissions: user.permissions,
    };

    const accessToken = await signAccessToken(tokenPayload);
    const refreshToken = await signRefreshToken(tokenPayload);

    const res = NextResponse.json({
        ok: true,
        role: user.role,
        tenantId: user.tenantId?.toString() ?? null,
    });

    // Set HTTP-only cookies
    res.cookies.set('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 4, // 4 hours
        path: '/',
    });

    res.cookies.set('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
    });

    return res;
}

export const POST = withErrorHandler(loginHandler);
