import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { importVehiclesFromAT } from '@/lib/importVehiclesFromAT';

export async function POST(req: NextRequest) {
    try {
        const token = req.cookies.get('access_token')?.value;
        const session = token ? await verifyAccessToken(token) : null;
        if (!session || !session.tenantId) {
            return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
        }
        const { imported, updated } = await importVehiclesFromAT(session.tenantId);
        return NextResponse.json({ ok: true, imported, updated, total: imported + updated });
    } catch (error: any) {
        console.error('Import from AT error:', error);
        return NextResponse.json({ ok: false, error: error.message || 'Import failed.' }, { status: 500 });
    }
}
