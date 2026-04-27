import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import TestDrive from '@/models/TestDrive';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

async function getSessions(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ ok: true, sessions: [], session: null });
    const { searchParams } = new URL(req.url);
    const history = searchParams.get('history') === 'true';
    await connectToDatabase();

    if (history) {
        const sessions = await TestDrive.find({
            tenantId: new mongoose.Types.ObjectId(tenantId),
            vehicleId: new mongoose.Types.ObjectId(id),
        }).sort({ startTime: -1 }).lean();
        return NextResponse.json({ ok: true, sessions });
    }

    // Return active session
    const active = await TestDrive.findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vehicleId: new mongoose.Types.ObjectId(id),
        status: 'active',
    }).lean();
    return NextResponse.json({ ok: true, session: active || null });
}

async function startSession(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    await connectToDatabase();

    // Only one active session at a time per vehicle
    const existing = await TestDrive.findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vehicleId: new mongoose.Types.ObjectId(id),
        status: 'active',
    });
    if (existing) return NextResponse.json({ ok: false, error: 'A test drive session is already active' }, { status: 400 });

    const session = await TestDrive.create({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        vehicleId: new mongoose.Types.ObjectId(id),
        customerId: body.customerId ? new mongoose.Types.ObjectId(body.customerId) : undefined,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerAddress: body.customerAddress,
        drivingLicenseNumber: body.drivingLicenseNumber,
        drivingLicenseCheckCode: body.drivingLicenseCheckCode,
        nationalInsuranceNumber: body.nationalInsuranceNumber,
        dateOfBirth: body.dateOfBirth,
        licenseCheckedDate: body.licenseCheckedDate,
        checkedByUserId: body.checkedByUserId ? new mongoose.Types.ObjectId(body.checkedByUserId) : undefined,
        checkedByName: body.checkedByName,
        startTime: new Date(),
        intendedReturnTime: body.intendedReturnTime ? new Date(body.intendedReturnTime) : undefined,
        fuelLevel: body.fuelLevel,
        conditionReportId: body.conditionReportId ? new mongoose.Types.ObjectId(body.conditionReportId) : undefined,
        conditionReportLabel: body.conditionReportLabel,
        handoverLocation: body.handoverLocation,
        notes: body.notes,
        consentToDataStorage: body.consentToDataStorage ?? false,
        status: 'active',
    });

    return NextResponse.json({ ok: true, session });
}

export const GET  = withErrorHandler((req, ctx) => getSessions(req, ctx as any));
export const POST = withErrorHandler((req, ctx) => startSession(req, ctx as any));
