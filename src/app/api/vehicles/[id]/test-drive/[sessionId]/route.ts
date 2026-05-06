import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import TestDrive from '@/models/TestDrive';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string; sessionId: string }> };

async function updateSession(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id, sessionId } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    const update: any = {};

    if (body.action === 'end') {
        update.status = 'completed';
        update.endTime = new Date();
    }

    if (body.eSignatureDataUrl !== undefined) update.eSignatureDataUrl = body.eSignatureDataUrl;
    if (body.eSignedBy !== undefined) update.eSignedBy = body.eSignedBy;
    if (body.eSignedAt !== undefined) update.eSignedAt = new Date(body.eSignedAt);
    if (body.eSignedIp !== undefined) update.eSignedIp = body.eSignedIp;
    if (body.eSignedUserAgent !== undefined) update.eSignedUserAgent = body.eSignedUserAgent;

    const session = await TestDrive.findOneAndUpdate(
        { _id: sessionId, vehicleId: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: update },
        { returnDocument: 'after' }
    );
    if (!session) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, session });
}

async function deleteSession(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id, sessionId } = await context.params;
    await connectToDatabase();
    await TestDrive.deleteOne({ _id: sessionId, vehicleId: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) });
    return NextResponse.json({ ok: true });
}

export const PATCH  = withErrorHandler((req, ctx) => updateSession(req, ctx as any));
export const DELETE = withErrorHandler((req, ctx) => deleteSession(req, ctx as any));
