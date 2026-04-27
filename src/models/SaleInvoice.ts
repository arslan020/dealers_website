import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface ILineItem {
    name: string;
    description?: string;
    priceExcVat: number;
    vatRate: 'No VAT' | '5%' | '20%';
    isVehicle?: boolean;
}

export interface IPartExchange {
    vrm: string;
    vehicleName?: string;
    vin?: string;
    mileage?: number;
    price: number;
    vatRate: 'No VAT' | '5%' | '20%';
    createPurchaseInvoice: boolean;
    addToVehicles: boolean;
}

export interface IPayment {
    date: string;
    amount: number;
    method: 'Cash' | 'Card' | 'Bank Transfer' | 'Finance' | 'Other';
    note?: string;
}

export interface ICredit {
    name: string;
    description?: string;
    quantity: number;
    amount: number;
    vatRate: 'No VAT' | '5%' | '20%';
}

export interface ISaleInvoice extends Document {
    vehicleId?: mongoose.Types.ObjectId;
    vehicleVrm?: string;
    customerId: mongoose.Types.ObjectId;
    assignedUserId?: mongoose.Types.ObjectId;
    tenantId: mongoose.Types.ObjectId;
    type: 'invoice' | 'order';
    invoiceCategory: 'sale' | 'aftersale' | 'finance_provider';
    status: 'draft' | 'issued' | 'paid' | 'credited' | 'cancelled' | 'void';
    invoiceNumber: string;
    invoiceType: 'VAT Invoice' | 'Margin Scheme';
    invoiceDate: string;
    timeOfSupply?: string;
    invoiceNotes?: string;
    termsAndConditions?: string;
    lineItems: ILineItem[];
    partExchanges: IPartExchange[];
    finance?: {
        amount: number;
        providerId?: mongoose.Types.ObjectId;
        providerName?: string;
        generateProviderInvoice: boolean;
        customerDeposit: number;
        paidBy?: string;
    };
    payments: IPayment[];
    credits: ICredit[];
    handoverComplete: boolean;
    handoverAt?: Date;
    issuedAt?: Date;
    paidAt?: Date;
    cancelledAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const LineItemSchema = new Schema<ILineItem>({
    name: { type: String, required: true },
    description: { type: String },
    priceExcVat: { type: Number, required: true },
    vatRate: { type: String, enum: ['No VAT', '5%', '20%'], default: 'No VAT' },
    isVehicle: { type: Boolean, default: false },
}, { _id: false });

const PartExchangeSchema = new Schema<IPartExchange>({
    vrm: { type: String, required: true, uppercase: true, trim: true },
    vehicleName: { type: String, trim: true },
    vin: { type: String, trim: true },
    mileage: { type: Number },
    price: { type: Number, default: 0 },
    vatRate: { type: String, enum: ['No VAT', '5%', '20%'], default: 'No VAT' },
    createPurchaseInvoice: { type: Boolean, default: false },
    addToVehicles: { type: Boolean, default: true },
}, { _id: false });

const PaymentSchema = new Schema<IPayment>({
    date: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['Cash', 'Card', 'Bank Transfer', 'Finance', 'Other'], default: 'Cash' },
    note: { type: String, trim: true },
}, { _id: false });

const CreditSchema = new Schema<ICredit>({
    name: { type: String, required: true },
    description: { type: String },
    quantity: { type: Number, default: 1 },
    amount: { type: Number, required: true },
    vatRate: { type: String, enum: ['No VAT', '5%', '20%'], default: 'No VAT' },
}, { _id: false });

const SaleInvoiceSchema = new Schema<ISaleInvoice>(
    {
        vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
        vehicleVrm: { type: String, trim: true, uppercase: true },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
        assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        type: { type: String, enum: ['invoice', 'order'], default: 'invoice' },
        invoiceCategory: { type: String, enum: ['sale', 'aftersale', 'finance_provider'], default: 'sale' },
        status: { type: String, enum: ['draft', 'issued', 'paid', 'credited', 'cancelled', 'void'], default: 'draft', index: true },
        invoiceNumber: { type: String, required: true },
        invoiceType: { type: String, enum: ['VAT Invoice', 'Margin Scheme'], default: 'Margin Scheme' },
        invoiceDate: { type: String, required: true },
        timeOfSupply: { type: String },
        invoiceNotes: { type: String },
        termsAndConditions: { type: String },
        lineItems: [LineItemSchema],
        partExchanges: [PartExchangeSchema],
        finance: {
            amount: { type: Number, default: 0 },
            providerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
            providerName: { type: String },
            generateProviderInvoice: { type: Boolean, default: false },
            customerDeposit: { type: Number, default: 0 },
            paidBy: { type: String },
        },
        payments: [PaymentSchema],
        credits: [CreditSchema],
        handoverComplete: { type: Boolean, default: false },
        handoverAt: { type: Date },
        issuedAt: { type: Date },
        paidAt: { type: Date },
        cancelledAt: { type: Date },
    },
    { timestamps: true }
);

const SaleInvoice = models.SaleInvoice || model<ISaleInvoice>('SaleInvoice', SaleInvoiceSchema);
export default SaleInvoice;
