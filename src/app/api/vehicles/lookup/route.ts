import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

// Scores a candidate derivative against known vehicle signals.
// Higher = better match. Used when the VRM lookup returns no derivativeId.
function scoreDerivative(candidate: any, signals: {
    transmissionType?: string;
    derivativeName?: string;
    engineSize?: number;
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
            co2: vehicleData.co2EmissionGPKM || vehicleData.co2Emissions,
            features: vehicleData.features || [],
            competitors: responseData.competitors?.href || null,
            derivativeId: vehicleData.derivativeId,
            generation: vehicleData.generation || vehicleData.generationName || '',
            trim: vehicleData.trim || vehicleData.trimLevel || '',
            driverPosition: vehicleData.steeringPosition || vehicleData.driverPosition || 'Right',
            drivetrain: vehicleData.drivetrain || vehicleData.driveType || '',
            wheelbase: vehicleData.wheelbase || vehicleData.wheelBase || '',
            registeredDate: vehicleData.registrationDate || vehicleData.firstRegistrationDate ||
                            vehicleData.dateOfFirstRegistration || '',
            rawResponse: vehicleData,
            derivativeIdSource: vehicleData.derivativeId ? 'lookup' : undefined,
        };

        // ── Taxonomy fallback: walk Make→Model→Generation→Derivative if no derivativeId ──
        if (!mappedData.derivativeId && mappedData.make && mappedData.vehicleModel) {
            try {
                console.log(`[Taxonomy Fallback] No derivativeId from lookup for ${vrm} — walking taxonomy tree`);
                const { derivatives } = await client.searchDerivatives({
                    make: mappedData.make,
                    model: mappedData.vehicleModel,
                    generation: mappedData.generation || undefined,
                    fuelType: mappedData.fuelType || undefined,
                    engineSize: engineSize ? String(engineSize) : undefined,
                });

                if (derivatives && derivatives.length > 0) {
                    const scored = derivatives
                        .map((d: any) => ({ d, score: scoreDerivative(d, {
                            transmissionType: mappedData.transmission,
                            derivativeName: mappedData.derivative,
                            engineSize: engineSize ? Number(engineSize) : undefined,
                        }) }))
                        .sort((a: any, b: any) => b.score - a.score);

                    const best = scored[0].d;
                    mappedData.derivativeId = best.derivativeId;
                    mappedData.derivativeIdSource = 'taxonomy';
                    if (!mappedData.generation && best.generationName) mappedData.generation = best.generationName;
                    console.log(`[Taxonomy Fallback] Resolved derivativeId: ${best.derivativeId} (score: ${scored[0].score})`);
                } else {
                    console.warn(`[Taxonomy Fallback] No derivatives found for ${mappedData.make} ${mappedData.vehicleModel}`);
                }
            } catch (taxErr: any) {
                console.error('[Taxonomy Fallback Error]', taxErr.message);
            }
        }

        return NextResponse.json({ ok: true, vehicle: mappedData });

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
