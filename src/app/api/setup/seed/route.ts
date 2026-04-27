import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth';

// This route only works in development to seed the first SUPER_ADMIN
export async function POST(req: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ ok: false, error: { message: 'Forbidden in production.', code: 'FORBIDDEN' } }, { status: 403 });
    }

    const { name, email, password, secret } = await req.json();

    // Basic guard to prevent accidental seeding
    if (secret !== process.env.SEED_SECRET) {
        return NextResponse.json({ ok: false, error: { message: 'Invalid secret.', code: 'FORBIDDEN' } }, { status: 403 });
    }

    await connectToDatabase();

    const existing = await User.findOne({ role: 'SUPER_ADMIN' });
    if (existing) {
        return NextResponse.json({ ok: false, error: { message: 'Super admin already exists.', code: 'CONFLICT' } }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email, passwordHash, role: 'SUPER_ADMIN', tenantId: null });

    return NextResponse.json({
        ok: true,
        message: 'Super Admin created!',
        user: { id: user._id, email: user.email, name: user.name, role: user.role },
    }, { status: 201 });
}
