import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export interface IChecklistTask {
    _id: Types.ObjectId;
    name: string;
    done: boolean;
    notes: string;
    order: number;
}

export interface IVehicleChecklist extends Document {
    tenantId: Types.ObjectId;
    vehicleId: Types.ObjectId;
    templateId: Types.ObjectId | null;
    templateName: string;
    tasks: IChecklistTask[];
    notes: string;
    createdAt: Date;
    updatedAt: Date;
}

const ChecklistTaskSchema = new Schema<IChecklistTask>({
    name: { type: String, required: true, trim: true },
    done: { type: Boolean, default: false },
    notes: { type: String, default: '', trim: true },
    order: { type: Number, default: 0 },
});

const VehicleChecklistSchema = new Schema<IVehicleChecklist>(
    {
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
        templateId: { type: Schema.Types.ObjectId, ref: 'ChecklistTemplate', default: null },
        templateName: { type: String, trim: true, default: '' },
        tasks: { type: [ChecklistTaskSchema], default: [] },
        notes: { type: String, trim: true, default: '' },
    },
    { timestamps: true }
);

VehicleChecklistSchema.index({ tenantId: 1, vehicleId: 1 }, { unique: true });

const VehicleChecklist = models.VehicleChecklist || model<IVehicleChecklist>('VehicleChecklist', VehicleChecklistSchema);
export default VehicleChecklist;
