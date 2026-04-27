import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import ConditionReport from '@/models/ConditionReport';
import { withErrorHandler } from '@/lib/api-handler';

async function getConditionReports(req: NextRequest, context: { params?: any }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id: vehicleId } = await context.params;
    await connectToDatabase();

    const reports = await ConditionReport.find({ vehicleId, tenantId })
        .sort({ createdAt: -1 })
        .lean();

    return NextResponse.json({ ok: true, reports });
}

async function createConditionReport(req: NextRequest, context: { params?: any }) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id: vehicleId } = await context.params;
    const body = await req.json();

    await connectToDatabase();

    const report = await ConditionReport.create({
        ...body,
        vehicleId,
        tenantId,
        status: body.status || 'draft',
    });

    return NextResponse.json({ ok: true, report }, { status: 201 });
}

export const GET = withErrorHandler(getConditionReports);
export const POST = withErrorHandler(createConditionReport);
