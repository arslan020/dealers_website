import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import ContactTag from '@/models/ContactTag';
import { getSession } from '@/lib/session';

export async function GET() {
    try {
        const session = await getSession();
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        await connectToDatabase();
        const tags = await ContactTag.find({ tenantId: session.tenantId }).sort({ name: 1 }).lean();
        return NextResponse.json({ ok: true, tags });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        await connectToDatabase();
        const body = await req.json();
        const tag = await ContactTag.create({ ...body, tenantId: session.tenantId });
        return NextResponse.json({ ok: true, tag }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    // Bulk save tags — replace all tags for tenant
    try {
        const session = await getSession();
        if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        await connectToDatabase();
        const { tags } = await req.json();
        // Delete all and re-insert
        await ContactTag.deleteMany({ tenantId: session.tenantId });
        if (tags && tags.length > 0) {
            await ContactTag.insertMany(tags.map((t: any) => ({ ...t, tenantId: session.tenantId })));
        }
        const saved = await ContactTag.find({ tenantId: session.tenantId }).sort({ name: 1 }).lean();
        return NextResponse.json({ ok: true, tags: saved });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
