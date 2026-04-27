import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import User from '@/models/User';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

/** GET /api/users/staff — tenant users (dealer admin + employees) for assignment pickers */
async function getStaffHandler(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' } }, { status: 401 });
    }
    if (session.role !== 'DEALER_ADMIN' && session.role !== 'EMPLOYEE') {
        return NextResponse.json({ ok: false, error: { message: 'Forbidden.', code: 'FORBIDDEN' } }, { status: 403 });
    }

    await connectToDatabase();

    const rows = await User.find({
        tenantId: new mongoose.Types.ObjectId(session.tenantId as string),
        role: { $in: ['DEALER_ADMIN', 'EMPLOYEE'] },
        isActive: { $ne: false },
    })
        .select('name email role')
        .sort({ name: 1 })
        .lean();

    const staff = rows.map((u: any) => ({
        _id: String(u._id),
        name: u.name || '',
        email: u.email || '',
        role: u.role as string,
    }));

    return NextResponse.json({ ok: true, staff });
}

export const GET = withErrorHandler(getStaffHandler);
