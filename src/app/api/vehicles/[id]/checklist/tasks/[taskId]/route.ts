import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import VehicleChecklist from '@/models/VehicleChecklist';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function patchHandler(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; taskId: string }> }
) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id: vehicleId, taskId } = await params;

    const body = await req.json();
    await connectToDatabase();

    const checklist = await VehicleChecklist.findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vehicleId: new mongoose.Types.ObjectId(vehicleId),
    });
    if (!checklist) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const task = checklist.tasks.id(taskId);
    if (!task) return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });

    if (typeof body.done === 'boolean') task.done = body.done;
    if (typeof body.notes === 'string') task.notes = body.notes.trim();
    if (typeof body.name === 'string' && body.name.trim()) task.name = body.name.trim();

    await checklist.save();

    return NextResponse.json({
        ok: true,
        task: { _id: String(task._id), name: task.name, done: task.done, notes: task.notes, order: task.order },
    });
}

async function deleteHandler(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; taskId: string }> }
) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id: vehicleId, taskId } = await params;

    await connectToDatabase();

    const checklist = await VehicleChecklist.findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vehicleId: new mongoose.Types.ObjectId(vehicleId),
    });
    if (!checklist) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    checklist.tasks = checklist.tasks.filter((t: any) => String(t._id) !== taskId) as any;
    await checklist.save();

    return NextResponse.json({ ok: true });
}

export const PATCH = withErrorHandler(patchHandler);
export const DELETE = withErrorHandler(deleteHandler);
