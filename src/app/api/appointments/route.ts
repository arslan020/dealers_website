import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Appointment from '@/models/Appointment';
import { withErrorHandler } from '@/lib/api-handler';

async function getAppointments(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const query: any = { tenantId };
    if (start && end) {
        // Use full day boundaries to be safe
        const startDate = new Date(start);
        const endDate = new Date(end);

        // Ensure endDate covers the entire last day
        endDate.setHours(23, 59, 59, 999);

        query.startTime = { $gte: startDate, $lte: endDate };
    }

    const appointments = await Appointment.find(query).sort({ startTime: 1 });
    return NextResponse.json({ ok: true, appointments });
}

async function createAppointment(req: NextRequest) {
    try {
        const tenantId = req.headers.get('x-tenant-id');
        const userId = req.headers.get('x-user-id');

        if (!tenantId || !userId) {
            console.error('[API] Missing tenantId or userId in headers');
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        console.log('[API] Creating appointment:', { ...body, tenantId, userId });

        await connectToDatabase();

        const appointment = await Appointment.create({
            ...body,
            tenantId,
            creatorId: userId,
        });

        console.log('[API] Appointment created successfully:', appointment._id);
        return NextResponse.json({ ok: true, appointment });
    } catch (error: any) {
        console.error('[API] Error creating appointment:', error);
        return NextResponse.json({
            ok: false,
            error: error.message || 'Failed to create appointment'
        }, { status: 500 });
    }
}

async function updateAppointment(req: NextRequest) {
    try {
        const tenantId = req.headers.get('x-tenant-id');
        if (!tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ ok: false, error: 'Appointment ID required' }, { status: 400 });
        }

        await connectToDatabase();

        const appointment = await Appointment.findOneAndUpdate(
            { _id: id, tenantId },
            updateData,
            { returnDocument: 'after' }
        );

        if (!appointment) {
            return NextResponse.json({ ok: false, error: 'Appointment not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, appointment });
    } catch (error: any) {
        console.error('[API] Error updating appointment:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

async function deleteAppointment(req: NextRequest) {
    try {
        const tenantId = req.headers.get('x-tenant-id');
        if (!tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ ok: false, error: 'Appointment ID required' }, { status: 400 });
        }

        await connectToDatabase();

        const result = await Appointment.deleteOne({ _id: id, tenantId });

        if (result.deletedCount === 0) {
            return NextResponse.json({ ok: false, error: 'Appointment not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[API] Error deleting appointment:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export const GET = withErrorHandler(getAppointments);
export const POST = withErrorHandler(createAppointment);
export const PATCH = withErrorHandler(updateAppointment);
export const DELETE = withErrorHandler(deleteAppointment);

