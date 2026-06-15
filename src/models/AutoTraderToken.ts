import mongoose, { Schema } from 'mongoose';

const AutoTraderTokenSchema = new Schema({
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
});

// MongoDB TTL index — auto-removes expired token documents
AutoTraderTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.AutoTraderToken ||
    mongoose.model('AutoTraderToken', AutoTraderTokenSchema);
