import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { withErrorHandler } from '@/lib/api-handler';
import { AutoTraderClient } from '@/lib/autotrader';

async function getChatHistory(req: NextRequest, { params }: any) {
    const session = await getSession();
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: messagesId } = await params;

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // API PDF Page 70-71: GET /messages/{messagesId}
        const response = await client.getMessages(messagesId);

        // Map AutoTrader messages to our UI structure
        const history = response.messages.map((msg: any) => ({
            sender: msg.from === 'Advertiser' ? 'dealer' : 'customer',
            text: msg.message,
            timestamp: msg.at
        }));

        return NextResponse.json({
            ok: true,
            history,
            messagesId: response.messagesId,
            advertiserLastRead: response.advertiserLastRead,
            advertiserLastReadStatus: response.advertiserLastReadStatus
        });

    } catch (error: any) {
        console.error('[AutoTrader Chat GET Error]', error.message);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

async function sendChatMessage(req: NextRequest, { params }: any) {
    const session = await getSession();
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: messagesId } = await params;
    const { text, dealId } = await req.json();

    if (!text) {
        return NextResponse.json({ ok: false, error: 'Message text is required.' }, { status: 400 });
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // Send reply
        // API PDF Page 71: POST /messages
        // Payload can have dealId or messagesId
        const payload: any = { message: text };
        if (messagesId && messagesId !== 'new') {
            payload.messagesId = messagesId;
        } else if (dealId) {
            payload.dealId = dealId;
        } else {
            return NextResponse.json({ ok: false, error: 'No messagesId or dealId available to send message.' }, { status: 400 });
        }

        const response = await client.replyToMessage(payload);

        return NextResponse.json({ ok: true, message: response });

    } catch (error: any) {
        console.error('[AutoTrader Chat POST Error]', error.message, JSON.stringify(error.data));
        const atDetail = error.data ? JSON.stringify(error.data) : error.message;
        return NextResponse.json({ ok: false, error: atDetail }, { status: 500 });
    }
}

async function markChatAsRead(_req: NextRequest, { params }: any) {
    const session = await getSession();
    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: messagesId } = await params;

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        // PATCH /messages/{messagesId}?advertiserId= — mark messages as read
        await client.markMessageAsRead(messagesId);

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[AutoTrader Chat PATCH Error]', error.message);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export const GET = withErrorHandler(getChatHistory);
export const POST = withErrorHandler(sendChatMessage);
export const PATCH = withErrorHandler(markChatAsRead);
