import mongoose, { Schema, model, models } from 'mongoose';

export interface ISalesDocument {
    tenantId: mongoose.Types.ObjectId;
    name: string;
    group?: string;
    description?: string;
    mimeType: string;
    size: number;
    fileData: Buffer;
    createdAt?: Date;
    updatedAt?: Date;
}

const SalesDocumentSchema = new Schema<ISalesDocument>(
    {
        tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
        name:        { type: String, required: true, trim: true },
        group:       { type: String, trim: true },
        description: { type: String, trim: true },
        mimeType:    { type: String, required: true },
        size:        { type: Number, required: true },
        fileData:    { type: Buffer, required: true },
    },
    { timestamps: true }
);

const SalesDocument = models.SalesDocument || model<ISalesDocument>('SalesDocument', SalesDocumentSchema);
export default SalesDocument;
