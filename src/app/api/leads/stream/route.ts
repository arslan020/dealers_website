import { NextRequest, NextResponse } from 'next/server';
import { sseEmitter } from '@/lib/sse';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
    // Attempt to get session so we only stream events meant for this tenant
    const session = await getSession();
    if (!session?.tenantId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const tenantIdStr = session.tenantId.toString();

    let streamController: ReadableStreamDefaultController;

    const stream = new ReadableStream({
        start(controller) {
            streamController = controller;
            
            // Send initial ping to establish connection
            controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

            const onLeadUpdate = (data: { tenantId: string, payload: any }) => {
                // Ensure we only broadcast to the correct tenant's stream
                if (data.tenantId === tenantIdStr) {
                    controller.enqueue(`data: ${JSON.stringify(data.payload)}\n\n`);
                }
            };

            sseEmitter.on('lead_update', onLeadUpdate);

            req.signal.addEventListener('abort', () => {
                sseEmitter.off('lead_update', onLeadUpdate);
            });
        },
        cancel() {
            // Cleanup on explicit cancel if needed
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Encoding': 'none'
        }
    });
}
