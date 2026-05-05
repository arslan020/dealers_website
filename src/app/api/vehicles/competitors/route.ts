import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

const AUTOTRADER_BASE_URL = process.env.AUTOTRADER_API_URL || 'https://api.autotrader.co.uk';


/** Sample data shown when AutoTrader Search capability is not enabled on this account */
const SAMPLE_COMPETITORS = [
    { registration: 'SJ21 KPF', price: 28495, valuation: 27800, trim: 'Sport', derivative: '2.0 TDI Sport 5dr S Tronic', engine: '2.0L', fuelType: 'Diesel', transmission: 'Automatic', mileage: 21400, daysOnForecourt: 18, distance: 12, year: 2021, priceIndicatorRating: 'GOOD' },
    { registration: 'LK21 CVR', price: 26990, valuation: 28100, trim: 'SE', derivative: '2.0 TDI SE 5dr', engine: '2.0L', fuelType: 'Diesel', transmission: 'Manual', mileage: 34200, daysOnForecourt: 42, distance: 28, year: 2021, priceIndicatorRating: 'LOW' },
    { registration: 'KL71 YHG', price: 31200, valuation: 29900, trim: 'S Line', derivative: '2.0 TDI S Line 5dr S Tronic', engine: '2.0L', fuelType: 'Diesel', transmission: 'Automatic', mileage: 14800, daysOnForecourt: 7, distance: 55, year: 2021, priceIndicatorRating: 'HIGH' },
    { registration: 'MH21 BKP', price: 27750, valuation: 27500, trim: 'Sport', derivative: '2.0 TDI Sport 5dr', engine: '2.0L', fuelType: 'Diesel', transmission: 'Manual', mileage: 28600, daysOnForecourt: 31, distance: 74, year: 2021, priceIndicatorRating: 'GREAT' },
    { registration: 'SG21 NXL', price: 33495, valuation: 31200, trim: 'Black Edition', derivative: '2.0 TDI Black Edition 5dr S Tronic', engine: '2.0L', fuelType: 'Diesel', transmission: 'Automatic', mileage: 9200, daysOnForecourt: 5, distance: 89, year: 2021, priceIndicatorRating: 'HIGH' },
    { registration: 'YH71 DKM', price: 25990, valuation: 26400, trim: 'SE', derivative: '2.0 TDI SE 5dr', engine: '2.0L', fuelType: 'Diesel', transmission: 'Manual', mileage: 41000, daysOnForecourt: 60, distance: 110, year: 2021, priceIndicatorRating: 'LOW' },
    { registration: 'OE21 PKT', price: 29800, valuation: 29100, trim: 'Sport', derivative: '2.0 TFSI Sport 5dr S Tronic', engine: '2.0L', fuelType: 'Petrol', transmission: 'Automatic', mileage: 18900, daysOnForecourt: 22, distance: 145, year: 2021, priceIndicatorRating: 'GOOD' },
];



