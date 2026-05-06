import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

async function getAutoTraderLeads(req: NextRequest) {
    const session = await getSession();
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const { searchParams } = new URL(req.url);
        const page = searchParams.get('page') || '1';
        const from = searchParams.get('from') || '';

        const params: Record<string, string> = { page };
        if (from) params.from = from;

        // Fetch deals from AutoTrader
        // API PDF Page 65-66: GET /deals
        const response = await client.getDeals(params);

        function mapAtDealStatus(atStatus: string | undefined): string {
            switch (atStatus) {
                case 'In progress':
                case 'In Progress': return 'IN_PROGRESS';
                case 'Completed':   return 'WON';
                case 'Cancelled':   return 'LOST';
                default:            return 'NEW_LEAD';
            }
        }

        // Map AutoTrader Deals to UI-friendly Lead structures
        const leads = response.results.map((deal: any) => ({
            id: deal.dealId,
            source: 'AutoTrader',
            customer: {
                name: `${deal.consumer.firstName} ${deal.consumer.lastName}`,
                email: deal.consumer.email,
                phone: deal.consumer.phone
            },
            vehicle: {
                stockId: deal.stock?.stockId,
                searchId: deal.stock?.searchId
            },
            status: mapAtDealStatus(deal.advertiserDealStatus),
            atDealStatus: deal.advertiserDealStatus,
            created: deal.created,
            lastUpdated: deal.lastUpdated,
            intentScore: deal.buyingSignals?.dealIntentScore,
            intentLevel: deal.buyingSignals?.intent,
            messagesId: deal.messages?.id ?? deal.messages?.messagesId ?? null
        }));

        return NextResponse.json({
            ok: true,
            leads,
            totalResults: response.totalResults
        });

    } catch (error: any) {
        console.error('[AutoTrader Leads API Error]', error.message);
        return NextResponse.json({
            ok: false,
            error: error.message || 'Failed to fetch leads from AutoTrader.'
        }, { status: 500 });
    }
}

export const GET = withErrorHandler(getAutoTraderLeads);
