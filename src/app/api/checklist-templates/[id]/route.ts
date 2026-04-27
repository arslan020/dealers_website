import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import ChecklistTemplate from '@/models/ChecklistTemplate';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function getHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    await connectToDatabase();
    const t = await ChecklistTemplate.findOne({ _id: id, tenantId }).lean() as any;
    if (!t) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    return NextResponse.json({
        ok: true,
        template: {
            _id: String(t._id),
            name: t.name,
            tasks: (t.tasks || []).map((task: any) => ({
                _id: String(task._id),
                name: task.name,
                order: task.order ?? 0,
            })),
        },
    });
}

async function patchHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim();
    if (Array.isArray(body.tasks)) {
        update.tasks = body.tasks.map((t: any, i: number) => ({
            name: String(t.name || '').trim(),
            order: i,
        })).filter((t: any) => t.name);
    }

    await connectToDatabase();
    const updated = await ChecklistTemplate.findOneAndUpdate(
        { _id: id, tenantId },
        { $set: update },
        { new: true }
    ).lean() as any;

    if (!updated) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    return NextResponse.json({
        ok: true,
        template: {
            _id: String(updated._id),
            name: updated.name,
            tasks: (updated.tasks || []).map((task: any) => ({
                _id: String(task._id),
                name: task.name,
                order: task.order ?? 0,
            })),
        },
    });
}

async function deleteHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    await connectToDatabase();
    const deleted = await ChecklistTemplate.findOneAndDelete({ _id: id, tenantId });
    if (!deleted) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
}

export const GET = withErrorHandler(getHandler);
export const PATCH = withErrorHandler(patchHandler);
export const DELETE = withErrorHandler(deleteHandler);
