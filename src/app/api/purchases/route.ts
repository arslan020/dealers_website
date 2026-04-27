import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import PurchaseInvoice from '@/models/PurchaseInvoice';
import Customer from '@/models/Customer';
import Vehicle from '@/models/Vehicle';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

/* GET — list purchase invoices */
async function getPurchases(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    await connectToDatabase();

    const filter: Record<string, unknown> = { tenantId: new mongoose.Types.ObjectId(tenantId) };
    if (status) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length) filter.status = { $in: statuses };
    }

    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
        PurchaseInvoice.find(filter)
            .populate({ path: 'contactId', model: Customer, select: 'firstName lastName businessName email' })
            .populate({ path: 'linkedVehicleId', model: Vehicle, select: 'vrm make model derivative stockId' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        PurchaseInvoice.countDocuments(filter),
    ]);

    let filtered = purchases as any[];
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(p => {
            const contact = p.contactId as any;
            const name = `${contact?.firstName ?? ''} ${contact?.lastName ?? ''} ${contact?.businessName ?? ''}`.toLowerCase();
            const vehicle = p.linkedVehicleId as any;
            const vrm = (vehicle?.vrm ?? p.linkedVehicleVrm ?? '').toLowerCase();
            return p.purchaseNumber?.toLowerCase().includes(q) || name.includes(q) || vrm.includes(q) || (p.reference ?? '').toLowerCase().includes(q);
        });
    }

    return NextResponse.json({ ok: true, purchases: filtered, total, page, limit });
}

/* POST — create purchase invoice */
async function createPurchase(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    await connectToDatabase();

    let contactId = body.contactId;
    if (!contactId && body.contactDetails) {
        const c = await Customer.create({ ...body.contactDetails, tenantId: new mongoose.Types.ObjectId(tenantId) });
        contactId = c._id;
    }
    if (!contactId) return NextResponse.json({ ok: false, error: 'contactId required' }, { status: 400 });

    const count = await PurchaseInvoice.countDocuments({ tenantId: new mongoose.Types.ObjectId(tenantId) });
    const purchaseNumber = String(count + 1).padStart(6, '0');
    const today = new Date().toISOString().split('T')[0];

    const purchase = await PurchaseInvoice.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        contactId: new mongoose.Types.ObjectId(contactId),
        linkedVehicleId: body.linkedVehicleId ? new mongoose.Types.ObjectId(body.linkedVehicleId) : undefined,
        linkedVehicleVrm: body.linkedVehicleVrm,
        linkedSaleInvoiceId: body.linkedSaleInvoiceId ? new mongoose.Types.ObjectId(body.linkedSaleInvoiceId) : undefined,
        reference: body.reference,
        purchaseNumber,
        status: 'draft',
        type: body.type || 'Marginal',
        invoiceDate: body.invoiceDate || today,
        lineItems: body.lineItems || [],
        adjustment: body.adjustment || 0,
        notes: body.notes,
    });

    const populated = await PurchaseInvoice.findById(purchase._id)
        .populate({ path: 'contactId', model: Customer, select: 'firstName lastName businessName email phone' })
        .populate({ path: 'linkedVehicleId', model: Vehicle, select: 'vrm make model derivative stockId' })
        .lean();

    return NextResponse.json({ ok: true, purchase: populated }, { status: 201 });
}

export const GET = withErrorHandler(getPurchases);
export const POST = withErrorHandler(createPurchase);
