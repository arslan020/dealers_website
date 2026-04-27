import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

type Params = { params: Promise<{ dealId: string }> };

/**
 * GET /api/deals/[dealId]/messages?messagesId=xxx
 * Fetch all messages for a deal thread from AutoTrader.
 * Capability: Deal Sync
 */
export async function GET(req: NextRequest, { params }: Params) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
        }

        const { dealId } = await params;
        const messagesId = new URL(req.url).searchParams.get('messagesId');

        if (!messagesId) {
            return NextResponse.json({ ok: true, messages: { messages: [] } });
        }

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const data = await client.getMessages(messagesId);

        try { await client.markMessageAsRead(messagesId); } catch { /* silent */ }

        return NextResponse.json({ ok: true, messages: data });
    } catch (error: any) {
        console.error('[Messages GET]', error.message);
        return NextResponse.json({ ok: false, error: { message: error.message || 'Failed to fetch messages.' } }, { status: 500 });
    }
}

/**
 * POST /api/deals/[dealId]/messages
 * Send a message reply on a deal thread.
 * Body: { message: string, messagesId?: string }
 * Capability: Message Updates
 */
export async function POST(req: NextRequest, { params }: Params) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
        }

        const { dealId } = await params;
        const body = await req.json();
        const { message, messagesId } = body;

        if (!message?.trim()) {
            return NextResponse.json({ ok: false, error: { message: 'Message text is required.', code: 'VALIDATION_ERROR' } }, { status: 400 });
        }

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const result = await client.replyToMessage({
            dealId: messagesId ? undefined : dealId,
            messagesId: messagesId || undefined,
            message: message.trim(),
        });

        return NextResponse.json({ ok: true, result });
    } catch (error: any) {
        console.error('[Messages POST]', error.message, JSON.stringify(error.data));
        const atDetail = error.data ? JSON.stringify(error.data) : (error.message || 'Failed to send message.');
        return NextResponse.json({ ok: false, error: { message: atDetail } }, { status: 500 });
    }
}

/**
 * PATCH /api/deals/[dealId]/messages?messagesId=xxx
 * Mark the message thread as read by the advertiser.
 * Capability: Message Updates
 */
export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session?.tenantId) {
            return NextResponse.json({ ok: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, { status: 401 });
        }

        const messagesId = new URL(req.url).searchParams.get('messagesId');

        if (!messagesId) {
            return NextResponse.json({ ok: true });
        }

        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        await client.markMessageAsRead(messagesId);

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[Messages PATCH]', error.message);
        return NextResponse.json({ ok: false, error: { message: error.message || 'Failed to mark messages as read.' } }, { status: 500 });
    }
}
