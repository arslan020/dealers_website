import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Job from '@/models/Job';
import User from '@/models/User';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function addTimeCardHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    const body = await req.json();
    const { staffId, date, hours, minutes, notes } = body;

    if (!staffId || !date) return NextResponse.json({ ok: false, error: 'staffId and date required' }, { status: 400 });

    await connectToDatabase();

    const job = await Job.findOneAndUpdate(
        { _id: id, tenantId },
        {
            $push: {
                timeCards: {
                    _id: new mongoose.Types.ObjectId(),
                    staffId: new mongoose.Types.ObjectId(staffId),
                    date: new Date(date),
                    hours: Number(hours) || 0,
                    minutes: Number(minutes) || 0,
                    notes: notes?.trim() || '',
                    createdAt: new Date(),
                },
            },
        },
        { returnDocument: 'after' }
    ).lean() as any;

    if (!job) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const rawTimeCards = job.timeCards || [];
    const staffIds = [...new Set(rawTimeCards.map((t: any) => t.staffId?.toString()).filter(Boolean))];
    const staffList = staffIds.length > 0
        ? await User.find({ _id: { $in: staffIds } }).select('name').lean() as any[]
        : [];
    const staffMap: Record<string, string> = {};
    staffList.forEach((s: any) => { staffMap[String(s._id)] = s.name; });

    const timeCards = rawTimeCards.map((t: any) => ({
        _id: String(t._id),
        date: t.date ? new Date(t.date).toISOString() : null,
        hours: t.hours || 0,
        minutes: t.minutes || 0,
        notes: t.notes || '',
        staff: t.staffId ? { _id: String(t.staffId), name: staffMap[String(t.staffId)] || 'Unknown' } : null,
    }));

    return NextResponse.json({ ok: true, timeCards });
}

export const POST = withErrorHandler(addTimeCardHandler);
