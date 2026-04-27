import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SaleInvoice from '@/models/SaleInvoice';
import Customer from '@/models/Customer';
import Vehicle from '@/models/Vehicle';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

/* GET — list all invoices (type=invoice) with filters */
async function getInvoices(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const issuedFrom = searchParams.get('issuedFrom') || '';
    const issuedTo = searchParams.get('issuedTo') || '';
    const paidFrom = searchParams.get('paidFrom') || '';
    const paidTo = searchParams.get('paidTo') || '';

    await connectToDatabase();

    const filter: Record<string, unknown> = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        type: 'invoice',
    };

    if (status) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length) filter.status = { $in: statuses };
    }
    if (issuedFrom || issuedTo) {
        const range: Record<string, string> = {};
        if (issuedFrom) range.$gte = issuedFrom;
        if (issuedTo) range.$lte = issuedTo;
        filter.invoiceDate = range;
    }
    if (paidFrom || paidTo) {
        const range: Record<string, Date> = {};
        if (paidFrom) range.$gte = new Date(paidFrom);
        if (paidTo) range.$lte = new Date(paidTo);
        filter.paidAt = range;
    }

    const skip = (page - 1) * limit;

    let query = SaleInvoice.find(filter)
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName businessName email' })
        .populate({ path: 'vehicleId', model: Vehicle, select: 'vrm make model derivative stockId' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const [invoices, total] = await Promise.all([
        query,
        SaleInvoice.countDocuments(filter),
    ]);

    // Filter by search after populate
    let filtered = invoices as any[];
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(inv => {
            const customer = inv.customerId as any;
            const vehicle = inv.vehicleId as any;
            const customerName = `${customer?.firstName ?? ''} ${customer?.lastName ?? ''} ${customer?.businessName ?? ''}`.toLowerCase();
            const vrm = (vehicle?.vrm ?? inv.vehicleVrm ?? '').toLowerCase();
            return (
                inv.invoiceNumber?.toLowerCase().includes(q) ||
                customerName.includes(q) ||
                vrm.includes(q)
            );
        });
    }

    return NextResponse.json({ ok: true, invoices: filtered, total, page, limit });
}

/* POST — create standalone invoice (not tied to vehicle via sell-vehicle flow) */
async function createInvoice(req: NextRequest) {
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

    const invoice = await SaleInvoice.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        customerId: new mongoose.Types.ObjectId(customerId),
        vehicleId: body.vehicleId ? new mongoose.Types.ObjectId(body.vehicleId) : undefined,
        vehicleVrm: body.vehicleVrm,
        type: 'invoice',
        invoiceCategory: body.invoiceCategory || 'sale',
        invoiceNumber,
        invoiceType: body.invoiceType || 'VAT Invoice',
        invoiceDate: body.invoiceDate || today,
        timeOfSupply: body.timeOfSupply,
        invoiceNotes: body.invoiceNotes,
        termsAndConditions: body.termsAndConditions,
        lineItems: (body.lineItems || []).map((item: any) => ({
            ...item,
            vatRate: item.vatRate === '20% VAT' ? '20%' : item.vatRate === '5% VAT' ? '5%' : (item.vatRate ?? 'No VAT'),
        })),
        partExchanges: body.partExchanges || [],
        finance: body.finance,
        payments: [],
        credits: [],
        status: 'draft',
    });

    const populated = await SaleInvoice.findById(invoice._id)
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName businessName email phone' })
        .populate({ path: 'vehicleId', model: Vehicle, select: 'vrm make model derivative stockId' })
        .lean();

    return NextResponse.json({ ok: true, invoice: populated }, { status: 201 });
}

export const GET = withErrorHandler(getInvoices);
export const POST = withErrorHandler(createInvoice);
