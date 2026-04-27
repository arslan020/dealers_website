import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export interface IJobComment {
    _id: Types.ObjectId;
    text: string;
    authorId: Types.ObjectId;
    createdAt: Date;
}

export interface ITimeCard {
    _id: Types.ObjectId;
    staffId: Types.ObjectId;
    date: Date;
    hours: number;
    minutes: number;
    notes?: string;
    createdAt: Date;
}

export interface IJob {
    tenantId: Types.ObjectId;
    vehicleId: Types.ObjectId;
    jobType: string;
    details?: string;
    status?: 'Incomplete' | 'Complete';
    location?: string;
    dueAt?: Date | null;
    assigneeId?: Types.ObjectId | null;
    createdBy?: Types.ObjectId | null;
    comments?: IJobComment[];
    timeCards?: ITimeCard[];
}

export interface IJobDoc extends IJob, Document {}

const TimeCardSchema = new Schema<ITimeCard>({
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    hours: { type: Number, default: 0 },
    minutes: { type: Number, default: 0 },
    notes: { type: String, trim: true, default: '' },
    createdAt: { type: Date, default: () => new Date() },
});

const CommentSchema = new Schema<IJobComment>({
    text: { type: String, required: true, trim: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: () => new Date() },
});

const JobSchema = new Schema<IJobDoc>(
    {
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
        jobType: { type: String, required: true, trim: true, index: true },
        details: { type: String, trim: true, default: '' },
        status: {
            type: String,
            enum: ['Incomplete', 'Complete'],
            default: 'Incomplete',
        },
        location: { type: String, trim: true, default: '' },
        dueAt: { type: Date, default: null },
        assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        comments: { type: [CommentSchema], default: [] },
        timeCards: { type: [TimeCardSchema], default: [] },
    },
    { timestamps: true }
);

JobSchema.index({ tenantId: 1, jobType: 1 });

const Job = models.Job || model<IJobDoc>('Job', JobSchema);
export default Job;
