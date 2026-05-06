import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Lead from '@/models/Lead';
import Customer from '@/models/Customer';
import Vehicle from '@/models/Vehicle';
import { getSession } from '@/lib/session';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        let query: any = { tenantId: session.tenantId };
        if (status) query.status = status;

        const leads = await Lead.find(query)
            .populate({ path: 'customerId', model: Customer })
            .populate({ path: 'vehicleId', model: Vehicle, select: 'make vehicleModel vrm price primaryImage' })
            .sort({ createdAt: -1 });

        return NextResponse.json({ ok: true, leads });
    } catch (error: any) {
        console.error('Leads API GET error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const body = await request.json();

        // Check if customer exists or create new
        let customerId = body.customerId;
        if (!customerId && body.customerDetails) {
            const newCustomer = new Customer({
                ...body.customerDetails,
                tenantId: session.tenantId,
            });
            await newCustomer.save();
            customerId = newCustomer._id;
        }

        if (!customerId) {
            return NextResponse.json({ ok: false, error: 'Customer ID or Details required' }, { status: 400 });
        }

        const lead = new Lead({
            ...body,
            customerId,
            tenantId: session.tenantId,
        });

        await lead.save();

        return NextResponse.json({ ok: true, lead });
    } catch (error: any) {
        console.error('Leads API POST error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getSession();
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const body = await request.json();
        const { id, status } = body;

        if (!id || !status) {
            return NextResponse.json({ ok: false, error: 'Lead ID and status required' }, { status: 400 });
        }

        const query = id.match(/^[0-9a-fA-F]{24}$/) 
            ? { _id: id, tenantId: session.tenantId }
            : { dealId: id, tenantId: session.tenantId };

        const lead = await Lead.findOneAndUpdate(
            query,
            { status },
            { returnDocument: 'after' }
        );

        if (!lead) {
            return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, lead });
    } catch (error: any) {
        console.error('Leads API PATCH error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ ok: false, error: 'Lead ID required' }, { status: 400 });
        }

        const lead = await Lead.findOneAndDelete({
            _id: id,
            tenantId: session.tenantId,
        });

        if (!lead) {
            return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Leads API DELETE error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

