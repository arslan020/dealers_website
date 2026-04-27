import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface IVehicle {
    make: string;
    model: string;
    derivative: string;
    derivativeId?: string;
    vrm: string;
    vin?: string;
    mileage: string | number;
    year: string | number;
    dateOfRegistration: string;
    status: 'In Stock' | 'Reserved' | 'Sold' | 'To Order' | 'Courtesy' | 'Browse' | 'Advertising' | 'Draft';
    price: number;
    retailPrice?: number;
    forecourtPrice?: number;
    purchasePrice?: number;
    serviceHistory?: 'Full service history' | 'Full dealership history' | 'Part service history' | 'No service history';
    previousOwners?: number;
    numberOfKeys?: number;
    v5Present?: boolean;
    condition?: 'Used' | 'New';
    interiorCondition?: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    exteriorCondition?: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    tyreCondition?: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    dateOfNextService?: string;
    dateOfLastService?: string;
    mileageAtLastService?: number;
    serviceNotes?: string;
    manufacturerWarrantyMonths?: number;
    manufacturerWarrantyExpiry?: string;
    batteryWarrantyMonths?: number;
    batteryWarrantyExpiry?: string;
    extendedWarrantyMonths?: number;
    motExpiry?: string;
    includes12MonthsMot?: boolean;
    includesMotInsurance?: boolean;
    keyTags?: string;
    tags?: string[];
    vehicleType?: string;
    generation?: string;
    trim?: string;
    engineSize?: string;
    fuelType?: string;
    transmission?: string;
    bodyType?: string;
    seats?: number;
    doors?: number;
    driverPosition?: string;
    drivetrain?: string;
    colour?: string;
    colourName?: string;
    exteriorFinish?: string;
    interiorUpholstery?: string;
    description?: string;
    description2?: string;
    attentionGrabber?: string;
    longAttentionGrabber?: string;
    features?: string[];
    customFeatures?: string[];
    imagesCount: number;
    videosCount: number;
    primaryImage: string;
    images?: string[];          // AT CDN URLs for display
    imageIds?: string[];        // AT imageIds — saved locally to prevent loss
    youtubeVideoIds?: string[]; // YouTube video IDs
    imageMetadata?: Record<string, { group?: string; banner?: string; bannerColor?: string; branding?: boolean; watermark?: boolean }>;
    stockId?: string;
    externalStockId?: string; // Maps to MongoDB _id for tracing
    atAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
    advertiserAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
    locatorAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
    exportAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
    profileAdvertStatus?: 'PUBLISHED' | 'NOT_PUBLISHED';
    websitePublished: boolean;
    featured?: boolean;
    priceOnApplication?: boolean;
    vehicleUrl?: string;
    vehicleHighlights?: string[];
    disableWebsite?: {
        buyOnline?: boolean; delivery?: boolean; clickAndCollect?: boolean;
        reserveOnline?: boolean; finance?: boolean; viewings?: boolean;
        callbacks?: boolean; offers?: boolean; partExchange?: boolean;
    };
    stopFollowUps?: { vehicleReservedEmail?: boolean };
    excludeFromAdvert?: {
        attentionGrabber?: boolean; previousOwners?: boolean; mot?: boolean;
        warranty?: boolean; interiorCondition?: boolean; exteriorCondition?: boolean;
        tyreCondition?: boolean;
    };
    exDemo?: boolean;
    atPriceOnApplication?: boolean;
    tenantId: mongoose.Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const VehicleSchema = new Schema<IVehicle>(
    {
        make: { type: String, required: true, trim: true },
        model: { type: String, required: true, trim: true },
        derivative: { type: String, trim: true },
        derivativeId: { type: String, trim: true },
        vrm: { type: String, required: true, uppercase: true, trim: true },
        vin: { type: String, uppercase: true, trim: true },
        mileage: { type: Schema.Types.Mixed, trim: true },
        year: { type: Schema.Types.Mixed, trim: true },
        dateOfRegistration: { type: String, trim: true },
        status: {
            type: String,
            enum: ['In Stock', 'Reserved', 'Sold', 'To Order', 'Courtesy', 'Browse', 'Advertising', 'Draft'],
            default: 'In Stock'
        },
        price: { type: Number, default: 0 },
        retailPrice: { type: Number },
        forecourtPrice: { type: Number },
        purchasePrice: { type: Number },
        serviceHistory: { type: String, enum: ['Full service history', 'Full dealership history', 'Part service history', 'No service history'] },
        previousOwners: { type: Number },
        numberOfKeys: { type: Number },
        v5Present: { type: Boolean },
        condition: { type: String, enum: ['Used', 'New'] },
        interiorCondition: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        exteriorCondition: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        tyreCondition: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
        dateOfNextService: { type: String, trim: true },
        dateOfLastService: { type: String, trim: true },
        mileageAtLastService: { type: Number },
        serviceNotes: { type: String, trim: true },
        manufacturerWarrantyMonths: { type: Number },
        manufacturerWarrantyExpiry: { type: String, trim: true },
        batteryWarrantyMonths: { type: Number },
        batteryWarrantyExpiry: { type: String, trim: true },
        extendedWarrantyMonths: { type: Number },
        motExpiry: { type: String, trim: true },
        includes12MonthsMot: { type: Boolean },
        includesMotInsurance: { type: Boolean },
        keyTags: { type: String, trim: true },
        tags: [{ type: String, trim: true }],
        vehicleType: { type: String, trim: true, default: 'Car' },
        generation: { type: String, trim: true },
        trim: { type: String, trim: true },
        engineSize: { type: String, trim: true },
        fuelType: { type: String, trim: true },
        transmission: { type: String, trim: true },
        bodyType: { type: String, trim: true },
        seats: { type: Number },
        doors: { type: Number },
        driverPosition: { type: String, trim: true },
        drivetrain: { type: String, trim: true },
        colour: { type: String, trim: true },
        colourName: { type: String, trim: true },
        exteriorFinish: { type: String, trim: true },
        interiorUpholstery: { type: String, trim: true },
        description: { type: String, trim: true },
        description2: { type: String, trim: true },
        attentionGrabber: { type: String, trim: true, maxlength: 30 },
        longAttentionGrabber: { type: String, trim: true, maxlength: 70 },
        features: [{ type: String, trim: true }],
        customFeatures: [{ type: String, trim: true }],
        imagesCount: { type: Number, default: 0 },
        videosCount: { type: Number, default: 0 },
        primaryImage: { type: String, trim: true },
        images: [{ type: String, trim: true }],                  // AT CDN URLs
        imageIds: [{ type: String, trim: true }],                // AT imageIds (persisted locally)
        youtubeVideoIds: [{ type: String, trim: true }],         // YouTube video IDs
        imageMetadata: { type: Schema.Types.Mixed, default: {} }, // Per-image metadata (group, banner, branding)
        stockId: { type: String, trim: true, index: true },
        externalStockId: { type: String, trim: true },
        atAdvertStatus: { type: String, enum: ['PUBLISHED', 'NOT_PUBLISHED'], default: 'NOT_PUBLISHED' },
        advertiserAdvertStatus: { type: String, enum: ['PUBLISHED', 'NOT_PUBLISHED'], default: 'NOT_PUBLISHED' },
        locatorAdvertStatus: { type: String, enum: ['PUBLISHED', 'NOT_PUBLISHED'], default: 'NOT_PUBLISHED' },
        exportAdvertStatus: { type: String, enum: ['PUBLISHED', 'NOT_PUBLISHED'], default: 'NOT_PUBLISHED' },
        profileAdvertStatus: { type: String, enum: ['PUBLISHED', 'NOT_PUBLISHED'], default: 'NOT_PUBLISHED' },
        websitePublished: { type: Boolean, default: false },
        featured: { type: Boolean, default: false },
        priceOnApplication: { type: Boolean, default: false },
        vehicleUrl: { type: String, trim: true },
        vehicleHighlights: [{ type: String, trim: true }],
        disableWebsite: { type: Schema.Types.Mixed, default: {} },
        stopFollowUps: { type: Schema.Types.Mixed, default: {} },
        excludeFromAdvert: { type: Schema.Types.Mixed, default: {} },
        exDemo: { type: Boolean, default: false },
        atPriceOnApplication: { type: Boolean, default: false },
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    },
    { timestamps: true }
);

// Index for VRM and tenant isolation
VehicleSchema.index({ tenantId: 1, vrm: 1 });
VehicleSchema.index({ tenantId: 1, status: 1 });

const Vehicle = models.Vehicle || model<IVehicle>('Vehicle', VehicleSchema);
export default Vehicle;
