import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface IPurchaseLineItem {
    name: string;
    description?: string;
    priceExcVat: number;
    vatRate: 'No VAT' | '5%' | '20%';
}

export interface IPurchaseInvoice extends Document {
    tenantId: mongoose.Types.ObjectId;
    contactId: mongoose.Types.ObjectId;
    linkedVehicleId?: mongoose.Types.ObjectId;
    linkedVehicleVrm?: string;
    linkedSaleInvoiceId?: mongoose.Types.ObjectId;
    reference?: string;
    purchaseNumber: string;
    status: 'draft' | 'issued' | 'paid' | 'void';
    type: 'VAT' | 'Marginal' | 'No VAT';
    invoiceDate: string;
    lineItems: IPurchaseLineItem[];
    adjustment: number;
    notes?: string;
    documentUrl?: string;
    paidAt?: Date;
    issuedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PurchaseLineItemSchema = new Schema<IPurchaseLineItem>({
    name: { type: String, required: true },
    description: { type: String },
    priceExcVat: { type: Number, required: true },
    vatRate: { type: String, enum: ['No VAT', '5%', '20%'], default: 'No VAT' },
}, { _id: false });

const PurchaseInvoiceSchema = new Schema<IPurchaseInvoice>(
    {
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        contactId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
        linkedVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
        linkedVehicleVrm: { type: String, trim: true, uppercase: true },
        linkedSaleInvoiceId: { type: Schema.Types.ObjectId, ref: 'SaleInvoice' },
        reference: { type: String, trim: true },
        purchaseNumber: { type: String, required: true },
        status: { type: String, enum: ['draft', 'issued', 'paid', 'void'], default: 'draft', index: true },
        type: { type: String, enum: ['VAT', 'Marginal', 'No VAT'], default: 'Marginal' },
        invoiceDate: { type: String, required: true },
        lineItems: [PurchaseLineItemSchema],
        adjustment: { type: Number, default: 0 },
        notes: { type: String },
        documentUrl: { type: String },
        paidAt: { type: Date },
        issuedAt: { type: Date },
    },
    { timestamps: true }
);

const PurchaseInvoice = models.PurchaseInvoice || model<IPurchaseInvoice>('PurchaseInvoice', PurchaseInvoiceSchema);
export default PurchaseInvoice;
