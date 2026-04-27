import mongoose, { Schema, model, models } from 'mongoose';

export interface ICalendar {
    tenantId: mongoose.Types.ObjectId;
    name: string;
    color: string;
    isPrimary: boolean;
}

const CalendarSchema = new Schema<ICalendar>(
    {
        tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
        name: { type: String, required: true, trim: true },
        color: { type: String, default: '#4D7CFF' },
        isPrimary: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const Calendar = models.Calendar || model<ICalendar>('Calendar', CalendarSchema);
export default Calendar;
