import { cookies } from 'next/headers';
import { verifyAccessToken, TokenPayload } from './auth';

export type Session = TokenPayload;

// ─── Read session from cookies (server-side / RSC safe) ───────────────────────

export async function getSession(): Promise<Session | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value;
    if (!token) return null;
    return verifyAccessToken(token);
}

// ─── Guards ───────────────────────────────────────────────────────────────────

export function requireRole(session: Session | null, roles: string[]): session is Session {
    if (!session) return false;
    return roles.includes(session.role);
}

export function requireTenant(session: Session | null): string {
    if (!session?.tenantId) {
        throw new Error('tenantId is required for this action but was not found in session.');
    }
    return session.tenantId;
}
