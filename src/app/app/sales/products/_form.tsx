'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface ProductOption {
    subCode: string;
    name: string;
    description: string;
    highlight: '' | 'Recommended' | 'Most Popular' | 'Best Value';
    priceExcVat: string;
}

interface Props {
    title: string;
    breadcrumb: string;
    submitLabel: string;
    initial?: Record<string, any>;
    onSave: (body: Record<string, any>) => Promise<void>;
}

function reverseVat(priceInc: number, rate: string): number {
    if (rate === '20% VAT') return priceInc / 1.2;
    if (rate === '5% VAT') return priceInc / 1.05;
    return priceInc;
}

export default function ProductForm({ title, breadcrumb, submitLabel, initial, onSave }: Props) {
    const p = initial ?? {};

    const [name, setName] = useState(p.name ?? '');
    const [code, setCode] = useState(p.code ?? '');
    const [description, setDescription] = useState(p.description ?? '');
    const [typeInvoice, setTypeInvoice] = useState(p.typeInvoice !== false);
    const [typePurchaseInvoice, setTypePurchaseInvoice] = useState(p.typePurchaseInvoice !== false);
    const [typeCheckout, setTypeCheckout] = useState(p.typeCheckout ?? false);
    const [stockControl, setStockControl] = useState(p.stockControl ?? false);
    const [editable, setEditable] = useState<'Disable' | 'Price' | 'Name' | 'Both'>(p.editable ?? 'Disable');
    const [priceExcVat, setPriceExcVat] = useState(p.priceExcVat != null ? String(p.priceExcVat) : '');
    const [vatRate, setVatRate] = useState<'No VAT' | '5% VAT' | '20% VAT'>(p.vatRate ?? '20% VAT');
    const [quantityInStock, setQuantityInStock] = useState(p.quantityInStock != null ? String(p.quantityInStock) : '0');
    const [quantityAvailable, setQuantityAvailable] = useState(p.quantityAvailable != null ? String(p.quantityAvailable) : '0');
    const [supplier, setSupplier] = useState(p.supplier ?? '');
    const [reference, setReference] = useState(p.reference ?? '');
    const [optionsType, setOptionsType] = useState<'No Options' | 'Single' | 'Multiple'>(p.optionsType ?? 'No Options');
    const [selectMinimum, setSelectMinimum] = useState(p.selectMinimum != null ? String(p.selectMinimum) : '');
    const [selectMaximum, setSelectMaximum] = useState(p.selectMaximum != null ? String(p.selectMaximum) : '');
    const [options, setOptions] = useState<ProductOption[]>(
        p.options?.length
            ? p.options.map((o: any) => ({
                subCode: o.subCode ?? '',
                name: o.name ?? '',
                description: o.description ?? '',
                highlight: o.highlight ?? '',
                priceExcVat: o.priceExcVat != null ? String(o.priceExcVat) : '',
            }))
            : [{ subCode: '', name: '', description: '', highlight: '', priceExcVat: '' }]
    );
    const [saving, setSaving] = useState(false);

    function reverseCalc() {
        const val = parseFloat(priceExcVat);
        if (!val) return;
        setPriceExcVat(String(Math.round(reverseVat(val, vatRate) * 100) / 100));
    }

    function reverseOptionCalc(idx: number) {
        const val = parseFloat(options[idx].priceExcVat);
        if (!val) return;
        setOptions(prev => prev.map((o, i) => i === idx
            ? { ...o, priceExcVat: String(Math.round(reverseVat(val, vatRate) * 100) / 100) }
            : o
        ));
    }

    async function handleSubmit() {
        if (!name.trim()) { toast.error('Name is required'); return; }
        setSaving(true);
        try {
            const body: Record<string, any> = {
                name: name.trim(),
                code: code.trim() || undefined,
                description: description.trim() || undefined,
                typeInvoice,
                typePurchaseInvoice,
                typeCheckout,
                stockControl,
                editable,
                priceExcVat: parseFloat(priceExcVat) || 0,
                vatRate,
                supplier: supplier.trim() || undefined,
                reference: reference.trim() || undefined,
                optionsType,
            };
            if (stockControl) {
                body.quantityInStock = parseInt(quantityInStock) || 0;
                body.quantityAvailable = parseInt(quantityAvailable) || 0;
            }
            if (optionsType !== 'No Options') {
                body.options = options
                    .filter(o => o.name.trim())
                    .map(o => ({
                        subCode: o.subCode.trim() || undefined,
                        name: o.name.trim(),
                        description: o.description.trim() || undefined,
                        highlight: o.highlight || '',
                        priceExcVat: parseFloat(o.priceExcVat) || 0,
                        vatRate,
                    }));
                if (optionsType === 'Multiple') {
                    if (selectMinimum) body.selectMinimum = parseInt(selectMinimum) || undefined;
                    if (selectMaximum) body.selectMaximum = parseInt(selectMaximum) || undefined;
                }
            } else {
                body.options = [];
            }
            await onSave(body);
        } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
    }

    const inp = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#4D7CFF] focus:ring-1 focus:ring-[#4D7CFF]/20";
    const label = "block text-[13px] font-medium text-slate-600 mb-1.5";

    return (
        <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
                <span>Sales</span><span>/</span>
                <Link href="/app/sales/products" className="hover:text-[#4D7CFF]">Products</Link>
                <span>/</span>
                <span className="text-slate-800 font-semibold">{breadcrumb}</span>
            </div>

            {/* Section 1 — Name / Code / Description / Type / Enable / Editable */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h1 className="text-[16px] font-bold text-slate-800">{title}</h1>
                </div>
                <div className="px-6 py-5 space-y-5">
                    {/* Name + Code */}
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className={label}>Name</label>
                            <input className={inp} value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div>
                            <label className={label}>Code</label>
                            <input className={inp} value={code} onChange={e => setCode(e.target.value)} />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className={label}>Description</label>
                        <textarea rows={5} className={`${inp} resize-y`} value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    {/* Type / Enable / Editable */}
                    <div className="grid grid-cols-3 gap-8">
                        <div>
                            <p className={label}>Type</p>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                                    <input type="checkbox" checked={typeInvoice} onChange={e => setTypeInvoice(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-[#4D7CFF] focus:ring-[#4D7CFF]" />
                                    Invoice
                                </label>
                                <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                                    <input type="checkbox" checked={typePurchaseInvoice} onChange={e => setTypePurchaseInvoice(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-[#4D7CFF] focus:ring-[#4D7CFF]" />
                                    Purchase Invoice
                                </label>
                                <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                                    <input type="checkbox" checked={typeCheckout} onChange={e => setTypeCheckout(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-[#4D7CFF] focus:ring-[#4D7CFF]" />
                                    Checkout
                                </label>
                            </div>
                        </div>
                        <div>
                            <p className={label}>Enable <sup className="text-[#4D7CFF] text-[11px]">[?]</sup></p>
                            <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer">
                                <input type="checkbox" checked={stockControl} onChange={e => setStockControl(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-[#4D7CFF] focus:ring-[#4D7CFF]" />
                                Stock Control
                            </label>
                        </div>
                        <div>
                            <label className={label}>Editable <sup className="text-[#4D7CFF] text-[11px]">[?]</sup></label>
                            <select value={editable} onChange={e => setEditable(e.target.value as any)}
                                className={inp}>
                                <option value="Disable">Disable</option>
                                <option value="Price">Price</option>
                                <option value="Name">Name</option>
                                <option value="Both">Both</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2 — Price / VAT / Stock / Supplier / Reference */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                        {/* Price */}
                        <div>
                            <label className={label}>Price Exc. VAT</label>
                            <div className="flex">
                                <span className="border border-r-0 border-slate-200 rounded-l-lg px-3 py-2.5 text-[13px] text-slate-400 bg-slate-50">£</span>
                                <input type="number" step="0.01" value={priceExcVat}
                                    onChange={e => setPriceExcVat(e.target.value)}
                                    className="flex-1 border border-slate-200 px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#4D7CFF]" />
                                <button onClick={reverseCalc} title="Reverse calculate (remove VAT)"
                                    className="border border-l-0 border-slate-200 rounded-r-lg px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 13h.01M13 13h.01M17 13h.01M17 9h.01M13 9h.01M3 4h18M3 4v16M21 4v16M3 20h18" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        {/* VAT */}
                        <div>
                            <label className={label}>VAT</label>
                            <select value={vatRate} onChange={e => setVatRate(e.target.value as any)} className={inp}>
                                <option value="No VAT">No VAT</option>
                                <option value="5% VAT">5% VAT</option>
                                <option value="20% VAT">20% VAT</option>
                            </select>
                        </div>
                    </div>

                    {/* Stock quantities */}
                    {stockControl && (
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className={label}>Quantity In Stock</label>
                                <input type="number" min="0" className={inp}
                                    value={quantityInStock} onChange={e => setQuantityInStock(e.target.value)} />
                            </div>
                            <div>
                                <label className={label}>Quantity Available <sup className="text-[#4D7CFF] text-[11px]">[?]</sup></label>
                                <input type="number" min="0" className={inp}
                                    value={quantityAvailable} onChange={e => setQuantityAvailable(e.target.value)} />
                            </div>
                        </div>
                    )}

                    {/* Supplier / Reference */}
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className={label}>Supplier</label>
                            <input className={inp} value={supplier} onChange={e => setSupplier(e.target.value)} />
                        </div>
                        <div>
                            <label className={label}>Reference</label>
                            <input className={inp} value={reference} onChange={e => setReference(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 3 — Options Type */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className={label}>Options Type</label>
                            <select value={optionsType} onChange={e => setOptionsType(e.target.value as any)} className={inp}>
                                <option value="No Options">No Options</option>
                                <option value="Single">Single</option>
                                <option value="Multiple">Multiple</option>
                            </select>
                        </div>
                        {optionsType === 'Multiple' && (
                            <>
                                <div />
                                <div>
                                    <label className={label}>Select Minimum</label>
                                    <input type="number" min="0" placeholder="Disabled" className={inp}
                                        value={selectMinimum} onChange={e => setSelectMinimum(e.target.value)} />
                                </div>
                                <div>
                                    <label className={label}>Select Maximum</label>
                                    <input type="number" min="0" placeholder="Disabled" className={inp}
                                        value={selectMaximum} onChange={e => setSelectMaximum(e.target.value)} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Options table */}
                    {optionsType !== 'No Options' && (
                        <div>
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="pb-2 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide w-28">Sub-Code</th>
                                        <th className="pb-2 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Name</th>
                                        <th className="pb-2 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Description</th>
                                        <th className="pb-2 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide w-40">Highlight</th>
                                        <th className="pb-2 text-left font-semibold text-slate-500 uppercase text-[11px] tracking-wide w-44">Price Exc. VAT</th>
                                        <th className="pb-2 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {options.map((opt, idx) => (
                                        <tr key={idx} className="border-b border-slate-50">
                                            <td className="py-2 pr-2">
                                                <input className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                    value={opt.subCode}
                                                    onChange={e => setOptions(prev => prev.map((o, i) => i === idx ? { ...o, subCode: e.target.value } : o))} />
                                            </td>
                                            <td className="py-2 pr-2">
                                                <input className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                    value={opt.name}
                                                    onChange={e => setOptions(prev => prev.map((o, i) => i === idx ? { ...o, name: e.target.value } : o))} />
                                            </td>
                                            <td className="py-2 pr-2">
                                                <input className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                    value={opt.description}
                                                    onChange={e => setOptions(prev => prev.map((o, i) => i === idx ? { ...o, description: e.target.value } : o))} />
                                            </td>
                                            <td className="py-2 pr-2">
                                                <select value={opt.highlight}
                                                    onChange={e => setOptions(prev => prev.map((o, i) => i === idx ? { ...o, highlight: e.target.value as any } : o))}
                                                    className="w-full border border-slate-200 rounded-lg px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]">
                                                    <option value="">Nothing selected</option>
                                                    <option value="Recommended">Recommended</option>
                                                    <option value="Most Popular">Most Popular</option>
                                                    <option value="Best Value">Best Value</option>
                                                </select>
                                            </td>
                                            <td className="py-2 pr-2">
                                                <div className="flex">
                                                    <span className="border border-r-0 border-slate-200 rounded-l-lg px-2 py-2 text-[12px] text-slate-400 bg-slate-50">£</span>
                                                    <input type="number" step="0.01"
                                                        className="w-24 border border-slate-200 px-2 py-2 text-[13px] focus:outline-none focus:border-[#4D7CFF]"
                                                        value={opt.priceExcVat}
                                                        onChange={e => setOptions(prev => prev.map((o, i) => i === idx ? { ...o, priceExcVat: e.target.value } : o))} />
                                                    <button onClick={() => reverseOptionCalc(idx)} title="Reverse calculate"
                                                        className="border border-l-0 border-slate-200 rounded-r-lg px-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-500">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 13h.01M13 13h.01M17 13h.01M17 9h.01M13 9h.01M3 4h18M3 4v16M21 4v16M3 20h18" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="py-2">
                                                {options.length > 1 && (
                                                    <button onClick={() => setOptions(prev => prev.filter((_, i) => i !== idx))}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button
                                onClick={() => setOptions(prev => [...prev, { subCode: '', name: '', description: '', highlight: '', priceExcVat: '' }])}
                                className="mt-3 flex items-center gap-1.5 border border-[#4D7CFF] text-[#4D7CFF] px-3 py-1.5 rounded-lg text-[13px] font-semibold hover:bg-blue-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                Add Option
                            </button>
                        </div>
                    )}

                    {/* Submit */}
                    <div className="pt-2">
                        <button onClick={handleSubmit} disabled={saving}
                            className="bg-[#4D7CFF] text-white px-6 py-2.5 rounded-lg text-[14px] font-bold hover:bg-[#3a6ae0] disabled:opacity-60 transition-colors">
                            {saving ? 'Saving…' : submitLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
