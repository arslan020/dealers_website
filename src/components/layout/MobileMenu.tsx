'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAddVehicle } from '@/components/vehicles/AddVehicleProvider';

interface MobileMenuProps {
    role: string;
    permissions?: any;
}

export function MobileMenu({ role, permissions }: MobileMenuProps) {
    const { openAddVehicle } = useAddVehicle();
    const [isOpen, setIsOpen] = useState(false);

    const isSuperAdmin = role === 'SUPER_ADMIN';
    const isDealerAdmin = role === 'DEALER_ADMIN';

    const hasPermission = (key: string) => {
        if (isSuperAdmin || isDealerAdmin) return true;
        return permissions?.[key] !== false;
    };

    const closeMenu = () => setIsOpen(false);

    return (
        <div className="lg:hidden">
            <button
                onClick={() => setIsOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-500 border border-slate-50 active:bg-slate-100 transition-all shadow-sm"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
            </button>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] animate-in fade-in duration-200"
                    onClick={closeMenu}
                />
            )}

            {/* Sidebar Drawer */}
            <div className={`fixed top-0 right-0 h-full w-[280px] bg-white z-[101] shadow-2xl transition-transform duration-300 ease-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900">Menu</span>
                    <button onClick={closeMenu} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto h-[calc(100%-80px)]">
                    <Link
                        href={isSuperAdmin ? "/app/admin" : "/app/dashboard"}
                        onClick={closeMenu}
                        className="block py-3 px-4 rounded-xl text-blue-600 font-bold bg-blue-50/50"
                    >
                        {isSuperAdmin ? 'Panel' : 'Dashboard'}
                    </Link>

                    {role === 'DEALER_ADMIN' && (
                        <Link
                            href="/app/team"
                            onClick={closeMenu}
                            className="block py-3 px-4 rounded-xl text-slate-600 font-bold hover:bg-slate-50"
                        >
                            Team
                        </Link>
                    )}

                    {!isSuperAdmin && hasPermission('vehicles') && (
                        <div className="space-y-1">
                            <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicles</div>
                            <MobileLink href="/app/vehicles" label="Browse Vehicles" onClick={closeMenu} />
                            <MobileLink href="/app/vehicles/check" label="Quick Check" onClick={closeMenu} />
                            <button
                                type="button"
                                onClick={() => { openAddVehicle(); closeMenu(); }}
                                className="block w-full text-left py-2 px-4 rounded-lg text-sm text-slate-600 font-bold hover:bg-slate-50 active:text-blue-600 transition-colors"
                            >
                                Add Vehicle
                            </button>
                            <MobileLink href="/app/tasks" label="Job Boards" onClick={closeMenu} />
                        </div>
                    )}

                    {!isSuperAdmin && hasPermission('sales') && (
                        <div className="space-y-1">
                            <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sales</div>
                            <MobileLink href="/app/crm" label="Leads & Chat" onClick={closeMenu} />
                            <MobileLink href="/app/contacts" label="Contacts" onClick={closeMenu} />
                            <MobileLink href="/app/dashboard" label="Orders" onClick={closeMenu} />
                            <MobileLink href="/app/dashboard" label="Documents" onClick={closeMenu} />
                            <MobileLink href="/app/dashboard" label="Deals" onClick={closeMenu} />
                            <MobileLink href="/app/dashboard" label="Invoices" onClick={closeMenu} />
                            <MobileLink href="/app/dashboard" label="Purchases" onClick={closeMenu} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function MobileLink({ href, label, onClick }: { href: string, label: string, onClick: () => void }) {
    return (
        <Link 
            href={href} 
            onClick={onClick} 
            className="block py-2 px-4 rounded-lg text-sm text-slate-600 font-bold hover:bg-slate-50 active:text-blue-600 transition-colors"
        >
            {label}
        </Link>
    );
}
