import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db';
import Customer from '@/models/Customer';
import { getSession } from '@/lib/session';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('q');

        let query: any = { tenantId: new mongoose.Types.ObjectId(session.tenantId) };
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        const customers = await Customer.aggregate([
            { $match: query },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: 'leads',
                    localField: '_id',
                    foreignField: 'customerId',
                    as: 'leads',
                },
            },
            {
                $addFields: { totalDeals: { $size: '$leads' } },
            },
            {
                $project: { leads: 0 },
            },
        ]);

        return NextResponse.json({ ok: true, customers });
    } catch (error: any) {
        console.error('Customers API GET error:', error);
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

        const customer = new Customer({
            ...body,
            tenantId: session.tenantId,
        });

        await customer.save();

        return NextResponse.json({ ok: true, customer });
    } catch (error: any) {
        console.error('Customers API POST error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
