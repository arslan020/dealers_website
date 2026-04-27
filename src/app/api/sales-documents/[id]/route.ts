import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SalesDocument from '@/models/SalesDocument';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

async function getDocument(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    await connectToDatabase();
    const doc = await SalesDocument.findOne(
        { _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) },
        { fileData: 0 }
    ).lean();
    if (!doc) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, document: doc });
}

async function updateDocument(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.group !== undefined) update.group = body.group ? String(body.group).trim() : undefined;
    if (body.description !== undefined) update.description = body.description ? String(body.description).trim() : undefined;

    const doc = await SalesDocument.findOneAndUpdate(
        { _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: update },
        { new: true, projection: { fileData: 0 } }
    );
    if (!doc) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, document: doc });
}

async function deleteDocument(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    await connectToDatabase();
    await SalesDocument.deleteOne({ _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) });
    return NextResponse.json({ ok: true });
}

export const GET    = withErrorHandler((req, ctx) => getDocument(req, ctx as any));
export const PUT    = withErrorHandler((req, ctx) => updateDocument(req, ctx as any));
export const DELETE = withErrorHandler((req, ctx) => deleteDocument(req, ctx as any));
