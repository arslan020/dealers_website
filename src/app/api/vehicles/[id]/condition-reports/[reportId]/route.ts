import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import ConditionReport from '@/models/ConditionReport';
import { withErrorHandler } from '@/lib/api-handler';

async function getConditionReport(req: NextRequest, context: { params?: any }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id: vehicleId, reportId } = await context.params;
    await connectToDatabase();

    const report = await ConditionReport.findOne({ _id: reportId, vehicleId, tenantId }).lean();
    if (!report) return NextResponse.json({ ok: false, error: 'Report not found' }, { status: 404 });

    return NextResponse.json({ ok: true, report });
}

async function updateConditionReport(req: NextRequest, context: { params?: any }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id: vehicleId, reportId } = await context.params;
    const body = await req.json();

    await connectToDatabase();

    const report = await ConditionReport.findOneAndUpdate(
        { _id: reportId, vehicleId, tenantId },
        { $set: body },
        { new: true }
    );

    if (!report) return NextResponse.json({ ok: false, error: 'Report not found' }, { status: 404 });

    return NextResponse.json({ ok: true, report });
}

async function deleteConditionReport(req: NextRequest, context: { params?: any }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id: vehicleId, reportId } = await context.params;
    await connectToDatabase();

    const result = await ConditionReport.deleteOne({ _id: reportId, vehicleId, tenantId });
    if (result.deletedCount === 0) return NextResponse.json({ ok: false, error: 'Report not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
}

export const GET = withErrorHandler(getConditionReport);
export const PATCH = withErrorHandler(updateConditionReport);
export const DELETE = withErrorHandler(deleteConditionReport);
