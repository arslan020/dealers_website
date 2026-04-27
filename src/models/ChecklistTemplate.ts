import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export interface ITemplateTask {
    _id: Types.ObjectId;
    name: string;
    order: number;
}

export interface IChecklistTemplate extends Document {
    tenantId: Types.ObjectId;
    name: string;
    tasks: ITemplateTask[];
    createdAt: Date;
    updatedAt: Date;
}

const TemplateTaskSchema = new Schema<ITemplateTask>({
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
});

const ChecklistTemplateSchema = new Schema<IChecklistTemplate>(
    {
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        name: { type: String, required: true, trim: true },
        tasks: { type: [TemplateTaskSchema], default: [] },
    },
    { timestamps: true }
);

const ChecklistTemplate = models.ChecklistTemplate || model<IChecklistTemplate>('ChecklistTemplate', ChecklistTemplateSchema);
export default ChecklistTemplate;
