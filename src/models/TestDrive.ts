import mongoose, { Schema, model, models } from 'mongoose';

export interface ITestDrive {
    tenantId: mongoose.Types.ObjectId;
    vehicleId: mongoose.Types.ObjectId;
    // Customer
    customerId?: mongoose.Types.ObjectId;
    customerName: string;
    customerEmail?: string;
    customerAddress?: string;
    // License
    drivingLicenseNumber?: string;
    drivingLicenseCheckCode?: string;
    nationalInsuranceNumber?: string;
    dateOfBirth?: string;
    licenseCheckedDate?: string;
    checkedByUserId?: mongoose.Types.ObjectId;
    checkedByName?: string;
    // Session
    startTime: Date;
    endTime?: Date;
    intendedReturnTime?: Date;
    fuelLevel?: number;
    conditionReportId?: mongoose.Types.ObjectId;
    conditionReportLabel?: string;
    handoverLocation?: string;
    notes?: string;
    consentToDataStorage: boolean;
    status: 'active' | 'completed';
    // eSign
    eSignatureDataUrl?: string;
    eSignedBy?: string;
    eSignedAt?: Date;
    eSignedIp?: string;
    eSignedUserAgent?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const TestDriveSchema = new Schema<ITestDrive>(
    {
        tenantId:              { type: Schema.Types.ObjectId, required: true, index: true },
        vehicleId:             { type: Schema.Types.ObjectId, required: true, index: true },
        customerId:            { type: Schema.Types.ObjectId, ref: 'Customer' },
        customerName:          { type: String, required: true, trim: true },
        customerEmail:         { type: String, trim: true },
        customerAddress:       { type: String, trim: true },
        drivingLicenseNumber:  { type: String, trim: true },
        drivingLicenseCheckCode: { type: String, trim: true },
        nationalInsuranceNumber: { type: String, trim: true },
        dateOfBirth:           { type: String, trim: true },
        licenseCheckedDate:    { type: String, trim: true },
        checkedByUserId:       { type: Schema.Types.ObjectId, ref: 'User' },
        checkedByName:         { type: String, trim: true },
        startTime:             { type: Date, required: true },
        endTime:               { type: Date },
        intendedReturnTime:    { type: Date },
        fuelLevel:             { type: Number, min: 0, max: 100 },
        conditionReportId:     { type: Schema.Types.ObjectId, ref: 'ConditionReport' },
        conditionReportLabel:  { type: String, trim: true },
        handoverLocation:      { type: String, trim: true },
        notes:                 { type: String, trim: true },
        consentToDataStorage:  { type: Boolean, default: false },
        status:                { type: String, enum: ['active', 'completed'], default: 'active' },
        eSignatureDataUrl:     { type: String },
        eSignedBy:             { type: String, trim: true },
        eSignedAt:             { type: Date },
        eSignedIp:             { type: String, trim: true },
        eSignedUserAgent:      { type: String, trim: true },
    },
    { timestamps: true }
);

TestDriveSchema.index({ tenantId: 1, vehicleId: 1, status: 1 });

if (process.env.NODE_ENV === 'development') delete (models as any).TestDrive;
const TestDrive = models.TestDrive || model<ITestDrive>('TestDrive', TestDriveSchema);
export default TestDrive;
