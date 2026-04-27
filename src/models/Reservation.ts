import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface IReservation extends Document {
    vehicleId: mongoose.Types.ObjectId;
    customerId: mongoose.Types.ObjectId;
    tenantId: mongoose.Types.ObjectId;
    paymentMethod: 'No Payment' | 'Cash' | 'Bank Transfer' | 'Card';
    amountPaid: number;
    invoiceNumber: string;
    notes?: string;
    status: 'active' | 'cancelled';
    cancelType?: 'with_credit' | 'without_credit';
    reservedAt: Date;
    cancelledAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>(
    {
        vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
        customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        paymentMethod: { type: String, enum: ['No Payment', 'Cash', 'Bank Transfer', 'Card'], default: 'No Payment' },
        amountPaid: { type: Number, default: 0 },
        invoiceNumber: { type: String, required: true },
        notes: { type: String, trim: true },
        status: { type: String, enum: ['active', 'cancelled'], default: 'active', index: true },
        cancelType: { type: String, enum: ['with_credit', 'without_credit'] },
        reservedAt: { type: Date, default: Date.now },
        cancelledAt: { type: Date },
    },
    { timestamps: true }
);

const Reservation = models.Reservation || model<IReservation>('Reservation', ReservationSchema);
export default Reservation;
