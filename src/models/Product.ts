import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface IProductOption {
    subCode?: string;
    name: string;
    description?: string;
    highlight?: '' | 'Recommended' | 'Most Popular' | 'Best Value';
    priceExcVat: number;
    vatRate?: string;
}

export interface IProduct extends Document {
    tenantId: mongoose.Types.ObjectId;
    name: string;
    code?: string;
    description?: string;
    typeInvoice: boolean;
    typePurchaseInvoice: boolean;
    typeCheckout: boolean;
    stockControl: boolean;
    editable: 'Disable' | 'Price' | 'Name' | 'Both';
    priceExcVat: number;
    vatRate: 'No VAT' | '5% VAT' | '20% VAT';
    quantityInStock: number;
    quantityAvailable: number;
    supplier?: string;
    reference?: string;
    optionsType: 'No Options' | 'Single' | 'Multiple';
    options: IProductOption[];
    selectMinimum?: number;
    selectMaximum?: number;
    createdAt: Date;
    updatedAt: Date;
}

const OptionSchema = new Schema<IProductOption>({
    subCode: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    highlight: { type: String, enum: ['', 'Recommended', 'Most Popular', 'Best Value'], default: '' },
    priceExcVat: { type: Number, default: 0 },
    vatRate: { type: String, default: '20% VAT' },
}, { _id: false });

const ProductSchema = new Schema<IProduct>(
    {
        tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
        name: { type: String, required: true, trim: true },
        code: { type: String, trim: true },
        description: { type: String, trim: true },
        typeInvoice: { type: Boolean, default: true },
        typePurchaseInvoice: { type: Boolean, default: true },
        typeCheckout: { type: Boolean, default: false },
        stockControl: { type: Boolean, default: false },
        editable: { type: String, enum: ['Disable', 'Price', 'Name', 'Both'], default: 'Disable' },
        priceExcVat: { type: Number, default: 0 },
        vatRate: { type: String, enum: ['No VAT', '5% VAT', '20% VAT'], default: '20% VAT' },
        quantityInStock: { type: Number, default: 0 },
        quantityAvailable: { type: Number, default: 0 },
        supplier: { type: String, trim: true },
        reference: { type: String, trim: true },
        optionsType: { type: String, enum: ['No Options', 'Single', 'Multiple'], default: 'No Options' },
        options: [OptionSchema],
        selectMinimum: { type: Number },
        selectMaximum: { type: Number },
    },
    { timestamps: true }
);

const Product = models.Product || model<IProduct>('Product', ProductSchema);
export default Product;
