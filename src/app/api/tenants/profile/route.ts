import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Tenant from '@/models/Tenant';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function getProfile(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    await connectToDatabase();
    const tenant = await Tenant.findById(new mongoose.Types.ObjectId(tenantId)).lean();
    if (!tenant) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, profile: (tenant as any).businessProfile ?? {}, name: (tenant as any).name });
}

async function updateProfile(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    await connectToDatabase();
    const tenant = await Tenant.findByIdAndUpdate(
        new mongoose.Types.ObjectId(tenantId),
        { $set: { businessProfile: body } },
        { returnDocument: 'after' }
    ).lean();
    if (!tenant) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, profile: (tenant as any).businessProfile ?? {} });
}

export const GET = withErrorHandler(getProfile);
export const PATCH = withErrorHandler(updateProfile);

