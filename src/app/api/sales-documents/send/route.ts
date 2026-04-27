import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import SalesDocument from '@/models/SalesDocument';
import DocumentSignature from '@/models/DocumentSignature';
import Customer from '@/models/Customer';
import { withErrorHandler } from '@/lib/api-handler';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

async function sendDocuments(req: NextRequest) {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { customerId, documentIds, type, invoiceId, invoiceNumber } = body;

    if (!customerId) return NextResponse.json({ ok: false, error: 'customerId required' }, { status: 400 });
    if (!documentIds?.length) return NextResponse.json({ ok: false, error: 'Select at least one document' }, { status: 400 });
    if (!['esign', 'email'].includes(type)) return NextResponse.json({ ok: false, error: 'Invalid type' }, { status: 400 });

    await connectToDatabase();
    const tid = new mongoose.Types.ObjectId(tenantId);

    const [customer, docs] = await Promise.all([
        Customer.findOne({ _id: customerId, tenantId: tid }, { firstName: 1, lastName: 1, businessName: 1, email: 1 }).lean(),
        SalesDocument.find({ _id: { $in: documentIds.map((d: string) => new mongoose.Types.ObjectId(d)) }, tenantId: tid }, { name: 1 }).lean(),
    ]);

    if (!customer) return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });
    if (!docs.length) return NextResponse.json({ ok: false, error: 'No valid documents found' }, { status: 404 });

    const customerName = (customer as any).businessName || `${(customer as any).firstName ?? ''} ${(customer as any).lastName ?? ''}`.trim();

    const signature = await DocumentSignature.create({
        tenantId: tid,
        customerId: new mongoose.Types.ObjectId(customerId),
        customerName,
        customerEmail: (customer as any).email,
        invoiceId: invoiceId ? new mongoose.Types.ObjectId(invoiceId) : undefined,
        invoiceNumber,
        documents: docs.map((d: any) => ({ documentId: d._id, documentName: d.name })),
        type,
        status: 'requested',
        token: randomUUID(),
        sentAt: new Date(),
    });

    return NextResponse.json({ ok: true, signatureId: String(signature._id) }, { status: 201 });
}

export const POST = withErrorHandler(sendDocuments);
