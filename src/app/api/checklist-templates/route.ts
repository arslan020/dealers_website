import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import ChecklistTemplate from '@/models/ChecklistTemplate';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function listHandler(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();
    const templates = await ChecklistTemplate.find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
        .sort({ name: 1 })
        .lean();

    return NextResponse.json({
        ok: true,
        templates: templates.map((t: any) => ({
            _id: String(t._id),
            name: t.name,
            tasks: (t.tasks || []).map((task: any) => ({
                _id: String(task._id),
                name: task.name,
                order: task.order ?? 0,
            })),
            createdAt: t.createdAt,
        })),
    });
}

async function createHandler(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const name = (body.name || '').trim();
    if (!name) return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });

    await connectToDatabase();
    const template = await ChecklistTemplate.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        name,
        tasks: [],
    });

    return NextResponse.json({ ok: true, template: { _id: String(template._id), name: template.name, tasks: [] } });
}

export const GET = withErrorHandler(listHandler);
export const POST = withErrorHandler(createHandler);
