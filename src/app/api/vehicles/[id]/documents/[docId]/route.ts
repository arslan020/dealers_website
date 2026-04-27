import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import VehicleDocument from '@/models/VehicleDocument';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string; docId: string }> };

async function patchDocument(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id, docId } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    const doc = await VehicleDocument.findOneAndUpdate(
        { _id: docId, vehicleId: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: { ...(body.name !== undefined && { name: body.name }), ...(body.description !== undefined && { description: body.description }), ...(body.status !== undefined && { status: body.status }) } },
        { new: true, projection: { fileData: 0 } }
    );
    if (!doc) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, document: doc });
}

async function deleteDocument(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id, docId } = await context.params;
    await connectToDatabase();
    await VehicleDocument.deleteOne({ _id: docId, vehicleId: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) });
    return NextResponse.json({ ok: true });
}

async function downloadDocument(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return new NextResponse('Unauthorized', { status: 401 });
    const { id, docId } = await context.params;
    await connectToDatabase();
    const doc = await VehicleDocument.findOne({ _id: docId, vehicleId: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) });
    if (!doc) return new NextResponse('Not found', { status: 404 });
    return new NextResponse(doc.fileData, {
        headers: {
            'Content-Type': doc.mimeType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.name)}"`,
            'Content-Length': String(doc.size),
        },
    });
}

export const GET    = withErrorHandler((req, ctx) => downloadDocument(req, ctx as any));
export const PATCH  = withErrorHandler((req, ctx) => patchDocument(req, ctx as any));
export const DELETE = withErrorHandler((req, ctx) => deleteDocument(req, ctx as any));
