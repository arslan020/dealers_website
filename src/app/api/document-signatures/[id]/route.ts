import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import DocumentSignature from '@/models/DocumentSignature';
import Customer from '@/models/Customer';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

async function getSignature(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    await connectToDatabase();

    const sig = await DocumentSignature.findOne({ _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) })
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName businessName email' })
        .lean();

    if (!sig) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, signature: sig });
}

async function updateSignature(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    const update: Record<string, unknown> = {};
    if (body.status === 'signed') { update.status = 'signed'; update.signedAt = new Date(); }
    else if (body.status === 'declined') { update.status = 'declined'; update.declinedAt = new Date(); }

    const sig = await DocumentSignature.findOneAndUpdate(
        { _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: update },
        { new: true }
    );
    if (!sig) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, signature: sig });
}

export const GET   = withErrorHandler((req, ctx) => getSignature(req, ctx as any));
export const PATCH = withErrorHandler((req, ctx) => updateSignature(req, ctx as any));
