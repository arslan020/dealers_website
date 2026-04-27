import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const ACCESS_SECRET = new TextEncoder().encode(
    process.env.JWT_ACCESS_SECRET || 'fallback-access-secret-change-in-prod'
);
const REFRESH_SECRET = new TextEncoder().encode(
    process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-change-in-prod'
);

export type TokenPayload = {
    userId: string;
    role: string;
    tenantId?: string;
    name?: string;
    permissions?: {
        vehicles: boolean;
        sales: boolean;
        tasks: boolean;
        analytics: boolean;
        advertising: boolean;
        inventory: boolean;
        canLookupAutoTrader?: boolean;
        canPublishAutoTrader?: boolean;
        canViewValuations?: boolean;
        canManageMessages?: boolean;
    };
};

// ─── Password Helpers ─────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

// ─── Token Helpers ────────────────────────────────────────────────────────────

export async function signAccessToken(payload: TokenPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('4h') // 4 hours
        .sign(ACCESS_SECRET);
}

export async function signRefreshToken(payload: TokenPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, ACCESS_SECRET);
        return payload as unknown as TokenPayload;
    } catch {
        return null;
    }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, REFRESH_SECRET);
        return payload as unknown as TokenPayload;
    } catch {
        return null;
    }
}
