import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import DocumentSignature from '@/models/DocumentSignature';
import Customer from '@/models/Customer';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';

async function listSignatures(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    await connectToDatabase();
    const tid = new mongoose.Types.ObjectId(tenantId);

    const filter: Record<string, unknown> = { tenantId: tid };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const [sigs, total] = await Promise.all([
        DocumentSignature.find(filter)
            .populate({ path: 'customerId', model: Customer, select: 'firstName lastName businessName email' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        DocumentSignature.countDocuments(filter),
    ]);

    let filtered = sigs as any[];
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(s => {
            const name = (s.customerName ?? '').toLowerCase();
            const email = (s.customerEmail ?? '').toLowerCase();
            return name.includes(q) || email.includes(q) || (s.invoiceNumber ?? '').toLowerCase().includes(q);
        });
    }

    return NextResponse.json({ ok: true, signatures: filtered, total, page, limit });
}

export const GET = withErrorHandler(listSignatures);
