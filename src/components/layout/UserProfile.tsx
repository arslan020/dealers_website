'use client';

import { useState, useEffect } from 'react';

interface UserProfileProps {
    name: string;
    role: string;
    initials: string;
}

export function UserProfile({ name, role, initials }: UserProfileProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Lock scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    }

    const roleLabel = role === 'SUPER_ADMIN' ? 'Administrator' :
        role === 'DEALER_ADMIN' ? 'Manager' :
            'Staff Account';

    return (
        <>
            {/* Profile Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-3 pl-1 hover:opacity-80 transition-opacity focus:outline-none"
            >
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center p-0.5 border-2 border-slate-200">
                    <div className="w-full h-full rounded-full bg-slate-300 flex items-center justify-center text-slate-100">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                    </div>
                </div>
            </button>

            {/* Backdrop Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[100] transition-opacity duration-300"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Drawer Content */}
            <div
                className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white shadow-2xl z-[101] transform transition-transform duration-300 ease-out border-l border-slate-100 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header: User Info */}
                <div className="px-6 sm:px-8 py-6 sm:py-8 flex items-center justify-between">
                    <div className="flex items-center gap-4 sm:gap-5">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-100 p-0.5 border-2 border-slate-200">
                            <div className="w-full h-full rounded-full bg-slate-300 flex items-center justify-center text-slate-50">
                                <svg className="w-10 h-10 sm:w-12 sm:h-12" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-[20px] font-bold text-slate-900 leading-tight">{name}</h3>
                            <p className="text-sm sm:text-[15px] text-slate-500 font-medium">{roleLabel}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-2"
                    >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="h-px bg-slate-100 mx-8"></div>

                {/* Main Scrollable Area */}
                <div className="flex-1 overflow-y-auto">
                    {/* Alerts Section */}
                    <div className="px-6 sm:px-8 py-6 sm:py-8">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-base sm:text-[18px] font-bold text-slate-800">Alerts</h4>
                            <button className="text-[12px] sm:text-[13px] text-slate-400 font-semibold hover:text-indigo-600 transition-colors">[Clear All]</button>
                        </div>
                        <p className="text-sm sm:text-[14px] text-slate-400 italic">No alerts.</p>
                    </div>

                    <div className="h-px bg-slate-50 mx-8"></div>

                    {/* Your Account Section */}
                    <div className="px-6 sm:px-8 py-6 sm:py-8">
                        <h4 className="text-base sm:text-[18px] font-bold text-slate-800 mb-6">Your Account</h4>
                        <div className="grid grid-cols-2 gap-3 sm:gap-5">
                            <AccountTile
                                icon={<svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                                label="Profile"
                            />
                            <AccountTile
                                icon={<svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                                label="Security"
                            />
                            <AccountTile
                                icon={<svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                                label="Notifications"
                            />
                            <AccountTile
                                icon={<svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                                label="Billing"
                            />
                            <AccountTile
                                icon={<svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                label="Referrals"
                            />
                            <AccountTile
                                icon={<svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                                label="Apps"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/30">
                    <button
                        onClick={handleLogout}
                        className="flex flex-col items-center gap-2 py-6 sm:py-8 hover:bg-slate-100 transition-colors border-r border-slate-100 group"
                    >
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="text-sm sm:text-[15px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Log-Out</span>
                    </button>
                    <button className="flex flex-col items-center gap-2 py-6 sm:py-8 hover:bg-slate-100 transition-colors group">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className="text-sm sm:text-[15px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Support</span>
                    </button>
                </div>
            </div>
        </>
    );
}

function AccountTile({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <button className="flex flex-col items-center justify-center p-4 sm:p-8 border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/50 transition-all group">
            <span className="text-slate-400 group-hover:text-indigo-600 transition-colors mb-2 sm:mb-3">
                {icon}
            </span>
            <span className="text-sm sm:text-[15px] font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">
                {label}
            </span>
        </button>
    );
}
