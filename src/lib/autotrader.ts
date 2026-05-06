import Tenant from '@/models/Tenant';
import connectToDatabase from './db';

/** Production: https://api.autotrader.co.uk — Sandbox: https://api-sandbox.autotrader.co.uk (set AUTOTRADER_API_URL) */
const AUTOTRADER_BASE_URL = process.env.AUTOTRADER_API_URL || 'https://api.autotrader.co.uk';

interface AutoTraderTokenResponse {
    access_token: string;
    expires_at: string; // ISO date string from AT
}

// ─── Module-level token cache (per tenant) ─────────────────────────────────
// AT docs: "Clients should NOT authenticate prior to every request"
// Token TTL is 15 minutes — we cache with a 60s safety margin
const tokenCache: Record<string, { token: string; expiresAt: number }> = {};

export class AutoTraderClient {
    private tenantId: string;
    private apiKey?: string;
    private apiSecret?: string;
    public dealerId?: string;
    public postcode?: string;

    constructor(tenantId: string) {
        this.tenantId = tenantId;
    }

    /** Initialise client — load credentials from DB for this tenant. */
    async init() {
        await connectToDatabase();
        const tenant = await Tenant.findById(this.tenantId).lean() as any;

        if (!tenant) throw new Error('Dealer (tenant) not found.');

        this.apiKey = tenant.autoTraderConfig?.apiKey || process.env.AUTOTRADER_PARTNER_KEY;
        this.apiSecret = tenant.autoTraderConfig?.apiSecret || process.env.AUTOTRADER_PARTNER_SECRET;
        this.dealerId = tenant.autoTraderConfig?.dealerId || process.env.AUTOTRADER_ADVERTISER_ID;
        this.postcode = tenant.autoTraderConfig?.postcode || undefined;

        if (!this.apiKey || !this.apiSecret)
            throw new Error('AutoTrader Partner credentials are not configured.');
        if (!this.dealerId)
            throw new Error('AutoTrader Advertiser ID (dealerId) is not set for this dealer.');
    }

    // ─── Core HTTP helpers ────────────────────────────────────────────────────────

