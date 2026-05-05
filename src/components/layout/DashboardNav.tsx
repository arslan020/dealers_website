'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useAddVehicle } from '@/components/vehicles/AddVehicleProvider';
import { useQuickCheck } from '@/components/vehicles/QuickCheckProvider';

interface DashboardNavProps {
    role: string;
    permissions?: {
        vehicles?: boolean;
        sales?: boolean;
        tasks?: boolean;
        analytics?: boolean;
        advertising?: boolean;
        inventory?: boolean;
        addVehicle?: boolean;
        quickCheck?: boolean;
        canLookupAutoTrader?: boolean;
        canPublishAutoTrader?: boolean;
        canViewValuations?: boolean;
        canManageMessages?: boolean;
    };
}

export function DashboardNav({ role, permissions }: DashboardNavProps) {
    const { openAddVehicle } = useAddVehicle();
    const { openQuickCheck } = useQuickCheck();
    const [isVehiclesOpen, setIsVehiclesOpen] = useState(false);
    const [isSalesOpen, setIsSalesOpen] = useState(false);
    const vehiclesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const salesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const isSuperAdmin = role === 'SUPER_ADMIN';
    const isDealerAdmin = role === 'DEALER_ADMIN';

    const hasPermission = (key: keyof NonNullable<DashboardNavProps['permissions']>) => {
        if (isSuperAdmin || isDealerAdmin) return true;
        return permissions?.[key] !== false;
    };

    const handleVehiclesEnter = () => {
        if (vehiclesTimeoutRef.current) clearTimeout(vehiclesTimeoutRef.current);
        setIsVehiclesOpen(true);
    };

    const handleVehiclesLeave = () => {
        vehiclesTimeoutRef.current = setTimeout(() => {
            setIsVehiclesOpen(false);
        }, 150);
    };

    const handleSalesEnter = () => {
        if (salesTimeoutRef.current) clearTimeout(salesTimeoutRef.current);
        setIsSalesOpen(true);
    };

    const handleSalesLeave = () => {
        salesTimeoutRef.current = setTimeout(() => {
            setIsSalesOpen(false);
        }, 150);
    };


    return (
        <nav className="hidden lg:flex items-center gap-8 ml-8">
            <Link href={isSuperAdmin ? "/app/admin" : "/app/dashboard"} className="text-[15px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                {isSuperAdmin ? 'Panel' : 'Dashboard'}
            </Link>

            {role === 'DEALER_ADMIN' && (
                <Link href="/app/team" className="text-[15px] font-semibold text-slate-500 hover:text-slate-900 transition-colors">
                    Team
                </Link>
            )}

            {!isSuperAdmin && (
                <>
                    {/* Vehicles Dropdown */}
                    {hasPermission('vehicles') && (
                        <div
                            className="relative h-20 flex items-center"
                            onMouseEnter={handleVehiclesEnter}
                            onMouseLeave={handleVehiclesLeave}
                        >
                            <button className={`flex items-center gap-1.5 text-[15px] font-semibold transition-colors ${isVehiclesOpen ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}>
                                Vehicles
                                <svg className={`w-4 h-4 transition-transform ${isVehiclesOpen ? 'rotate-180 text-indigo-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isVehiclesOpen && (
                                <div className="absolute top-20 left-1/2 -translate-x-3/4 w-[800px] bg-white rounded-3xl shadow-[0_20px_70px_-10px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex">
                                        {/* Main Content Areas */}
                                        <div className="flex-1 grid grid-cols-2 p-8 gap-8 border-r border-slate-50">
                                            {/* Column 1 */}
                                            <div className="space-y-6">
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                                                    title="Browse Vehicles"
                                                    description="View your vehicles."
                                                    href="/app/vehicles"
                                                />
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><rect x="4" y="3" width="16" height="18" rx="2" strokeWidth={1.5}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h2m0 0h0m2 0h4M8 11h8M8 15h5" /></svg>}
                                                    title="Vehicle Prices"
                                                    description="Set vehicle pricing."
                                                    href="/app/vehicles?view=pricing"
                                                />
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" /></svg>}
                                                    title="Stock Book"
                                                    description="Track your stock."
                                                    href="/app/vehicles/stock-book"
                                                />
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                                                    title="Quick Check"
                                                    description="Review a vehicle."
                                                    onClick={() => { setIsVehiclesOpen(false); openQuickCheck(); }}
                                                />
                                            </div>
                                            {/* Column 2 */}
                                            <div className="space-y-6">
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>}
                                                    title="Add Vehicle"
                                                    description="Add in stock vehicle."
                                                    onClick={() => { setIsVehiclesOpen(false); openAddVehicle(); }}
                                                />
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>}
                                                    title="Advertising"
                                                    description="Manage vehicle ads."
                                                    href="/app/vehicles?view=advertising"
                                                />
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
                                                    title="Job Boards"
                                                    description="Manage jobs & tasks."
                                                    href="/app/tasks"
                                                />
                                            </div>
                                        </div>

                                        {/* Status & Tools Sidebar */}
                                        <div className="w-64 bg-slate-50/50 p-8 space-y-8">
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-800 mb-4">Vehicles</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <SubLink icon="🛡️" label="Reserved" href="/app/vehicles?status=Reserved" />
                                                    <SubLink icon="🌐" label="To Order" href="/app/vehicles?stockType=To+Order" />
                                                    <SubLink icon="🔧" label="Customer" href="/app/vehicles?vehicleType=customer" />
                                                    <SubLink icon="👥" label="Courtesy" href="/app/vehicles?vehicleType=courtesy" />
                                                    <SubLink icon="🔑" label="Sold" href="/app/vehicles?status=Sold" />
                                                    <SubLink icon="✅" label="Complete" href="/app/vehicles?status=Complete" />
                                                    <SubLink icon="➕" label="Latest" href="/app/vehicles?special=latest" />
                                                    <SubLink icon="⏱️" label="Overage" href="/app/vehicles?special=overage" />
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-800 mb-4">Tools & Resources</h3>
                                                <div className="space-y-3">
                                                    <SubLink icon="↘️" label="Import" />
                                                    <SubLink icon="☑️" label="Checklists" href="/app/vehicles/checklists" />
                                                    <SubLink icon="⚙️" label="Settings" href="/app/integrations" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sales Dropdown */}
                    {hasPermission('sales') && (
                        <div
                            className="relative h-20 flex items-center"
                            onMouseEnter={handleSalesEnter}
                            onMouseLeave={handleSalesLeave}
                        >
                            <button className={`flex items-center gap-1.5 text-[15px] font-semibold transition-colors ${isSalesOpen ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}>
                                Sales
                                <svg className={`w-4 h-4 transition-transform ${isSalesOpen ? 'rotate-180 text-indigo-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isSalesOpen && (
                                <div className="absolute top-20 left-1/2 -translate-x-3/4 w-[800px] bg-white rounded-3xl shadow-[0_20px_70px_-10px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex">
                                        <div className="flex-1 grid grid-cols-2 p-8 gap-8 border-r border-slate-50">
                                            <div className="space-y-6">
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
                                                    title="Leads & Chat"
                                                    description="Customer communication."
                                                    href="/app/sales/leads"
                                                />
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                                                    title="Contacts"
                                                    description="Customers & suppliers."
                                                    href="/app/sales/contacts"
                                                />
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                                                    title="Orders"
                                                    description="Create proposals."
                                                    href="/app/sales/orders"
                                                />
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                                                    title="Documents"
                                                    description="Organise signatures."
                                                    href="/app/sales/documents"
                                                />
                                            </div>
                                            <div className="space-y-6">
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>}
                                                    title="Deals"
                                                    description="Build & manage sales."
                                                    href="/app/sales/deals"
                                                />
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
                                                    title="Invoices"
                                                    description="Manage invoices."
                                                    href="/app/sales/invoices"
                                                />
                                                <MenuAction
                                                    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                                                    title="Purchases"
                                                    description="Manage purchases."
                                                    href="/app/sales/purchases"
                                                />
                                            </div>
                                        </div>

                                        <div className="w-64 bg-slate-50/50 p-8 space-y-8">
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-800 mb-4">Create</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <SubLink icon="💬" label="Lead" />
                                                    <SubLink icon="📄" label="Invoice" />
                                                    <SubLink icon="🤝" label="Deal" />
                                                    <SubLink icon="📦" label="Order" />
                                                    <SubLink icon="👤" label="Contact" />
                                                    <SubLink icon="🛒" label="Purchase" />
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-800 mb-4">Tools</h3>
                                                <div className="space-y-3">
                                                    <SubLink icon="⏳" label="Pending Purchases" />
                                                    <SubLink icon="𝒒" label="Currency Converter" />
                                                    <SubLink icon="🏷️" label="Products" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </nav>
    );
}

function MenuAction({
    icon,
    title,
    description,
    href,
    onClick,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    href?: string;
    onClick?: () => void;
}) {
    const inner = (
        <>
            <div className="w-10 h-10 bg-slate-50 ring-1 ring-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:ring-indigo-600 transition-all shadow-sm">
                {icon}
            </div>
            <div>
                <h4 className="text-[13px] font-black text-slate-700 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{title}</h4>
                <p className="text-[11px] text-slate-400 font-bold leading-tight mt-0.5">{description}</p>
            </div>
        </>
    );
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className="group flex items-center gap-4 p-3 -m-3 rounded-2xl hover:bg-slate-50 transition-all duration-200 w-full text-left">
                {inner}
            </button>
        );
    }
    return (
        <Link href={href!} className="group flex items-center gap-4 p-3 -m-3 rounded-2xl hover:bg-slate-50 transition-all duration-200">
            {inner}
        </Link>
    );
}

function SubLink({ icon, label, href = "#" }: { icon: string, label: string, href?: string }) {
    return (
        <Link href={href} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors group">
            <span className="text-xs grayscale group-hover:grayscale-0 transition-all">{icon}</span>
            <span className="text-[11px] font-bold">{label}</span>
        </Link>
    );
}
