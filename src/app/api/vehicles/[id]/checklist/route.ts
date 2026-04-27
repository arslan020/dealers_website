import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import VehicleChecklist from '@/models/VehicleChecklist';
import ChecklistTemplate from '@/models/ChecklistTemplate';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

function formatChecklist(c: any) {
    return {
        _id: String(c._id),
        templateId: c.templateId ? String(c.templateId) : null,
        templateName: c.templateName || '',
        notes: c.notes || '',
        tasks: (c.tasks || [])
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
            .map((t: any) => ({
                _id: String(t._id),
                name: t.name,
                done: !!t.done,
                notes: t.notes || '',
                order: t.order ?? 0,
            })),
    };
}

async function getHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id: vehicleId } = await params;
    if (!mongoose.isValidObjectId(vehicleId)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    await connectToDatabase();
    const checklist = await VehicleChecklist.findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vehicleId: new mongoose.Types.ObjectId(vehicleId),
    }).lean() as any;

    if (!checklist) return NextResponse.json({ ok: true, checklist: null });
    return NextResponse.json({ ok: true, checklist: formatChecklist(checklist) });
}

async function postHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id: vehicleId } = await params;
    if (!mongoose.isValidObjectId(vehicleId)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    const body = await req.json();
    const templateId = body.templateId as string;
    if (!templateId || !mongoose.isValidObjectId(templateId)) {
        return NextResponse.json({ ok: false, error: 'templateId required' }, { status: 400 });
    }

    await connectToDatabase();
    const tid = new mongoose.Types.ObjectId(tenantId);
    const vid = new mongoose.Types.ObjectId(vehicleId);

    const template = await ChecklistTemplate.findOne({ _id: templateId, tenantId: tid }).lean() as any;
    if (!template) return NextResponse.json({ ok: false, error: 'Template not found' }, { status: 404 });

    const tasks = (template.tasks || []).map((t: any, i: number) => ({
        name: t.name,
        done: false,
        notes: '',
        order: i,
    }));

    const checklist = await VehicleChecklist.findOneAndUpdate(
        { tenantId: tid, vehicleId: vid },
        {
            $set: {
                templateId: new mongoose.Types.ObjectId(templateId),
                templateName: template.name,
                tasks,
                notes: '',
            },
        },
        { upsert: true, new: true }
    ).lean() as any;

    return NextResponse.json({ ok: true, checklist: formatChecklist(checklist) });
}

async function patchHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id: vehicleId } = await params;
    if (!mongoose.isValidObjectId(vehicleId)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (typeof body.notes === 'string') update.notes = body.notes.trim();

    await connectToDatabase();
    const checklist = await VehicleChecklist.findOneAndUpdate(
        { tenantId: new mongoose.Types.ObjectId(tenantId), vehicleId: new mongoose.Types.ObjectId(vehicleId) },
        { $set: update },
        { new: true }
    ).lean() as any;

    if (!checklist) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, checklist: formatChecklist(checklist) });
}

async function deleteHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id: vehicleId } = await params;

    await connectToDatabase();
    await VehicleChecklist.findOneAndDelete({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vehicleId: new mongoose.Types.ObjectId(vehicleId),
    });

    return NextResponse.json({ ok: true });
}

export const GET = withErrorHandler(getHandler);
export const POST = withErrorHandler(postHandler);
export const PATCH = withErrorHandler(patchHandler);
export const DELETE = withErrorHandler(deleteHandler);
