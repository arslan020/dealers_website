import { AutoTraderClient } from './autotrader';
import connectToDatabase from './db';
import Vehicle from '@/models/Vehicle';

export async function importVehiclesFromAT(tenantId: string): Promise<{ imported: number; updated: number }> {
    await connectToDatabase();

    const client = new AutoTraderClient(tenantId);
    await client.init();

    const responseData = await client.get('/stock', {
        advertiserId: client.dealerId || '',
        page: '1',
        pageSize: '200',
        features: 'true',
    });

    const rawStock = responseData.results || responseData.vehicles || responseData.stock || responseData.data || (Array.isArray(responseData) ? responseData : []);

    const statusMap: Record<string, string> = {
        FORECOURT: 'In Stock',
        SALE_IN_PROGRESS: 'Reserved',
        SOLD: 'Sold',
        DUE_IN: 'Draft',
    };

    let imported = 0;
    let updated = 0;

    for (const v of rawStock) {
        const vrm = v.vehicle?.vrm || v.vrm || v.vehicle?.registration || v.registration || v.vehicle?.registrationNumber || v.registrationNumber || '';
        if (!vrm) continue;
        const make = v.vehicle?.make || v.make || '';
        if (!make) continue;

        const lifecycleState: string = v.metadata?.lifecycleState || 'FORECOURT';
        const status = statusMap[lifecycleState] || 'In Stock';
        const stockId = v.id || v.stockId || v.advertId || v.vehicle?.id || v.metadata?.stockId || v.metadata?.advertId || v.adverts?.[0]?.advertId || '';
        const price = v.adverts?.forecourtPrice?.amountGBP || v.adverts?.retailAdverts?.suppliedPrice?.amountGBP || v.price?.advertisedPrice || v.retailPrice || 0;
        const images: string[] = (v.media?.images || v.images || []).map((img: any) => img.href || img).filter(Boolean);

        const vehicleData: any = {
            tenantId,
            vrm: vrm.toUpperCase(),
            make,
            model: v.vehicle?.model || v.model || '',
            derivative: v.vehicle?.derivative || v.derivative || '',
            year: v.vehicle?.yearOfManufacture || v.vehicle?.registrationYear || v.year || '',
            mileage: v.vehicle?.odometerReadingMiles || v.vehicle?.odometer?.value || v.mileage || 0,
            price,
            status,
            fuelType: v.vehicle?.fuelType || '',
            transmission: v.vehicle?.transmissionType || '',
            colour: v.vehicle?.colour || '',
            engineSize: v.vehicle?.engineSizeCc ? String(v.vehicle.engineSizeCc) : '',
            bodyType: v.vehicle?.bodyType || '',
            features: (v.features || []).map((f: any) => typeof f === 'string' ? f : f.name).filter(Boolean),
            primaryImage: images[0] || '',
            images,
            imagesCount: images.length,
            videosCount: 0,
            stockId,
            atAdvertStatus: 'PUBLISHED',
            websitePublished: false,
            isLiveOnAT: true,
        };

        const existing = await Vehicle.findOne({ tenantId, vrm: vrm.toUpperCase() });
        if (existing) {
            await Vehicle.updateOne({ _id: existing._id }, { $set: vehicleData });
            updated++;
        } else {
            await Vehicle.create(vehicleData);
            imported++;
        }
    }

    return { imported, updated };
}
