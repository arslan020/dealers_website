import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SaleInvoice from '@/models/SaleInvoice';
import Customer from '@/models/Customer';
import Vehicle from '@/models/Vehicle';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

/* GET — list all orders */
async function getOrders(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    await connectToDatabase();

    const filter: Record<string, unknown> = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        type: 'order',
    };
    if (status) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length) filter.status = { $in: statuses };
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
        SaleInvoice.find(filter)
            .populate({ path: 'customerId', model: Customer, select: 'firstName lastName businessName email' })
            .populate({ path: 'vehicleId', model: Vehicle, select: 'vrm make model derivative stockId' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        SaleInvoice.countDocuments(filter),
    ]);

    let filtered = orders as any[];
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(o => {
            const customer = o.customerId as any;
            const name = `${customer?.firstName ?? ''} ${customer?.lastName ?? ''} ${customer?.businessName ?? ''}`.toLowerCase();
            const vehicle = o.vehicleId as any;
            const vrm = (vehicle?.vrm ?? o.vehicleVrm ?? '').toLowerCase();
            return o.invoiceNumber?.toLowerCase().includes(q) || name.includes(q) || vrm.includes(q);
        });
    }

    return NextResponse.json({ ok: true, orders: filtered, total, page, limit });
}

/* POST — create order */
async function createOrder(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    await connectToDatabase();

    let customerId = body.customerId;
    if (!customerId && body.customerDetails) {
        const c = await Customer.create({ ...body.customerDetails, tenantId: new mongoose.Types.ObjectId(tenantId) });
        customerId = c._id;
    }
    if (!customerId) return NextResponse.json({ ok: false, error: 'customerId required' }, { status: 400 });

    const count = await SaleInvoice.countDocuments({ tenantId: new mongoose.Types.ObjectId(tenantId) });
    const invoiceNumber = String(count + 1).padStart(6, '0');
    const today = new Date().toISOString().split('T')[0];

    const order = await SaleInvoice.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        customerId: new mongoose.Types.ObjectId(customerId),
        vehicleId: body.vehicleId ? new mongoose.Types.ObjectId(body.vehicleId) : undefined,
        vehicleVrm: body.vehicleVrm,
        type: 'order',
        invoiceCategory: body.invoiceCategory || 'sale',
        invoiceNumber,
        invoiceType: body.invoiceType || 'VAT Invoice',
        invoiceDate: body.invoiceDate || today,
        timeOfSupply: body.timeOfSupply,
        invoiceNotes: body.invoiceNotes,
        termsAndConditions: body.termsAndConditions,
        lineItems: body.lineItems || [],
        partExchanges: body.partExchanges || [],
        finance: body.finance,
        payments: [],
        credits: [],
        status: 'draft',
    });

    const populated = await SaleInvoice.findById(order._id)
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName businessName email phone' })
        .populate({ path: 'vehicleId', model: Vehicle, select: 'vrm make model derivative stockId' })
        .lean();

    return NextResponse.json({ ok: true, order: populated }, { status: 201 });
}

export const GET = withErrorHandler(getOrders);
export const POST = withErrorHandler(createOrder);
