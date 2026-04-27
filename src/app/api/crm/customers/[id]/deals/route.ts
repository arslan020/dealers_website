import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import Customer from '@/models/Customer';
import dbConnect from '@/lib/db';
import { AutoTraderClient } from '@/lib/autotrader';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        await dbConnect();
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        const tenantId = session?.tenantId;
        if (!tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const customer = await Customer.findOne({ _id: params.id, tenantId });
        if (!customer) return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });

        // Instantiate AutoTrader Client
        const atClient = new AutoTraderClient(tenantId.toString());
        
        let allATDeals: any[] = [];
        let page = 1;
        let hasMore = true;
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Loop through all Deals from AT to find this customer's full history and buying signals (as per user arch plan)
        while (hasMore) {
            try {
                const atRes = await atClient.getDeals({ 
                    page: page.toString(),
                    from: oneYearAgo
                });
                if (atRes && atRes.deals) {
                    allATDeals = [...allATDeals, ...atRes.deals];
                    if (allATDeals.length >= atRes.totalResults || atRes.deals.length < 50) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            } catch (err) {
                console.error("Error fetching AT Deals for Profile View", err);
                hasMore = false;
            }
        }

        // Filter and Map the deals to the requested shape
        const mappedDeals = allATDeals.filter(d => {
            const cEmail = customer.email?.toLowerCase();
            const cPhone = customer.phone?.replace(/\s+/g, '');
            const dEmail = d.consumer?.email?.toLowerCase();
            const dPhone = d.consumer?.phone?.replace(/\s+/g, '');

            if (cEmail && dEmail && cEmail === dEmail) return true;
            if (cPhone && dPhone && cPhone === dPhone) return true;
            return false;
        }).map(d => ({
            dealId: d.dealId,
            advertiserDealStatus: d.advertiserDealStatus,
            stock: {
                stockId: d.stock?.stockId,
                searchId: d.stock?.searchId
            },
            financeApplication: d.financeApplication ? { id: d.financeApplication.id } : null,
            partExchange: d.partExchange ? { id: d.partExchange.id } : null,
            buyingSignals: d.buyingSignals ? {
                dealIntentScore: d.buyingSignals.dealIntentScore,
                intent: d.buyingSignals.intent,
                localConsumer: d.buyingSignals.localConsumer,
                advertSaved: d.buyingSignals.advertSaved,
                preferences: {
                    makeModels: d.buyingSignals.preferences?.makeModels || [],
                    bodyTypes: d.buyingSignals.preferences?.bodyTypes || [],
                    fuelTypes: d.buyingSignals.preferences?.fuelTypes || [],
                    colours: d.buyingSignals.preferences?.colours || [],
                    wheelbaseTypes: d.buyingSignals.preferences?.wheelbaseTypes || [],
                    mileages: d.buyingSignals.preferences?.mileages || null,
                    years: d.buyingSignals.preferences?.years || null
                }
            } : null
        }));

        return NextResponse.json({ ok: true, deals: mappedDeals, customer });

    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
