import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface ILead extends Document {
    customerId: mongoose.Types.ObjectId;
    vehicleId?: mongoose.Types.ObjectId;
    assignedTo?: mongoose.Types.ObjectId;
    message?: string;
    status: 'NEW_LEAD' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'WON' | 'LOST' | 'CLOSED';
    platform: 'AutoTrader' | 'Website' | 'Manual';
    dealId?: string;
    messagesId?: string;
    intentScore?: number;
    intentLevel?: string;
    tenantId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
    {
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
        vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
        assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
        message: { type: String, trim: true },
        status: {
            type: String,
            enum: ['NEW_LEAD', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WON', 'LOST', 'CLOSED'],
            default: 'NEW_LEAD',
            index: true,
        },
        platform: {
            type: String,
            enum: ['AutoTrader', 'Website', 'Manual'],
            default: 'Manual',
        },
        dealId: { type: String, unique: true, sparse: true, index: true },
        messagesId: { type: String, sparse: true, index: true },
        intentScore: { type: Number },
        intentLevel: { type: String },
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    },
    {
        timestamps: true,
    }
);

const Lead = models.Lead || model<ILead>('Lead', LeadSchema);
export default Lead;
