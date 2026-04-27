'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Product {
    _id: string;
    name: string;
    code?: string;
    description?: string;
    priceExcVat: number;
    vatRate: string;
    stockControl: boolean;
    quantityAvailable: number;
    typeInvoice: boolean;
    typePurchaseInvoice: boolean;
    optionsType: string;
    options: { name: string; priceExcVat: number }[];
}

function GBP(n: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n); }

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);

    async function fetchProducts() {
        try {
            const res = await fetch(`/api/products?limit=200${search ? `&search=${encodeURIComponent(search)}` : ''}`);
            const data = await res.json();
            if (data.ok) setProducts(data.products);
        } catch { toast.error('Failed to load products'); } finally { setLoading(false); }
    }

    useEffect(() => { fetchProducts(); }, [search]);

    async function handleDelete(id: string, name: string) {
        if (!confirm(`Delete "${name}"?`)) return;
        setDeleting(id);
        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            toast.success('Product deleted');
            setProducts(prev => prev.filter(p => p._id !== id));
        } catch (err: any) { toast.error(err.message); } finally { setDeleting(null); }
    }

    return (
        <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
                <span>Sales</span>
                <span>/</span>
                <span className="text-slate-800 font-semibold">Products</span>
            </div>

            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">Products &amp; Services</h1>
                    <Link href="/app/sales/products/add"
                        className="flex items-center gap-1.5 bg-[#4D7CFF] text-white px-4 py-2 rounded-lg text-[13px] font-bold hover:bg-[#3a6ae0]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Add Product
                    </Link>
                </div>

                {/* Search */}
                <div className="px-5 py-3 border-b border-slate-100">
                    <input
                        type="text"
                        placeholder="Search products…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full max-w-sm border border-slate-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                    />
                </div>

                {/* Table */}
                {loading ? (
                    <div className="flex items-center justify-center h-40 text-slate-400 text-[13px]">Loading…</div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
                        <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7h.01M7 3h5l7 7-5 5-7-7V3z" /></svg>
                        <p className="text-[13px]">No products yet. <Link href="/app/sales/products/add" className="text-[#4D7CFF] font-semibold hover:underline">Add your first product</Link></p>
                    </div>
                ) : (
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-5 py-3 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Name</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Code</th>
                                <th className="px-5 py-3 text-right font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Price</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">VAT</th>
                                <th className="px-5 py-3 text-center font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Stock</th>
                                <th className="px-5 py-3 text-center font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Options</th>
                                <th className="px-5 py-3 w-20"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(p => (
                                <tr key={p._id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                    <td className="px-5 py-3">
                                        <div className="font-semibold text-slate-800">{p.name}</div>
                                        {p.description && <p className="text-[12px] text-slate-400 mt-0.5 line-clamp-1">{p.description}</p>}
                                    </td>
                                    <td className="px-5 py-3 text-slate-500">{p.code || '—'}</td>
                                    <td className="px-5 py-3 text-right font-semibold text-slate-800">
                                        {p.optionsType !== 'No Options' && p.options?.length
                                            ? <span className="text-[12px] text-slate-500">from {GBP(Math.min(...p.options.map(o => o.priceExcVat)))}</span>
                                            : GBP(p.priceExcVat)
                                        }
                                    </td>
                                    <td className="px-5 py-3 text-slate-500">{p.vatRate}</td>
                                    <td className="px-5 py-3 text-center">
                                        {p.stockControl
                                            ? <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${p.quantityAvailable > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                {p.quantityAvailable} avail.
                                            </span>
                                            : <span className="text-slate-300 text-[12px]">—</span>
                                        }
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        {p.optionsType !== 'No Options'
                                            ? <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-[#4D7CFF]">{p.optionsType}</span>
                                            : <span className="text-slate-300 text-[12px]">—</span>
                                        }
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2 justify-end">
                                            <Link href={`/app/sales/products/${p._id}/edit`}
                                                className="text-[12px] font-semibold text-[#4D7CFF] hover:underline">
                                                Edit
                                            </Link>
                                            <button onClick={() => handleDelete(p._id, p.name)} disabled={deleting === p._id}
                                                className="text-[12px] font-semibold text-red-400 hover:text-red-600 disabled:opacity-50">
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
