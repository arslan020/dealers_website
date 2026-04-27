import mongoose, { Schema, model, models } from 'mongoose';

export interface IDocumentItem {
    documentId: mongoose.Types.ObjectId;
    documentName: string;
}

export interface IDocumentSignature {
    tenantId: mongoose.Types.ObjectId;
    customerId?: mongoose.Types.ObjectId;
    customerName?: string;
    customerEmail?: string;
    invoiceId?: mongoose.Types.ObjectId;
    invoiceNumber?: string;
    documents: IDocumentItem[];
    type: 'esign' | 'email';
    status: 'requested' | 'signed' | 'declined';
    token: string;
    sentAt: Date;
    signedAt?: Date;
    declinedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

const DocumentItemSchema = new Schema<IDocumentItem>(
    {
        documentId:   { type: Schema.Types.ObjectId, required: true },
        documentName: { type: String, required: true },
    },
    { _id: false }
);

const DocumentSignatureSchema = new Schema<IDocumentSignature>(
    {
        tenantId:      { type: Schema.Types.ObjectId, required: true, index: true },
        customerId:    { type: Schema.Types.ObjectId, ref: 'Customer' },
        customerName:  { type: String, trim: true },
        customerEmail: { type: String, trim: true },
        invoiceId:     { type: Schema.Types.ObjectId, ref: 'SaleInvoice' },
        invoiceNumber: { type: String, trim: true },
        documents:     [DocumentItemSchema],
        type:          { type: String, enum: ['esign', 'email'], required: true },
        status:        { type: String, enum: ['requested', 'signed', 'declined'], default: 'requested' },
        token:         { type: String, required: true, unique: true },
        sentAt:        { type: Date, default: Date.now },
        signedAt:      { type: Date },
        declinedAt:    { type: Date },
    },
    { timestamps: true }
);

const DocumentSignature = models.DocumentSignature || model<IDocumentSignature>('DocumentSignature', DocumentSignatureSchema);
export default DocumentSignature;
