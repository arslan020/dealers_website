import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, signAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';

async function refreshHandler(req: NextRequest) {
    const refreshToken = req.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
        return NextResponse.json(
            { ok: false, error: { message: 'No refresh token found.', code: 'UNAUTHORIZED' } },
            { status: 401 }
        );
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
        return NextResponse.json(
            { ok: false, error: { message: 'Invalid or expired refresh token.', code: 'UNAUTHORIZED' } },
            { status: 401 }
        );
    }

    const newAccessToken = await signAccessToken({
        userId: payload.userId,
        role: payload.role,
        tenantId: payload.tenantId,
        name: payload.name,
        permissions: payload.permissions,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set('access_token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 4, // 4 hours
        path: '/',
    });

    return res;
}

export const POST = withErrorHandler(refreshHandler);
