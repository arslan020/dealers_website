import mongoose from 'mongoose';
import Vehicle from '@/models/Vehicle';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';

type AtStockItem = {
    id?: string;
    make?: string;
    model?: string;
    derivative?: string;
    vrm?: string;
    mileage?: number;
    year?: string | number;
    firstRegistrationDate?: string;
    registrationDate?: string;
    price?: number;
    primaryImage?: string;
    images?: string[];
};

/**
 * Resolves client vehicle id (Mongo _id or `at-{stockId}`) to a Vehicle document _id for jobs.
 * AutoTrader-only picks create/find a local row by stockId so jobs always link to Vehicle.
 */
export async function resolveVehicleObjectIdForJob(
    tenantObjectId: mongoose.Types.ObjectId,
    vehicleId: string
): Promise<mongoose.Types.ObjectId | null> {
    if (mongoose.isValidObjectId(vehicleId)) {
        const hit = await Vehicle.findOne({
            _id: new mongoose.Types.ObjectId(vehicleId),
            tenantId: tenantObjectId,
        })
            .select('_id')
            .lean();
        return hit ? new mongoose.Types.ObjectId(String(hit._id)) : null;
    }

    if (!vehicleId.startsWith('at-')) return null;
    const stockId = vehicleId.slice(3).trim();
    if (!stockId) return null;

    const existing = await Vehicle.findOne({ tenantId: tenantObjectId, stockId }).select('_id').lean();
    if (existing) return new mongoose.Types.ObjectId(String(existing._id));

    const cache = await AutoTraderStockCache.findOne({ tenantId: tenantObjectId }).lean();
    const atv = (cache?.stock as AtStockItem[] | undefined)?.find((s) => s?.id === stockId);
    if (!atv) return null;

    const vrmRaw = (atv.vrm || '').toString().trim().toUpperCase().replace(/\s+/g, '');
    const vrm =
        vrmRaw ||
        `AT${stockId.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)}`.padEnd(7, '0');

    try {
        const doc = await Vehicle.create({
            tenantId: tenantObjectId,
            stockId,
            make: atv.make || 'Unknown',
            model: atv.model || 'Unknown',
            derivative: atv.derivative || '',
            vrm,
            mileage: typeof atv.mileage === 'number' ? atv.mileage : 0,
            year: atv.year != null ? String(atv.year) : '',
            dateOfRegistration: atv.firstRegistrationDate || atv.registrationDate || '',
            status: 'In Stock',
            price: typeof atv.price === 'number' ? atv.price : 0,
            primaryImage: atv.primaryImage || '',
            imagesCount: Array.isArray(atv.images) ? atv.images.length : 0,
            images: Array.isArray(atv.images) ? atv.images : [],
            vehicleType: 'Car',
        });
        return doc._id as mongoose.Types.ObjectId;
    } catch (err: unknown) {
        const e = err as { code?: number; codeName?: string };
        if (e?.code === 11000 || e?.codeName === 'DuplicateKey') {
            let again = await Vehicle.findOne({ tenantId: tenantObjectId, stockId }).select('_id').lean();
            if (!again && vrmRaw) {
                again = await Vehicle.findOne({ tenantId: tenantObjectId, vrm: vrmRaw }).select('_id').lean();
            }
            return again ? new mongoose.Types.ObjectId(String(again._id)) : null;
        }
        throw err;
    }
}
