import mongoose, { Schema, model, models } from 'mongoose';

export interface IFaultPoint {
    idx: number;
    part: string;
    damage: string;
    detail: string;
    note: string;
    coords: { x: number; y: number };
    sectionId?: string;
    photoUrl?: string;
    fromPrevious?: boolean;
}

export interface ITyre {
    position: 'front-left' | 'front-right' | 'rear-left' | 'rear-right' | 'spare';
    treadDepth: string;
    condition: string;
    /** Tyre pressure (PSI) */
    psi?: string;
    /** Optional photo (e.g. data URL) */
    photo?: string;
}

export interface IConditionReport {
    vehicleId: string;
    tenantId: mongoose.Types.ObjectId;
    reportType: 'Appraisal' | 'PDI' | 'Service Check' | 'Other';
    staffMember: string;
    location: string;
    mileage: string;

    // Walk-around media (stored as data URLs for now)
    walkaround?: {
        front?: string;
        offside?: string;
        rear?: string;
        nearside?: string;
        nsFrontWheel?: string;
        nsRearWheel?: string;
        osFrontWheel?: string;
        osRearWheel?: string;
        video?: string;
        /** Optional note per media slot (parallel to keys above) */
        frontDesc?: string;
        offsideDesc?: string;
        rearDesc?: string;
        nearsideDesc?: string;
        nsFrontWheelDesc?: string;
        nsRearWheelDesc?: string;
        osFrontWheelDesc?: string;
        osRearWheelDesc?: string;
        videoDesc?: string;
    };

    faults: {
        exterior: IFaultPoint[];
        interior: IFaultPoint[];
    };

    // Tyres
    tyres: ITyre[];

    // Mechanical checks
    lightsCheck?: boolean;
    mirrorsCheck?: boolean;
    wipersCheck?: boolean;
    engineStartSmooth?: boolean;
    steeringAlignment?: boolean;
    brakePerformance?: boolean;
    gearShiftQuality?: boolean;
    testDriveNotes?: string;

    // Oil & Fluid
    oilLeakage?: string;
    oilColor?: string;
    oilLevel?: number;
    coolantLevel?: string;
    coolantColor?: string;
    coolantLevelPercent?: number;
    brakeFluidLevel?: string;
    warningLights?: string;

    // Other mechanical
    batteryCondition?: string;
    exhaustCondition?: string;
    mechanicalNotes?: string;

    // Service & History
    hasV5Document?: string;
    numberOfOwners?: string;
    numberOfKeys?: string;
    insuranceWriteOff?: string;
    serviceHistoryType?: string;
    serviceHistoryCount?: string;
    motExpiryDate?: string;

    // Inventory checklist
    inventory?: Record<string, boolean>;

    // Summary
    overallGrade?: string;
    conditionMeter?: number;
    additionalNotes?: string;
    aiSummary?: string;

    status: 'draft' | 'completed';
    createdAt?: Date;
    updatedAt?: Date;
}

const FaultPointSchema = new Schema<IFaultPoint>({
    idx: { type: Number },
    part: { type: String },
    damage: { type: String },
    detail: { type: String },
    note: { type: String },
    coords: { x: { type: Number }, y: { type: Number } },
    sectionId: { type: String },
    photoUrl: { type: String },
    fromPrevious: { type: Boolean, default: false },
}, { _id: false });

const TyreSchema = new Schema<ITyre>({
    position: { type: String, enum: ['front-left', 'front-right', 'rear-left', 'rear-right', 'spare'] },
    treadDepth: { type: String },
    condition: { type: String },
    psi: { type: String, default: '' },
    photo: { type: String, default: '' },
}, { _id: false });

const WalkaroundSchema = new Schema(
    {
        front: { type: String, default: '' },
        offside: { type: String, default: '' },
        rear: { type: String, default: '' },
        nearside: { type: String, default: '' },
        nsFrontWheel: { type: String, default: '' },
        nsRearWheel: { type: String, default: '' },
        osFrontWheel: { type: String, default: '' },
        osRearWheel: { type: String, default: '' },
        video: { type: String, default: '' },
        frontDesc: { type: String, default: '' },
        offsideDesc: { type: String, default: '' },
        rearDesc: { type: String, default: '' },
        nearsideDesc: { type: String, default: '' },
        nsFrontWheelDesc: { type: String, default: '' },
        nsRearWheelDesc: { type: String, default: '' },
        osFrontWheelDesc: { type: String, default: '' },
        osRearWheelDesc: { type: String, default: '' },
        videoDesc: { type: String, default: '' },
    },
    { _id: false }
);

const ConditionReportSchema = new Schema<IConditionReport>(
    {
        vehicleId: { type: String, required: true, trim: true },
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
            reportType: {
                   type: String,
                   enum: ['Initial', 'Appraisal', 'PDI', 'Drop-Off', 'Collection', 'Test Drive', 'Pre-Delivery', 'Delivery', 'Return', 'Service Check', 'Other'],
                   default: 'Initial',
               },
        staffMember: { type: String, trim: true, default: '' },
        location: { type: String, trim: true, default: '' },
        mileage: { type: String, trim: true, default: '' },

        walkaround: { type: WalkaroundSchema, default: {} },

        faults: {
            exterior: [FaultPointSchema],
            interior: [FaultPointSchema],
        },

        tyres: [TyreSchema],

        lightsCheck: { type: Boolean },
        mirrorsCheck: { type: Boolean },
        wipersCheck: { type: Boolean },
        engineStartSmooth: { type: Boolean },
        steeringAlignment: { type: Boolean },
        brakePerformance: { type: Boolean },
        gearShiftQuality: { type: Boolean },
        testDriveNotes: { type: String, default: '' },

        oilLeakage: { type: String, default: null },
        oilColor: { type: String, default: null },
        oilLevel: { type: Number, default: null },
        coolantLevel: { type: String, default: null },
        coolantColor: { type: String, default: null },
        coolantLevelPercent: { type: Number, default: null },
        brakeFluidLevel: { type: String, default: null },
        warningLights: { type: String, default: '' },

        batteryCondition: { type: String, default: null },
        exhaustCondition: { type: String, default: null },
        mechanicalNotes: { type: String, default: '' },

        hasV5Document: { type: String, default: null },
        numberOfOwners: { type: String, default: '' },
        numberOfKeys: { type: String, default: '' },
        insuranceWriteOff: { type: String, default: null },
        serviceHistoryType: { type: String, default: '' },
        serviceHistoryCount: { type: String, default: '' },
        motExpiryDate: { type: String, default: '' },

        inventory: { type: Schema.Types.Mixed, default: {} },

        overallGrade: { type: String, default: '' },
        conditionMeter: { type: Number, default: null },
        additionalNotes: { type: String, default: '' },
        aiSummary: { type: String, default: '' },

        status: { type: String, enum: ['draft', 'completed'], default: 'draft' },
    },
    { timestamps: true }
);

ConditionReportSchema.index({ vehicleId: 1, tenantId: 1 }, { unique: false });

if (models.ConditionReport) {
    delete (models as any).ConditionReport;
}
const ConditionReport = model<IConditionReport>('ConditionReport', ConditionReportSchema);
export default ConditionReport;
