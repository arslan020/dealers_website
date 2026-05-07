import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectToDatabase from '@/lib/db';
import Lead from '@/models/Lead';
import Customer from '@/models/Customer';
import Tenant from '@/models/Tenant';
import Vehicle from '@/models/Vehicle';
import { sseEmitter } from '@/lib/sse';

export async function PUT(req: NextRequest) {
    try {
        const signatureHeader = req.headers.get('autotrader-signature');
        if (!signatureHeader) {
            return NextResponse.json({ ok: false, error: 'Missing autotrader-signature' }, { status: 401 });
        }

        const bodyText = await req.text();
        
        // Find tenant and validate HMAC signature
        // AutoTrader webhooks are configured per tenant, or globally.
        // For security, MotorDesk style means we likely need the advertiserId from the payload to find the tenant.
        let bodyJson;
        try {
            bodyJson = JSON.parse(bodyText);
        } catch (e) {
            return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
        }

        // AT docs: advertiserId is inside the 'data' envelope, not at root level
        // Root structure: { id, time, type, data: { advertiserId, dealId, ... } }
        const advertiserId = bodyJson.data?.advertiserId;
        if (!advertiserId) {
            return NextResponse.json({ ok: false, error: 'Missing advertiserId in payload' }, { status: 400 });
        }

        await connectToDatabase();
        
        // Find tenant by dealerId
        const tenant = await Tenant.findOne({ 'autoTraderConfig.dealerId': advertiserId });
        if (!tenant) {
            return NextResponse.json({ ok: false, error: 'Dealer not found' }, { status: 404 });
        }

        // Validate HMAC Signature
        // AT docs header format: "autotrader-signature: t=1623882082,v1=6bbf5a26..."
        // Hash = HMAC-SHA256(secret, timestamp + "." + rawBody)
        const sigParts = signatureHeader.split(',').reduce((acc, part) => {
            const [k, v] = part.split('=');
            if (k && v) acc[k.trim()] = v.trim();
            return acc;
        }, {} as Record<string, string>);

        const timestamp = sigParts['t'];
        const signature = sigParts['v1'];
        
        const secret = process.env.AUTOTRADER_WEBHOOK_SECRET || tenant.autoTraderConfig?.apiSecret;

        if (timestamp && signature && secret) {
            const signedPayload = `${timestamp}.${bodyText}`;
            const expectedSig = crypto
                .createHmac('sha256', secret)
                .update(signedPayload)
                .digest('hex');

            if (expectedSig !== signature && process.env.NODE_ENV === 'production') {
                return NextResponse.json({ ok: false, error: 'Invalid HMAC signature' }, { status: 401 });
            }
        }

        // AT docs notification envelope: { id, time, type, data: { ...deal fields } }
        // 'type' is at root; all deal/advertiser data is under 'data'
        const { type } = bodyJson;
        const deal = bodyJson.data; // Contains dealId, advertiserId, advertiserDealStatus, consumer, messages, buyingSignals, etc.

        let statusUpdate: string;
        switch (deal?.advertiserDealStatus) {
            case 'In progress':
            case 'In Progress': statusUpdate = 'IN_PROGRESS'; break;
            case 'Completed':   statusUpdate = 'WON'; break;
            case 'Cancelled':   statusUpdate = 'LOST'; break;
            default:            statusUpdate = 'NEW_LEAD';
        }
        // ── ADVERTISER_UPDATE: stock lifecycle/advert status changed on AT ──────
        if (type === 'ADVERTISER_UPDATE' && deal?.stockId && !deal?.dealId) {
            const lifecycleMap: Record<string, string> = {
                FORECOURT:        'In Stock',
                SALE_IN_PROGRESS: 'Reserved',
                SOLD:             'Sold',
                DUE_IN:           'Draft',
                WASTEBIN:         'Deleted',
                DELETED:          'Deleted',
            };

            const vehicleUpdate: Record<string, any> = {};

            if (deal.lifecycleState && lifecycleMap[deal.lifecycleState]) {
                vehicleUpdate.status = lifecycleMap[deal.lifecycleState];
            }

            // Sync advert channel statuses if present
            const ra = deal.adverts?.retailAdverts;
            if (ra?.autotraderAdvert?.status)  vehicleUpdate.atAdvertStatus          = ra.autotraderAdvert.status;
            if (ra?.advertiserAdvert?.status)  vehicleUpdate.advertiserAdvertStatus  = ra.advertiserAdvert.status;
            if (ra?.locatorAdvert?.status)     vehicleUpdate.locatorAdvertStatus     = ra.locatorAdvert.status;
            if (ra?.exportAdvert?.status)      vehicleUpdate.exportAdvertStatus      = ra.exportAdvert.status;
            if (ra?.profileAdvert?.status)     vehicleUpdate.profileAdvertStatus     = ra.profileAdvert.status;

            if (Object.keys(vehicleUpdate).length > 0) {
                await Vehicle.findOneAndUpdate(
                    { stockId: deal.stockId, tenantId: tenant._id },
                    { $set: vehicleUpdate }
                );
                console.log(`[Webhook] Stock ${deal.stockId} updated:`, vehicleUpdate);

                sseEmitter.emit('stock_update', {
                    tenantId: tenant._id.toString(),
                    payload: { event: 'STOCK_STATUS_UPDATE', stockId: deal.stockId, ...vehicleUpdate }
                });
            }
        }

        if (type === 'DEAL' || type === 'ADVERTISER_UPDATE') {

            // Save / Update Lead in DB for Real Time
            if (deal?.dealId) {
                // Upsert customer if data is available
                let customerId;
                if (deal.consumer?.email || deal.consumer?.phone) {
                    const customerData = {
                        firstName: deal.consumer.firstName || 'Unknown',
                        lastName: deal.consumer.lastName || '',
                        email: deal.consumer.email,
                        phone: deal.consumer.phone,
                        source: 'AutoTrader',
                        status: 'Active',
                        type: deal.consumer.type || 'Private',
                        vatRegistrationStatus: deal.consumer.vatRegistrationStatus || '',
                        tenantId: tenant._id
                    };
                    
                    const orConditions = [];
                    if (deal.consumer.email) orConditions.push({ email: deal.consumer.email });
                    if (deal.consumer.phone) orConditions.push({ phone: deal.consumer.phone });
                    
                    const updatedCustomer = await Customer.findOneAndUpdate(
                        { 
                            tenantId: tenant._id,
                            ...(orConditions.length > 0 ? { $or: orConditions } : { _id: null })
                        },
                        { $set: customerData },
                        { upsert: true, returnDocument: 'after' }
                    );
                    customerId = updatedCustomer._id;
                }

                // Upsert Lead
                const leadData = {
                    dealId: deal.dealId,
                    platform: 'AutoTrader',
                    status: statusUpdate,
                    messagesId: deal.messages?.id ?? null, // AT docs: messages object only has 'id' field
                    intentScore: deal.buyingSignals?.dealIntentScore || 0,
                    intentLevel: deal.buyingSignals?.intent || 'Unknown',
                    tenantId: tenant._id,
                    ...(customerId ? { customerId } : {})
                };

                const updatedLead = await Lead.findOneAndUpdate(
                    { dealId: deal.dealId, tenantId: tenant._id },
                    { $set: leadData },
                    { upsert: true, returnDocument: 'after' }
                ).populate('customerId');

                // Broadcast SSE event
                sseEmitter.emit('lead_update', {
                    tenantId: tenant._id.toString(),
                    payload: {
                        event: 'WEBHOOK_UPDATE',
                        type: type,
                        lead: updatedLead
                    }
                });
            }
        }

        return NextResponse.json({ ok: true, received: true }, { status: 200 });

    } catch (err: any) {
        console.error('[Webhook Error]', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

