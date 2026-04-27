import mongoose, { Schema, Document, model, models } from 'mongoose';

export type UserRole = 'SUPER_ADMIN' | 'DEALER_ADMIN' | 'EMPLOYEE';

export interface IUser extends Document {
    email: string;
    passwordHash: string;
    name: string;
    phone?: string;
    role: UserRole;
    tenantId?: mongoose.Types.ObjectId;
    isActive: boolean;
    permissions: {
        vehicles: boolean;
        sales: boolean;
        tasks: boolean;
        analytics: boolean;
        advertising: boolean;
        inventory: boolean;
        addVehicle: boolean;
        quickCheck: boolean;
        canLookupAutoTrader: boolean;
        canPublishAutoTrader: boolean;
        canViewValuations: boolean;
        canManageMessages: boolean;
    };
    createdAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        name: { type: String, required: true, trim: true },
        phone: { type: String, trim: true },
        role: {
            type: String,
            enum: ['SUPER_ADMIN', 'DEALER_ADMIN', 'EMPLOYEE'],
            required: true,
        },
        // tenantId: required for DEALER_ADMIN and EMPLOYEE, null for SUPER_ADMIN
        // Enforcement is done at the API layer, not the model layer to avoid Mongoose typing issues.
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
        isActive: { type: Boolean, default: true },
        permissions: {
            vehicles: { type: Boolean, default: true },
            sales: { type: Boolean, default: true },
            tasks: { type: Boolean, default: true },
            analytics: { type: Boolean, default: true },
            advertising: { type: Boolean, default: true },
            inventory: { type: Boolean, default: true },
            addVehicle: { type: Boolean, default: true },
            quickCheck: { type: Boolean, default: true },
            canLookupAutoTrader: { type: Boolean, default: true },
            canPublishAutoTrader: { type: Boolean, default: true },
            canViewValuations: { type: Boolean, default: true },
            canManageMessages: { type: Boolean, default: true },
        },
    },
    { timestamps: true }
);

const User = models.User || model<IUser>('User', UserSchema);
export default User;
