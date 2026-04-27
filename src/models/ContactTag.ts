import mongoose, { Schema, model, models } from 'mongoose';

const ContactTagSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: ['Default', 'Checkbox'], default: 'Default' },
        isDefault: { type: Boolean, default: false },
        color: { type: String, default: '#10B981' },
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    },
    { timestamps: true }
);

ContactTagSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const ContactTag = models.ContactTag || model('ContactTag', ContactTagSchema);
export default ContactTag;
