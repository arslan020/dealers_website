import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

// Protect all /app/* and /api/* routes — edge-safe (no MongoDB calls)
export const config = {
    matcher: ['/app/:path*', '/api/:path*'],
};

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Public API routes that don't need authentication
    const isPublicApi = pathname.startsWith('/api/auth/login') ||
        pathname.startsWith('/api/auth/refresh') ||
        pathname.startsWith('/api/health') ||
        pathname.startsWith('/api/setup');

    if (isPublicApi) {
        return NextResponse.next();
    }

    const token = req.cookies.get('access_token')?.value;

    if (!token) {
        // For API routes, return 401 instead of redirecting
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('callbackUrl', pathname + (req.nextUrl.search || ''));
        return NextResponse.redirect(loginUrl);
    }

    const session = await verifyAccessToken(token);
    if (!session) {
        // For API routes, return 401
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        // Token invalid or expired — clear cookies and redirect to login
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('expired', 'true');
        loginUrl.searchParams.set('callbackUrl', pathname + (req.nextUrl.search || ''));
        const res = NextResponse.redirect(loginUrl);
        res.cookies.set('access_token', '', { maxAge: 0, path: '/' });
        return res;
    }

    // Inject session info into request headers for downstream use
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', session.userId);
    requestHeaders.set('x-user-role', session.role);
    if (session.tenantId) {
        requestHeaders.set('x-tenant-id', session.tenantId);
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
}
