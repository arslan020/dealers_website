'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Customer {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
}

interface Vehicle {
    _id: string;
    vrm: string;
    make: string;
    vehicleModel: string;
    year?: number;
    mileage?: number;
    price?: number;
    stockId?: string;
    status: string;
}

interface Product {
    _id: string;
    name: string;
    price: number;
    type?: string;
}

type ActionType = 'deal' | 'finance' | 'confirm' | 'share';

export default function CreateDealPage() {
    const router = useRouter();

    // Customer
    const [customerSearch, setCustomerSearch] = useState('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // New customer form
    const [showNewCustomer, setShowNewCustomer] = useState(false);
    const [newFirstName, setNewFirstName] = useState('');
    const [newLastName, setNewLastName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPhone, setNewPhone] = useState('');

    // Vehicle
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
    const [loadingVehicles, setLoadingVehicles] = useState(false);

    // Part Exchange
    const [pxVrm, setPxVrm] = useState('');
    const [pxMileage, setPxMileage] = useState('');
    const [pxCondition, setPxCondition] = useState('Good');
    const [pxOffer, setPxOffer] = useState('');

    // Products
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

    // Delivery
    const [deliveryType, setDeliveryType] = useState<'none' | 'delivery' | 'collection'>('none');
    const [deliveryDate, setDeliveryDate] = useState('');

    // Submit state
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const customerSearchTimeout = useRef<NodeJS.Timeout | null>(null);
    const vehicleSearchTimeout = useRef<NodeJS.Timeout | null>(null);

    // Customer search
    const searchCustomers = useCallback(async (q: string) => {
        if (!q.trim()) { setCustomers([]); return; }
        setLoadingCustomers(true);
        try {
            const res = await fetch(`/api/crm/customers?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            if (data.ok) setCustomers(data.customers || []);
        } finally { setLoadingCustomers(false); }
    }, []);

    useEffect(() => {
        if (customerSearchTimeout.current) clearTimeout(customerSearchTimeout.current);
        customerSearchTimeout.current = setTimeout(() => searchCustomers(customerSearch), 300);
    }, [customerSearch, searchCustomers]);

    // Vehicle search
    const searchVehicles = useCallback(async (q: string) => {
        setLoadingVehicles(true);
        try {
            const params = new URLSearchParams({ status: 'In Stock' });
            if (q.trim()) params.set('search', q);
            const res = await fetch(`/api/vehicles?${params}`);
            const data = await res.json();
            if (data.ok) setVehicles(data.vehicles || []);
        } finally { setLoadingVehicles(false); }
    }, []);

    useEffect(() => {
        if (vehicleSearchTimeout.current) clearTimeout(vehicleSearchTimeout.current);
        vehicleSearchTimeout.current = setTimeout(() => searchVehicles(vehicleSearch), 300);
    }, [vehicleSearch, searchVehicles]);

    // Load products on mount
    useEffect(() => {
        fetch('/api/products')
            .then(r => r.json())
            .then(d => { if (d.ok) setProducts(d.products || []); });
    }, []);

    function toggleProduct(id: string) {
        setSelectedProducts(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }

    const consumer = selectedCustomer
        ? { firstName: selectedCustomer.firstName, lastName: selectedCustomer.lastName, email: selectedCustomer.email, phone: selectedCustomer.phone }
        : showNewCustomer
            ? { firstName: newFirstName, lastName: newLastName, email: newEmail, phone: newPhone || null }
            : null;

    async function handleSubmit(action: ActionType) {
        setError('');

        if (!consumer) { setError('Please select or add a customer.'); return; }
        if (!consumer.firstName || !consumer.lastName || !consumer.email) { setError('Customer name and email are required.'); return; }
        if (!selectedVehicle) { setError('Please select a vehicle.'); return; }
        if (!selectedVehicle.stockId) { setError('Selected vehicle has no AutoTrader Stock ID. Please publish it to AT first.'); return; }

        setSubmitting(true);
        try {
            const res = await fetch('/api/deals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    consumer: {
                        firstName: consumer.firstName.trim(),
                        lastName: consumer.lastName.trim(),
                        email: consumer.email.trim().toLowerCase(),
                        ...(consumer.phone ? { phone: consumer.phone.trim() } : {}),
                    },
                    stockId: selectedVehicle.stockId,
                }),
            });

            const data = await res.json();
            if (!data.ok) { setError(data.error?.message || 'Failed to create deal.'); return; }

            const dealId = data.dealId;
            const tabMap: Record<ActionType, string> = {
                deal: 'deal',
                finance: 'finance',
                confirm: 'confirm',
                share: 'share',
            };
            router.push(`/app/deals/${dealId}?tab=${tabMap[action]}`);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    const selectedProductItems = products.filter(p => selectedProducts.includes(p._id));
    const vehiclePrice = selectedVehicle?.price || 0;
    const pxOfferNum = parseFloat(pxOffer) || 0;
    const productsTotal = selectedProductItems.reduce((s, p) => s + p.price, 0);
    const total = vehiclePrice - pxOfferNum + productsTotal;

    return (
        <div className="p-3 sm:p-6 min-h-screen bg-[#f8fafc]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                <Link href="/app/deals" className="text-slate-400 hover:text-slate-700 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-[#1e293b]">Create Deal</h1>
                    <p className="text-[11px] text-slate-400 mt-0.5">Sales → Deals → Create</p>
                </div>
            </div>

            {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600 font-medium">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: Main form */}
                <div className="lg:col-span-2 space-y-4">

                    {/* ── Customer ── */}
                    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-5">
                        <h2 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-4">Customer</h2>

                        {selectedCustomer ? (
                            <div className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                                <div className="w-9 h-9 rounded-full bg-[#3eb6cd]/10 flex items-center justify-center text-[#3eb6cd] font-bold text-sm shrink-0">
                                    {selectedCustomer.firstName[0]}{selectedCustomer.lastName[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-[#1e293b]">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                                    <p className="text-[11px] text-slate-400 truncate">{selectedCustomer.email}</p>
                                </div>
                                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-[11px] text-slate-400 hover:text-red-500 transition-colors">
                                    Remove
                                </button>
                            </div>
                        ) : showNewCustomer ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">First Name *</label>
                                        <input value={newFirstName} onChange={e => setNewFirstName(e.target.value)} placeholder="John" className="w-full h-9 px-3 text-[13px] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Last Name *</label>
                                        <input value={newLastName} onChange={e => setNewLastName(e.target.value)} placeholder="Smith" className="w-full h-9 px-3 text-[13px] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email *</label>
                                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="john@example.com" className="w-full h-9 px-3 text-[13px] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phone</label>
                                    <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="07700 123456" className="w-full h-9 px-3 text-[13px] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none" />
                                </div>
                                <button onClick={() => setShowNewCustomer(false)} className="text-[12px] text-slate-400 hover:text-slate-600">
                                    ← Search existing customer
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="relative">
                                    <input
                                        value={customerSearch}
                                        onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        placeholder="Search by name, email or phone..."
                                        className="w-full h-10 pl-4 pr-10 text-[13px] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none"
                                    />
                                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                    {showCustomerDropdown && (customerSearch.trim() || loadingCustomers) && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto">
                                            {loadingCustomers ? (
                                                <div className="px-4 py-3 text-[12px] text-slate-400">Searching...</div>
                                            ) : customers.length === 0 ? (
                                                <div className="px-4 py-3 text-[12px] text-slate-400">No customers found</div>
                                            ) : customers.map(c => (
                                                <button
                                                    key={c._id}
                                                    onClick={() => { setSelectedCustomer(c); setShowCustomerDropdown(false); setCustomerSearch(''); }}
                                                    className="w-full text-left px-4 py-2.5 hover:bg-[#f8fafc] flex items-center gap-3 transition-colors"
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-[#3eb6cd]/10 flex items-center justify-center text-[#3eb6cd] text-[11px] font-bold shrink-0">
                                                        {c.firstName[0]}{c.lastName[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-semibold text-[#1e293b]">{c.firstName} {c.lastName}</p>
                                                        <p className="text-[11px] text-slate-400">{c.email}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setShowNewCustomer(true); setShowCustomerDropdown(false); }}
                                    className="text-[12px] font-semibold text-[#3eb6cd] hover:underline"
                                >
                                    + Add new customer
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Vehicle ── */}
                    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-5">
                        <h2 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-4">Vehicle</h2>

                        {selectedVehicle ? (
                            <div className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1 1h1m0-5h10m0 5h1l1-1v-3.65a1 1 0 00-.22-.624l-3.48-4.35A1 1 0 0014.52 8H13"/></svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold text-[#1e293b]">{selectedVehicle.make} {selectedVehicle.vehicleModel}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{selectedVehicle.vrm}</span>
                                        {selectedVehicle.year && <span className="text-[11px] text-slate-400">{selectedVehicle.year}</span>}
                                        {selectedVehicle.mileage && <span className="text-[11px] text-slate-400">{selectedVehicle.mileage.toLocaleString()} mi</span>}
                                        {!selectedVehicle.stockId && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">No AT Stock ID</span>}
                                    </div>
                                </div>
                                {selectedVehicle.price && (
                                    <p className="text-[15px] font-black text-[#1e293b]">£{selectedVehicle.price.toLocaleString()}</p>
                                )}
                                <button onClick={() => { setSelectedVehicle(null); setVehicleSearch(''); }} className="text-[11px] text-slate-400 hover:text-red-500 transition-colors">
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    value={vehicleSearch}
                                    onChange={e => { setVehicleSearch(e.target.value); setShowVehicleDropdown(true); }}
                                    onFocus={() => { setShowVehicleDropdown(true); if (!vehicleSearch) searchVehicles(''); }}
                                    placeholder="Search by make, model or VRM..."
                                    className="w-full h-10 pl-4 pr-10 text-[13px] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none"
                                />
                                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                {showVehicleDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                                        {loadingVehicles ? (
                                            <div className="px-4 py-3 text-[12px] text-slate-400">Loading...</div>
                                        ) : vehicles.length === 0 ? (
                                            <div className="px-4 py-3 text-[12px] text-slate-400">No vehicles in stock</div>
                                        ) : vehicles.map(v => (
                                            <button
                                                key={v._id}
                                                onClick={() => { setSelectedVehicle(v); setShowVehicleDropdown(false); setVehicleSearch(''); }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-[#f8fafc] flex items-center gap-3 transition-colors border-b border-[#f1f5f9] last:border-0"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-semibold text-[#1e293b]">{v.make} {v.vehicleModel}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{v.vrm}</span>
                                                        {v.year && <span className="text-[11px] text-slate-400">{v.year}</span>}
                                                        {!v.stockId && <span className="text-[10px] font-bold text-amber-600">No AT ID</span>}
                                                    </div>
                                                </div>
                                                {v.price && <span className="text-[13px] font-bold text-slate-700">£{v.price.toLocaleString()}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Part Exchange ── */}
                    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-5">
                        <h2 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-4">Part Exchange <span className="text-[10px] font-normal normal-case text-slate-400 ml-1">(optional)</span></h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vehicle Registration</label>
                                <div className="flex gap-2">
                                    <input
                                        value={pxVrm}
                                        onChange={e => setPxVrm(e.target.value.toUpperCase())}
                                        placeholder="AB12 CDE"
                                        className="flex-1 h-9 px-3 text-[13px] font-mono border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none"
                                    />
                                    <button className="px-3 h-9 bg-[#3eb6cd] text-white text-[12px] font-bold rounded-lg hover:bg-[#37a3b8] transition-colors whitespace-nowrap">
                                        Search
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mileage</label>
                                <input value={pxMileage} onChange={e => setPxMileage(e.target.value)} placeholder="e.g. 45000" type="number" className="w-full h-9 px-3 text-[13px] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Condition</label>
                                <select value={pxCondition} onChange={e => setPxCondition(e.target.value)} className="w-full h-9 px-3 text-[13px] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none">
                                    <option>Excellent</option>
                                    <option>Good</option>
                                    <option>Fair</option>
                                    <option>Poor</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Offer Price (£)</label>
                                <input value={pxOffer} onChange={e => setPxOffer(e.target.value)} placeholder="£0" type="number" className="w-full h-9 px-3 text-[13px] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* ── Products ── */}
                    {products.length > 0 && (
                        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-5">
                            <h2 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-4">Products <span className="text-[10px] font-normal normal-case text-slate-400 ml-1">(optional)</span></h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {products.map(p => {
                                    const selected = selectedProducts.includes(p._id);
                                    return (
                                        <button
                                            key={p._id}
                                            onClick={() => toggleProduct(p._id)}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
                                                selected
                                                    ? 'border-[#3eb6cd] bg-[#3eb6cd]/5 text-[#3eb6cd]'
                                                    : 'border-[#e2e8f0] hover:border-[#3eb6cd]/40 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'border-[#3eb6cd] bg-[#3eb6cd]' : 'border-[#cbd5e1]'}`}>
                                                    {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                                                </div>
                                                <span className="text-[13px] font-medium">{p.name}</span>
                                            </div>
                                            <span className="text-[12px] font-bold">£{p.price.toLocaleString()}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Delivery & Collection ── */}
                    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-5">
                        <h2 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-4">Delivery & Collection <span className="text-[10px] font-normal normal-case text-slate-400 ml-1">(optional)</span></h2>
                        <div className="flex gap-2 mb-3">
                            {(['none', 'collection', 'delivery'] as const).map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setDeliveryType(opt)}
                                    className={`flex-1 py-2 text-[12px] font-semibold rounded-lg border transition-colors capitalize ${
                                        deliveryType === opt
                                            ? 'border-[#3eb6cd] bg-[#3eb6cd]/5 text-[#3eb6cd]'
                                            : 'border-[#e2e8f0] text-slate-500 hover:border-[#3eb6cd]/40'
                                    }`}
                                >
                                    {opt === 'none' ? 'No Preference' : opt === 'collection' ? 'Collection' : 'Delivery'}
                                </button>
                            ))}
                        </div>
                        {deliveryType !== 'none' && (
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Preferred Date</label>
                                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full h-9 px-3 text-[13px] border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#3eb6cd] focus:border-transparent outline-none" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Summary */}
                <div className="space-y-4 self-start sticky top-6">
                    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-5">
                        <h2 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-4">Summary</h2>
                        <div className="space-y-2 text-[13px]">
                            {selectedVehicle ? (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">{selectedVehicle.vrm} — Vehicle</span>
                                    <span className="font-semibold text-[#1e293b]">{vehiclePrice ? `£${vehiclePrice.toLocaleString()}` : '—'}</span>
                                </div>
                            ) : (
                                <p className="text-slate-400 text-[12px]">No vehicle selected</p>
                            )}
                            {pxVrm && pxOfferNum > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">{pxVrm} — Part Exchange</span>
                                    <span className="font-semibold text-amber-600">-£{pxOfferNum.toLocaleString()}</span>
                                </div>
                            )}
                            {selectedProductItems.map(p => (
                                <div key={p._id} className="flex justify-between">
                                    <span className="text-slate-500">{p.name}</span>
                                    <span className="font-semibold text-[#1e293b]">£{p.price.toLocaleString()}</span>
                                </div>
                            ))}
                            {selectedVehicle && (
                                <div className="border-t border-[#f1f5f9] pt-2 mt-2 flex justify-between">
                                    <span className="font-bold text-[#1e293b]">Total</span>
                                    <span className="font-black text-[#1e293b] text-[15px]">£{total.toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Customer summary */}
                        {consumer && (
                            <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
                                <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-1">Customer</p>
                                <p className="text-[13px] font-semibold text-[#1e293b]">{consumer.firstName} {consumer.lastName}</p>
                                <p className="text-[11px] text-slate-400">{consumer.email}</p>
                            </div>
                        )}

                        {/* Delivery summary */}
                        {deliveryType !== 'none' && (
                            <div className="mt-3 pt-3 border-t border-[#f1f5f9]">
                                <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-1">Delivery / Collection</p>
                                <p className="text-[13px] font-semibold text-[#1e293b] capitalize">{deliveryType}{deliveryDate ? ` — ${new Date(deliveryDate).toLocaleDateString('en-GB')}` : ''}</p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4 space-y-2">
                        <button
                            onClick={() => handleSubmit('deal')}
                            disabled={submitting}
                            className="w-full py-2.5 bg-[#3eb6cd] text-white text-[13px] font-bold rounded-lg hover:bg-[#37a3b8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                            Create Deal
                        </button>
                        <button
                            onClick={() => handleSubmit('finance')}
                            disabled={submitting}
                            className="w-full py-2 border border-[#e2e8f0] text-[#3eb6cd] text-[13px] font-semibold rounded-lg hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
                        >
                            Create & Finance
                        </button>
                        <button
                            onClick={() => handleSubmit('confirm')}
                            disabled={submitting}
                            className="w-full py-2 border border-[#e2e8f0] text-[#3eb6cd] text-[13px] font-semibold rounded-lg hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
                        >
                            Create & Confirm
                        </button>
                        <button
                            onClick={() => handleSubmit('share')}
                            disabled={submitting}
                            className="w-full py-2 border border-[#e2e8f0] text-[#3eb6cd] text-[13px] font-semibold rounded-lg hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
                        >
                            Create & Share
                        </button>
                    </div>
                </div>
            </div>

            {/* Close dropdowns on outside click */}
            {(showCustomerDropdown || showVehicleDropdown) && (
                <div className="fixed inset-0 z-10" onClick={() => { setShowCustomerDropdown(false); setShowVehicleDropdown(false); }} />
            )}
        </div>
    );
}
