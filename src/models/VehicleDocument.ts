import mongoose, { Schema, model, models } from 'mongoose';

export interface IVehicleDocument {
    tenantId: mongoose.Types.ObjectId;
    vehicleId: mongoose.Types.ObjectId;
    name: string;
    description?: string;
    mimeType: string;
    size: number;
    status: 'private' | 'public';
    fileData: Buffer;
    createdAt?: Date;
    updatedAt?: Date;
}

const VehicleDocumentSchema = new Schema<IVehicleDocument>(
    {
        tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
        vehicleId:   { type: Schema.Types.ObjectId, required: true, index: true },
        name:        { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: '' },
        mimeType:    { type: String, required: true },
        size:        { type: Number, required: true },
        status:      { type: String, enum: ['private', 'public'], default: 'private' },
        fileData:    { type: Buffer, required: true },
    },
    { timestamps: true }
);

const VehicleDocument = models.VehicleDocument || model<IVehicleDocument>('VehicleDocument', VehicleDocumentSchema);
export default VehicleDocument;
