import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api-handler';
import { verifyAccessToken } from '@/lib/auth';
import connectToDatabase from '@/lib/db';
import Vehicle from '@/models/Vehicle';
import SaleInvoice from '@/models/SaleInvoice';

async function getStockBook(req: NextRequest) {
    const token = req.cookies.get('access_token')?.value;
    const session = token ? await verifyAccessToken(token) : null;
    if (!session?.tenantId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const tenantId = session.tenantId;

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const purchaseFrom = searchParams.get('purchaseFrom');
    const purchaseTo   = searchParams.get('purchaseTo');
    const invoiceFrom  = searchParams.get('invoiceFrom');
    const invoiceTo    = searchParams.get('invoiceTo');
    const paidFrom     = searchParams.get('paidFrom');
    const paidTo       = searchParams.get('paidTo');
    const statuses     = searchParams.get('statuses')?.split(',').filter(Boolean) || [];
    const saleTypes    = searchParams.get('saleTypes')?.split(',').filter(Boolean) || [];
    const saleOrReturn = searchParams.get('saleOrReturn') === 'true';
    const search       = searchParams.get('search')?.toLowerCase() || '';

    // Build vehicle query
    const vQuery: any = { tenantId };
    if (statuses.length) {
        const mapped = statuses.map((s: string) => s === 'For Sale' ? 'In Stock' : s);
        vQuery.status = { $in: mapped };
    }
    if (purchaseFrom || purchaseTo) {
        vQuery.createdAt = {};
        if (purchaseFrom) vQuery.createdAt.$gte = new Date(purchaseFrom);
        if (purchaseTo)   vQuery.createdAt.$lte = new Date(purchaseTo + 'T23:59:59');
    }
    if (saleOrReturn) vQuery.saleOrReturn = true;

    const vehicles = await Vehicle.find(vQuery, {
        make: 1, model: 1, derivative: 1, vrm: 1, status: 1,
        purchasePrice: 1, purchaseVatAmount: 1, vatType: 1,
        primaryImage: 1, createdAt: 1, forecourtPrice: 1, price: 1, stockId: 1,
    }).lean() as any[];

    // Fetch sale invoices for sold vehicles
    const vehicleIds = vehicles.map((v: any) => v._id);
    const invoiceQuery: any = { tenantId, vehicleId: { $in: vehicleIds }, type: 'invoice' };
    if (invoiceFrom || invoiceTo) {
        invoiceQuery.invoiceDate = {};
        if (invoiceFrom) invoiceQuery.invoiceDate.$gte = invoiceFrom;
        if (invoiceTo)   invoiceQuery.invoiceDate.$lte = invoiceTo;
    }
    if (paidFrom || paidTo) {
        invoiceQuery.paidAt = {};
        if (paidFrom) invoiceQuery.paidAt.$gte = new Date(paidFrom);
        if (paidTo)   invoiceQuery.paidAt.$lte = new Date(paidTo + 'T23:59:59');
    }

    const invoices = await SaleInvoice.find(invoiceQuery, {
        vehicleId: 1, invoiceDate: 1, invoiceType: 1, status: 1,
        lineItems: 1, payments: 1, paidAt: 1,
    }).lean() as any[];

    // Map invoiceId by vehicleId
    const invoiceByVehicle = new Map<string, any>();
    for (const inv of invoices) {
        const key = String(inv.vehicleId);
        if (!invoiceByVehicle.has(key)) invoiceByVehicle.set(key, inv);
    }

    // Build result rows
    const rows = vehicles
        .filter((v: any) => {
            if (!search) return true;
            return (
                v.vrm?.toLowerCase().includes(search) ||
                v.make?.toLowerCase().includes(search) ||
                v.model?.toLowerCase().includes(search)
            );
        })
        .map((v: any) => {
            const inv = invoiceByVehicle.get(String(v._id));
            // saleTotal = sum of ex-VAT line items (consistent revenue figure regardless of scheme)
            const saleTotal = inv
                ? inv.lineItems.reduce((s: number, li: any) => s + (li.priceExcVat || 0), 0)
                : null;
            const paidDate = inv?.paidAt ? new Date(inv.paidAt).toISOString().slice(0, 10) : null;
            const siv = v.purchasePrice || 0;
            // For VAT Invoice vehicles the dealer reclaims purchase VAT — subtract it from cost
            const effectiveSiv = inv?.invoiceType === 'VAT Invoice'
                ? siv - (v.purchaseVatAmount || 0)
                : siv;
            const profit = saleTotal !== null ? saleTotal - effectiveSiv : null;
            const displayStatus = v.status === 'In Stock' ? 'For Sale' : v.status;

            // Apply sale type filter
            if (saleTypes.length) {
                const invType = inv?.invoiceType || 'Not Sold';
                const mapped = invType === 'Margin Scheme' ? 'Margin Scheme'
                    : invType === 'VAT Invoice' ? 'VAT Qualifying'
                    : 'Not Sold';
                if (!saleTypes.includes(mapped)) return null;
            }

            return {
                _id: String(v._id),
                vrm: v.vrm,
                make: v.make,
                model: v.model,
                derivative: v.derivative,
                primaryImage: v.primaryImage,
                status: displayStatus,
                purchaseDate: v.createdAt ? new Date(v.createdAt).toISOString().slice(0, 10) : null,
                siv: effectiveSiv,
                invoiceDate: inv?.invoiceDate || null,
                invoiceType: inv?.invoiceType || null,
                saleTotal,
                paidDate,
                profit,
            };
        })
        .filter(Boolean);

    // Totals
    const totals = {
        count: rows.length,
        totalSiv: rows.reduce((s, r) => s + (r!.siv || 0), 0),
        totalSale: rows.reduce((s, r) => s + (r!.saleTotal || 0), 0),
        totalProfit: rows.reduce((s, r) => s + (r!.profit || 0), 0),
    };

    return NextResponse.json({ ok: true, rows, totals });
}

export const GET = withErrorHandler(getStockBook);
