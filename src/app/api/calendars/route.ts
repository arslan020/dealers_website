import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Calendar from '@/models/Calendar';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function listCalendars(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    await connectToDatabase();

    let calendars = await Calendar.find({ tenantId: new mongoose.Types.ObjectId(tenantId) }).sort({ isPrimary: -1, name: 1 }).lean();

    if (calendars.length === 0) {
        const primary = await Calendar.create({
            tenantId: new mongoose.Types.ObjectId(tenantId),
            name: 'Primary Calendar',
            color: '#4D7CFF',
            isPrimary: true,
        });
        calendars = [primary.toObject()];
    }

    return NextResponse.json({ ok: true, calendars });
}

async function createCalendar(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    await connectToDatabase();

    const calendar = await Calendar.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        name: body.name,
        color: body.color || '#4D7CFF',
        isPrimary: false,
    });
    return NextResponse.json({ ok: true, calendar });
}

async function updateCalendar(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { id, ...updates } = body;
    await connectToDatabase();

    const calendar = await Calendar.findOneAndUpdate(
        { _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) },
        { $set: updates },
        { returnDocument: 'after' }
    );
    if (!calendar) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, calendar });
}

async function deleteCalendar(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'ID required' }, { status: 400 });
    await connectToDatabase();

    const cal = await Calendar.findOne({ _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) });
    if (!cal) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (cal.isPrimary) return NextResponse.json({ ok: false, error: 'Cannot delete primary calendar' }, { status: 400 });

    await Calendar.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
}

export const GET    = withErrorHandler(listCalendars);
export const POST   = withErrorHandler(createCalendar);
export const PATCH  = withErrorHandler(updateCalendar);
export const DELETE = withErrorHandler(deleteCalendar);

