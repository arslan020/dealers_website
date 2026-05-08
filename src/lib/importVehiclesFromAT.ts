import { AutoTraderClient } from './autotrader';
import connectToDatabase from './db';
import Vehicle from '@/models/Vehicle';

// AT → Local reverse mappings
const AT_ORIGIN_REVERSE: Record<string, string> = {
    'UK': 'UK Vehicle',
    'Non UK': 'Import',
};
const AT_CONDITION_REVERSE: Record<string, string> = {
    'Excellent': 'Excellent', 'Good': 'Good', 'Average': 'Fair', 'Poor': 'Poor',
};
const AT_VAT_REVERSE: Record<string, string> = {
    'Standard': 'VAT Qualifying',
    'Marginal': 'No VAT',
};

function extractYouTubeId(href: string | undefined): string | null {
    if (!href) return null;
    const m = href.match(/[?&]v=([^&]+)/) || href.match(/youtu\.be\/([^?]+)/);
    return m ? m[1] : null;
}

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
        FORECOURT:        'In Stock',
        SALE_IN_PROGRESS: 'Reserved',
        SOLD:             'Sold',
        DUE_IN:           'Draft',
        WASTEBIN:         'Deleted',
        DELETED:          'Deleted',
    };

    const atApiUrl = process.env.AUTOTRADER_API_URL || 'https://api.autotrader.co.uk';
    const cdnHost  = atApiUrl.includes('sandbox') ? 'm-qa.atcdn.co.uk' : 'm.atcdn.co.uk';

    let imported = 0;
    let updated  = 0;

    for (const v of rawStock) {
        const veh = v.vehicle || {};
        const adverts = v.adverts || {};
        const retail  = adverts.retailAdverts || {};
        const meta    = v.metadata || {};
        const media   = v.media   || {};

        const vrm = (veh.registration || v.vrm || '').toUpperCase();
        if (!vrm) continue;
        const make = veh.make || v.make || '';
        if (!make) continue;

        const lifecycleState: string = meta.lifecycleState || 'FORECOURT';
        const status  = statusMap[lifecycleState] || 'In Stock';
        const stockId = v.id || meta.stockId || '';

        // ── Pricing ──────────────────────────────────────────────────────────
        const price         = retail.suppliedPrice?.amountGBP || adverts.forecourtPrice?.amountGBP || 0;
        const forecourtPrice = adverts.forecourtPrice?.amountGBP || price;

        // ── Images ───────────────────────────────────────────────────────────
        const rawImages: any[] = media.images || v.images || [];
        const imageIds: string[] = rawImages
            .map((img: any) => img.imageId || '')
            .filter(Boolean);
        const images: string[] = rawImages
            .map((img: any) => img.href || (img.imageId ? `https://${cdnHost}/a/media/{resize}/${img.imageId}.jpg` : ''))
            .filter(Boolean);
        const primaryImage = images[0] || '';

        // ── Video ────────────────────────────────────────────────────────────
        const videoId = extractYouTubeId(media.video?.href);
        const youtubeVideoIds = videoId ? [videoId] : [];

        // ── Features ─────────────────────────────────────────────────────────
        const rawFeatures: any[] = v.features || [];
        const standardFeatures: string[] = [];
        const optionalFeatures: string[] = [];
        const factoryFittedFeatures: string[] = [];

        for (const f of rawFeatures) {
            const name = typeof f === 'string' ? f : (f.name || '');
            if (!name) continue;
            if (f.factoryFitted) factoryFittedFeatures.push(name);
            if (f.type === 'Optional') {
                optionalFeatures.push(name);
            } else {
                standardFeatures.push(name);
            }
        }

        // ── Technical specs (saved as technicalSpecs sub-object) ─────────────
        const TECH_FIELDS = [
            'enginePowerBHP', 'enginePowerPS', 'engineTorqueNM', 'engineTorqueLBFT',
            'cylinders', 'cylinderArrangement', 'valves', 'boreMM', 'strokeMM',
            'fuelCapacityLitres', 'fuelDelivery', 'gears', 'startStop',
            'topSpeedMPH', 'zeroToSixtyMPHSeconds', 'zeroToOneHundredKMPHSeconds',
            'batteryRangeMiles', 'batteryCapacityKWH', 'batteryUsableCapacityKWH',
            'batteryChargeTime', 'batteryQuickChargeTime', 'batteryHealth',
            'fuelEconomyNEDCExtraUrbanMPG', 'fuelEconomyNEDCUrbanMPG', 'fuelEconomyNEDCCombinedMPG',
            'fuelEconomyWLTPLowMPG', 'fuelEconomyWLTPMediumMPG', 'fuelEconomyWLTPHighMPG',
            'fuelEconomyWLTPExtraHighMPG', 'fuelEconomyWLTPCombinedMPG',
            'insuranceGroup', 'insuranceSecurityCode',
            'lengthMM', 'heightMM', 'widthMM', 'wheelbaseMM',
            'minimumKerbWeightKG', 'grossVehicleWeightKG',
            'bootSpaceSeatsUpLitres', 'bootSpaceSeatsDownLitres',
            'payloadLengthMM', 'payloadWidthMM', 'payloadHeightMM', 'payloadWeightKG',
            'ulezCompliant', 'rde2', 'countryOfOrigin',
            'emissionClass', 'co2EmissionGPKM',
            'axles', 'unladenWeightKG', 'noseWeightKG', 'mtplmKG',
            'sector', 'driveType',
        ] as const;

        const technicalSpecs: Record<string, any> = {};
        for (const field of TECH_FIELDS) {
            if (veh[field] !== null && veh[field] !== undefined) {
                technicalSpecs[field] = veh[field];
            }
        }

        // ── Engine size (stored as CC string, fallback to litres) ─────────────
        const engineSizeNum = veh.engineCapacityCC
            ? Number(veh.engineCapacityCC)
            : veh.badgeEngineSizeLitres
            ? Number(veh.badgeEngineSizeLitres)
            : undefined;
        const engineSize = engineSizeNum ? String(engineSizeNum) : '';

        // ── Advert channel statuses ───────────────────────────────────────────
        const atAdvertStatus        = retail.autotraderAdvert?.status  || (lifecycleState === 'FORECOURT' ? 'PUBLISHED' : 'NOT_PUBLISHED');
        const advertiserAdvertStatus = retail.advertiserAdvert?.status  || 'NOT_PUBLISHED';
        const locatorAdvertStatus   = retail.locatorAdvert?.status     || 'NOT_PUBLISHED';
        const exportAdvertStatus    = retail.exportAdvert?.status      || 'NOT_PUBLISHED';
        const profileAdvertStatus   = retail.profileAdvert?.status     || 'NOT_PUBLISHED';

        // ── Condition reverse-mapping ─────────────────────────────────────────
        const interiorCondition  = AT_CONDITION_REVERSE[veh.interiorCondition  || ''] || veh.interiorCondition  || undefined;
        const tyreCondition      = AT_CONDITION_REVERSE[veh.tyreCondition      || ''] || veh.tyreCondition      || undefined;
        const exteriorCondition  = AT_CONDITION_REVERSE[veh.bodyCondition      || ''] || veh.bodyCondition      || undefined;

        const vehicleData: any = {
            tenantId,
            // ── Identifiers ──────────────────────────────────────────────────
            stockId,
            vrm,
            vin:              veh.vin              || undefined,
            engineNumber:     veh.engineNumber     || undefined,
            plate:            veh.plate            || undefined,
            derivativeId:     veh.derivativeId     || undefined,
            // ── Core vehicle ─────────────────────────────────────────────────
            make,
            model:            veh.model            || v.model    || '',
            derivative:       veh.derivative       || v.derivative || '',
            generation:       veh.generation       || '',
            trim:             veh.trim             || '',
            vehicleType:      veh.vehicleType      || 'Car',
            year:             veh.yearOfManufacture || v.year    || '',
            mileage:          veh.odometerReadingMiles ?? v.mileage ?? 0,
            colour:           veh.colour           || '',
            fuelType:         veh.fuelType         || '',
            transmission:     veh.transmissionType || '',
            bodyType:         veh.bodyType         || '',
            doors:            veh.doors            ?? undefined,
            seats:            veh.seats            ?? undefined,
            drivetrain:       veh.drivetrain       || undefined,
            driverPosition:   veh.steeringPosition || undefined,
            engineSize,
            emissionClass:    veh.emissionClass    || undefined,
            co2EmissionGPKM:  veh.co2EmissionGPKM  ?? undefined,
            exteriorFinish:   veh.exteriorFinish   || undefined,
            dateOfRegistration: veh.firstRegistrationDate || undefined,
            // ── History / service ─────────────────────────────────────────────
            serviceHistory:   veh.serviceHistory   || undefined,
            previousOwners:   veh.previousOwners   ?? veh.owners ?? undefined,
            motExpiry:        veh.motExpiryDate     || undefined,
            manufacturerWarrantyMonths: veh.warrantyMonthsOnPurchase ?? undefined,
            numberOfKeys:     veh.keys             ?? undefined,
            v5Present:        veh.v5Certificate    ?? undefined,
            exDemo:           veh.exDemo           ?? undefined,
            wheelchairAccessible: veh.wheelchairAccessible ?? undefined,
            // ── Condition ────────────────────────────────────────────────────
            ...(interiorCondition  && { interiorCondition }),
            ...(tyreCondition      && { tyreCondition }),
            ...(exteriorCondition  && { exteriorCondition }),
            // ── Origin ───────────────────────────────────────────────────────
            ...(veh.origin && { origin: AT_ORIGIN_REVERSE[veh.origin] || veh.origin }),
            // ── Van / truck specific ─────────────────────────────────────────
            ...(veh.cabType        && { cabType:       veh.cabType }),
            ...(veh.wheelbaseType  && { wheelbaseType: veh.wheelbaseType }),
            ...(veh.roofHeightType && { roofHeightType: veh.roofHeightType }),
            // ── Pricing ───────────────────────────────────────────────────────
            price,
            forecourtPrice,
            priceOnApplication: retail.priceOnApplication ?? undefined,
            vatStatus:  AT_VAT_REVERSE[adverts.vatScheme || ''] || undefined,
            // ── Advert content ────────────────────────────────────────────────
            description:          retail.description          || undefined,
            description2:         retail.description2         || undefined,
            attentionGrabber:     retail.attentionGrabber     || undefined,
            // ── Advert settings ───────────────────────────────────────────────
            dueInDate:            adverts.dueDate             || undefined,
            dateInStock:          adverts.stockInDate         || undefined,
            includes12MonthsMot:  adverts.twelveMonthsMot     ?? undefined,
            includesMotInsurance: adverts.motInsurance        ?? undefined,
            // ── Status / lifecycle ────────────────────────────────────────────
            status,
            atAdvertStatus,
            advertiserAdvertStatus,
            locatorAdvertStatus,
            exportAdvertStatus,
            profileAdvertStatus,
            isLiveOnAT:  atAdvertStatus === 'PUBLISHED',
            websitePublished: false,
            // ── Features ─────────────────────────────────────────────────────
            standardFeatures,
            features:           optionalFeatures,
            factoryFittedFeatures,
            // ── Media ─────────────────────────────────────────────────────────
            imageIds,
            images,
            primaryImage,
            imagesCount:  imageIds.length,
            youtubeVideoIds,
            videosCount:  youtubeVideoIds.length,
            // ── Technical specs ───────────────────────────────────────────────
            ...(Object.keys(technicalSpecs).length > 0 && { technicalSpecs }),
        };

        // Strip undefined values so $set doesn't null out existing fields
        for (const key of Object.keys(vehicleData)) {
            if (vehicleData[key] === undefined) delete vehicleData[key];
        }

        const existing = await Vehicle.findOne({ tenantId, $or: [{ vrm }, ...(stockId ? [{ stockId }] : [])] });
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
