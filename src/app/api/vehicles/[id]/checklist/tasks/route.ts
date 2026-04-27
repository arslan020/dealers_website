import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import VehicleChecklist from '@/models/VehicleChecklist';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function postHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id: vehicleId } = await params;

    const body = await req.json();
    const name = (body.name || '').trim();
    if (!name) return NextResponse.json({ ok: false, error: 'Task name required' }, { status: 400 });

    await connectToDatabase();
    const tid = new mongoose.Types.ObjectId(tenantId);
    const vid = new mongoose.Types.ObjectId(vehicleId);

    let checklist = await VehicleChecklist.findOne({ tenantId: tid, vehicleId: vid });
    if (!checklist) {
        checklist = await VehicleChecklist.create({ tenantId: tid, vehicleId: vid, templateId: null, templateName: '', tasks: [], notes: '' });
    }

    const order = checklist.tasks.length;
    checklist.tasks.push({ name, done: false, notes: '', order } as any);
    await checklist.save();

    const task = checklist.tasks[checklist.tasks.length - 1] as any;
    return NextResponse.json({
        ok: true,
        task: { _id: String(task._id), name: task.name, done: false, notes: '', order },
    });
}

export const POST = withErrorHandler(postHandler);
