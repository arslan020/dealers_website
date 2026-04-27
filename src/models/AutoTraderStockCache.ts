import mongoose, { Schema, Document } from 'mongoose';

export interface IAutoTraderStockCache extends Document {
    tenantId: mongoose.Types.ObjectId;
    stock: mongoose.Schema.Types.Mixed[];
    total: number;
    fetchedAt: Date;
    nextAllowedFetchAt: Date;
}

const AutoTraderStockCacheSchema = new Schema({
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    stock: { type: Schema.Types.Mixed, default: [] },
    total: { type: Number, default: 0 },
    fetchedAt: { type: Date, default: null },
    nextAllowedFetchAt: { type: Date, default: null },
});

export default mongoose.models.AutoTraderStockCache ||
    mongoose.model('AutoTraderStockCache', AutoTraderStockCacheSchema);

