import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SalesDocument from '@/models/SalesDocument';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

type Ctx = { params: Promise<{ id: string }> };

async function serveFile(req: NextRequest, context: Ctx) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return new NextResponse('Unauthorized', { status: 401 });
    const { id } = await context.params;
    const download = new URL(req.url).searchParams.get('download') === '1';

    await connectToDatabase();
    const doc = await SalesDocument.findOne({ _id: id, tenantId: new mongoose.Types.ObjectId(tenantId) });
    if (!doc) return new NextResponse('Not found', { status: 404 });

    const disposition = download
        ? `attachment; filename="${encodeURIComponent(doc.name)}.pdf"`
        : `inline; filename="${encodeURIComponent(doc.name)}.pdf"`;

    return new NextResponse(doc.fileData, {
        headers: {
            'Content-Type': doc.mimeType || 'application/pdf',
            'Content-Disposition': disposition,
            'Content-Length': String(doc.size),
        },
    });
}

export const GET = withErrorHandler((req, ctx) => serveFile(req, ctx as any));
