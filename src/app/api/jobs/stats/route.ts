import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Job from '@/models/Job';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

/** GET /api/jobs/stats — per jobType: open jobs on in-stock vs sold vehicles + preparation insights */
async function getStatsHandler(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const tid = new mongoose.Types.ObjectId(tenantId);
    const now = new Date();

    // Jobs by type (stock vs sold)
    const rows = await Job.aggregate([
        { $match: { tenantId: tid } },
        {
            $lookup: {
                from: 'vehicles',
                localField: 'vehicleId',
                foreignField: '_id',
                as: 'vehicle',
            },
        },
        { $unwind: '$vehicle' },
        {
            $group: {
                _id: '$jobType',
                total: { $sum: 1 },
                stock: {
                    $sum: {
                        $cond: [{ $eq: ['$vehicle.status', 'In Stock'] }, 1, 0],
                    },
                },
                sold: {
                    $sum: {
                        $cond: [{ $eq: ['$vehicle.status', 'Sold'] }, 1, 0],
                    },
                },
            },
        },
    ]);

    const byType: Record<string, { total: number; stock: number; sold: number }> = {};
    for (const r of rows) {
        const key = r._id as string;
        byType[key] = {
            total: r.total || 0,
            stock: r.stock || 0,
            sold: r.sold || 0,
        };
    }

    // Preparation insights aggregates
    const [
        totalIncomplete,
        totalComplete,
        overdueJobs,
        unassignedJobs,
        stockJobs,
        soldJobs,
    ] = await Promise.all([
        Job.countDocuments({ tenantId: tid, status: 'Incomplete' }),
        Job.countDocuments({ tenantId: tid, status: 'Complete' }),
        Job.countDocuments({ tenantId: tid, status: 'Incomplete', dueAt: { $lt: now, $ne: null } }),
        Job.countDocuments({ tenantId: tid, status: 'Incomplete', $or: [{ assigneeId: null }, { assigneeId: { $exists: false } }] }),
        // Jobs on In Stock vehicles
        Job.aggregate([
            { $match: { tenantId: tid, status: 'Incomplete' } },
            { $lookup: { from: 'vehicles', localField: 'vehicleId', foreignField: '_id', as: 'v' } },
            { $unwind: '$v' },
            { $match: { 'v.status': 'In Stock' } },
            { $count: 'n' },
        ]).then((r) => r[0]?.n ?? 0),
        // Jobs on Sold vehicles
        Job.aggregate([
            { $match: { tenantId: tid, status: 'Incomplete' } },
            { $lookup: { from: 'vehicles', localField: 'vehicleId', foreignField: '_id', as: 'v' } },
            { $unwind: '$v' },
            { $match: { 'v.status': 'Sold' } },
            { $count: 'n' },
        ]).then((r) => r[0]?.n ?? 0),
    ]);

    const insights = {
        totalIncomplete,
        totalComplete,
        overdueJobs,
        unassignedJobs,
        stockJobs: stockJobs as number,
        soldJobs: soldJobs as number,
        totalJobs: totalIncomplete + totalComplete,
    };

    return NextResponse.json({ ok: true, byType, insights });
}

export const GET = withErrorHandler(getStatsHandler);
