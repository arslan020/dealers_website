import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { AutoTraderClient } from '@/lib/autotrader';

/**
 * POST /api/vehicles/images
 * Uploads a single image to the AutoTrader CDN.
 * Returns { imageId } which then gets saved to the stock via PATCH /api/vehicles (imageIds field).
 *
 * Body: multipart/form-data with field 'file' (JPEG) and optional 'vehicleType' (Car|Van|Bike)
 * Capability: Media Updates
 */
export async function POST(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;

    if (!session?.tenantId) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json({ ok: false, error: 'Could not parse form data. Send multipart/form-data with a "file" field.' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    const vehicleType = (formData.get('vehicleType') as string) || 'Car';

    if (!file) {
        return NextResponse.json({ ok: false, error: 'No file provided. Include a "file" field in the form data.' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
        return NextResponse.json({ ok: false, error: 'File must be an image (JPEG recommended).' }, { status: 400 });
    }

    if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: 'Image must be under 20MB (AutoTrader limit).' }, { status: 400 });
    }

    try {
        const client = new AutoTraderClient(session.tenantId);
        await client.init();

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const result = await client.uploadImage(buffer, file.type || 'image/jpeg', vehicleType);

        const atBaseUrl = process.env.AUTOTRADER_API_URL || 'https://api.autotrader.co.uk';
        const cdnHost = atBaseUrl.includes('sandbox') ? 'm-qa.atcdn.co.uk' : 'm.atcdn.co.uk';

        return NextResponse.json({
            ok: true,
            imageId: result?.imageId || result?.id || null,
            classificationTags: result?.classificationTags || [],
            href: result?.imageId
                ? `https://${cdnHost}/a/media/{resize}/${result.imageId}.jpg`
                : null,
        });
    } catch (error: any) {
        console.error('[Image Upload Error]', error.message);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to upload image to AutoTrader.' },
            { status: 500 }
        );
    }
}

