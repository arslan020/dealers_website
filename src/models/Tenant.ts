import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface ITenant extends Document {
    name: string;
    status: 'active' | 'suspended';
    plan: 'trial' | 'basic' | 'pro';
    createdBy?: mongoose.Types.ObjectId;
    autoTraderConfig?: {
        apiKey: string;
        apiSecret: string;
        dealerId: string;
        postcode?: string;
    };
    businessProfile?: {
        businessName?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        postcode?: string;
        country?: string;
        vatNumber?: string;
        companyNumber?: string;
        telephone?: string;
        email?: string;
        website?: string;
    };
    createdAt: Date;
}

const TenantSchema = new Schema<ITenant>(
    {
        name: { type: String, required: true, trim: true },
        status: { type: String, enum: ['active', 'suspended'], default: 'active' },
        plan: { type: String, enum: ['trial', 'basic', 'pro'], default: 'trial' },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        autoTraderConfig: {
            apiKey: { type: String, trim: true },
            apiSecret: { type: String, trim: true },
            dealerId: { type: String, trim: true },
            postcode: { type: String, trim: true, uppercase: true },
        },
        businessProfile: {
            businessName: { type: String, trim: true },
            addressLine1: { type: String, trim: true },
            addressLine2: { type: String, trim: true },
            city: { type: String, trim: true },
            postcode: { type: String, trim: true },
            country: { type: String, trim: true },
            vatNumber: { type: String, trim: true },
            companyNumber: { type: String, trim: true },
            telephone: { type: String, trim: true },
            email: { type: String, trim: true },
            website: { type: String, trim: true },
        },
    },
    { timestamps: true }
);

const Tenant = models.Tenant || model<ITenant>('Tenant', TenantSchema);
export default Tenant;
