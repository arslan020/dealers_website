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

export default function CreateDealPage() {
    const router = useRouter();

    const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
    const [loadingVehicles, setLoadingVehicles] = useState(true);
    const [saving, setSaving] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [stockId, setStockId] = useState('');

    const loadVehicles = useCallback(async () => {
        setLoadingVehicles(true);
        try {
            const res = await fetch('/api/vehicles?status=In Stock');
            const data = await res.json();
            if (data.ok && Array.isArray(data.vehicles)) {
                const withStock = (data.vehicles as VehicleRow[]).filter(v => v.stockId && v.stockId.trim() !== '');
                setVehicles(withStock);
            }
        } catch {
            toast.error('Failed to load vehicles');
        } finally {
            setLoadingVehicles(false);
        }
    }, []);

    useEffect(() => {
        loadVehicles();
    }, [loadVehicles]);

    useEffect(() => {
        const s = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('stockId');
        if (s) setStockId(s);
    }, []);

    const vehicleOptions = useMemo(
        () =>
            vehicles.map(v => ({
                stockId: v.stockId!,
                label: `${v.vrm} · ${v.make} ${v.vehicleModel || v.model || ''}`.trim(),
            })),
        [vehicles]
    );

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !stockId.trim()) {
            toast.error('First name, last name, email and vehicle (stock) are required.');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/deals', {
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
            const data = await res.json();
            if (data.ok && data.dealId) {
                toast.success('Deal created');
                router.push(`/app/deals/${data.dealId}`);
            } else {
                toast.error(data.error?.message || 'Could not create deal');
            }
        } catch {
            toast.error('Network error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
                <span className="font-semibold">Sales</span>
                <span>/</span>
                <Link href="/app/sales/deals" className="font-semibold hover:text-slate-600 text-[#4D7CFF]">
                    Deals
                </Link>
                <span>/</span>
                <span className="text-slate-600 font-semibold">Create</span>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-900">Create deal</h1>
                        <p className="text-[12px] text-slate-500 mt-0.5">
                            Select a customer and an in-stock vehicle with an AutoTrader stock ID. A new deal is created on
                            AutoTrader.
                        </p>
                    </div>
                    <Link
                        href="/app/sales/deals"
                        className="text-[12px] font-semibold text-slate-500 hover:text-slate-800"
                    >
                        Back to list
                    </Link>
                </div>

                <form onSubmit={handleCreate} className="p-5 space-y-5">
                    <div>
                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Customer</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 mb-1 block">First name *</label>
                                <input
                                    required
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                />
                            </div>
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Last name *</label>
                                <input
                                    required
                                    value={lastName}
                                    onChange={e => setLastName(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Email *</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                            />
                        </div>
                        <div className="mt-4">
                            <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Phone (recommended)</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="e.g. 07123 456789"
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Some AutoTrader deal rules need a contact number. Add if the API still returns an error.</p>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vehicle</h2>
                        {loadingVehicles ? (
                            <p className="text-[12px] text-slate-400">Loading stock…</p>
                        ) : vehicleOptions.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 text-[12px] text-slate-600">
                                No in-stock vehicles with a linked AutoTrader <code className="text-[11px]">stockId</code>{' '}
                                were found. Add or sync a vehicle in{' '}
                                <Link href="/app/vehicles" className="font-semibold text-[#4D7CFF] hover:underline">
                                    Vehicles
                                </Link>
                                , or enter a stock ID manually below.
                            </div>
                        ) : (
                            <div>
                                <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Select vehicle *</label>
                                <select
                                    value={vehicleOptions.some(o => o.stockId === stockId) ? stockId : ''}
                                    onChange={e => setStockId(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:border-[#4D7CFF]"
                                >
                                    <option value="">Choose…</option>
                                    {vehicleOptions.map(o => (
                                        <option key={o.stockId} value={o.stockId}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="mt-3">
                            <label className="text-[12px] font-semibold text-slate-600 mb-1 block">Or enter stock ID</label>
                            <input
                                value={stockId}
                                onChange={e => setStockId(e.target.value)}
                                placeholder="AutoTrader stock ID"
                                className="w-full font-mono text-[13px] border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4D7CFF]"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <Link
                            href="/app/sales/deals"
                            className="px-4 py-2 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 bg-[#4D7CFF] text-white rounded-lg text-[13px] font-bold hover:bg-[#3a6ae8] disabled:opacity-50"
                        >
                            {saving ? 'Creating…' : 'Create deal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
