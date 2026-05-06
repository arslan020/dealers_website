import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Customer from '@/models/Customer';
import { getSession } from '@/lib/session';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
    try {
        const session = await getSession();
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        const { id } = await ctx.params;
        await connectToDatabase();
        const body = await req.json();
        // Strip read-only / immutable fields before update
        const { _id, tenantId: _t, __v, createdAt, updatedAt, totalDeals, ...updateFields } = body;
        const customer = await Customer.findOneAndUpdate(
            { _id: id, tenantId: session.tenantId },
            { $set: updateFields },
            { returnDocument: 'after' }
        );
        if (!customer) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
        return NextResponse.json({ ok: true, customer });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
    try {
        const session = await getSession();
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        const { id } = await ctx.params;
        await connectToDatabase();
        await Customer.deleteOne({ _id: id, tenantId: session.tenantId });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
