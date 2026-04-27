import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Job from '@/models/Job';
import User from '@/models/User';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function getJobHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    await connectToDatabase();

    const job = await Job.findOne({ _id: id, tenantId })
        .populate({ path: 'vehicleId', select: 'make model derivative vrm status' })
        .populate({ path: 'assigneeId', select: 'name email' })
        .populate({ path: 'createdBy', select: 'name email' })
        .lean() as any;

    if (!job) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    // Manually look up comment authors + time card staff
    const rawComments = job.comments || [];
    const rawTimeCards = job.timeCards || [];
    const userIds = [...new Set([
        ...rawComments.map((c: any) => c.authorId?.toString()),
        ...rawTimeCards.map((t: any) => t.staffId?.toString()),
    ].filter(Boolean))];
    const users = userIds.length > 0
        ? await User.find({ _id: { $in: userIds } }).select('name').lean() as any[]
        : [];
    const userMap: Record<string, string> = {};
    users.forEach((u: any) => { userMap[String(u._id)] = u.name; });

    const comments = rawComments.map((c: any) => ({
        _id: String(c._id),
        text: c.text || '',
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
        author: c.authorId
            ? { _id: String(c.authorId), name: userMap[String(c.authorId)] || 'Unknown' }
            : null,
    }));

    const timeCards = rawTimeCards.map((t: any) => ({
        _id: String(t._id),
        date: t.date ? new Date(t.date).toISOString() : null,
        hours: t.hours || 0,
        minutes: t.minutes || 0,
        notes: t.notes || '',
        staff: t.staffId
            ? { _id: String(t.staffId), name: userMap[String(t.staffId)] || 'Unknown' }
            : null,
    }));

    const v = job.vehicleId && typeof job.vehicleId === 'object' ? job.vehicleId : null;
    const a = job.assigneeId && typeof job.assigneeId === 'object' ? job.assigneeId : null;
    const cb = job.createdBy && typeof job.createdBy === 'object' ? job.createdBy : null;

    return NextResponse.json({
        ok: true,
        job: {
            _id: String(job._id),
            jobType: job.jobType,
            details: job.details || '',
            status: job.status || 'Incomplete',
            location: job.location || '',
            dueAt: job.dueAt ? new Date(job.dueAt).toISOString() : null,
            createdAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
            assignee: a ? { _id: String(a._id), name: a.name, email: a.email } : null,
            createdBy: cb ? { name: cb.name } : null,
            comments,
            timeCards,
            vehicle: v ? {
                _id: String(v._id),
                vrm: v.vrm || '',
                make: v.make || '',
                model: v.model || '',
                derivative: v.derivative || '',
                status: v.status || '',
            } : null,
        },
    });
}

async function patchJobHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    await connectToDatabase();

    const body = await req.json();
    const allowed: Record<string, unknown> = {};

    if (typeof body.details === 'string') allowed.details = body.details.trim();
    if (typeof body.location === 'string') allowed.location = body.location.trim();
    if (body.status === 'Complete' || body.status === 'Incomplete') allowed.status = body.status;
    if (body.dueAt === null) {
        allowed.dueAt = null;
    } else if (typeof body.dueAt === 'string') {
        const d = new Date(body.dueAt);
        if (!Number.isNaN(d.getTime())) allowed.dueAt = d;
    }
    if (body.assigneeId === null) {
        allowed.assigneeId = null;
    } else if (typeof body.assigneeId === 'string' && mongoose.isValidObjectId(body.assigneeId)) {
        allowed.assigneeId = new mongoose.Types.ObjectId(body.assigneeId);
    }

    const updated = await Job.findOneAndUpdate(
        { _id: id, tenantId },
        { $set: allowed },
        { new: true }
    ).lean();

    if (!updated) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
}

async function deleteJobHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    await connectToDatabase();
    const deleted = await Job.findOneAndDelete({ _id: id, tenantId });
    if (!deleted) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
}

export const GET = withErrorHandler(getJobHandler);
export const PATCH = withErrorHandler(patchJobHandler);
export const DELETE = withErrorHandler(deleteJobHandler);
