import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import User from '@/models/User';
import { hashPassword, verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

// GET /api/users — DEALER_ADMIN: list employees in their tenant
async function getUsersHandler(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;
    if (!session || session.role !== 'DEALER_ADMIN') {
        return NextResponse.json({ ok: false, error: { message: 'Forbidden.', code: 'FORBIDDEN' } }, { status: 403 });
    }

    await connectToDatabase();

    const users = await User.find({
        tenantId: new mongoose.Types.ObjectId(session.tenantId as string),
        role: 'EMPLOYEE'
    })
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .lean();

    // Unified permission defaults
    const defaultPermissions = {
        vehicles: true,
        sales: true,
        tasks: true,
        analytics: true,
        advertising: true,
        inventory: true,
        addVehicle: true,
        quickCheck: true,
    };

    const sanitizedUsers = users.map((u: any) => {
        const merged = { ...defaultPermissions, ...u.permissions };
        console.log(`[GET /api/users] User ${u.email} permissions:`, { db: u.permissions, merged });
        return {
            ...u,
            permissions: merged
        };
    });

    return NextResponse.json({ ok: true, users: sanitizedUsers });
}

// POST /api/users — DEALER_ADMIN: create employee in their tenant
async function createUserHandler(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;
    if (!session || session.role !== 'DEALER_ADMIN') {
        return NextResponse.json({ ok: false, error: { message: 'Forbidden.', code: 'FORBIDDEN' } }, { status: 403 });
    }

    const { name, email, password, phone, permissions } = await req.json();

    if (!name || !email || !password) {
        return NextResponse.json(
            { ok: false, error: { message: 'name, email, password are required.', code: 'VALIDATION_ERROR' } },
            { status: 400 }
        );
    }

    await connectToDatabase();

    const passwordHash = await hashPassword(password);
    const user = await User.create({
        name,
        email,
        passwordHash,
        phone,
        role: 'EMPLOYEE',
        tenantId: session.tenantId, // Always from session — not client
        permissions: permissions || {
            vehicles: true,
            sales: true,
            tasks: true,
            analytics: true,
            advertising: true,
            inventory: true,
            addVehicle: true,
            quickCheck: true,
        }
    });

    return NextResponse.json({
        ok: true,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
    }, { status: 201 });
}

export const GET = withErrorHandler(getUsersHandler);
export const POST = withErrorHandler(createUserHandler);
