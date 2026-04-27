import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import User from '@/models/User';
import { verifyAccessToken } from '@/lib/auth';
import mongoose from 'mongoose';

// PATCH /api/users/:id — DEALER_ADMIN: update employee
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session || session.role !== 'DEALER_ADMIN') {
            return NextResponse.json({ ok: false, error: { message: 'Forbidden.', code: 'FORBIDDEN' } }, { status: 403 });
        }

        const { id } = await params;
        const { isActive, permissions } = await req.json();

        console.log(`[PATCH /api/users/${id}] Request Body:`, { isActive, permissions });
        console.log(`[PATCH /api/users/${id}] Session Tenant:`, session.tenantId);

        await connectToDatabase();

        const updateData: any = {};
        if (isActive !== undefined) updateData.isActive = isActive;
        if (permissions !== undefined) updateData.permissions = permissions;

        // Use more robust matching and save method
        const user = await User.findOne({
            _id: new mongoose.Types.ObjectId(id),
            tenantId: new mongoose.Types.ObjectId(session.tenantId as string),
            role: 'EMPLOYEE'
        });

        if (!user) {
            console.log(`[PATCH /api/users/${id}] FAILED: User not found with given criteria.`);
            return NextResponse.json({ ok: false, error: { message: 'Employee not found in your tenant.', code: 'NOT_FOUND' } }, { status: 404 });
        }

        if (isActive !== undefined) user.isActive = isActive;
        if (permissions !== undefined) {
            console.log(`[PATCH /api/users/${id}] Setting permissions:`, permissions);
            user.permissions = permissions;
            user.markModified('permissions');
        }

        await user.save();
        console.log(`[PATCH /api/users/${id}] SUCCESS: Saved user:`, user._id);

        return NextResponse.json({ ok: true, user: { id: user._id, isActive: user.isActive, permissions: user.permissions } });
    } catch (error: any) {
        console.error('PATCH /api/users/[id] error:', error);
        return NextResponse.json({ ok: false, error: { message: error.message, code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
}
