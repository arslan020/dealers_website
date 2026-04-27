import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

/** Cache DVSA OAuth2 token to avoid fetching on every request */
let dvsaTokenCache: { token: string; expiresAt: number } | null = null;

async function getDvsaAccessToken(): Promise<string | null> {
    const clientId = process.env.DVSA_CLIENT_ID;
    const clientSecret = process.env.DVSA_CLIENT_SECRET;
    const tokenUrl = process.env.DVSA_TOKEN_URL;
    const scope = process.env.DVSA_SCOPE || 'https://tapi.dvsa.gov.uk/.default';

    if (!clientId || !clientSecret || !tokenUrl) return null;

    // Return cached token if still valid (with 60s buffer)
    if (dvsaTokenCache && dvsaTokenCache.expiresAt > Date.now() + 60_000) {
        return dvsaTokenCache.token;
    }

    try {
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope,
        });

        const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        if (!res.ok) {
            const err = await res.text();
            console.error('[DVSA Token Error]', res.status, err);
            return null;
        }
        const data = await res.json();

        dvsaTokenCache = {
            token: data.access_token,
            expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        };

        return dvsaTokenCache.token;
    } catch {
        return null;
    }
}

/** Fetch full MOT history from DVSA MOT History API (OAuth2) */
async function fetchDvsaMotHistory(vrm: string) {
    const accessToken = await getDvsaAccessToken();
    if (!accessToken) return null;

    try {
        const endpoint = process.env.DVSA_MOT_ENDPOINT || 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration';
        const apiKey = process.env.DVSA_API_KEY;

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        };
        if (apiKey) headers['X-API-Key'] = apiKey;

        const url = `${endpoint}/${encodeURIComponent(vrm)}`;
        console.log('[DVSA MOT] Fetching:', url);
        const res = await fetch(url, { headers });

        if (!res.ok) {
            const err = await res.text();
            console.error('[DVSA MOT Error]', res.status, err);
            return null;
        }
        const data = await res.json();
        // DVSA API returns an array of vehicle objects; motTests is nested inside first element
        const vehicle = Array.isArray(data) ? data[0] : data;
        const tests = vehicle?.motTests || [];
        return tests.map((t: any) => ({
            completedDate: t.completedDate || t.testDate || '',
            expiryDate: t.expiryDate || null,
            testResult: t.testResult === 'PASSED' ? 'Passed' : t.testResult === 'FAILED' ? 'Failed' : (t.testResult || ''),
            odometerValue: t.odometerValue ? parseInt(t.odometerValue) : undefined,
            odometerUnit: t.odometerUnit || 'mi',
            motTestNumber: t.motTestNumber || undefined,
            rfrAndComments: (t.defects || t.rfrAndComments || []).map((r: any) => ({
                type: r.type || '',
                text: r.text || r.comment || '',
                dangerous: r.dangerous || false,
            })),
        }));
    } catch {
        return null;
    }
}

/** Fetch tax status from DVLA VES (free GOV.UK API) */
async function fetchDvlaTax(vrm: string) {
    const apiKey = process.env.DVLA_API_KEY;
    if (!apiKey) return null;
    try {
        const endpoint = process.env.DVLA_ENDPOINT || 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ registrationNumber: vrm }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {
            taxStatus: data.taxStatus || null,           // e.g. "Taxed", "SORN"
            taxDueDate: data.taxDueDate || null,         // e.g. "2027-02-01"
            motStatus: data.motStatus || null,
            motExpiryDate: data.motExpiryDate || null,   // e.g. "2026-12-19"
            make: data.make || null,
            colour: data.colour || null,
            fuelType: data.fuelType || null,
            engineCapacity: data.engineCapacity || null,
            co2Emissions: data.co2Emissions || null,
            firstUsedDate: data.monthOfFirstRegistration || null,
        };
    } catch {
        return null;
    }
}

async function getVehicleCheck(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const vrm = searchParams.get('vrm')?.toUpperCase().replace(/\s/g, '');

    if (!vrm) {
        return NextResponse.json({ ok: false, error: { message: 'VRM is required.' } }, { status: 400 });
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // Run AT, DVLA, and DVSA MOT History calls in parallel
        const [responseData, dvlaTax, dvsaMotTests] = await Promise.all([
            client.get('/vehicles', {
                registration: vrm,
                advertiserId: client.dealerId || '',
                history: 'true',
                fullVehicleCheck: 'true',
            }),
            fetchDvlaTax(vrm),
            fetchDvsaMotHistory(vrm),
        ]);

        // MOT history always comes from DVSA only
        const motTests = dvsaMotTests || [];

        return NextResponse.json({
            ok: true,
            vehicle: responseData.vehicle || null,
            history: responseData.history || null,
            check: responseData.check || null,
            motTests,
            motSource: dvsaMotTests ? 'dvsa' : 'none',
            warnings: responseData.warnings || [],
            dvlaTax,
            _fetchedAt: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('[Vehicle Check Error]', error.message);

        // Fallback: try without fullVehicleCheck
        try {
            const client2 = new AutoTraderClient(session.tenantId);
            await client2.init();

            const [fallback, dvlaTax, dvsaMotTests] = await Promise.all([
                client2.get('/vehicles', {
                    registration: vrm,
                    advertiserId: client2.dealerId || '',
                    history: 'true',
                }),
                fetchDvlaTax(vrm),
                fetchDvsaMotHistory(vrm),
            ]);

            // MOT history always comes from DVSA only
            const motTests = dvsaMotTests || [];

            return NextResponse.json({
                ok: true,
                vehicle: fallback.vehicle || null,
                history: fallback.history || null,
                check: null,
                motTests,
                motSource: dvsaMotTests ? 'dvsa' : 'none',
                warnings: fallback.warnings || [],
                limitedData: true,
                dvlaTax,
                _fetchedAt: new Date().toISOString(),
            });
        } catch (fallbackError: any) {
            return NextResponse.json({
                ok: false,
                error: { message: error.message || 'Failed to retrieve vehicle check data.' }
            }, { status: 500 });
        }
    }
}

export const GET = withErrorHandler(getVehicleCheck);
