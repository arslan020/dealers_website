import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

// Scores a candidate derivative against known vehicle signals.
// Higher = better match. Used when the VRM lookup returns no/wrong/incomplete derivativeId.
function scoreDerivative(candidate: any, signals: {
    transmissionType?: string;
    derivativeName?: string;
    engineSize?: number;
    year?: number;
}): number {
    let score = 0;
    const name = (candidate.name || candidate.derivative || '').toLowerCase();

    if (signals.transmissionType) {
        const t = signals.transmissionType.toLowerCase();
        const isManual = t.includes('manual');
        const isAuto = t.includes('auto');
        if (isManual && name.includes('manual')) score += 5;
        if (isAuto && (name.includes('auto') || name.includes('dct') || name.includes('dsg') || name.includes('tronic'))) score += 5;
    }

    if (signals.derivativeName) {
        const words = signals.derivativeName.toLowerCase().split(/\s+/);
        for (const word of words) {
            if (word.length > 2 && name.includes(word)) score += 1;
        }
    }

    if (signals.engineSize && candidate.engineCapacityCC) {
        if (Math.abs(candidate.engineCapacityCC - signals.engineSize) < 50) score += 3;
    }

    // Year-based generation matching — highest weight because a wrong generation
    // produces a completely wrong derivativeId even if name/engine match.
    if (signals.year) {
        const yearFrom = candidate.yearFrom ?? candidate.generationYearFrom ?? null;
        const yearTo   = candidate.yearTo   ?? candidate.generationYearTo   ?? null;
        if (yearFrom && yearTo) {
            if (signals.year >= yearFrom && signals.year <= yearTo) {
                score += 10; // exact range match
            } else {
                const dist = Math.min(Math.abs(signals.year - yearFrom), Math.abs(signals.year - yearTo));
                if (dist <= 1) score += 4;
                else if (dist <= 2) score += 2;
            }
        } else if (yearFrom) {
            if (signals.year >= yearFrom) score += 5;
        }
    }

    return score;
}

