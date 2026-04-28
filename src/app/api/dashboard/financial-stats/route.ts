import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import connectToDatabase from '@/lib/db';
import SaleInvoice from '@/models/SaleInvoice';
import PurchaseInvoice from '@/models/PurchaseInvoice';
import Vehicle from '@/models/Vehicle';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session?.tenantId) return NextResponse.json({ ok: false }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 90);

    await connectToDatabase();
    const tenantId = new mongoose.Types.ObjectId(session.tenantId as string);

    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 86_400_000);
    const prevStart = new Date(periodStart.getTime() - days * 86_400_000);

    const [saleInvoices, purchaseInvoices, vehiclesAdded,
           prevSaleInvoices, prevPurchaseInvoices, prevVehiclesAdded] = await Promise.all([
        SaleInvoice.find({ tenantId, status: { $in: ['issued', 'paid'] }, createdAt: { $gte: periodStart } })
            .select('payments createdAt').lean(),
        PurchaseInvoice.find({ tenantId, status: { $in: ['issued', 'paid'] }, createdAt: { $gte: periodStart } })
            .select('lineItems adjustment createdAt').lean(),
        Vehicle.countDocuments({ tenantId, createdAt: { $gte: periodStart } }),
        SaleInvoice.find({ tenantId, status: { $in: ['issued', 'paid'] }, createdAt: { $gte: prevStart, $lt: periodStart } })
            .select('payments createdAt').lean(),
        PurchaseInvoice.find({ tenantId, status: { $in: ['issued', 'paid'] }, createdAt: { $gte: prevStart, $lt: periodStart } })
            .select('lineItems adjustment createdAt').lean(),
        Vehicle.countDocuments({ tenantId, createdAt: { $gte: prevStart, $lt: periodStart } }),
    ]);

    function sumSales(invs: any[]): number {
        return invs.reduce((s, inv) =>
            s + (inv.payments || []).reduce((ps: number, p: any) => ps + (p.amount || 0), 0), 0);
    }

    function sumPurchases(invs: any[]): number {
        return invs.reduce((s, inv) =>
            s + (inv.lineItems || []).reduce((ls: number, l: any) => ls + (l.priceExcVat || 0), 0) + (inv.adjustment || 0), 0);
    }

    const totalSales = sumSales(saleInvoices);
    const purchases = sumPurchases(purchaseInvoices);
    const prevTotalSales = sumSales(prevSaleInvoices);
    const prevPurchases = sumPurchases(prevPurchaseInvoices);

    // Build daily sparkline data
    const dailyData: { date: string; sales: number; purchases: number }[] = [];
    for (let i = 0; i < days; i++) {
        const dayStart = new Date(periodStart.getTime() + i * 86_400_000);
        const dayEnd = new Date(dayStart.getTime() + 86_400_000);
        const dateKey = dayStart.toISOString().split('T')[0];

        const daySales = saleInvoices
            .filter((inv: any) => { const d = new Date(inv.createdAt); return d >= dayStart && d < dayEnd; })
            .reduce((s, inv: any) => s + (inv.payments || []).reduce((ps: number, p: any) => ps + (p.amount || 0), 0), 0);

        const dayPurchases = purchaseInvoices
            .filter((inv: any) => { const d = new Date(inv.createdAt); return d >= dayStart && d < dayEnd; })
            .reduce((s, inv: any) => s + (inv.lineItems || []).reduce((ls: number, l: any) => ls + (l.priceExcVat || 0), 0) + (inv.adjustment || 0), 0);

        dailyData.push({ date: dateKey, sales: daySales, purchases: dayPurchases });
    }

    return NextResponse.json({
        ok: true,
        totalSales,
        revenue: totalSales,
        purchases,
        balance: totalSales - purchases,
        vehiclesAdded,
        prevTotalSales,
        prevPurchases,
        prevBalance: prevTotalSales - prevPurchases,
        prevVehiclesAdded,
        dailyData,
    });
}
