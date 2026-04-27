import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Lead from '@/models/Lead';
import Customer from '@/models/Customer';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

async function listLeads(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: true, leads: [] });
    await connectToDatabase();

    const leads = await Lead.find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vehicleId: new mongoose.Types.ObjectId(id),
    })
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName email phone' })
        .sort({ createdAt: -1 })
        .lean();

    return NextResponse.json({ ok: true, leads });
}

async function createLead(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    let customerId = body.customerId;
    if (!customerId && body.customerDetails) {
        const customer = await Customer.create({
            ...body.customerDetails,
            tenantId: new mongoose.Types.ObjectId(tenantId),
        });
        customerId = customer._id;
    }

    if (!customerId) {
        return NextResponse.json({ ok: false, error: 'customerId or customerDetails required' }, { status: 400 });
    }

    const lead = await Lead.create({
        customerId: new mongoose.Types.ObjectId(customerId),
        vehicleId: new mongoose.Types.ObjectId(id),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        platform: body.platform || 'Manual',
        status: 'NEW_LEAD',
        message: body.message,
    });

    const populated = await Lead.findById(lead._id)
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName email phone' })
        .lean();

    return NextResponse.json({ ok: true, lead: populated }, { status: 201 });
}

export const GET = withErrorHandler((req: NextRequest, ctx: any) => listLeads(req, ctx));
export const POST = withErrorHandler((req: NextRequest, ctx: any) => createLead(req, ctx));
