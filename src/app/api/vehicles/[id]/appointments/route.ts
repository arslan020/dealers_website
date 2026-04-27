import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Appointment from '@/models/Appointment';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

async function listAppointments(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: true, appointments: [] });
    await connectToDatabase();

    const appointments = await Appointment.find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vehicleId: new mongoose.Types.ObjectId(id),
    }).sort({ startTime: 1 }).lean();

    return NextResponse.json({ ok: true, appointments });
}

async function createAppointment(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    const userId = req.headers.get('x-user-id');
    if (!tenantId || !userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    const startTime = new Date(body.startTime);
    const durationMs = (body.durationMinutes || 60) * 60 * 1000;
    const endTime = new Date(startTime.getTime() + durationMs);

    const appointment = await Appointment.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        creatorId: new mongoose.Types.ObjectId(userId),
        vehicleId: new mongoose.Types.ObjectId(id),
        title: body.purpose || body.title || 'Appointment',
        purpose: body.purpose,
        apptType: body.apptType || 'appointment',
        calendarId: body.calendarId ? new mongoose.Types.ObjectId(body.calendarId) : undefined,
        calendarName: body.calendarName,
        startTime,
        endTime,
        durationMinutes: body.durationMinutes,
        followUpAfterMinutes: body.followUpAfterMinutes,
        customerId: body.customerId ? new mongoose.Types.ObjectId(body.customerId) : undefined,
        customerName: body.customerName,
        staffUserIds: (body.staffUserIds || []).map((uid: string) => new mongoose.Types.ObjectId(uid)),
        vehicleIds: body.vehicleIds || [],
        notes: body.notes,
        completed: false,
    });

    return NextResponse.json({ ok: true, appointment });
}

export const GET  = withErrorHandler((req, ctx) => listAppointments(req, ctx as any));
export const POST = withErrorHandler((req, ctx) => createAppointment(req, ctx as any));
