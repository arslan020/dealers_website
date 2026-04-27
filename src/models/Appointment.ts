import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface IAppointment extends Document {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    tenantId: mongoose.Types.ObjectId;
    creatorId: mongoose.Types.ObjectId;
    customerName?: string;
    customerPhone?: string;
    // Extended fields
    apptType: 'appointment' | 'reminder';
    calendarId?: mongoose.Types.ObjectId;
    calendarName?: string;
    durationMinutes?: number;
    followUpAfterMinutes?: number;
    customerId?: mongoose.Types.ObjectId;
    staffUserIds?: mongoose.Types.ObjectId[];
    purpose?: string;
    vehicleId?: mongoose.Types.ObjectId;
    vehicleIds?: string[];
    notes?: string;
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
    {
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        startTime: { type: Date, required: true },
        endTime: { type: Date, required: true },
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
        creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        customerName: { type: String, trim: true },
        customerPhone: { type: String, trim: true },
        apptType: { type: String, enum: ['appointment', 'reminder'], default: 'appointment' },
        calendarId: { type: Schema.Types.ObjectId, ref: 'Calendar' },
        calendarName: { type: String, trim: true },
        durationMinutes: { type: Number },
        followUpAfterMinutes: { type: Number },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
        staffUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        purpose: { type: String, trim: true },
        vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
        vehicleIds: [{ type: String }],
        notes: { type: String, trim: true },
        completed: { type: Boolean, default: false },
    },
    { timestamps: true }
);

AppointmentSchema.index({ tenantId: 1, startTime: 1 });
AppointmentSchema.index({ tenantId: 1, vehicleId: 1 });

// Delete cached model in development so schema changes via hot-reload take effect
if (process.env.NODE_ENV === 'development') delete (models as any).Appointment;
const Appointment = models.Appointment || model<IAppointment>('Appointment', AppointmentSchema);
export default Appointment;
