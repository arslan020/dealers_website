import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { withErrorHandler } from '@/lib/api-handler';

async function healthHandler() {
    // Test the DB connection
    await connectToDatabase();

    return NextResponse.json({ ok: true, db: "connected" });
}

export const GET = withErrorHandler(healthHandler);
