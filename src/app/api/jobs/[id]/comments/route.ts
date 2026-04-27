import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Job from '@/models/Job';
import User from '@/models/User';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function addCommentHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const tenantId = req.headers.get('x-tenant-id');
    const userId = req.headers.get('x-user-id');
    if (!tenantId || !userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: 'Invalid ID' }, { status: 400 });

    const body = await req.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return NextResponse.json({ ok: false, error: 'Comment text required' }, { status: 400 });

    await connectToDatabase();

    const job = await Job.findOneAndUpdate(
        { _id: id, tenantId },
        {
            $push: {
                comments: {
                    _id: new mongoose.Types.ObjectId(),
                    text,
                    authorId: new mongoose.Types.ObjectId(userId),
                    createdAt: new Date(),
                },
            },
        },
        { new: true }
    ).lean() as any;

    if (!job) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    // Manually look up comment authors
    const rawComments = job.comments || [];
    const authorIds = [...new Set(
        rawComments.map((c: any) => c.authorId?.toString()).filter(Boolean)
    )];
    const authors = authorIds.length > 0
        ? await User.find({ _id: { $in: authorIds } }).select('name').lean() as any[]
        : [];
    const authorMap: Record<string, string> = {};
    authors.forEach((a: any) => { authorMap[String(a._id)] = a.name; });

    const comments = rawComments.map((c: any) => ({
        _id: String(c._id),
        text: c.text || '',
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
        author: c.authorId
            ? { _id: String(c.authorId), name: authorMap[String(c.authorId)] || 'Unknown' }
            : null,
    }));

    return NextResponse.json({ ok: true, comments });
}

export const POST = withErrorHandler(addCommentHandler);
