import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';
import connectToDatabase from '@/lib/db';
import Lead from '@/models/Lead';
import Customer from '@/models/Customer';

/** Turn AutoTrader JSON error body into a short user-facing string */
function formatAutoTraderError(data: unknown): string {
    if (data == null || data === '') return 'AutoTrader rejected the request.';
    if (typeof data === 'string') return data;
    if (typeof data !== 'object') return String(data);
    const o = data as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.error === 'string') return o.error;
    if (typeof o.title === 'string') return o.title;
    if (Array.isArray(o.errors)) {
        return o.errors
            .map((e: unknown) =>
                typeof e === 'string' ? e : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : JSON.stringify(e)
            )
            .filter(Boolean)
            .join('; ');
    }
    if (o.detail) return typeof o.detail === 'string' ? o.detail : JSON.stringify(o.detail);
    try {
        return JSON.stringify(data);
    } catch {
        return 'AutoTrader rejected the request.';
    }
}

/**
 * GET /api/deals
 * Lists all deals for this advertiser from AutoTrader.
 * Query params: page, from (ISO date), to (ISO date)
 * Capability: Deal Sync
 *
 * POST /api/deals
 * Creates a new deal on AutoTrader.
 * Body: { consumer: { firstName, lastName, email }, stockId }
 * Capability: Deal Updates
 */

async function getDeals(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = searchParams.get('page') || '1';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';

    const queryParams: Record<string, string> = { page };
    if (from) queryParams.from = from;
    if (to) queryParams.to = to;

    const client = new AutoTraderClient(session.tenantId);
    await client.init();
    
    // Add required advertiserId param which the client handler might do implicitly, 
    // but just to be safe as per user requirements.
    if (client.dealerId) {
        queryParams.advertiserId = client.dealerId;
    }

    const data = await client.getDeals(queryParams);
    await connectToDatabase();

    // Shape the results for the UI and Sync to DB
    const deals = await Promise.all((data.results || []).map(async (d: any) => {
        
        let statusUpdate = 'NEW_LEAD';
        if (d.messages && d.messages.lastUpdated) {
            statusUpdate = 'NEW_MESSAGE';
        } else if (d.advertiserDealStatus && d.advertiserDealStatus !== 'New') {
            statusUpdate = 'IN_PROGRESS';
        }
        
        // Upsert Customer
        let customerId;
        if (d.consumer?.email || d.consumer?.phone) {
            const customerData = {
                firstName: d.consumer.firstName || 'Unknown',
                lastName: d.consumer.lastName || '',
                email: d.consumer.email,
                phone: d.consumer.phone,
                source: 'AutoTrader',
                status: 'Active',
                type: d.consumer.type || 'Private',
                vatRegistrationStatus: d.consumer.vatRegistrationStatus || '',
                tenantId: session.tenantId
            };
            
            const orConditions = [];
            if (d.consumer.email) orConditions.push({ email: d.consumer.email });
            if (d.consumer.phone) orConditions.push({ phone: d.consumer.phone });
            
            const updatedCustomer = await Customer.findOneAndUpdate(
                { 
                    tenantId: session.tenantId,
                    ...(orConditions.length > 0 ? { $or: orConditions } : { _id: null }) // fallback if no contact
                },
                { $set: customerData },
                { upsert: true, new: true }
            );
            customerId = updatedCustomer._id;
        }

        // Upsert Lead
        const resolvedDealId = d.dealId ?? d.id;
        if (resolvedDealId) {
            await Lead.findOneAndUpdate(
                { dealId: resolvedDealId, tenantId: session.tenantId },
                { 
                    $setOnInsert: { 
                        platform: 'AutoTrader',
                        status: statusUpdate === 'NEW_MESSAGE' ? 'NEW_LEAD' : statusUpdate, 
                        createdAt: d.created ? new Date(d.created) : new Date()
                    },
                    $set: {
                        messagesId: d.messages?.messagesId ?? d.messages?.id ?? null,
                        intentScore: d.buyingSignals?.dealIntentScore || 0,
                        intentLevel: d.buyingSignals?.intent || 'Unknown',
                        ...(customerId ? { customerId } : {})
                    }
                },
                { upsert: true }
            );
        }

        return {
            dealId: d.dealId ?? d.id,
            advertiserId: d.advertiserId,
            created: d.created,
            lastUpdated: d.lastUpdated,
            advertiserDealStatus: d.advertiserDealStatus,
            consumerDealStatus: d.consumerDealStatus,
            consumer: d.consumer,
            stock: d.stock,
            price: d.price,
            reservation: d.reservation,
            buyingSignals: d.buyingSignals,
            financeApplication: d.financeApplication,
            partExchange: d.partExchange,
            messages: d.messages,
            calls: d.calls,
            delivery: d.delivery,
        };
    }));

    return NextResponse.json({
        ok: true,
        deals,
        totalResults: data.totalResults || deals.length,
        page: parseInt(page),
    });
}


async function createDeal(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const body = await req.json();
    const { consumer, stockId } = body;

    if (!consumer?.firstName || !consumer?.lastName || !consumer?.email || !stockId) {
        return NextResponse.json({
            ok: false,
            error: { message: 'consumer.firstName, consumer.lastName, consumer.email and stockId are required.', code: 'VALIDATION_ERROR' }
        }, { status: 400 });
    }

    const consumerPayload: { firstName: string; lastName: string; email: string; phone?: string } = {
        firstName: String(consumer.firstName).trim(),
        lastName: String(consumer.lastName).trim(),
        email: String(consumer.email).trim().toLowerCase(),
    };
    if (typeof consumer.phone === 'string' && consumer.phone.trim() !== '') {
        consumerPayload.phone = consumer.phone.trim();
    }

    const client = new AutoTraderClient(session.tenantId);
    await client.init();

    try {
        const result = await client.createDeal({ consumer: consumerPayload, stockId: String(stockId).trim() });
        const dealId = (result as any)?.dealId ?? (result as any)?.id;
        if (!dealId) {
            console.error('[POST /api/deals] Unexpected AT response:', result);
            return NextResponse.json(
                { ok: false, error: { message: 'Deal created but no deal ID was returned.', code: 'AUTOTRADER_PARSE' } },
                { status: 502 }
            );
        }
        return NextResponse.json({ ok: true, dealId });
    } catch (e: unknown) {
        const err = e as { status?: number; data?: unknown; message?: string };
        const status = typeof err.status === 'number' ? err.status : 500;
        const details = err.data;
        console.error('[POST /api/deals] AutoTrader error:', status, details);

        if (status >= 400 && status < 500) {
            return NextResponse.json(
                {
                    ok: false,
                    error: {
                        message: formatAutoTraderError(details) || err.message || 'AutoTrader rejected the request.',
                        code: 'AUTOTRADER_CLIENT_ERROR',
                        details,
                    },
                },
                { status: status === 400 ? 400 : status }
            );
        }
        if (status >= 500) {
            return NextResponse.json(
                {
                    ok: false,
                    error: {
                        message: formatAutoTraderError(details) || err.message || 'AutoTrader service error.',
                        code: 'AUTOTRADER_UPSTREAM_ERROR',
                        details,
                    },
                },
                { status: 502 }
            );
        }
        throw e;
    }
}

export const GET = withErrorHandler(getDeals);
export const POST = withErrorHandler(createDeal);
