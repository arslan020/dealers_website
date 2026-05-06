import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Reservation from '@/models/Reservation';
import Vehicle from '@/models/Vehicle';
import Customer from '@/models/Customer';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

/* GET /api/vehicles/[id]/reservation — get active reservation for vehicle */
async function getReservation(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: true, reservation: null });
    await connectToDatabase();

    const reservation = await Reservation.findOne({
        vehicleId: new mongoose.Types.ObjectId(id),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'active',
    })
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName email phone' })
        .lean();

    return NextResponse.json({ ok: true, reservation: reservation || null });
}

/* POST /api/vehicles/[id]/reservation — create reservation */
async function createReservation(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    const existing = await Reservation.findOne({
        vehicleId: new mongoose.Types.ObjectId(id),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'active',
    });
    if (existing) {
        return NextResponse.json({ ok: false, error: 'Vehicle already has an active reservation' }, { status: 409 });
    }

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

    // Generate sequential invoice number for this tenant
    const count = await Reservation.countDocuments({ tenantId: new mongoose.Types.ObjectId(tenantId) });
    const invoiceNumber = String(count + 1).padStart(6, '0');

    const reservation = await Reservation.create({
        vehicleId: new mongoose.Types.ObjectId(id),
        customerId: new mongoose.Types.ObjectId(customerId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        paymentMethod: body.paymentMethod || 'No Payment',
        amountPaid: body.amountPaid || 0,
        invoiceNumber,
        notes: body.notes,
        reservedAt: new Date(),
    });

    // Update vehicle status to Reserved
    await Vehicle.updateOne(
        { _id: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: { status: 'Reserved' } }
    );

    const populated = await Reservation.findById(reservation._id)
        .populate({ path: 'customerId', model: Customer, select: 'firstName lastName email phone' })
        .lean();

    return NextResponse.json({ ok: true, reservation: populated }, { status: 201 });
}

/* PATCH /api/vehicles/[id]/reservation — cancel reservation */
async function cancelReservation(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    const reservation = await Reservation.findOneAndUpdate(
        { vehicleId: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId), status: 'active' },
        { $set: { status: 'cancelled', cancelType: body.cancelType || 'without_credit', cancelledAt: new Date() } },
        { returnDocument: 'after' }
    );

    if (!reservation) {
        return NextResponse.json({ ok: false, error: 'No active reservation found' }, { status: 404 });
    }

    // Revert vehicle status to In Stock
    await Vehicle.updateOne(
        { _id: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: { status: 'In Stock' } }
    );

    return NextResponse.json({ ok: true, reservation });
}

export const GET = withErrorHandler((req: NextRequest, ctx: any) => getReservation(req, ctx));
export const POST = withErrorHandler((req: NextRequest, ctx: any) => createReservation(req, ctx));
export const PATCH = withErrorHandler((req: NextRequest, ctx: any) => cancelReservation(req, ctx));
