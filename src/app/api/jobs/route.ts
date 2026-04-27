import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Job from '@/models/Job';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';
import { resolveVehicleObjectIdForJob } from '@/lib/resolveVehicleForJob';

async function listJobsHandler(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobType = searchParams.get('jobType')?.trim();
    const status = searchParams.get('status')?.trim();
    const vehicleId = searchParams.get('vehicleId')?.trim();

    await connectToDatabase();

    const tid = new mongoose.Types.ObjectId(tenantId);
    const query: Record<string, unknown> = { tenantId: tid };
    if (jobType) query.jobType = jobType;
    if (status === 'Incomplete' || status === 'Complete') query.status = status;
    if (vehicleId && mongoose.isValidObjectId(vehicleId)) {
        query.vehicleId = new mongoose.Types.ObjectId(vehicleId);
    }

    const rows = await Job.find(query)
        .populate({ path: 'vehicleId', select: 'make model vrm status' })
        .populate({ path: 'assigneeId', select: 'name email' })
        .sort({ createdAt: -1 })
        .limit(300)
        .lean();

    const jobs = rows.map((j: any) => {
        const v = j.vehicleId && typeof j.vehicleId === 'object' ? j.vehicleId : null;
        const a = j.assigneeId && typeof j.assigneeId === 'object' ? j.assigneeId : null;
        return {
            _id: String(j._id),
            jobType: j.jobType,
            details: j.details || '',
            status: j.status || 'Incomplete',
            location: j.location || '',
            dueAt: j.dueAt ? new Date(j.dueAt).toISOString() : null,
            createdAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
            assigneeName: a?.name || null,
            vehicle: v
                ? {
                      _id: String(v._id),
                      vrm: v.vrm || '',
                      make: v.make || '',
                      model: v.model || '',
                      status: v.status || '',
                  }
                : null,
        };
    });

    return NextResponse.json({ ok: true, jobs });
}

async function createJobHandler(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    const userId = req.headers.get('x-user-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { vehicleId, jobType, details, assigneeId, location, status, dueAt } = body as {
        vehicleId?: string;
        jobType?: string;
        details?: string;
        assigneeId?: string | null;
        location?: string;
        status?: 'Incomplete' | 'Complete';
        dueAt?: string | null;
    };

    if (!vehicleId || !jobType?.trim()) {
        return NextResponse.json(
            { ok: false, error: { message: 'Vehicle and job type are required.', code: 'VALIDATION' } },
            { status: 400 }
        );
    }

    await connectToDatabase();

    const tid = new mongoose.Types.ObjectId(tenantId);
    const resolvedVehicleId = await resolveVehicleObjectIdForJob(tid, vehicleId);

    if (!resolvedVehicleId) {
        return NextResponse.json(
            {
                ok: false,
                error: {
                    message:
                        'Vehicle not found. If it is from AutoTrader, sync stock on the Vehicles page and try again.',
                    code: 'NOT_FOUND',
                },
            },
            { status: 404 }
        );
    }

    const doc: Record<string, unknown> = {
        tenantId: tid,
        vehicleId: resolvedVehicleId,
        jobType: jobType.trim(),
        details: typeof details === 'string' ? details.trim() : '',
    };

    if (typeof location === 'string' && location.trim()) {
        doc.location = location.trim();
    }
    if (status === 'Complete' || status === 'Incomplete') {
        doc.status = status;
    }
    if (dueAt && typeof dueAt === 'string') {
        const d = new Date(dueAt);
        if (!Number.isNaN(d.getTime())) doc.dueAt = d;
    }

    if (assigneeId && mongoose.isValidObjectId(assigneeId)) {
        doc.assigneeId = new mongoose.Types.ObjectId(assigneeId);
    }
    if (userId && mongoose.isValidObjectId(userId)) {
        doc.createdBy = new mongoose.Types.ObjectId(userId);
    }

    const job = await Job.create(doc);

    return NextResponse.json({
        ok: true,
        job: { _id: String(job._id), jobType: job.jobType, vehicleId: String(job.vehicleId) },
    });
}

export const GET = withErrorHandler(listJobsHandler);
export const POST = withErrorHandler(createJobHandler);
