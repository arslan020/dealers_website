import { NextRequest, NextResponse } from 'next/server';

type ApiContext = { params?: any };

/**
 * A wrapper for API endpoints to standardize error handling.
 */
export function withErrorHandler(handler: (req: NextRequest, context: ApiContext) => Promise<NextResponse>) {
    return async (req: NextRequest, context: ApiContext) => {
        try {
            return await handler(req, context);
        } catch (error: any) {
            console.error('API Error:', error);

            return NextResponse.json(
                {
                    ok: false,
                    error: {
                        message: error.message || 'Internal Server Error',
                        code: error.code || error.name || 'INTERNAL_ERROR',
                        stack: error.stack,
                    },
                },
                { status: 500 }
            );
        }
    };
}
