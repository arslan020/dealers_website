import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface ICustomer extends Document {
    firstName: string;
    lastName?: string;
    businessName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    vatNumber?: string;
    address?: {
        line1?: string;
        city?: string;
        postcode?: string;
        country?: string;
    };
    avatarColor?: string;
    contactTypes?: string[]; // Customer, Supplier, Service Provider, Partner, VIP
    source: 'AutoTrader' | 'Website' | 'Walk-in' | 'Referral' | 'Other';
    status: 'Lead' | 'Active' | 'Inactive';
    loginEnabled?: boolean;
    marketingConsent?: boolean;
    stopFollowUps?: {
        oncePaysInvoice?: boolean;
        vehicleReservedEmail?: boolean;
    };
    tags?: string[];
    // Legacy fields
    type?: 'Private' | 'Limited Company' | 'Soletrader' | 'Other';
    vatRegistrationStatus?: 'Registered' | 'Not Registered' | 'Unknown';
    autoTraderDealId?: string;
    buyingSignals?: {
        dealIntentScore?: number;
        intent?: 'High' | 'Medium' | 'Low';
        localConsumer?: boolean;
        lastUpdated?: Date;
    };
    notes?: string;
    tenantId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
    {
        firstName: { type: String, required: true, trim: true },
        lastName: { type: String, trim: true },
        businessName: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        mobile: { type: String, trim: true },
        vatNumber: { type: String, trim: true },
        address: {
            line1: { type: String, trim: true },
            city: { type: String, trim: true },
            postcode: { type: String, trim: true, uppercase: true },
            country: { type: String, trim: true, default: 'United Kingdom' },
        },
        avatarColor: { type: String, default: '#4D7CFF' },
        contactTypes: [{ type: String }],
        source: {
            type: String,
            enum: ['AutoTrader', 'Website', 'Walk-in', 'Referral', 'Other'],
            default: 'Walk-in',
        },
        status: {
            type: String,
            enum: ['Lead', 'Active', 'Inactive'],
            default: 'Active',
        },
        loginEnabled: { type: Boolean, default: false },
        marketingConsent: { type: Boolean, default: false },
        stopFollowUps: {
            oncePaysInvoice: { type: Boolean, default: false },
            vehicleReservedEmail: { type: Boolean, default: false },
        },
        tags: [{ type: String }],
        // Legacy
        type: {
            type: String,
            enum: ['Private', 'Limited Company', 'Soletrader', 'Other'],
        },
        vatRegistrationStatus: {
            type: String,
            enum: ['Registered', 'Not Registered', 'Unknown'],
            default: 'Unknown',
        },
        autoTraderDealId: { type: String, trim: true, sparse: true },
        buyingSignals: {
            dealIntentScore: { type: Number },
            intent: { type: String, enum: ['High', 'Medium', 'Low'] },
            localConsumer: { type: Boolean },
            lastUpdated: { type: Date },
        },
        notes: { type: String, trim: true },
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    },
    { timestamps: true }
);

CustomerSchema.index({ tenantId: 1, email: 1 });
CustomerSchema.index({ tenantId: 1, phone: 1 });
CustomerSchema.index({ tenantId: 1, autoTraderDealId: 1 }, { sparse: true });

const Customer = (models.Customer as mongoose.Model<ICustomer>) || model<ICustomer>('Customer', CustomerSchema);
export default Customer;
