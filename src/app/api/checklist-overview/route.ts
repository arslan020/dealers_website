import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import VehicleChecklist from '@/models/VehicleChecklist';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function handler(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const templateId = new URL(req.url).searchParams.get('templateId')?.trim();
    if (!templateId || !mongoose.isValidObjectId(templateId)) {
        return NextResponse.json({ ok: false, error: 'templateId required' }, { status: 400 });
    }

    await connectToDatabase();
    const tid = new mongoose.Types.ObjectId(tenantId);

    const checklists = await VehicleChecklist.find({ tenantId: tid, templateId: new mongoose.Types.ObjectId(templateId) })
        .populate({ path: 'vehicleId', select: 'vrm make model status' })
        .lean() as any[];

    const vehicles = checklists.map(c => {
        const v = c.vehicleId && typeof c.vehicleId === 'object' ? c.vehicleId : null;
        return {
            _id: v ? String(v._id) : '',
            vrm: v?.vrm || '',
            make: v?.make || '',
            model: v?.model || '',
            status: v?.status || '',
            checklist: {
                _id: String(c._id),
                templateName: c.templateName || '',
                notes: c.notes || '',
                tasks: (c.tasks || []).map((t: any) => ({
                    _id: String(t._id),
                    name: t.name,
                    done: !!t.done,
                })),
            },
        };
    }).filter(v => v._id);

    return NextResponse.json({ ok: true, vehicles });
}

export const GET = withErrorHandler(handler);
