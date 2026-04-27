import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import PurchaseInvoice from '@/models/PurchaseInvoice';
import Customer from '@/models/Customer';
import Vehicle from '@/models/Vehicle';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

function populate(query: ReturnType<typeof PurchaseInvoice.findById>) {
    return query
        .populate({ path: 'contactId', model: Customer, select: 'firstName lastName businessName email phone address' })
        .populate({ path: 'linkedVehicleId', model: Vehicle, select: 'vrm vin make model derivative stockId colour dateOfRegistration mileage' });
}

async function getPurchase(req: NextRequest, ctx: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    await connectToDatabase();

    const purchase = await populate(
        PurchaseInvoice.findOne({ _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) })
    ).lean();
    if (!purchase) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, purchase });
}

async function updatePurchase(req: NextRequest, ctx: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    const body = await req.json();
    await connectToDatabase();

    const purchase = await PurchaseInvoice.findOne({ _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) });
    if (!purchase) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    switch (body.action) {
        case 'issue':
            purchase.status = 'issued';
            purchase.issuedAt = new Date();
            break;
        case 'markPaid':
            purchase.status = 'paid';
            purchase.paidAt = new Date();
            break;
        case 'void':
            purchase.status = 'void';
            break;
        case 'edit':
            if (body.lineItems !== undefined) purchase.lineItems = body.lineItems;
            if (body.adjustment !== undefined) purchase.adjustment = body.adjustment;
            if (body.notes !== undefined) purchase.notes = body.notes;
            if (body.reference !== undefined) purchase.reference = body.reference;
            if (body.invoiceDate !== undefined) purchase.invoiceDate = body.invoiceDate;
            if (body.type !== undefined) purchase.type = body.type;
            break;
        default:
            return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
    }

    await purchase.save();
    const updated = await populate(PurchaseInvoice.findById(purchase._id)).lean();
    return NextResponse.json({ ok: true, purchase: updated });
}

export const GET = withErrorHandler((req: NextRequest, ctx: any) => getPurchase(req, ctx));
export const PATCH = withErrorHandler((req: NextRequest, ctx: any) => updatePurchase(req, ctx));
