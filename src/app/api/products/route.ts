import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Product from '@/models/Product';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function listProducts(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    await connectToDatabase();
    const url = new URL(req.url);
    const search = url.searchParams.get('search') ?? '';
    const limit = parseInt(url.searchParams.get('limit') ?? '100');

    const query: Record<string, any> = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    if (search) query.name = { $regex: search, $options: 'i' };

    const products = await Product.find(query).sort({ name: 1 }).limit(limit).lean();

    const mapped = products.map((p: any) => ({
        ...p,
        price: p.priceExcVat,
        vatRate: p.vatRate,
        variants: p.optionsType !== 'No Options' && p.options?.length
            ? p.options.map((o: any) => ({ name: o.name, price: o.priceExcVat, vatRate: o.vatRate ?? p.vatRate }))
            : undefined,
    }));

    return NextResponse.json({ ok: true, products: mapped });
}

async function createProduct(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ ok: false, error: 'Name required' }, { status: 400 });
    await connectToDatabase();
    const product = await Product.create({ ...body, tenantId: new mongoose.Types.ObjectId(tenantId) });
    return NextResponse.json({ ok: true, product }, { status: 201 });
}

export const GET = withErrorHandler(listProducts);
export const POST = withErrorHandler(createProduct);
