import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Tenant from '@/models/Tenant';
import { verifyAccessToken } from '@/lib/auth';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';
import { importVehiclesFromAT } from '@/lib/importVehiclesFromAT';
import User from '@/models/User';
import Vehicle from '@/models/Vehicle';
import Customer from '@/models/Customer';
import Lead from '@/models/Lead';
import Appointment from '@/models/Appointment';
import TestDrive from '@/models/TestDrive';
import Reservation from '@/models/Reservation';
import SaleInvoice from '@/models/SaleInvoice';
import PurchaseInvoice from '@/models/PurchaseInvoice';
import Job from '@/models/Job';
import SalesDocument from '@/models/SalesDocument';
import DocumentSignature from '@/models/DocumentSignature';
import Calendar from '@/models/Calendar';
import VehicleChecklist from '@/models/VehicleChecklist';
import VehicleDocument from '@/models/VehicleDocument';
import ConditionReport from '@/models/ConditionReport';
import ChecklistTemplate from '@/models/ChecklistTemplate';
import ContactTag from '@/models/ContactTag';
import Product from '@/models/Product';

// PATCH /api/tenants/:id — SUPER_ADMIN: suspend or activate a tenant
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session || session.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ ok: false, error: { message: 'Forbidden.', code: 'FORBIDDEN' } }, { status: 403 });
        }

        const { id } = await params;
        const { status, name, plan, autoTraderConfig } = await req.json();

        if (status && !['active', 'suspended'].includes(status)) {
            return NextResponse.json(
                { ok: false, error: { message: 'Status must be "active" or "suspended".', code: 'VALIDATION_ERROR' } },
                { status: 400 }
            );
        }

        const updates: any = {};
        if (status) updates.status = status;
        if (name) updates.name = name;
        if (plan) updates.plan = plan;
        if (autoTraderConfig !== undefined) updates.autoTraderConfig = autoTraderConfig;

        await connectToDatabase();
        const tenant = await Tenant.findByIdAndUpdate(id, updates, { returnDocument: 'after' });
        if (!tenant) {
            return NextResponse.json({ ok: false, error: { message: 'Tenant not found.', code: 'NOT_FOUND' } }, { status: 404 });
        }

        // If dealerId was just set → auto-import vehicles from AT in background
        const dealerIdSet = autoTraderConfig?.dealerId && autoTraderConfig.dealerId.trim() !== '';
        if (dealerIdSet) {
            importVehiclesFromAT(id).then(({ imported, updated }) => {
                console.log(`[AutoTrader] Auto-import for tenant ${id}: ${imported} new, ${updated} updated.`);
            }).catch(err => {
                console.warn(`[AutoTrader] Auto-import failed for tenant ${id}:`, err.message);
            });
        }

        // If AT keys were cleared (dealerId empty), delete vehicles and cache
        const dealerIdCleared = autoTraderConfig !== undefined && !autoTraderConfig?.dealerId;
        if (dealerIdCleared) {
            await AutoTraderStockCache.deleteOne({ tenantId: id });
            await Vehicle.deleteMany({ tenantId: id, isLiveOnAT: true });
            console.log(`[AutoTrader] Vehicles + cache cleared for tenant ${id} — dealerId removed.`);
        }

        return NextResponse.json({ ok: true, tenant });
    } catch (error: any) {
        console.error('PATCH /api/tenants/[id] error:', error);
        return NextResponse.json({ ok: false, error: { message: error.message, code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
}

// DELETE /api/tenants/:id — SUPER_ADMIN: permanently delete a tenant and all its data
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session || session.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ ok: false, error: { message: 'Forbidden.', code: 'FORBIDDEN' } }, { status: 403 });
        }

        const { id } = await params;
        await connectToDatabase();

        const tenant = await Tenant.findById(id);
        if (!tenant) {
            return NextResponse.json({ ok: false, error: { message: 'Tenant not found.', code: 'NOT_FOUND' } }, { status: 404 });
        }

        await Promise.all([
            User.deleteMany({ tenantId: id }),
            Vehicle.deleteMany({ tenantId: id }),
            Customer.deleteMany({ tenantId: id }),
            Lead.deleteMany({ tenantId: id }),
            Appointment.deleteMany({ tenantId: id }),
            TestDrive.deleteMany({ tenantId: id }),
            Reservation.deleteMany({ tenantId: id }),
            SaleInvoice.deleteMany({ tenantId: id }),
            PurchaseInvoice.deleteMany({ tenantId: id }),
            Job.deleteMany({ tenantId: id }),
            SalesDocument.deleteMany({ tenantId: id }),
            DocumentSignature.deleteMany({ tenantId: id }),
            Calendar.deleteMany({ tenantId: id }),
            VehicleChecklist.deleteMany({ tenantId: id }),
            VehicleDocument.deleteMany({ tenantId: id }),
            ConditionReport.deleteMany({ tenantId: id }),
            ChecklistTemplate.deleteMany({ tenantId: id }),
            ContactTag.deleteMany({ tenantId: id }),
            Product.deleteMany({ tenantId: id }),
            AutoTraderStockCache.deleteOne({ tenantId: id }),
        ]);

        await Tenant.findByIdAndDelete(id);

        console.log(`[Admin] Tenant ${id} (${tenant.name}) permanently deleted with all data.`);
        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('DELETE /api/tenants/[id] error:', error);
        return NextResponse.json({ ok: false, error: { message: error.message, code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
}
