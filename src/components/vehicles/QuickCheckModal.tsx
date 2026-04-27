'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type Step = 'input' | 'confirm';

type VehiclePreview = {
    make: string;
    year: number;
    colour: string;
};

interface QuickCheckModalProps {
    open: boolean;
    onClose: () => void;
}

export function QuickCheckModal({ open, onClose }: QuickCheckModalProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [step, setStep] = useState<Step>('input');
    const [vrm, setVrm] = useState('');
    const [loading, setLoading] = useState(false);
    const [navigating, setNavigating] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<VehiclePreview | null>(null);

    // Close modal when navigation to check page completes
    useEffect(() => {
        if (navigating && pathname.includes('/vehicles/check')) {
            onClose();
            setNavigating(false);
        }
    }, [pathname, navigating, onClose]);

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setStep('input');
            setVrm('');
            setError('');
            setPreview(null);
            setNavigating(false);
        }
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    const formatted = vrm.trim().toUpperCase();

    async function handleNext() {
        if (!formatted) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/vehicles/lookup?vrm=${encodeURIComponent(formatted)}`);
            const data = await res.json();
            if (data.ok) {
                const v = data.vehicle;
                const year = v.year || v.registrationYear || v.yearOfManufacture ||
                    (v.registrationDate ? new Date(v.registrationDate).getFullYear() : 0) ||
                    (v.rawResponse?.yearOfManufacture) || 0;
                setPreview({
                    make: v.make,
                    year,
                    colour: v.colour,
                });
                setStep('confirm');
            } else {
                setError(data.error?.message || 'Could not find vehicle for this plate.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    function handleConfirm() {
        setNavigating(true);
        router.push(`/app/vehicles/check?vrm=${encodeURIComponent(formatted)}`);
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[200]"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {step === 'input' ? (
                        <>
                            <div className="flex items-center justify-between px-6 pt-6 pb-4">
                                <h2 className="text-base font-bold text-slate-800">Check Vehicle</h2>
                                <button
                                    onClick={onClose}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all text-lg leading-none"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="px-6 pb-4">
                                <div className="flex items-center gap-3">
                                    {/* UK Number Plate */}
                                    <div className="flex-1 flex items-stretch rounded-lg overflow-hidden border-[3px] border-slate-900 shadow-md h-14">
                                        <div className="bg-blue-700 flex flex-col items-center justify-center px-2 gap-0.5 min-w-[38px]">
                                            <div className="flex gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                    <span key={i} className="text-[5px] text-yellow-300">★</span>
                                                ))}
                                            </div>
                                            <span className="text-white text-[9px] font-black tracking-widest leading-none">UK</span>
                                        </div>
                                        <input
                                            value={vrm}
                                            onChange={e => setVrm(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''))}
                                            onKeyDown={e => e.key === 'Enter' && handleNext()}
                                            placeholder="AB12 CDE"
                                            maxLength={8}
                                            autoFocus
                                            className="flex-1 bg-amber-400 px-4 text-2xl font-black text-center uppercase tracking-widest text-slate-900 placeholder-slate-700/40 outline-none min-w-0"
                                        />
                                    </div>
                                    {/* Camera */}
                                    <div className="flex items-center gap-1.5 text-slate-400">
                                        <span className="text-sm">or</span>
                                        <button className="w-10 h-10 flex items-center justify-center rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:text-indigo-600 transition-all">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <p className="mt-3 text-red-500 text-xs font-medium">{error}</p>
                                )}
                            </div>

                            <div className="border-t border-slate-100 px-6 py-4 flex gap-3 justify-end">
                                <button className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all">
                                    Past Checks
                                </button>
                                <button
                                    onClick={handleNext}
                                    disabled={loading || !vrm.trim()}
                                    className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                            </svg>
                                            Searching...
                                        </span>
                                    ) : 'Next'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between px-6 pt-6 pb-2">
                                <h2 className="text-base font-bold text-slate-800">Confirm Vehicle</h2>
                                <button
                                    onClick={onClose}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all text-lg leading-none"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="px-6 pb-6">
                                <p className="text-slate-400 text-sm mb-5">Is this the correct vehicle?</p>

                                <div className="space-y-0">
                                    {[
                                        { label: 'Registration', value: formatted },
                                        { label: 'Country', value: 'UNITED KINGDOM' },
                                        { label: 'Manufacturer', value: preview?.make?.toUpperCase() },
                                        { label: 'Year', value: preview?.year ? String(preview.year) : '—' },
                                        { label: 'Colour', value: preview?.colour?.toUpperCase() },
                                    ].map(row => (
                                        <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                                            <span className="text-sm text-slate-400">{row.label}</span>
                                            <span className="text-sm font-bold text-slate-900">{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-slate-100 px-6 py-4 flex gap-3 justify-end">
                                <button
                                    onClick={() => setStep('input')}
                                    className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={navigating}
                                    className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                >
                                    {navigating ? (
                                        <>
                                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                            </svg>
                                            Loading...
                                        </>
                                    ) : 'Correct Vehicle'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
