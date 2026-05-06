import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Appointment from '@/models/Appointment';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string; apptId: string }> };

async function patchAppointment(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id, apptId } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    const update: any = {};
    if (body.purpose !== undefined) { update.purpose = body.purpose; update.title = body.purpose || 'Appointment'; }
    if (body.apptType !== undefined) update.apptType = body.apptType;
    if (body.calendarId !== undefined) update.calendarId = body.calendarId ? new mongoose.Types.ObjectId(body.calendarId) : null;
    if (body.calendarName !== undefined) update.calendarName = body.calendarName;
    if (body.startTime !== undefined) {
        update.startTime = new Date(body.startTime);
        const dur = (body.durationMinutes ?? 60) * 60 * 1000;
        update.endTime = new Date(update.startTime.getTime() + dur);
    }
    if (body.durationMinutes !== undefined) update.durationMinutes = body.durationMinutes;
    if (body.followUpAfterMinutes !== undefined) update.followUpAfterMinutes = body.followUpAfterMinutes;
    if (body.customerId !== undefined) update.customerId = body.customerId ? new mongoose.Types.ObjectId(body.customerId) : null;
    if (body.customerName !== undefined) update.customerName = body.customerName;
    if (body.staffUserIds !== undefined) update.staffUserIds = body.staffUserIds.map((uid: string) => new mongoose.Types.ObjectId(uid));
    if (body.vehicleIds !== undefined) update.vehicleIds = body.vehicleIds;
    if (body.notes !== undefined) update.notes = body.notes;
    if (body.completed !== undefined) update.completed = body.completed;

    const appt = await Appointment.findOneAndUpdate(
        { _id: apptId, vehicleId: new mongoose.Types.ObjectId(id), tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: update },
        { returnDocument: 'after' }
    );
    if (!appt) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, appointment: appt });
}

async function deleteAppointment(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id, apptId } = await context.params;
    await connectToDatabase();

    await Appointment.deleteOne({
        _id: apptId,
        vehicleId: new mongoose.Types.ObjectId(id),
        tenantId: new mongoose.Types.ObjectId(tenantId),
    });
    return NextResponse.json({ ok: true });
}

export const PATCH  = withErrorHandler((req, ctx) => patchAppointment(req, ctx as any));
export const DELETE = withErrorHandler((req, ctx) => deleteAppointment(req, ctx as any));
