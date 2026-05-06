'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type VehicleRow = {
    _id: string;
    vrm: string;
    make: string;
    model?: string;
    vehicleModel?: string;
    stockId?: string;
    status?: string;
};

type Product = {
    _id: string;
    name: string;
    price: number;
    vatRate?: number;
};

type CreateAction = 'deal' | 'finance' | 'confirm' | 'share';

const CONDITIONS = ['Excellent', 'Great', 'Good', 'Fair', 'Poor'] as const;

export default function CreateDealPage() {
    const router = useRouter();

    // ── Customer ──────────────────────────────────────────────────────────────
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // ── Vehicle ───────────────────────────────────────────────────────────────
    const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
    const [loadingVehicles, setLoadingVehicles] = useState(true);
    const [stockId, setStockId] = useState('');

    // ── Part Exchange ─────────────────────────────────────────────────────────
    const [pxEnabled, setPxEnabled] = useState(false);
    const [pxReg, setPxReg] = useState('');
    const [pxMileage, setPxMileage] = useState('');
    const [pxCondition, setPxCondition] = useState('Good');
    const [pxOffer, setPxOffer] = useState('');
    const [pxHasFinance, setPxHasFinance] = useState(false);
    const [pxFinanceLender, setPxFinanceLender] = useState('');
    const [pxFinanceAmount, setPxFinanceAmount] = useState('');

    // ── Products ──────────────────────────────────────────────────────────────
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

    // ── Delivery & Collection ─────────────────────────────────────────────────
    const [deliveryEnabled, setDeliveryEnabled] = useState(false);
    const [deliveryType, setDeliveryType] = useState<'Delivery' | 'Collection'>('Collection');

    // ── UI ────────────────────────────────────────────────────────────────────
    const [saving, setSaving] = useState(false);

    // ── Load vehicles ─────────────────────────────────────────────────────────
    const loadVehicles = useCallback(async () => {
        setLoadingVehicles(true);
        try {
            const res = await fetch('/api/vehicles?status=In Stock');
            const data = await res.json();
            if (data.ok && Array.isArray(data.vehicles)) {
                setVehicles((data.vehicles as VehicleRow[]).filter(v => v.stockId?.trim()));
            }
        } catch {
            toast.error('Failed to load vehicles');
        } finally {
            setLoadingVehicles(false);
        }
    }, []);

    // ── Load products ─────────────────────────────────────────────────────────
    const loadProducts = useCallback(async () => {
        try {
            const res = await fetch('/api/products?limit=100');
            const data = await res.json();
            if (data.ok && Array.isArray(data.products)) {
                setProducts(data.products);
            }
        } catch { /* silent — products are optional */ }
    }, []);

    useEffect(() => {
        loadVehicles();
        loadProducts();
    }, [loadVehicles, loadProducts]);

    useEffect(() => {
        const s = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('stockId');
        if (s) setStockId(s);
    }, []);

    const vehicleOptions = useMemo(
        () => vehicles.map(v => ({
            stockId: v.stockId!,
            label: `${v.vrm} · ${v.make} ${v.vehicleModel || v.model || ''}`.trim(),
        })),
        [vehicles]
    );

    const selectedProducts = useMemo(
        () => products.filter(p => selectedProductIds.includes(p._id)),
        [products, selectedProductIds]
    );

    const toggleProduct = (id: string) =>
        setSelectedProductIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );

    // ── Summary totals ────────────────────────────────────────────────────────
    const selectedVehicle = vehicles.find(v => v.stockId === stockId);
    const productsTotal = selectedProducts.reduce((s, p) => s + (p.price || 0), 0);

    // ── Create deal ───────────────────────────────────────────────────────────
    const handleCreate = async (action: CreateAction) => {
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !stockId.trim()) {
            toast.error('Customer name, email and vehicle are required.');
            return;
        }
        if (pxEnabled && (!pxReg.trim() || !pxMileage.trim())) {
            toast.error('Part exchange registration and mileage are required.');
            return;
        }

        setSaving(true);
        try {
            // Step 1 — Create deal on AutoTrader
            const dealRes = await fetch('/api/deals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stockId: stockId.trim(),
                    consumer: {
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
                        email: email.trim().toLowerCase(),
                        ...(phone.trim() ? { phone: phone.trim() } : {}),
                    },
                }),
            });
            const dealData = await dealRes.json();
            if (!dealData.ok || !dealData.dealId) {
                toast.error(dealData.error?.message || 'Could not create deal.');
                return;
            }
            const dealId = dealData.dealId;

            // Step 2 — Add part exchange if provided
            if (pxEnabled && pxReg.trim() && pxMileage.trim()) {
                const pxPayload: any = {
                    vehicle: {
                        registration: pxReg.trim().toUpperCase(),
                        odometerReadingMiles: Number(pxMileage),
                    },
                    advertiser: {
                        conditionRating: pxCondition,
                        ...(pxOffer.trim() ? { offer: { amountGBP: Number(pxOffer) } } : {}),
                    },
                };
                if (pxHasFinance && pxFinanceLender.trim() && pxFinanceAmount.trim()) {
                    pxPayload.vehicle.outstandingFinance = {
                        lender: pxFinanceLender.trim(),
                        amountGBP: Number(pxFinanceAmount),
                    };
                }
                const pxRes = await fetch(`/api/deals/${dealId}/part-exchange`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pxPayload),
                });
                const pxData = await pxRes.json();
                if (!pxData.ok) {
                    toast.error(`Deal created but part exchange failed: ${pxData.error}`);
                }
            }

            // Step 3 — Save selected products & delivery preference to localStorage
            if (selectedProductIds.length > 0 || deliveryEnabled) {
                const extras = {
                    products: selectedProducts.map(p => ({ id: p._id, name: p.name, price: p.price })),
                    delivery: deliveryEnabled ? { type: deliveryType } : null,
                };
                localStorage.setItem(`deal_extras_${dealId}`, JSON.stringify(extras));
            }

            toast.success('Deal created!');

            // Step 4 — Navigate based on action button
            const tabMap: Record<CreateAction, string> = {
                deal: '',
                finance: '?tab=finance',
                confirm: '?tab=confirm',
                share: '?tab=share',
            };
            router.push(`/app/deals/${dealId}${tabMap[action]}`);

        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
                <span className="font-semibold">Sales</span>
                <span>/</span>
                <Link href="/app/sales/deals" className="font-semibold hover:text-slate-600 text-[#4D7CFF]">
                    Deals
                </Link>
                <span>/</span>
                <span className="text-slate-600 font-semibold">Create</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* ── Main Form ── */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Header */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h1 className="text-[16px] font-bold text-slate-900">Create Deal</h1>
                                <p className="text-[12px] text-slate-500 mt-0.5">
                                    Build a new deal — vehicle, customer, part exchange, products and delivery.
                                </p>
                            </div>
                            <Link href="/app/sales/deals" className="text-[12px] font-semibold text-slate-500 hover:text-slate-800">
                                Back to list
                            </Link>
                        </div>
                    </div>

                    {/* ── 1. Customer ── */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">
                            1. Customer
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 mb-1 block">First name *</label>
                                <input
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                    placeholder="John"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Last name *</label>
                                <input
                                    value={lastName}
                                    onChange={e => setLastName(e.target.value)}
                                    placeholder="Smith"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Email *</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="john@example.com"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Phone</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="07123 456789"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── 2. Vehicle ── */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">
                            2. Vehicle
                        </h2>
                        {loadingVehicles ? (
                            <p className="text-[12px] text-slate-400">Loading stock…</p>
                        ) : vehicleOptions.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 text-[12px] text-slate-600">
                                No in-stock vehicles with an AutoTrader stock ID found.{' '}
                                <Link href="/app/vehicles" className="font-semibold text-[#4D7CFF] hover:underline">
                                    Add vehicles
                                </Link>
                                , or enter a stock ID manually below.
                            </div>
                        ) : (
                            <>
                                <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Select vehicle *</label>
                                <select
                                    value={vehicleOptions.some(o => o.stockId === stockId) ? stockId : ''}
                                    onChange={e => setStockId(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-[#4D7CFF]"
                                >
                                    <option value="">Choose a vehicle…</option>
                                    {vehicleOptions.map(o => (
                                        <option key={o.stockId} value={o.stockId}>{o.label}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        <div className="mt-3">
                            <label className="text-[12px] font-semibold text-slate-600 mb-1 block">
                                {vehicleOptions.length > 0 ? 'Or enter stock ID manually' : 'Stock ID *'}
                            </label>
                            <input
                                value={stockId}
                                onChange={e => setStockId(e.target.value)}
                                placeholder="AutoTrader stock ID"
                                className="w-full font-mono text-[13px] border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4D7CFF]"
                            />
                        </div>
                    </div>

                    {/* ── 3. Part Exchange ── */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                3. Part Exchange
                            </h2>
                            <button
                                type="button"
                                onClick={() => setPxEnabled(v => !v)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pxEnabled ? 'bg-[#4D7CFF]' : 'bg-slate-200'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pxEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        {pxEnabled ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Registration *</label>
                                        <input
                                            value={pxReg}
                                            onChange={e => setPxReg(e.target.value.toUpperCase())}
                                            placeholder="e.g. AB12 CDE"
                                            className="w-full font-mono uppercase border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Mileage *</label>
                                        <input
                                            type="number"
                                            value={pxMileage}
                                            onChange={e => setPxMileage(e.target.value)}
                                            placeholder="e.g. 45000"
                                            min="0"
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Condition</label>
                                        <select
                                            value={pxCondition}
                                            onChange={e => setPxCondition(e.target.value)}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                        >
                                            {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Offer Price (£)</label>
                                        <input
                                            type="number"
                                            value={pxOffer}
                                            onChange={e => setPxOffer(e.target.value)}
                                            placeholder="e.g. 8000"
                                            min="0"
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                        />
                                    </div>
                                </div>

                                {/* Outstanding Finance */}
                                <div className="border border-slate-100 rounded-xl p-4">
                                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                                        <input
                                            type="checkbox"
                                            checked={pxHasFinance}
                                            onChange={e => setPxHasFinance(e.target.checked)}
                                            className="w-4 h-4 rounded accent-[#4D7CFF]"
                                        />
                                        <span className="text-[12px] font-semibold text-slate-700">Outstanding finance on part exchange</span>
                                    </label>
                                    {pxHasFinance && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                            <div>
                                                <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Lender</label>
                                                <input
                                                    value={pxFinanceLender}
                                                    onChange={e => setPxFinanceLender(e.target.value)}
                                                    placeholder="e.g. Black Horse"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Settlement Amount (£)</label>
                                                <input
                                                    type="number"
                                                    value={pxFinanceAmount}
                                                    onChange={e => setPxFinanceAmount(e.target.value)}
                                                    placeholder="e.g. 5000"
                                                    min="0"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-[12px] text-slate-400">Toggle on to add a customer part exchange vehicle.</p>
                        )}
                    </div>

                    {/* ── 4. Products ── */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">
                            4. Products
                        </h2>
                        {products.length === 0 ? (
                            <p className="text-[12px] text-slate-400">
                                No products found.{' '}
                                <Link href="/app/sales/products" className="text-[#4D7CFF] font-semibold hover:underline">
                                    Add products
                                </Link>
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {products.map(p => {
                                    const selected = selectedProductIds.includes(p._id);
                                    return (
                                        <label
                                            key={p._id}
                                            className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected ? 'border-[#4D7CFF] bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleProduct(p._id)}
                                                    className="w-4 h-4 rounded accent-[#4D7CFF]"
                                                />
                                                <span className="text-[13px] font-semibold text-slate-700">{p.name}</span>
                                            </div>
                                            <span className="text-[13px] font-bold text-slate-800">
                                                £{(p.price || 0).toLocaleString()}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── 5. Delivery & Collection ── */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                5. Delivery & Collection
                            </h2>
                            <button
                                type="button"
                                onClick={() => setDeliveryEnabled(v => !v)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${deliveryEnabled ? 'bg-[#4D7CFF]' : 'bg-slate-200'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${deliveryEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        {deliveryEnabled ? (
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 mb-2 block">Customer preference</label>
                                <div className="flex gap-3">
                                    {(['Collection', 'Delivery'] as const).map(type => (
                                        <label
                                            key={type}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${deliveryType === type ? 'border-[#4D7CFF] bg-blue-50/50 text-[#4D7CFF]' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                        >
                                            <input
                                                type="radio"
                                                name="deliveryType"
                                                value={type}
                                                checked={deliveryType === type}
                                                onChange={() => setDeliveryType(type)}
                                                className="accent-[#4D7CFF]"
                                            />
                                            <span className="text-[13px] font-semibold">
                                                {type === 'Collection' ? '🏪 Collection' : '🚚 Delivery'}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-2">
                                    This records the customer&apos;s preference. Calendar booking can be arranged after deal creation.
                                </p>
                            </div>
                        ) : (
                            <p className="text-[12px] text-slate-400">Toggle on to set a delivery or collection preference.</p>
                        )}
                    </div>
                </div>

                {/* ── Right: Summary + Actions ── */}
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5 sticky top-4">
                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Deal Summary</h2>

                        {/* Customer */}
                        <div className="mb-4 pb-4 border-b border-slate-100">
                            <p className="text-[11px] text-slate-400 mb-1">Customer</p>
                            {firstName || lastName ? (
                                <p className="text-[13px] font-semibold text-slate-800">{firstName} {lastName}</p>
                            ) : (
                                <p className="text-[12px] text-slate-400 italic">Not entered</p>
                            )}
                            {email && <p className="text-[12px] text-slate-500">{email}</p>}
                        </div>

                        {/* Vehicle */}
                        <div className="mb-4 pb-4 border-b border-slate-100">
                            <p className="text-[11px] text-slate-400 mb-1">Vehicle</p>
                            {selectedVehicle ? (
                                <p className="text-[13px] font-semibold text-slate-800">
                                    {selectedVehicle.vrm} · {selectedVehicle.make} {selectedVehicle.vehicleModel || selectedVehicle.model}
                                </p>
                            ) : stockId ? (
                                <p className="text-[12px] font-mono text-slate-600">{stockId}</p>
                            ) : (
                                <p className="text-[12px] text-slate-400 italic">Not selected</p>
                            )}
                        </div>

                        {/* Part Exchange */}
                        {pxEnabled && pxReg && (
                            <div className="mb-4 pb-4 border-b border-slate-100">
                                <p className="text-[11px] text-slate-400 mb-1">Part Exchange</p>
                                <p className="text-[13px] font-semibold text-slate-800">{pxReg}</p>
                                {pxMileage && <p className="text-[12px] text-slate-500">{Number(pxMileage).toLocaleString()} miles · {pxCondition}</p>}
                                {pxOffer && <p className="text-[12px] font-semibold text-amber-600">Offer: £{Number(pxOffer).toLocaleString()}</p>}
                            </div>
                        )}

                        {/* Products */}
                        {selectedProducts.length > 0 && (
                            <div className="mb-4 pb-4 border-b border-slate-100">
                                <p className="text-[11px] text-slate-400 mb-2">Products</p>
                                {selectedProducts.map(p => (
                                    <div key={p._id} className="flex justify-between text-[12px] text-slate-700 mb-1">
                                        <span>{p.name}</span>
                                        <span className="font-semibold">£{(p.price || 0).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-[12px] font-bold text-slate-800 mt-2 pt-2 border-t border-slate-100">
                                    <span>Products Total</span>
                                    <span>£{productsTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        {/* Delivery */}
                        {deliveryEnabled && (
                            <div className="mb-4 pb-4 border-b border-slate-100">
                                <p className="text-[11px] text-slate-400 mb-1">Delivery / Collection</p>
                                <p className="text-[13px] font-semibold text-slate-800">{deliveryType}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2 mt-2">
                            <button
                                type="button"
                                onClick={() => handleCreate('deal')}
                                disabled={saving}
                                className="w-full py-2.5 bg-[#4D7CFF] text-white text-[13px] font-bold rounded-lg hover:bg-[#3a6ae8] disabled:opacity-50 transition-colors"
                            >
                                {saving ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Creating…
                                    </span>
                                ) : 'Create Deal'}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCreate('finance')}
                                disabled={saving}
                                className="w-full py-2.5 border border-[#4D7CFF] text-[#4D7CFF] text-[13px] font-bold rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                            >
                                Create &amp; Finance
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCreate('confirm')}
                                disabled={saving}
                                className="w-full py-2.5 border border-slate-200 text-slate-700 text-[13px] font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                                Create &amp; Confirm
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCreate('share')}
                                disabled={saving}
                                className="w-full py-2.5 border border-slate-200 text-slate-700 text-[13px] font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                                Create &amp; Share
                            </button>
                            <Link
                                href="/app/sales/deals"
                                className="block w-full text-center py-2 text-[12px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Cancel
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
