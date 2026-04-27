import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SalesDocument from '@/models/SalesDocument';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

async function listDocuments(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();
    const docs = await SalesDocument.find(
        { tenantId: new mongoose.Types.ObjectId(tenantId) },
        { fileData: 0 }
    ).sort({ name: 1 }).lean();

    return NextResponse.json({ ok: true, documents: docs });
}

async function createDocument(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string | null)?.trim();
    const group = (formData.get('group') as string | null)?.trim() || undefined;
    const description = (formData.get('description') as string | null)?.trim() || undefined;

    if (!file) return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    if (!name) return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ ok: false, error: 'File too large (max 20 MB)' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    await connectToDatabase();

    const doc = await SalesDocument.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        name,
        group,
        description,
        mimeType: file.type || 'application/pdf',
        size: file.size,
        fileData: buffer,
    });

    return NextResponse.json(
        { ok: true, document: { _id: String(doc._id), name: doc.name, group: doc.group, description: doc.description, mimeType: doc.mimeType, size: doc.size, createdAt: doc.createdAt } },
        { status: 201 }
    );
}

export const GET  = withErrorHandler(listDocuments);
export const POST = withErrorHandler(createDocument);
