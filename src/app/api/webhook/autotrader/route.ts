import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectToDatabase from '@/lib/db';
import Lead from '@/models/Lead';
import Customer from '@/models/Customer';
import Tenant from '@/models/Tenant';
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

        const advertiserId = bodyJson.advertiserId;
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
        // "autotrader-signature": "t=1690000000,v1=abc123hmac..."
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

            // Temporarily disable STRICT HMAC fail in local dev unless enforced
            if (expectedSig !== signature && process.env.NODE_ENV === 'production') {
                return NextResponse.json({ ok: false, error: 'Invalid HMAC signature' }, { status: 401 });
            }
        }

        // Process webhook event types
        const { type, deal, stock, message } = bodyJson;

        let statusUpdate = 'NEW_LEAD';
        if (type === 'DEAL' || type === 'ADVERTISER_UPDATE') {
            if (deal?.messages && deal.messages.lastUpdated) {
                statusUpdate = 'NEW_MESSAGE'; // Based on internal rules
            } else if (deal?.advertiserDealStatus) {
                statusUpdate = 'IN_PROGRESS'; // Fallback mapping
            }
            
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
                        { upsert: true, new: true }
                    );
                    customerId = updatedCustomer._id;
                }

                // Upsert Lead
                const leadData = {
                    dealId: deal.dealId,
                    platform: 'AutoTrader',
                    status: statusUpdate === 'NEW_MESSAGE' ? 'NEW_LEAD' : statusUpdate, 
                    messagesId: deal.messages?.messagesId ?? deal.messages?.id ?? null,
                    intentScore: deal.buyingSignals?.dealIntentScore || 0,
                    intentLevel: deal.buyingSignals?.intent || 'Unknown',
                    tenantId: tenant._id,
                    ...(customerId ? { customerId } : {})
                };

                const updatedLead = await Lead.findOneAndUpdate(
                    { dealId: deal.dealId, tenantId: tenant._id },
                    { $set: leadData },
                    { upsert: true, new: true }
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