async function getCompetitors(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.' } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const vrm = searchParams.get('vrm')?.toUpperCase().replace(/\s/g, '');

    if (!vrm) {
        return NextResponse.json({ ok: false, error: { message: 'VRM is required.' } }, { status: 400 });
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // Step 1: Get vehicle data with competitors=true to receive the competitor search URL
        let vehicleData: any = null;
        let competitorUrl: string | undefined;

        try {
            vehicleData = await client.get('/vehicles', {
                registration: vrm,
                advertiserId: client.dealerId || '',
                features: 'true',
                competitors: 'true',
            });

            // The competitor URL can be at different paths depending on AT response shape
            competitorUrl =
                vehicleData?.links?.competitors?.href
                ?? vehicleData?.vehicle?.links?.competitors?.href
                ?? vehicleData?.vehicle?.competitorUrl
                ?? vehicleData?.vehicle?.competitors?.searchUrl
                ?? vehicleData?.competitors?.searchUrl
                ?? vehicleData?.competitorUrl
                ?? undefined;

        } catch (e: any) {
            console.error('[Competitors] VRM lookup failed:', e.message);
        }

        // Step 2: Build search URL
        const accessToken = await (client as any).getAccessToken();


        let searchUrl: URL;

        // Build from make/model using either AT response (preferred) or query params
        const v = vehicleData?.vehicle || {};
        const standardMake = v.standardMake || v.make || searchParams.get('make') || '';
        const standardModel = v.standardModel || v.model || searchParams.get('model') || '';
        const year =
            v.yearOfManufacture ||
            v.year ||
            (v.registrationDate ? new Date(v.registrationDate).getFullYear() : undefined) ||
            (v.firstRegistrationDate ? new Date(v.firstRegistrationDate).getFullYear() : undefined) ||
            (v.dateOfRegistration ? new Date(v.dateOfRegistration).getFullYear() : undefined) ||
            searchParams.get('year') ||
            '';

        if (!standardMake || !standardModel) {
            // If we can't determine taxonomy, fall back to competitorUrl if present
            if (competitorUrl && competitorUrl.startsWith('http')) {
                searchUrl = new URL(competitorUrl);
            } else {
                return NextResponse.json({
                    ok: true,
                    competitors: [],
                    total: 0,
                    vehicle: v,
                    warning: 'Could not determine make/model for competitor search. Ensure vehicle has AutoTrader stock linked.',
                });
            }
        } else {
            // Default competitor stock search (broad + filterable)
            searchUrl = new URL(`${AUTOTRADER_BASE_URL}/stock`);
            searchUrl.searchParams.set('advertiserId', client.dealerId || '');
            searchUrl.searchParams.set('searchType', 'competitor');
            searchUrl.searchParams.set('valuations', 'true');
            searchUrl.searchParams.set('vehicleMetrics', 'true');
            searchUrl.searchParams.set('standardMake', standardMake);
            searchUrl.searchParams.set('standardModel', standardModel);

            if (year) {
                // If UI provides min/max year it will override below; otherwise base around vehicle year.
                searchUrl.searchParams.set('minManufacturedYear', String(Number(year) - 2));
                searchUrl.searchParams.set('maxManufacturedYear', String(Number(year) + 2));
            }
        }

        // Ensure valuations are included (needed for Avg. Valuation)
        if (!searchUrl.searchParams.has('valuations')) {
            searchUrl.searchParams.set('valuations', 'true');
        }

        // Vehicle metrics sometimes carry valuation depending on endpoint/capabilities
        if (!searchUrl.searchParams.has('vehicleMetrics')) {
            searchUrl.searchParams.set('vehicleMetrics', 'true');
        }

        // Step 3: Apply user-defined filter overrides
        // AT Search/Stock API correct parameter names (from AT Connect docs)
        const filterMap: Record<string, string> = {
            trim:          'standardTrim',
            fuelType:      'standardFuelType',
            transmission:  'standardTransmissionType',
            drivetrain:    'standardDrivetrain',
            doors:         'doors',
            minEngineSize: 'minBadgeEngineSizeLitres',
            maxEngineSize: 'maxBadgeEngineSizeLitres',
            minMileage:    'minOdometerReadingMiles',
            maxMileage:    'maxOdometerReadingMiles',
            minYear:       'minManufacturedYear',
            maxYear:       'maxManufacturedYear',
            condition:     'ownershipCondition',
            sort:          'sort',
        };

        for (const [qParam, atParam] of Object.entries(filterMap)) {
            const val = searchParams.get(qParam);
            if (val && val !== '') {
                searchUrl.searchParams.set(atParam, val);
            }
        }

        // MotorDesk-style: fetch multiple pages so the UI can show >20 results.
        // AT competitor search is typically 20 per page, up to 10 pages (200 total).
        const requestedTotal = Number(searchParams.get('pageSize') || '50'); // UI sends 25; treat as desired total results
        const desiredTotal = Math.min(Math.max(Number.isFinite(requestedTotal) ? requestedTotal : 50, 1), 200);
        const perPage = 20;
        searchUrl.searchParams.set('pageSize', String(perPage));
        searchUrl.searchParams.set('page', '1');
        searchUrl.searchParams.set('advertiserId', client.dealerId || '');

        const vehicleForFallback = vehicleData?.vehicle || {};

        // Step 4: Execute the search (multi-page aggregation)
        let usedRelaxedFallback = false;
        const aggregated: any[] = [];
        const seenKeys = new Set<string>();

        const getKey = (item: any) => {
            const v = item?.vehicle || item?.stock?.vehicle || item || {};
            const reg = String(v.registration || '').toUpperCase().replace(/\s/g, '');
            const sid = String(item?.metadata?.searchId || item?.searchId || '');
            return (reg ? `reg:${reg}` : '') || (sid ? `sid:${sid}` : '') || '';
        };

        const pushUnique = (items: any[]) => {
            for (const it of items || []) {
                const key = getKey(it);
                if (key) {
                    if (seenKeys.has(key)) continue;
                    seenKeys.add(key);
                }
                aggregated.push(it);
            }
        };

        const fetchPage = async (url: URL) => {
            const res = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
            });
            if (!res.ok) {
                const errText = await res.text();
                const err: any = new Error(`HTTP ${res.status}`);
                err.status = res.status;
                err.body = errText;
                throw err;
            }
            return res.json();
        };

        let searchData: any;
        try {
            // Fetch first page
            searchData = await fetchPage(searchUrl);
            pushUnique(searchData?.results || []);

            // Fetch subsequent pages until desiredTotal reached (max 10 pages)
            for (let page = 2; page <= 10 && aggregated.length < desiredTotal; page++) {
                const pageUrl = new URL(searchUrl.toString());
                pageUrl.searchParams.set('page', String(page));
                const d = await fetchPage(pageUrl);
                const pageResults: any[] = d?.results || [];
                if (pageResults.length === 0) break;
                pushUnique(pageResults);
                // stop early if AT reports totalResults and we've reached it
                if (typeof d?.totalResults === 'number' && aggregated.length >= d.totalResults) break;
            }
        } catch (err: any) {
            console.error('[Competitors] Search API failed:', err.status || err.message, String(err.body || '').slice(0, 300));

            // 403 = Search capability not enabled on this AT account
            if (err.status === 403) {
                return NextResponse.json({
                    ok: true,
                    competitors: SAMPLE_COMPETITORS,
                    total: SAMPLE_COMPETITORS.length,
                    vehicle: vehicleData?.vehicle || null,
                    capabilityError: true,
                    warning: 'AutoTrader Search capability not enabled on this account.',
                });
            }

            return NextResponse.json({
                ok: true,
                competitors: [],
                total: 0,
                vehicle: vehicleData?.vehicle || null,
                warning: `AutoTrader search returned ${err.status || 'error'}`,
                _debug: { status: err.status || null, url: searchUrl.toString() },
            });
        }

        // If no results (or too few), retry once with relaxed competitor filters to avoid blank views.
        // MotorDesk tends to show a larger set by broadening the search automatically.
        if (aggregated.length < 5) {
            const relaxedUrl = new URL(searchUrl.toString());
            [
                'standardFuelType',
                'standardTransmissionType',
                'standardDrivetrain',
                'doors',
                'ownershipCondition',
                'standardTrim',
                'minBadgeEngineSizeLitres',
                'maxBadgeEngineSizeLitres',
                'minOdometerReadingMiles',
                'maxOdometerReadingMiles',
                'minManufacturedYear',
                'maxManufacturedYear',
            ].forEach(k => relaxedUrl.searchParams.delete(k));
            // Drop the radius filter so AT returns national results — postcode stays so each result gets distance data
            relaxedUrl.searchParams.delete('distance');
            relaxedUrl.searchParams.set('pageSize', String(perPage));
            relaxedUrl.searchParams.set('page', '1');

            try {
                const retryData = await fetchPage(relaxedUrl);
                const retryResults: any[] = retryData?.results || [];
                if (retryResults.length > 0) {
                    pushUnique(retryResults);
                    usedRelaxedFallback = true;
                }
            } catch { /* ignore */ }
        }

        // If still empty (or still too few), fall back to broad Search API by make/model.
        if (aggregated.length < 5) {
            const broadSearchUrl = new URL(`${AUTOTRADER_BASE_URL}/search`);
            broadSearchUrl.searchParams.set('advertiserId', client.dealerId || '');
            broadSearchUrl.searchParams.set('pageSize', String(perPage));
            broadSearchUrl.searchParams.set('page', '1');
            broadSearchUrl.searchParams.set('sort', 'totalPriceAsc');
            // Ensure valuation data is requested where supported
            broadSearchUrl.searchParams.set('valuations', 'true');
            broadSearchUrl.searchParams.set('vehicleMetrics', 'true');
            if (vehicleForFallback.make) broadSearchUrl.searchParams.set('standardMake', vehicleForFallback.make);
            if (vehicleForFallback.model) broadSearchUrl.searchParams.set('standardModel', vehicleForFallback.model);

            const byYear = Number(vehicleForFallback.yearOfManufacture || vehicleForFallback.year || 0);
            if (Number.isFinite(byYear) && byYear > 1900) {
                broadSearchUrl.searchParams.set('minManufacturedYear', String(byYear - 3));
                broadSearchUrl.searchParams.set('maxManufacturedYear', String(byYear + 3));
            }

            try {
                const broadData = await fetchPage(broadSearchUrl);
                const broadResults: any[] = broadData?.results || [];
                if (broadResults.length > 0) {
                    pushUnique(broadResults);
                    usedRelaxedFallback = true;
                }
            } catch { /* ignore */ }
        }

        // If still empty, build a fresh competitor stock search from make/model/year.
        // This avoids overly-restrictive competitorUrl queries for some vehicles.
        if (!aggregated.length) {
            const make = searchParams.get('make') || vehicleForFallback.make || vehicleForFallback.standardMake || '';
            const model = searchParams.get('model') || vehicleForFallback.model || vehicleForFallback.standardModel || '';
            const minYear = searchParams.get('minYear') || '';
            const maxYear = searchParams.get('maxYear') || '';

            if (make && model) {
                const constructed = new URL(`${AUTOTRADER_BASE_URL}/stock`);
                constructed.searchParams.set('advertiserId', client.dealerId || '');
                constructed.searchParams.set('searchType', 'competitor');
                constructed.searchParams.set('valuations', 'true');
                constructed.searchParams.set('vehicleMetrics', 'true');
                constructed.searchParams.set('standardMake', make);
                constructed.searchParams.set('standardModel', model);
                if (minYear) constructed.searchParams.set('minManufacturedYear', minYear);
                if (maxYear) constructed.searchParams.set('maxManufacturedYear', maxYear);
                if (searchUrl.searchParams.get('postcode')) constructed.searchParams.set('postcode', String(searchUrl.searchParams.get('postcode')));
                constructed.searchParams.set('distance', searchUrl.searchParams.get('distance') || '0');
                constructed.searchParams.set('pageSize', String(perPage));
                constructed.searchParams.set('page', '1');

                try {
                    const d = await fetchPage(constructed);
                    const r: any[] = d?.results || [];
                    if (r.length > 0) {
                        pushUnique(r);
                        usedRelaxedFallback = true;
                    }
                } catch { /* ignore */ }
            }
        }
        const results: any[] = aggregated.slice(0, desiredTotal);
        const minEngineSize = Number(searchParams.get('minEngineSize') || '0');
        const maxEngineSize = Number(searchParams.get('maxEngineSize') || '0');

        // Step 5: Map to display fields
        const competitors = results.map((item: any) => {
            const v = item.vehicle || item?.stock?.vehicle || item || {};
            const adverts = item.adverts?.retailAdverts || item.adverts || {};
            const advertiser = item.advertiser || item?.advertiser || {};

            // Try to extract a thumbnail image from stock/search payloads.
            // Shapes vary: media.images[], images[], primaryImage, or flat URLs.
            const firstMedia = (item.media?.images && Array.isArray(item.media.images)) ? item.media.images[0] : null;
            const imgHref =
                (typeof firstMedia === 'string' ? firstMedia : (firstMedia?.href || null))
                ?? (Array.isArray(item.images) ? (typeof item.images[0] === 'string' ? item.images[0] : item.images[0]?.href) : null)
                ?? item.primaryImage
                ?? item?.stock?.primaryImage
                ?? null;

            const price =
                adverts.totalPrice?.amountGBP
                ?? adverts.price?.amountGBP
                ?? adverts.suppliedPrice?.amountGBP
                ?? null;

            // AT Stock API valuation response structure (per AT Connect docs):
            // valuations.marketAverage.retail.amountGBP  ← primary path
            // valuations.adjusted.retail.amountGBP        ← fallback
            const valCandidate =
                item.valuations?.marketAverage?.retail?.amountGBP
                ?? item.valuations?.adjusted?.retail?.amountGBP
                ?? item.valuations?.retail?.amountGBP
                ?? item.valuations?.retailValuation?.amountGBP
                ?? item.valuations?.valuation?.amountGBP
                ?? item.valuation?.marketAverage?.retail?.amountGBP
                ?? item.valuation?.retail?.amountGBP
                ?? item.valuation?.amountGBP
                ?? item.vehicleMetrics?.retail?.valuation?.amountGBP
                ?? item.vehicleMetrics?.valuation?.amountGBP
                ?? item.vehicleMetrics?.retailValuation?.amountGBP
                ?? item.vehicleMetrics?.retailValuation?.amount
                ?? item.vehicleMetrics?.retailRating?.valuation?.amountGBP
                ?? item.vehicleMetrics?.retailRating?.valuation?.amount
                ?? null;

            const atValuation =
                typeof valCandidate === 'number'
                    ? valCandidate
                    : (typeof valCandidate === 'string' && valCandidate.trim() !== '' ? Number(valCandidate) : null);

            const engineSize = v.badgeEngineSizeLitres
                ? `${Number(v.badgeEngineSizeLitres).toFixed(1)}L`
                : v.engineCapacityCC
                ? `${(v.engineCapacityCC / 1000).toFixed(1)}L`
                : '—';
            const engineSizeLitres = v.badgeEngineSizeLitres
                ? Number(v.badgeEngineSizeLitres)
                : v.engineCapacityCC
                ? Number(v.engineCapacityCC) / 1000
                : null;

            const dateOnForecourt = item.metadata?.dateOnForecourt || v.dateOnForecourt;
            const daysOnForecourt = dateOnForecourt
                ? Math.floor((Date.now() - new Date(dateOnForecourt).getTime()) / 86400000)
                : null;

            const featuresArr = Array.isArray(item.features)
                ? item.features
                : Array.isArray(v.features)
                ? v.features
                : [];
            const serviceHistoryRaw =
                item?.history?.serviceHistory
                ?? v?.serviceHistory
                ?? item?.retailerComments?.serviceHistory
                ?? '';
            const fullDealershipHistory =
                typeof serviceHistoryRaw === 'string'
                    ? serviceHistoryRaw.toLowerCase().includes('full')
                    : Boolean(item?.history?.fullDealershipHistory);

            return {
                registration:        v.registration || '—',
                image:               imgHref ? String(imgHref).replace('{resize}', 'w300h225') : null,
                price,
                valuation:           atValuation,
                priceIndicatorRating: adverts.priceIndicatorRating || null,
                trim:                v.trim || v.standardTrim || '—',
                derivative:          v.derivative || v.standard?.derivative || '—',
                engine:              engineSize,
                fuelType:            v.fuelType || '—',
                transmission:        v.transmissionType || '—',
                drivetrain:          v.drivetrain || item?.drivetrain || '—',
                doors:               v.doors ?? item?.doors ?? null,
                condition:           v.condition || item?.condition || null,
                mileage:             v.odometerReadingMiles ?? null,
                daysOnForecourt,
                distance:            null,
                optionalExtrasCount: featuresArr.length,
                fullDealershipHistory,
                options: featuresArr.map((f: any) => (typeof f === 'string' ? f : f?.name)).filter(Boolean),
                advertiserName:      advertiser.name || null,
                searchId:            item.metadata?.searchId || null,
                year:                v.yearOfManufacture || null,
                colour:              v.colour || null,
                engineSizeLitres,
            };
        }).filter((row: any) => {
            if (minEngineSize > 0 && (row.engineSizeLitres == null || row.engineSizeLitres < minEngineSize)) return false;
            if (maxEngineSize > 0 && (row.engineSizeLitres == null || row.engineSizeLitres > maxEngineSize)) return false;
            return true;
        });

        return NextResponse.json({
            ok: true,
            competitors,
            total: competitors.length,
            vehicle: vehicleData?.vehicle || null,
            warning: usedRelaxedFallback ? 'No matches for your exact filters. Showing closest matches from a broader national search.' : undefined,
            _debug: {
                usedRelaxedFallback,
                ...(competitors.length ? {} : {
                    competitorUrlUsed: Boolean(competitorUrl),
                    make: searchParams.get('make') || vehicleForFallback.make || null,
                    model: searchParams.get('model') || vehicleForFallback.model || null,
                }),
            },
        });

    } catch (error: any) {
        console.error('[Competitors API Error]', error.message, error.stack?.slice(0, 300));
        return NextResponse.json({
            ok: false,
            error: { message: error.message || 'Failed to fetch competitor data.' }
        }, { status: 500 });
    }
}

export const GET = withErrorHandler(getCompetitors);