    private async getAccessToken(): Promise<string> {
        if (!this.apiKey || !this.apiSecret) await this.init();

        // Return cached token if still valid (with 60s safety margin)
        const cached = tokenCache[this.tenantId];
        if (cached && Date.now() < cached.expiresAt) {
            return cached.token;
        }

        const params = new URLSearchParams();
        params.append('key', this.apiKey as string);
        params.append('secret', this.apiSecret as string);

        const res = await fetch(`${AUTOTRADER_BASE_URL}/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
            cache: 'no-store',
        });

        if (!res.ok) {
            const err = await res.text();
            console.error('[AutoTrader] Auth Error:', err);
            throw new Error(`AutoTrader Authentication Failed: ${res.status}`);
        }

        const data: AutoTraderTokenResponse = await res.json();
        // Cache with 60s safety margin before actual expiry
        const expiresAt = data.expires_at
            ? new Date(data.expires_at).getTime() - 60_000
            : Date.now() + 14 * 60 * 1000; // fallback: 14 minutes

        tokenCache[this.tenantId] = { token: data.access_token, expiresAt };
        return data.access_token;
    }

    private buildUrl(endpoint: string, queryParams?: Record<string, string>) {
        let url = `${AUTOTRADER_BASE_URL}${endpoint}`;
        if (queryParams) url += `?${new URLSearchParams(queryParams).toString()}`;
        return url;
    }

    async request(method: string, endpoint: string, options: { body?: any; queryParams?: Record<string, string>; isMultipart?: boolean; contentType?: string } = {}) {
        const execute = async () => {
            const token = await this.getAccessToken();
            const url = this.buildUrl(endpoint, options.queryParams);
            const headers: Record<string, string> = {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            };

            if (!options.isMultipart && options.body) {
                headers['Content-Type'] = 'application/json';
            } else if (options.contentType) {
                headers['Content-Type'] = options.contentType;
            }

            const res = await fetch(url, {
                method,
                headers,
                body: options.isMultipart ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
                cache: 'no-store',
            });

            if (res.status === 401) {
                // Force token refresh on 401
                delete tokenCache[this.tenantId];
                throw new Error('RETRY_AUTH');
            }

            if (!res.ok) {
                // Special handling for 404 in DELETE
                if (method === 'DELETE' && res.status === 404) return { ok: true };
                
                const errText = await res.text();
                let error;
                try {
                    error = JSON.parse(errText);
                } catch {
                    error = { message: errText };
                }
                
                const atError = new Error(`AutoTrader ${method} ${endpoint} failed: ${res.status}`);
                (atError as any).status = res.status;
                (atError as any).data = error;
                throw atError;
            }

            const text = await res.text();
            if (!text) return { ok: true };
            try {
                return JSON.parse(text);
            } catch {
                return { ok: true };
            }
        };

        try {
            return await execute();
        } catch (err: any) {
            if (err.message === 'RETRY_AUTH') {
                return await execute();
            }
            throw err;
        }
    }

    async get(endpoint: string, queryParams?: Record<string, string>) {
        return this.request('GET', endpoint, { queryParams });
    }

    async post(endpoint: string, body: any, queryParams?: Record<string, string>) {
        return this.request('POST', endpoint, { body, queryParams });
    }

    async patch(endpoint: string, body: any, queryParams?: Record<string, string>) {
        return this.request('PATCH', endpoint, { body, queryParams });
    }

    async delete(endpoint: string) {
        return this.request('DELETE', endpoint);
    }

    /**
     * POST /images?advertiserId=&vehicleType= — upload a single vehicle image.
     * AT docs: multipart/form-data body using the parameter 'file' to send binary image.
     * JPEG format, up to 20MB max.
     */
    async uploadImage(imageBuffer: Buffer, contentType: string = 'image/jpeg', vehicleType: string = 'Car') {
        if (!this.dealerId) await this.init();
        // Build proper multipart/form-data — AT requires field named 'file'
        const formData = new FormData();
        const arrayBuffer = imageBuffer.buffer.slice(imageBuffer.byteOffset, imageBuffer.byteOffset + imageBuffer.byteLength) as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
        formData.append('file', blob, 'vehicle.jpg');

        const token = await this.getAccessToken();
        const url = `${AUTOTRADER_BASE_URL}/images?advertiserId=${this.dealerId}&vehicleType=${vehicleType}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                // Do NOT set Content-Type — browser/node sets it automatically with boundary
            },
            body: formData,
        });

        if (!res.ok) {
            const errText = await res.text();
            let errDetail = errText;
            try { errDetail = JSON.stringify(JSON.parse(errText)); } catch {}
            throw new Error(`AutoTrader POST /images failed: ${res.status} — ${errDetail}`);
        }

        return res.json();
    }

    // ─── Valuations ───────────────────────────────────────────────────────────────

    /** POST /valuations — current retail/trade/private/partExchange valuation. */
    /** POST /valuations — current retail/trade/private/partExchange valuation. */
    async getValuation(payload: {
        vehicle: { derivativeId: string; firstRegistrationDate: string; odometerReadingMiles: number };
        conditionRating?: 'Excellent' | 'Great' | 'Good' | 'Fair' | 'Poor';
        features?: { name: string }[];
    }) {
        if (!this.dealerId) await this.init();
        return this.post('/valuations', payload, { advertiserId: this.dealerId! });
    }

    /** GET /vehicles?registration={vrm}&advertiserId={dealerId}&features=true&competitors=true — core vehicle lookup. */
    async lookupVehicle(registration: string) {
        if (!this.dealerId) await this.init();
        return this.get('/vehicles', {
            registration,
            advertiserId: this.dealerId!,
            features: 'true',
            competitors: 'true',
        });
    }


    /**
     * Search derivatives via AT Taxonomy API.
     * AT docs: /taxonomy/derivatives requires generationId — it does NOT support free-text make/model search.
     * When generationId is provided: GET /taxonomy/derivatives?generationId=...
     * When only make/model text provided: automatically walk the taxonomy chain
     *   makes → models → generations → derivatives (parallel generation fetches).
     */
    async searchDerivatives(params: {
        make?: string; model?: string; generation?: string; vehicleType?: string;
        fuelType?: string; transmission?: string; trim?: string; generationId?: string;
        year?: number;
    }) {
        if (!this.dealerId) await this.init();
        const vehicleType = params.vehicleType || 'Car';

        // ── Fast path: generationId already known ────────────────────────────
        if (params.generationId) {
            const q: Record<string, string> = {
                advertiserId: this.dealerId!,
                generationId: params.generationId,
                vehicleType,
            };
            if (params.fuelType)    q.fuelType    = params.fuelType;
            if (params.transmission) q.transmission = params.transmission;
            if (params.trim)        q.trim         = params.trim;
            return this.get('/taxonomy/derivatives', q);
        }

        // ── Taxonomy chain: make → makeId → modelId → generationIds → derivatives ──
        // Step 1: Find makeId
        const makesData = await this.get('/taxonomy/makes', {
            advertiserId: this.dealerId!,
            vehicleType,
            ...(params.make ? { make: params.make } : {}),
        });
        const makes: any[] = makesData?.makes || [];
        const makeMatch = params.make
            ? makes.find((m: any) => m.name?.toLowerCase() === params.make!.toLowerCase()) || makes[0]
            : makes[0];
        if (!makeMatch?.makeId) return { derivatives: [] };

        // Step 2: Find modelId
        const modelsData = await this.get('/taxonomy/models', {
            advertiserId: this.dealerId!,
            vehicleType,
            makeId: makeMatch.makeId,
            ...(params.model ? { model: params.model } : {}),
        });
        const models: any[] = modelsData?.models || [];
        const modelMatch = params.model
            ? models.find((m: any) => m.name?.toLowerCase() === params.model!.toLowerCase()) || models[0]
            : models[0];
        if (!modelMatch?.modelId) return { derivatives: [] };

        // Step 3: Get generations for this model
        const gensData = await this.get('/taxonomy/generations', {
            advertiserId: this.dealerId!,
            vehicleType,
            modelId: modelMatch.modelId,
        });
        const generations: any[] = gensData?.generations || [];
        if (generations.length === 0) return { derivatives: [] };

        // Step 3a: Filter/sort generations by year when available.
        // A wrong generation produces a completely wrong derivativeId, so this is
        // the most important signal when multiple generations exist for a model.
        let candidateGens = generations;
        if (params.year) {
            const yr = params.year;
            const inRange = generations.filter((g: any) => {
                const from = g.yearFrom ?? g.startYear ?? null;
                const to   = g.yearTo   ?? g.endYear   ?? null;
                if (from && to)  return yr >= from && yr <= to;
                if (from)        return yr >= from;
                return true;
            });
            if (inRange.length > 0) candidateGens = inRange;
        }

        // If generation name filter provided, narrow further
        const filteredGens = params.generation
            ? candidateGens.filter((g: any) => g.name?.toLowerCase().includes(params.generation!.toLowerCase()))
            : candidateGens;
        const targetGens = (filteredGens.length > 0 ? filteredGens : candidateGens).slice(0, 5);

        // Step 4: Fetch derivatives for all target generations in parallel
        const derivativeArrays = await Promise.all(
            targetGens.map(async (gen: any) => {
                const q: Record<string, string> = {
                    advertiserId: this.dealerId!,
                    generationId: gen.generationId,
                    vehicleType,
                };
                if (params.fuelType)     q.fuelType     = params.fuelType;
                if (params.transmission) q.transmission  = params.transmission;
                if (params.trim)         q.trim          = params.trim;
                try {
                    const d = await this.get('/taxonomy/derivatives', q);
                    return (d?.derivatives || d?.derivative || []).map((deriv: any) => ({
                        ...deriv,
                        generationId:    gen.generationId,
                        generationName:  gen.name,
                        yearFrom:        gen.yearFrom ?? gen.startYear ?? null,
                        yearTo:          gen.yearTo   ?? gen.endYear   ?? null,
                    }));
                } catch {
                    return [];
                }
            })
        );

        const allDerivatives = derivativeArrays.flat();
        return { derivatives: allDerivatives };
    }

    /** GET /taxonomy/features?derivativeId=&effectiveDate=&advertiserId= */
    async getTaxonomyFeatures(derivativeId: string, effectiveDate: string) {
        if (!this.dealerId) await this.init();
        return this.get('/taxonomy/features', { derivativeId, effectiveDate, advertiserId: this.dealerId! });
    }

    /** GET /taxonomy/prices?derivativeId=&advertiserId=[&effectiveDate=] */
    async getTaxonomyPrices(derivativeId: string, effectiveDate?: string) {
        if (!this.dealerId) await this.init();
        const q: Record<string, string> = { derivativeId, advertiserId: this.dealerId! };
        if (effectiveDate) q.effectiveDate = effectiveDate;
        return this.get('/taxonomy/prices', q);
    }

    /** GET /taxonomy/{facet}?generationId=&advertiserId= — e.g. fuelTypes, transmissionTypes, trims */
    async getTaxonomyFacet(facet: string, filters: Record<string, string>) {
        if (!this.dealerId) await this.init();
        return this.get(`/taxonomy/${facet}`, { advertiserId: this.dealerId!, ...filters });
    }

    /**
     * GET /taxonomy/derivatives/{derivativeId} — full technical data for a derivative.
     * AT docs: Taxonomy API — /taxonomy/derivatives/{derivativeId}
     */
    async getDerivativeById(derivativeId: string) {
        if (!this.dealerId) await this.init();
        return this.get(`/taxonomy/derivatives/${derivativeId}`, { advertiserId: this.dealerId! });
    }

    /** GET /taxonomy/makes?vehicleType=Car — list all makes for a vehicle type. */
    async getTaxonomyMakes(vehicleType: string = 'Car') {
        if (!this.dealerId) await this.init();
        return this.get('/taxonomy/makes', { vehicleType, advertiserId: this.dealerId! });
    }

    /** GET /taxonomy/models?makeId=&vehicleType=Car — list models for a make. */
    async getTaxonomyModels(makeId: string, vehicleType: string = 'Car') {
        if (!this.dealerId) await this.init();
        return this.get('/taxonomy/models', { makeId, vehicleType, advertiserId: this.dealerId! });
    }

    /** GET /taxonomy/generations?modelId= — list generations for a model. */
    async getTaxonomyGenerations(modelId: string) {
        if (!this.dealerId) await this.init();
        return this.get('/taxonomy/generations', { modelId, advertiserId: this.dealerId! });
    }

    // ─── Stock ────────────────────────────────────────────────────────────────────

    /** GET /stock?advertiserId=&stockId= — single stock item. */
    async getStockItem(stockId: string) {
        if (!this.dealerId) await this.init();
        return this.get('/stock', { advertiserId: this.dealerId!, stockId });
    }

    /**
     * POST /stock?advertiserId= — create a new stock record on AutoTrader.
     * Capability: Stock Updates
     */
    async createStock(stockPayload: Record<string, any>) {
        if (!this.dealerId) await this.init();
        return this.post('/stock', stockPayload, { advertiserId: this.dealerId! });
    }

    /**
     * PATCH /stock/{stockId}?advertiserId= — update any field of a stock record.
     * Capability: Stock Updates | Price Updates | Availability Updates
     */
    async updateStock(stockId: string, updatePayload: Record<string, any>) {
        if (!this.dealerId) await this.init();
        return this.patch(`/stock/${stockId}`, updatePayload, { advertiserId: this.dealerId! });
    }

    /**
     * Updates only the lifecycle state of a stock item.
     * States: DUE_IN | FORECOURT | SALE_IN_PROGRESS | SOLD | WASTEBIN | DELETED
     * Capability: Availability Updates
     */
    async updateLifecycleState(
        stockId: string,
        lifecycleState: 'DUE_IN' | 'FORECOURT' | 'SALE_IN_PROGRESS' | 'SOLD' | 'WASTEBIN' | 'DELETED'
    ) {
        if (!this.dealerId) await this.init();
        return this.patch(
            `/stock/${stockId}`,
            { metadata: { lifecycleState } },
            { advertiserId: this.dealerId! }
        );
    }

    /**
     * Updates the advertising status (publish/unpublish) of a specific advert channel.
     * PATCH /stock/{stockId}?advertiserId=
     * channel: 'autotrader' | 'advertiser' | 'locator' | 'export' | 'profile'
     * status: 'PUBLISHED' | 'NOT_PUBLISHED'
     * Capability: Stock Updates
     */
    async updateStockAdvertiseStatus(
        stockId: string,
        channel: 'autotrader' | 'advertiser' | 'locator' | 'export' | 'profile',
        status: 'PUBLISHED' | 'NOT_PUBLISHED'
    ) {
        if (!this.dealerId) await this.init();

        const channelKeyMap: Record<string, string> = {
            autotrader: 'autotraderAdvert',
            advertiser: 'advertiserAdvert',
            locator:    'locatorAdvert',
            export:     'exportAdvert',
            profile:    'profileAdvert',
        };

        const advertKey = channelKeyMap[channel];
        if (!advertKey) throw new Error(`Invalid channel: ${channel}`);

        return this.patch(
            `/stock/${stockId}`,
            { adverts: { retailAdverts: { [advertKey]: { status } } } },
            { advertiserId: this.dealerId! }
        );
    }

    /**
     * Set ALL advert destinations to NOT_PUBLISHED.
     * Mandatory prior to setting status to SOLD.
     */
    async unpublishAll(stockId: string) {
        if (!this.dealerId) await this.init();
        const channels = ['autotrader', 'advertiser', 'locator', 'export', 'profile'] as const;
        
        // We do this in a single PATCH as AT allows multiple fields in retailAdverts
        const retailAdverts: any = {};
        channels.forEach(ch => {
            const keyMap: Record<string, string> = {
                autotrader: 'autotraderAdvert',
                advertiser: 'advertiserAdvert',
                locator:    'locatorAdvert',
                export:     'exportAdvert',
                profile:    'profileAdvert',
            };
            retailAdverts[keyMap[ch]] = { status: 'NOT_PUBLISHED' };
        });

        // Feb 2026 AT docs: tradeAdverts.dealerAuctionAdvert must also be unpublished
        // before a lifecycleState can be set to SOLD/DELETED/WASTEBIN
        const tradeAdverts = {
            dealerAuctionAdvert: { status: 'NOT_PUBLISHED' }
        };

        return this.patch(
            `/stock/${stockId}`,
            { adverts: { retailAdverts, tradeAdverts } },
            { advertiserId: this.dealerId! }
        );
    }

    // ─── Stock Extended Queries ───────────────────────────────────────────────────

    /**
     * GET /stock/{stockId}/summary?advertiserId= — real-time state snapshot for a stock item.
     * AT docs (Jan 2026): returns lifecycleState, reservation, advert publish statuses.
     * Capability: Stock Sync
     */
    async getStockSummary(stockId: string) {
        if (!this.dealerId) await this.init();
        return this.get(`/stock/${stockId}/summary`, { advertiserId: this.dealerId! });
    }

    /**
     * GET /stock?responseMetrics=true&advertiserId= — advertising performance per stock item.
     * AT docs: returns performanceRating, advertViews, searchViews, leadCountRating.
     * Capability: Response Metrics
     */
    async getStockWithResponseMetrics(page: string = '1', pageSize: string = '200') {
        if (!this.dealerId) await this.init();
        return this.get('/stock', {
            advertiserId: this.dealerId!,
            responseMetrics: 'true',
            page,
            pageSize,
        });
    }

    /**
     * GET /stock?trendedValuations=true&advertiserId= — 30/60/90 day valuation trends per stock.
     * AT docs: returns trendedValuations with plus30Days, plus60Days, plus90Days.
     * Capability: Trended Valuations
     */
    async getStockWithTrendedValuations(page: string = '1', pageSize: string = '200') {
        if (!this.dealerId) await this.init();
        return this.get('/stock', {
            advertiserId: this.dealerId!,
            trendedValuations: 'true',
            page,
            pageSize,
        });
    }

    /**
     * GET /stock?vehicleMetrics=true&advertiserId= — supply/demand/daysToSell metrics per stock.
     * AT docs: returns national + local vehicleMetrics for each stock item.
     * Capability: Vehicle Metrics
     */
    async getStockWithVehicleMetrics(page: string = '1', pageSize: string = '200') {
        if (!this.dealerId) await this.init();
        return this.get('/stock', {
            advertiserId: this.dealerId!,
            vehicleMetrics: 'true',
            page,
            pageSize,
        });
    }

    /**
     * POST /vehicle-metrics?advertiserId= — get vehicle metrics for a specific vehicle.
     * AT docs: requires derivativeId, firstRegistrationDate, odometerReadingMiles.
     * Capability: Vehicle Metrics / Retail Rating
     */
    async getVehicleMetrics(payload: {
        vehicle: { derivativeId: string; firstRegistrationDate: string; odometerReadingMiles: number };
        price?: number;
    }) {
        if (!this.dealerId) await this.init();
        return this.post('/vehicle-metrics', payload, { advertiserId: this.dealerId! });
    }

    // ─── Deals ────────────────────────────────────────────────────────────────────

    /**
     * GET /deals?advertiserId= — list all deals with optional filters.
     * Filters: page, from, to (ISO date strings)
     * Capability: Deal Sync
     */
    async getDeals(queryParams: Record<string, string> = {}) {
        if (!this.dealerId) await this.init();
        return this.get('/deals', { ...queryParams, advertiserId: this.dealerId! });
    }

    /**
     * GET /deals/{dealId}?advertiserId= — fetch a single deal with all components.
     * Capability: Deal Sync
     */
    async getDeal(dealId: string) {
        if (!this.dealerId) await this.init();
        return this.get(`/deals/${dealId}`, { advertiserId: this.dealerId! });
    }

    /**
     * POST /deals?advertiserId= — create a new deal manually.
     * Per AutoTrader Connect docs, body must include: consumer (firstName, lastName, email),
     * stockId, and advertiserId (query param is also still required).
     * Optional: consumer.phone
     * Capability: Deal Updates
     */
    async createDeal(payload: {
        consumer: { firstName: string; lastName: string; email: string; phone?: string | null };
        stockId: string;
    }) {
        if (!this.dealerId) await this.init();
        const consumer: Record<string, string> = {
            firstName: payload.consumer.firstName,
            lastName: payload.consumer.lastName,
            email: payload.consumer.email,
        };
        if (payload.consumer.phone) consumer.phone = payload.consumer.phone;
        return this.post(
            '/deals',
            {
                consumer,
                stockId: payload.stockId,
                advertiserId: this.dealerId,
            },
            { advertiserId: this.dealerId! }
        );
    }

    /**
     * PATCH /deals/{dealId}?advertiserId= — update deal status/components.
     * Complete: advertiserDealStatus "Complete" (per AT docs; responses may also show "Completed").
     * Cancel: "Cancelled" with advertiserCancellationReason.
     * Capability: Deal Updates
     */
    async updateDeal(dealId: string, payload: Record<string, any>) {
        if (!this.dealerId) await this.init();
        return this.patch(`/deals/${dealId}`, payload, { advertiserId: this.dealerId! });
    }

    // ─── Part Exchange ────────────────────────────────────────────────────────────

    /**
     * GET /part-exchange/{partExchangeId}?advertiserId= — fetch full PX details.
     * Capability: Deal Sync
     */
    async getPartExchange(partExchangeId: string) {
        if (!this.dealerId) await this.init();
        return this.get(`/part-exchange/${partExchangeId}`, { advertiserId: this.dealerId! });
    }

    /**
     * POST /part-exchange?advertiserId= — add a part exchange to an existing deal.
     * Requires dealId, vehicle.registration, vehicle.odometerReadingMiles.
     * Capability: Part Exchange Updates
     */
    async addPartExchange(payload: {
        dealId: string;
        vehicle: {
            registration: string;
            odometerReadingMiles: number;
            outstandingFinance?: { lender: string; amountGBP: number };
        };
        advertiser?: {
            conditionRating?: 'Poor' | 'Fair' | 'Good' | 'Great' | 'Excellent';
            offer?: { amountGBP: number };
        };
    }) {
        if (!this.dealerId) await this.init();
        return this.post('/part-exchange', payload, { advertiserId: this.dealerId! });
    }

    /**
     * GET /part-exchange/settlement-lenders?advertiserId= — list configured lenders for outstanding finance.
     * Capability: Part Exchange Updates
     */
    async getSettlementLenders() {
        if (!this.dealerId) await this.init();
        return this.get('/part-exchange/settlement-lenders', { advertiserId: this.dealerId! });
    }

    /**
     * PATCH /part-exchange/{partExchangeId}?advertiserId= — update PX outstanding finance, condition and/or offer.
     * Valid conditionRating values: Poor | Fair | Good | Great | Excellent
     * Capability: Part Exchange Updates
     */
    async updatePartExchange(partExchangeId: string, payload: {
        dealId: string;
        vehicle?: { outstandingFinance?: { lender: string; amountGBP: number } };
        advertiser?: {
            conditionRating?: 'Poor' | 'Fair' | 'Good' | 'Great' | 'Excellent';
            offer?: { amountGBP: number };
        };
    }) {
        if (!this.dealerId) await this.init();
        return this.patch(`/part-exchange/${partExchangeId}`, payload, { advertiserId: this.dealerId! });
    }

    // ─── Messages ─────────────────────────────────────────────────────────────────

    /**
     * GET /messages/{messagesId}?advertiserId= — get all messages for a deal.
     * Capability: Deal Sync
     */
    async getMessages(messagesId: string) {
        if (!this.dealerId) await this.init();
        return this.get(`/messages/${messagesId}`, { advertiserId: this.dealerId! });
    }

    /**
     * POST /messages?advertiserId= — send a message reply.
     * Provide dealId (new thread) OR messagesId (existing thread).
     * Capability: Message Updates
     */
    async replyToMessage(payload: { dealId?: string; messagesId?: string; message: string }) {
        if (!this.dealerId) await this.init();
        return this.post('/messages', payload, { advertiserId: this.dealerId! });
    }

    /**
     * PATCH /messages/{messagesId}?advertiserId= — mark messages as read.
     * Capability: Message Updates
     */
    async markMessageAsRead(messagesId: string) {
        if (!this.dealerId) await this.init();
        return this.patch(
            `/messages/${messagesId}`,
            { advertiserLastReadStatus: 'Read' },
            { advertiserId: this.dealerId! }
        );
    }

    // ─── Finance (BETA) ───────────────────────────────────────────────────────────

    /**
     * POST /finance/applications?advertiserId= — create a new finance application.
     * Required: dealId, applicant (title/firstName/lastName/email),
     *           financeTerms (productType, termMonths, estimatedAnnualMileage, cashPrice, deposit)
     * Capability: Finance Updates
     */
    async createFinanceApplication(payload: Record<string, any>) {
        if (!this.dealerId) await this.init();
        return this.post('/finance/applications', payload, { advertiserId: this.dealerId! });
    }

    /**
     * GET /finance/applications/{applicationId}?advertiserId= — get a finance application.
     * Capability: Deal Sync
     */
    async getFinanceApplication(applicationId: string) {
        if (!this.dealerId) await this.init();
        return this.get(`/finance/applications/${applicationId}`, { advertiserId: this.dealerId! });
    }

    /**
     * PATCH /finance/applications/{applicationId}?advertiserId= — edit a finance application.
     * Capability: Finance Updates
     */
    async updateFinanceApplication(applicationId: string, payload: Record<string, any>) {
        if (!this.dealerId) await this.init();
        return this.patch(`/finance/applications/${applicationId}`, payload, { advertiserId: this.dealerId! });
    }

    /**
     * POST /finance/applications/{applicationId}/quotes?advertiserId= — generate personalised quotes.
     * Returns up to 3 lender quotes. Application status becomes "Quoted".
     * Note: consent.softCheck must be completed before calling this.
     * Capability: Finance Updates
     */
    async getFinanceQuotes(applicationId: string) {
        if (!this.dealerId) await this.init();
        return this.post(`/finance/applications/${applicationId}/quotes`, {}, { advertiserId: this.dealerId! });
    }

    /**
     * GET /finance/applications/{applicationId}/proposals?advertiserId= — list all proposals.
     * Capability: Finance Updates
     */
    async getFinanceProposals(applicationId: string) {
        if (!this.dealerId) await this.init();
        return this.get(`/finance/applications/${applicationId}/proposals`, { advertiserId: this.dealerId! });
    }

    /**
     * POST /finance/applications/{applicationId}/proposals?advertiserId= — send a new proposal.
     * Body: { quoteId }
     * Capability: Finance Updates
     */
    async sendFinanceProposal(applicationId: string, quoteId: string) {
        if (!this.dealerId) await this.init();
        return this.post(`/finance/applications/${applicationId}/proposals`, { quoteId }, { advertiserId: this.dealerId! });
    }

    /**
     * PATCH /finance/applications/{applicationId}/proposals/{proposalId}?advertiserId=
     * Set active: { active: true }
     * Set paid out: { paidOutDate: "YYYY-MM-DD" }
     * Capability: Finance Updates
     */
    async updateFinanceProposal(applicationId: string, proposalId: string, payload: Record<string, any>) {
        if (!this.dealerId) await this.init();
        return this.patch(
            `/finance/applications/${applicationId}/proposals/${proposalId}`,
            payload,
            { advertiserId: this.dealerId! }
        );
    }
}
