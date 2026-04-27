import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';
import connectToDatabase from '@/lib/db';
import AutoTraderStockCache from '@/models/AutoTraderStockCache';

// Rate limit removed — sync always fetches fresh from AutoTrader

async function getAutoTraderStock(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session || !session.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    if (session.role === 'SUPER_ADMIN') {
        return NextResponse.json({ ok: false, error: { message: 'Super Admins do not have dealer access.', code: 'FORBIDDEN' } }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = 25;
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const tenantObjectId = session.tenantId;
    const now = new Date();

    // ─── Always fetch fresh from AutoTrader (rate limit removed) ────────────────
    let cache = await AutoTraderStockCache.findOne({ tenantId: tenantObjectId });
    const shouldFetch = true;

    if (shouldFetch) {

        try {
            // ─── Fetch fresh stock from AutoTrader ──────────────────────────────
            const client = new AutoTraderClient(session.tenantId);
            await client.init();

            const queryParams: Record<string, string> = {
                advertiserId: client.dealerId || '',
                page: '1',
                pageSize: '200', // AutoTrader maximum page size
                features: 'true',
            };

            const responseData = await client.get('/stock', queryParams);

            const rawStock = responseData.results || responseData.vehicles || responseData.stock || responseData.data || (Array.isArray(responseData) ? responseData : []);
            
            const allStock = rawStock
                .map((v: any, index: number) => {
                    // AutoTrader often hides the real ID in metadata or adverts
                    const realId = v.id || v.stockId || v.advertId || v.vehicle?.id || v.metadata?.stockId || v.metadata?.advertId || v.adverts?.[0]?.advertId;
                    const id = realId || v.vehicle?.vrm || v.vrm || v.vehicle?.registrationNumber || v.registrationNumber || `at-${index}`;

                    // ── Map AT lifecycleState → local status ──────────────────
                    const lifecycleState: string = v.metadata?.lifecycleState || 'FORECOURT';
                    const statusMap: Record<string, string> = {
                        FORECOURT:        'In Stock',
                        SALE_IN_PROGRESS: 'Reserved',
                        SOLD:             'Sold',
                        DUE_IN:           'Draft',
                    };
                    const status = statusMap[lifecycleState] || 'In Stock';
                    
                    return {
                        id,
                        isRealAtId: !!realId,
                        vrm: v.vehicle?.vrm || v.vrm || v.vehicle?.registration || v.registration || v.vehicle?.registrationNumber || v.registrationNumber || '',
                        make: v.vehicle?.make || v.make || '',
                        model: v.vehicle?.model || v.model || '',
                        derivative: v.vehicle?.derivative || v.derivative || '',
                        year: v.vehicle?.yearOfManufacture || v.year || v.vehicle?.registrationYear || '',
                        mileage: v.vehicle?.odometerReadingMiles || v.mileage || v.vehicle?.odometer?.value || 0,
                        price: v.adverts?.forecourtPrice?.amountGBP || v.adverts?.retailAdverts?.suppliedPrice?.amountGBP || v.price?.advertisedPrice || v.retailPrice || 0,
                        status,
                        primaryImage: (v.media?.images?.[0]?.href) || (v.images?.[0]?.href) || (v.images?.[0]) || '',
                        images: (v.media?.images || []).map((img: any) => img.href || img),
                        fuelType: v.vehicle?.fuelType || '',
                        transmission: v.vehicle?.transmissionType || '',
                        colour: v.vehicle?.colour || '',
                        engineSize: v.vehicle?.engineSizeCc || '',
                        bodyType: v.vehicle?.bodyType || '',
                        features: v.features || [],
                        technicalSpecs: v.vehicle || {},
                        adverts: v.adverts,
                        // Keep full metadata so dashboard can read lifecycleState & dateOnForecourt from cache
                        metadata: v.metadata || {},
                    };
                })
                .filter((v: any) => v.make && (v.isRealAtId || (v.id && !v.id.startsWith('at-')))); 

            // ─── Save to cache ──────────────────────────────────────────────────
            if (cache) {
                cache.stock = allStock;
                cache.total = allStock.length;
                cache.fetchedAt = now;
                await cache.save();
            } else {
                cache = await AutoTraderStockCache.create({
                    tenantId: tenantObjectId,
                    stock: allStock,
                    total: allStock.length,
                    fetchedAt: now,
                });
            }

            console.log(`[AutoTrader] Fresh stock fetched for tenant ${tenantObjectId}. ${allStock.length} vehicles.`);
        } catch (error: any) {
            // If fresh fetch fails but we have stale cache, serve it anyway
            if (cache?.stock?.length) {
                console.warn(`[AutoTrader] Fresh fetch failed, serving stale cache. Error: ${error.message}`);
            } else {
                const isConfigError = error.message?.includes('not configured');
                const isRateLimitError = error.message?.includes('429');
                
                return NextResponse.json({
                    ok: false,
                    error: {
                        message: isConfigError
                            ? 'AutoTrader is not connected for this dealership. Please ask your admin to configure it.'
                            : isRateLimitError
                                ? 'AutoTrader is currently busy. Please wait 5 minutes before trying again.'
                                : 'Failed to fetch stock from AutoTrader.',
                        code: isConfigError ? 'NOT_CONFIGURED' : (isRateLimitError ? 'AT_RATE_LIMITED' : 'API_ERROR'),
                    }
                }, { status: isConfigError ? 400 : (isRateLimitError ? 429 : 500) });
            }
        }
    }

    // ─── Serve from cache (with local search filter + pagination) ────────────
    let stockItems = (cache?.stock || [])
        .filter((v: any) => v.make && (v.isRealAtId || (v.id && !v.id.startsWith('at-'))));

    if (search) {
        stockItems = stockItems.filter((v: any) =>
            v.make?.toLowerCase().includes(search) ||
            v.model?.toLowerCase().includes(search) ||
            v.vrm?.toLowerCase().includes(search) ||
            v.derivative?.toLowerCase().includes(search)
        );
    }

    const total = stockItems.length;
    const startIdx = (page - 1) * pageSize;
    const pagedStock = stockItems.slice(startIdx, startIdx + pageSize);

    const cacheAge = cache?.fetchedAt
        ? Math.round((now.getTime() - cache.fetchedAt.getTime()) / 60000)
        : null;

    return NextResponse.json({
        ok: true,
        stock: pagedStock,
        total,
        cachedAt: cache?.fetchedAt || null,
        nextRefreshAt: cache?.nextAllowedFetchAt || null,
        cacheAgeMinutes: cacheAge,
        fromCache: !shouldFetch,
    });
}


/**
 * POST /api/vehicles/autotrader-stock
 * Creates a new stock record on AutoTrader.
 * Body: { vehicle: localVehicleObject }
 * Capability: Stock Updates
 */
export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;

        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: { message: 'Unauthorized.', code: 'UNAUTHORIZED' } }, { status: 401 });
        }

        const body = await req.json();
        const { vehicle } = body;

        if (!vehicle) {
            return NextResponse.json({ ok: false, error: { message: 'Vehicle data is required.', code: 'VALIDATION_ERROR' } }, { status: 400 });
        }

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // ─── Map local vehicle to AT schema ──────────────────────────────
        // Align with AT Connect docs + our main /api/vehicles POST mapping.
        // Important: use registration + odometerReadingMiles (not vrm + nested mileage object).
        const vrm = (vehicle.vrm || vehicle.registration || '').toString().toUpperCase().replace(/\s/g, '');
        const stockPayload: any = {
            vehicle: {
                ...(vehicle.make && { make: vehicle.make }),
                ...(vehicle.model && { model: vehicle.model }),
                ...(vrm && { registration: vrm }),
                ...(vehicle.vin && { vin: vehicle.vin }),
                ...(vehicle.derivativeId && { derivativeId: vehicle.derivativeId }),
                ...(vehicle.mileage !== undefined && { odometerReadingMiles: Number(vehicle.mileage) }),
                ...(vehicle.colour && { colour: vehicle.colour }),
                ...(vehicle.fuelType && { fuelType: vehicle.fuelType }),
                ...(vehicle.transmission && { transmissionType: vehicle.transmission }),
                ...(vehicle.bodyType && { bodyType: vehicle.bodyType }),
                ...(vehicle.year && { yearOfManufacture: String(vehicle.year) }),
            },
            adverts: {
                retailAdverts: {
                    suppliedPrice: { amountGBP: Number(vehicle.price) || 0 },
                    ...(vehicle.description ? { description: vehicle.description } : {}),
                    ...(vehicle.attentionGrabber ? { attentionGrabber: vehicle.attentionGrabber } : {}),
                }
            },
            metadata: {
                lifecycleState: 'FORECOURT',
            }
        };

        const result = await client.createStock(stockPayload);

        return NextResponse.json({ ok: true, result });
    } catch (error: any) {
        console.error('[AutoTrader Stock Create] Error:', error.message);
        return NextResponse.json({ 
            ok: false, 
            error: { message: error.message || 'Failed to create stock on AutoTrader.' } 
        }, { status: 500 });
    }
}

export const GET = withErrorHandler(getAutoTraderStock);