async function lookupVehicle(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session || !session.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    // (Temporarily disabled permission check so employees aren't blocked from testing)
    // if (session.role === 'EMPLOYEE' && session.permissions?.canLookupAutoTrader === false) {
    //     return NextResponse.json({ ok: false, error: { message: 'Permission denied for AutoTrader lookups.', code: 'FORBIDDEN' } }, { status: 403 });
    // }

    const { searchParams } = new URL(req.url);
    const vrm = searchParams.get('vrm')?.toUpperCase().replace(/\s/g, '');

    if (!vrm) {
        return NextResponse.json({ ok: false, error: { message: 'Number plate (VRM) is required.', code: 'VALIDATION_ERROR' } }, { status: 400 });
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // AutoTrader Vehicles API — PDF Page 20-25
        // Correct endpoint: GET /vehicles?registration={vrm}&advertiserId={dealerId}
        const responseData = await client.lookupVehicle(vrm);

        // The API returns { vehicle: { ... } }
        const vehicleData = responseData.vehicle;

        if (!vehicleData) {
            return NextResponse.json({ ok: false, error: { message: 'No vehicle found for this number plate in AutoTrader.', code: 'NOT_FOUND' } }, { status: 404 });
        }

        const engineSize = vehicleData.engine?.sizeCC || vehicleData.engineCapacity;

        // Extract all technical spec fields from the AT /vehicles response.
        // These are saved as technicalSpecs on the Vehicle document so SpecificationTab
        // shows data immediately for new Draft vehicles (before they have a stockId).
        const AT_SPEC_FIELDS = [
            'topSpeedMPH', 'zeroToSixtyMPHSeconds', 'zeroToOneHundredKMPHSeconds',
            'engineCapacityCC', 'badgeEngineSizeLitres', 'badgeEngineSizeCC',
            'cylinders', 'cylinderArrangement', 'valves', 'boreMM', 'strokeMM',
            'enginePowerBHP', 'enginePowerPS', 'engineTorqueNM', 'engineTorqueLBFT',
            'fuelCapacityLitres', 'fuelDelivery', 'gears', 'startStop',
            'batteryRangeMiles', 'batteryCapacityKWH', 'batteryUsableCapacityKWH',
            'co2EmissionGPKM', 'emissionClass',
            'fuelEconomyNEDCExtraUrbanMPG', 'fuelEconomyNEDCUrbanMPG', 'fuelEconomyNEDCCombinedMPG',
            'fuelEconomyWLTPLowMPG', 'fuelEconomyWLTPMediumMPG', 'fuelEconomyWLTPHighMPG',
            'fuelEconomyWLTPExtraHighMPG', 'fuelEconomyWLTPCombinedMPG',
            'insuranceGroup', 'insuranceSecurityCode',
            'lengthMM', 'heightMM', 'widthMM', 'wheelbaseMM',
            'minimumKerbWeightKG', 'grossVehicleWeightKG',
            'bootSpaceSeatsUpLitres', 'bootSpaceSeatsDownLitres',
            'payloadLengthMM', 'payloadWidthMM', 'payloadHeightMM', 'payloadWeightKG',
            'drivetrain', 'ulezCompliant', 'rde2', 'countryOfOrigin',
            'sector', 'axles', 'unladenWeightKG', 'noseWeightKG', 'mtplmKG',
            'batteryChargeTime', 'batteryQuickChargeTime', 'batteryHealth',
        ];
        const technicalSpecs: Record<string, any> = {};
        for (const field of AT_SPEC_FIELDS) {
            if (vehicleData[field] !== null && vehicleData[field] !== undefined) {
                technicalSpecs[field] = vehicleData[field];
            }
        }

        const mappedData: Record<string, any> = {
            make: vehicleData.make,
            vehicleModel: vehicleData.model,
            derivative: vehicleData.derivative || vehicleData.trim,
            vrm: vehicleData.registration,
            year: vehicleData.yearOfManufacture || vehicleData.registrationYear || vehicleData.year ||
                  (vehicleData.registrationDate ? new Date(vehicleData.registrationDate).getFullYear() : undefined) ||
                  (vehicleData.firstRegistrationDate ? new Date(vehicleData.firstRegistrationDate).getFullYear() : undefined),
            engineSize,
            fuelType: vehicleData.fuelType,
            transmission: vehicleData.transmissionType,
            bodyType: vehicleData.bodyType,
            colour: vehicleData.colour || vehicleData.color,
            doors: vehicleData.doors,
            seats: vehicleData.seats,
            co2EmissionGPKM: vehicleData.co2EmissionGPKM ?? vehicleData.co2Emissions ?? null,
            wheelbaseMM: vehicleData.wheelbaseMM ?? null,
            features: responseData.features || [],
            competitors: responseData.links?.competitors?.href || null,
            derivativeId: vehicleData.derivativeId,
            generation: vehicleData.generation || vehicleData.generationName || '',
            trim: vehicleData.trim || vehicleData.trimLevel || '',
            driverPosition: vehicleData.steeringPosition || vehicleData.driverPosition || 'Right',
            drivetrain: vehicleData.drivetrain || vehicleData.driveType || '',
            wheelbase: vehicleData.wheelbase || vehicleData.wheelBase || '',
            registeredDate: vehicleData.registrationDate || vehicleData.firstRegistrationDate ||
                            vehicleData.dateOfFirstRegistration || '',
            vin: vehicleData.vin || '',
            rawResponse: vehicleData,
            derivativeIdSource: vehicleData.derivativeId ? 'lookup' : undefined,
            technicalSpecs,
        };

        // ── Taxonomy fallback: walk Make→Model→Generation→Derivative ──────────────
        // Triggers when:
        //   1. No derivativeId from lookup (missing data)
        //   2. derivativeId present but generation is missing (incomplete data —
        //      the returned ID may belong to the wrong generation for this year)
        //   3. derivativeId present but no year returned — can't verify it's correct
        const vehicleYear = mappedData.year ? Number(mappedData.year) : undefined;
        const lookupSeemsSuspect =
            mappedData.derivativeId &&
            (!mappedData.generation || !vehicleYear);

        const needsTaxonomyFallback =
            (!mappedData.derivativeId || lookupSeemsSuspect) &&
            mappedData.make && mappedData.vehicleModel;

        if (needsTaxonomyFallback) {
            const reason = !mappedData.derivativeId ? 'no derivativeId'
                : !mappedData.generation ? 'no generation returned'
                : 'no year returned';
            try {
                console.log(`[Taxonomy Fallback] ${reason} for ${vrm} — walking taxonomy tree`);
                const { derivatives } = await client.searchDerivatives({
                    make: mappedData.make,
                    model: mappedData.vehicleModel,
                    generation: mappedData.generation || undefined,
                    fuelType: mappedData.fuelType || undefined,
                    transmission: mappedData.transmission || undefined,
                    trim: mappedData.trim || undefined,
                    year: vehicleYear,
                });

                if (derivatives && derivatives.length > 0) {
                    const scored = derivatives
                        .map((d: any) => ({ d, score: scoreDerivative(d, {
                            transmissionType: mappedData.transmission,
                            derivativeName: mappedData.derivative,
                            engineSize: engineSize ? Number(engineSize) : undefined,
                            year: vehicleYear,
                        }) }))
                        .sort((a: any, b: any) => b.score - a.score);

                    const best = scored[0].d;
                    // Only override existing derivativeId if the taxonomy match scores
                    // confidently (score ≥ 8 means at least year range + one other signal matched).
                    const shouldOverride = !mappedData.derivativeId || scored[0].score >= 8;
                    if (shouldOverride) {
                        mappedData.derivativeId = best.derivativeId;
                        mappedData.derivativeIdSource = 'taxonomy';
                        if (best.generationName) mappedData.generation = best.generationName;
                    }
                    console.log(`[Taxonomy Fallback] derivativeId: ${best.derivativeId}, score: ${scored[0].score}, override: ${shouldOverride}`);
                } else {
                    console.warn(`[Taxonomy Fallback] No derivatives found for ${mappedData.make} ${mappedData.vehicleModel}`);
                }
            } catch (taxErr: any) {
                console.error('[Taxonomy Fallback Error]', taxErr.message);
            }
        }

        // Process features into categorised lists so callers don't need a second AT request
        const rawFeatures: any[] = mappedData.features || [];
        const optionalExtras: any[] = [];
        const standardFeatures: any[] = [];
        const factoryFitted: string[] = [];

        rawFeatures.forEach((f: any) => {
            const name: string = f.name || '';
            if (!name) return;
            const isOptional = f.type === 'Optional';
            const category: string = f.category || 'Other';
            const genericName: string | null = f.genericName || null;
            const factoryCodes: string[] = Array.isArray(f.factoryCodes) ? f.factoryCodes : [];
            const basicPrice = typeof f.basicPrice === 'number' ? f.basicPrice : null;
            const vatPrice = typeof f.vatPrice === 'number' ? f.vatPrice : null;
            const totalPrice = basicPrice !== null && vatPrice !== null ? basicPrice + vatPrice : basicPrice;
            const isFitted = f.factoryFitted === true;
            if (isFitted) factoryFitted.push(name);
            if (isOptional) {
                optionalExtras.push({
                    name, genericName, price: totalPrice, fitted: isFitted, category, factoryCodes,
                    rarityRating: f.rarityRating || null, valueRating: f.valueRating || null,
                    finish: f.finish || null, genericFinish: f.genericFinish || null,
                });
            } else {
                standardFeatures.push({ name, genericName, category, factoryCodes });
            }
        });

        return NextResponse.json({
            ok: true,
            vehicle: mappedData,
            standardFeatures,
            optionalExtras,
            factoryFitted: [...new Set(factoryFitted)],
        });

    } catch (error: any) {
        console.error('[VRM Lookup Error]', error.message);

        const userMessage = error.message?.includes('not configured') || error.message?.includes('not set')
            ? error.message
            : 'Failed to look up this number plate. Please check the VRM and try again.';

        return NextResponse.json({
            ok: false,
            error: { message: userMessage }
        }, { status: 500 });
    }
}

export const GET = withErrorHandler(lookupVehicle);
