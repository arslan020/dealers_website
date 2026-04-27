import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SaleInvoice from '@/models/SaleInvoice';
import Customer from '@/models/Customer';
import Vehicle from '@/models/Vehicle';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

function populate(query: ReturnType<typeof SaleInvoice.findById>) {
    return query
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName businessName email phone address vatNumber' })
        .populate({ path: 'vehicleId', model: Vehicle, select: 'vrm vin make model derivative engineNumber stockId colour dateOfRegistration mileage' });
}

/* GET single invoice */
async function getInvoice(req: NextRequest, ctx: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    await connectToDatabase();

    const invoice = await populate(
        SaleInvoice.findOne({ _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) })
    ).lean();
    if (!invoice) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, invoice });
}

/* PATCH — issue, markPaid, addPayment, cancel, addCredit, edit */
async function updateInvoice(req: NextRequest, ctx: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    const body = await req.json();
    await connectToDatabase();

    const invoice = await SaleInvoice.findOne({ _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) });
    if (!invoice) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    switch (body.action) {
        case 'issue':
            invoice.status = 'issued';
            invoice.issuedAt = new Date();
            break;

        case 'markPaid':
            if (body.payment) invoice.payments.push(body.payment);
            invoice.status = 'paid';
            invoice.paidAt = new Date();
            if (invoice.vehicleId) {
                await Vehicle.updateOne(
                    { _id: invoice.vehicleId, tenantId: new mongoose.Types.ObjectId(tenantId) },
                    { $set: { status: 'Sold' } }
                );
            }
            break;

        case 'savePayments':
            if (body.payments) invoice.payments = body.payments;
            break;

        case 'addCredit':
            if (body.credit) {
                invoice.credits.push(body.credit);
                invoice.status = 'credited';
            }
            break;

        case 'cancel':
            invoice.status = 'cancelled';
            invoice.cancelledAt = new Date();
            if (invoice.vehicleId) {
                await Vehicle.updateOne(
                    { _id: invoice.vehicleId, tenantId: new mongoose.Types.ObjectId(tenantId) },
                    { $set: { status: 'In Stock' } }
                );
            }
            break;

        case 'handover':
            invoice.handoverComplete = true;
            invoice.handoverAt = new Date();
            break;

        case 'edit':
            if (body.lineItems !== undefined) invoice.lineItems = body.lineItems;
            if (body.partExchanges !== undefined) invoice.partExchanges = body.partExchanges;
            if (body.finance !== undefined) invoice.finance = body.finance;
            if (body.invoiceNotes !== undefined) invoice.invoiceNotes = body.invoiceNotes;
            if (body.termsAndConditions !== undefined) invoice.termsAndConditions = body.termsAndConditions;
            if (body.invoiceType !== undefined) invoice.invoiceType = body.invoiceType;
            if (body.invoiceDate !== undefined) invoice.invoiceDate = body.invoiceDate;
            if (body.timeOfSupply !== undefined) invoice.timeOfSupply = body.timeOfSupply;
            break;

        default:
            return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
    }

    await invoice.save();

    const updated = await populate(SaleInvoice.findById(invoice._id)).lean();
    return NextResponse.json({ ok: true, invoice: updated });
}

export const GET = withErrorHandler((req: NextRequest, ctx: any) => getInvoice(req, ctx));
export const PATCH = withErrorHandler((req: NextRequest, ctx: any) => updateInvoice(req, ctx));
