import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Job from '@/models/Job';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function deleteCommentHandler(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; commentId: string }> }
) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id, commentId } = await params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(commentId)) {
        return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });
    }

    await connectToDatabase();

    const job = await Job.findOneAndUpdate(
        { _id: id, tenantId },
        { $pull: { comments: { _id: new mongoose.Types.ObjectId(commentId) } } },
        { new: true }
    ).lean();

    if (!job) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
}

export const DELETE = withErrorHandler(deleteCommentHandler);
