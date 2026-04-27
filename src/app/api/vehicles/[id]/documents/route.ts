import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import VehicleDocument from '@/models/VehicleDocument';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

async function listDocuments(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: true, documents: [] });
    await connectToDatabase();
    const docs = await VehicleDocument.find(
        { tenantId: new mongoose.Types.ObjectId(tenantId), vehicleId: new mongoose.Types.ObjectId(id) },
        { fileData: 0 } // exclude binary from list
    ).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, documents: docs });
}

async function uploadDocument(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ ok: false, error: 'File too large (max 20MB)' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    await connectToDatabase();

    const doc = await VehicleDocument.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vehicleId: new mongoose.Types.ObjectId(id),
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        status: 'private',
        fileData: buffer,
    });

    return NextResponse.json({ ok: true, document: { _id: String(doc._id), name: doc.name, mimeType: doc.mimeType, size: doc.size, status: doc.status, createdAt: doc.createdAt } });
}

export const GET  = withErrorHandler((req, ctx) => listDocuments(req, ctx as any));
export const POST = withErrorHandler((req, ctx) => uploadDocument(req, ctx as any));
