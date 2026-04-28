'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface VehicleHit { _id: string; make: string; model: string; vrm: string; status: string; }
interface CustomerHit { _id: string; firstName: string; lastName: string; email?: string; }

interface SearchResults {
    vehicles: VehicleHit[];
    customers: CustomerHit[];
}

export function NavActions() {
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults>({ vehicles: [], customers: [] });
    const [searching, setSearching] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const router = useRouter();

    // Ctrl+Shift+S shortcut
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                setSearchOpen(v => !v);
            }
            if (e.key === 'Escape') setSearchOpen(false);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (searchOpen) { setTimeout(() => inputRef.current?.focus(), 50); }
        else { setQuery(''); setResults({ vehicles: [], customers: [] }); setSelectedIdx(-1); }
    }, [searchOpen]);

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) { setResults({ vehicles: [], customers: [] }); return; }
        setSearching(true);
        try {
            const [vRes, cRes] = await Promise.all([
                fetch(`/api/vehicles?search=${encodeURIComponent(q)}`).then(r => r.json()),
                fetch(`/api/crm/customers?q=${encodeURIComponent(q)}`).then(r => r.json()),
            ]);
            setResults({
                vehicles: (vRes.vehicles || []).slice(0, 5).map((v: any) => ({
                    _id: String(v._id), make: v.make, model: v.model, vrm: v.vrm, status: v.status,
                })),
                customers: (cRes.customers || []).slice(0, 4).map((c: any) => ({
                    _id: String(c._id), firstName: c.firstName, lastName: c.lastName, email: c.email,
                })),
            });
        } catch { /* ignore */ }
        setSearching(false);
        setSelectedIdx(-1);
    }, []);

    function onQueryChange(val: string) {
        setQuery(val);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => doSearch(val), 280);
    }

    // Build flat list of results for keyboard nav
    const allHits = [
        ...results.vehicles.map(v => ({ type: 'vehicle' as const, id: v._id, href: `/app/vehicles/${v._id}`, label: `${v.vrm} — ${v.make} ${v.model}`, sub: v.status })),
        ...results.customers.map(c => ({ type: 'customer' as const, id: c._id, href: `/app/sales/contacts/${c._id}`, label: `${c.firstName} ${c.lastName}`, sub: c.email || '' })),
    ];

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, allHits.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, -1)); }
        if (e.key === 'Enter') {
            if (selectedIdx >= 0 && allHits[selectedIdx]) {
                router.push(allHits[selectedIdx].href);
                setSearchOpen(false);
            } else if (query.trim()) {
                router.push(`/app/vehicles?search=${encodeURIComponent(query.trim())}`);
                setSearchOpen(false);
            }
        }
    }

    const hasResults = allHits.length > 0;
    const showTips = !query.trim();

    return (
        <>
            {/* Icon buttons */}
            <div className="flex items-center gap-1">
                <NavBtn onClick={() => setSearchOpen(true)} label="Search" active={searchOpen}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </NavBtn>

                <NavBtn href="/app/sales/deals" label="Deals">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                </NavBtn>

                <NavBtn href="/app/sales/leads" label="Leads & Chat" teal>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                </NavBtn>
            </div>

            {/* Search overlay */}
            {searchOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-[500] flex flex-col items-center pt-14 px-4"
                    onClick={() => setSearchOpen(false)}
                >
                    <div
                        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Input */}
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                            {searching ? (
                                <div className="w-5 h-5 border-2 border-slate-200 border-t-[#4D7CFF] rounded-full animate-spin shrink-0" />
                            ) : (
                                <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => onQueryChange(e.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder="e.g. hatchback silver or john smith valuation"
                                className="flex-1 text-[15px] text-slate-700 placeholder:text-slate-400 outline-none bg-transparent"
                            />
                            <button type="button" onClick={() => setSearchOpen(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Results */}
                        {!showTips && hasResults && (
                            <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-50">
                                {results.vehicles.length > 0 && (
                                    <div>
                                        <p className="px-5 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicles</p>
                                        {results.vehicles.map((v, i) => {
                                            const idx = i;
                                            return (
                                                <Link
                                                    key={v._id}
                                                    href={`/app/vehicles/${v._id}`}
                                                    onClick={() => setSearchOpen(false)}
                                                    className={`flex items-center gap-3 px-5 py-3 hover:bg-blue-50 transition-colors ${selectedIdx === idx ? 'bg-blue-50' : ''}`}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                                        <svg className="w-4 h-4 text-[#4D7CFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] font-bold text-slate-800 truncate">{v.vrm} — {v.make} {v.model}</p>
                                                        <p className="text-[11px] text-slate-400 truncate">{v.status}</p>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                                {results.customers.length > 0 && (
                                    <div>
                                        <p className="px-5 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Customers</p>
                                        {results.customers.map((c, i) => {
                                            const idx = results.vehicles.length + i;
                                            return (
                                                <Link
                                                    key={c._id}
                                                    href={`/app/sales/contacts/${c._id}`}
                                                    onClick={() => setSearchOpen(false)}
                                                    className={`flex items-center gap-3 px-5 py-3 hover:bg-blue-50 transition-colors ${selectedIdx === idx ? 'bg-blue-50' : ''}`}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-[12px] font-bold text-emerald-600">
                                                        {c.firstName?.[0]}{c.lastName?.[0]}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] font-bold text-slate-800 truncate">{c.firstName} {c.lastName}</p>
                                                        <p className="text-[11px] text-slate-400 truncate">{c.email}</p>
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                                {/* View all */}
                                <div className="px-5 py-3">
                                    <Link
                                        href={`/app/vehicles?search=${encodeURIComponent(query)}`}
                                        onClick={() => setSearchOpen(false)}
                                        className="text-[12px] font-semibold text-[#4D7CFF] hover:underline"
                                    >
                                        View all results for "{query}" →
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* No results */}
                        {!showTips && !hasResults && !searching && query.trim() && (
                            <div className="px-5 py-6 text-center text-[13px] text-slate-400">
                                No results found for <strong className="text-slate-600">"{query}"</strong>
                            </div>
                        )}

                        {/* Search tips (shown when empty) */}
                        {showTips && (
                            <div className="px-6 py-5">
                                <p className="text-[13px] font-bold text-slate-700 mb-3">Search Tips</p>
                                <ul className="space-y-2.5 text-[13px] text-slate-500">
                                    <li className="flex gap-2"><span className="shrink-0">•</span><span>Phrase match with quotes, e.g. <em className="text-slate-700">"rear wheel drive"</em></span></li>
                                    <li className="flex gap-2"><span className="shrink-0">•</span><span>Exact match with plus, e.g. <em className="text-slate-700">bmw +estate</em></span></li>
                                    <li className="flex gap-2"><span className="shrink-0">•</span><span>Search by colour, fuel type, transmission, e.g. <em className="text-slate-700">silver hatchback manual</em></span></li>
                                    <li className="flex gap-2"><span className="shrink-0">•</span><span>Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px] font-mono">ctrl+shift+s</kbd> to open, <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px] font-mono">↑↓</kbd> to navigate, <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px] font-mono">esc</kbd> to close.</span></li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

function NavBtn({
    children, label, onClick, href, active, teal,
}: {
    children: React.ReactNode;
    label: string;
    onClick?: () => void;
    href?: string;
    active?: boolean;
    teal?: boolean;
}) {
    const base = `relative group w-10 h-10 flex items-center justify-center rounded-full transition-all`;
    const color = teal
        ? 'bg-teal-50 text-teal-500 hover:bg-teal-100'
        : active
        ? 'bg-[#4D7CFF] text-white'
        : 'bg-slate-100 text-slate-500 hover:bg-slate-200';

    const inner = (
        <>
            {children}
            <span className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold bg-slate-800 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {label}
            </span>
        </>
    );

    if (href) return <Link href={href} className={`${base} ${color}`}>{inner}</Link>;
    return <button type="button" onClick={onClick} className={`${base} ${color}`}>{inner}</button>;
}
