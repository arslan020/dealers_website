import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function getQuickStats(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    // Group by status to get counts
    const aggregation = await Vehicle.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const stats = {
        total: 0,
        sold: 0,
        reserved: 0
    };

    aggregation.forEach(item => {
        stats.total += item.count;
        if (item._id === 'Sold') stats.sold = item.count;
        if (item._id === 'Reserved') stats.reserved = item.count;
    });

    return NextResponse.json({ ok: true, stats });
}

export const GET = withErrorHandler(getQuickStats);
