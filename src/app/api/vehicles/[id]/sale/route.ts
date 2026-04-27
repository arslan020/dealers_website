import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SaleInvoice from '@/models/SaleInvoice';
import Vehicle from '@/models/Vehicle';
import Customer from '@/models/Customer';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

/* GET — fetch active sale invoice for this vehicle */
async function getSale(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: true, sale: null });
    await connectToDatabase();

    const sale = await SaleInvoice.findOne({
        vehicleId: new mongoose.Types.ObjectId(id),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: { $ne: 'void' },
    })
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName email phone' })
        .sort({ createdAt: -1 })
        .lean();

    return NextResponse.json({ ok: true, sale: sale || null });
}

/* POST — create new invoice/order */
async function createSale(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    // Check no active sale exists
    const existing = await SaleInvoice.findOne({
        vehicleId: new mongoose.Types.ObjectId(id),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: { $ne: 'void' },
    });
    if (existing) {
        return NextResponse.json({ ok: false, error: 'An active sale already exists for this vehicle' }, { status: 409 });
    }

    let customerId = body.customerId;
    if (!customerId && body.customerDetails) {
        const c = await Customer.create({ ...body.customerDetails, tenantId: new mongoose.Types.ObjectId(tenantId) });
        customerId = c._id;
    }
    if (!customerId) return NextResponse.json({ ok: false, error: 'customerId required' }, { status: 400 });

    const count = await SaleInvoice.countDocuments({ tenantId: new mongoose.Types.ObjectId(tenantId) });
    const invoiceNumber = String(count + 1).padStart(6, '0');

    const today = new Date().toISOString().split('T')[0];

    const sale = await SaleInvoice.create({
        vehicleId: new mongoose.Types.ObjectId(id),
        customerId: new mongoose.Types.ObjectId(customerId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        type: body.type || 'invoice',
        invoiceNumber,
        invoiceType: body.invoiceType || 'Margin Scheme',
        invoiceDate: body.invoiceDate || today,
        timeOfSupply: body.timeOfSupply,
        invoiceNotes: body.invoiceNotes,
        lineItems: body.lineItems || [],
        partExchanges: body.partExchanges || [],
        finance: body.finance,
        payments: [],
        status: 'draft',
    });

    const populated = await SaleInvoice.findById(sale._id)
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName email phone' })
        .lean();

    return NextResponse.json({ ok: true, sale: populated }, { status: 201 });
}

/* PATCH — update sale: issue, add payment, mark paid, handover */
async function updateSale(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    const sale = await SaleInvoice.findOne({
        vehicleId: new mongoose.Types.ObjectId(id),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: { $ne: 'void' },
    });
    if (!sale) return NextResponse.json({ ok: false, error: 'Sale not found' }, { status: 404 });

    // Issue
    if (body.action === 'issue') {
        sale.status = 'issued';
        sale.issuedAt = new Date();
    }

    // Add payment
    if (body.action === 'addPayment' && body.payment) {
        sale.payments.push(body.payment);
    }

    // Mark paid
    if (body.action === 'markPaid') {
        if (body.payment) sale.payments.push(body.payment);
        sale.status = 'paid';
        sale.paidAt = new Date();
        // Mark vehicle as sold
        await Vehicle.updateOne(
            { _id: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) },
            { $set: { status: 'Sold' } }
        );
    }

    // Handover complete
    if (body.action === 'handover') {
        sale.handoverComplete = true;
        sale.handoverAt = new Date();
    }

    // Void
    if (body.action === 'void') {
        sale.status = 'void';
        await Vehicle.updateOne(
            { _id: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) },
            { $set: { status: 'In Stock' } }
        );
    }

    await sale.save();

    const populated = await SaleInvoice.findById(sale._id)
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName email phone' })
        .lean();

    return NextResponse.json({ ok: true, sale: populated });
}

export const GET = withErrorHandler((req: NextRequest, ctx: any) => getSale(req, ctx));
export const POST = withErrorHandler((req: NextRequest, ctx: any) => createSale(req, ctx));
export const PATCH = withErrorHandler((req: NextRequest, ctx: any) => updateSale(req, ctx));
