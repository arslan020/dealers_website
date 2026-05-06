import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Product from '@/models/Product';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

async function getProduct(req: NextRequest, ctx: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    await connectToDatabase();
    const product = await Product.findOne({ _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) }).lean();
    if (!product) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, product });
}

async function updateProduct(req: NextRequest, ctx: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    const body = await req.json();
    await connectToDatabase();
    const product = await Product.findOneAndUpdate(
        { _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: body },
        { returnDocument: 'after' }
    ).lean();
    if (!product) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, product });
}

async function deleteProduct(req: NextRequest, ctx: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    await connectToDatabase();
    const result = await Product.deleteOne({ _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) });
    if (!result.deletedCount) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
}

export const GET = withErrorHandler((req, ctx: any) => getProduct(req, ctx));
export const PATCH = withErrorHandler((req, ctx: any) => updateProduct(req, ctx));
export const DELETE = withErrorHandler((req, ctx: any) => deleteProduct(req, ctx));
