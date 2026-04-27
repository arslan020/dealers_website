import { getSession } from '@/lib/session';
import { UserProfile } from './UserProfile';
import { DashboardNav } from './DashboardNav';
import { MobileMenu } from './MobileMenu';
import connectToDatabase from '@/lib/db';
import User from '@/models/User';
import Link from 'next/link';

interface TopbarProps {
    role: string;
}

export async function Topbar({ role }: TopbarProps) {
    const session = await getSession();
    const name = session?.name ?? 'User';
    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    // Live permission check for employees to bypass JWT staleness
    let permissions = session?.permissions;
    if (session?.role === 'EMPLOYEE') {
        await connectToDatabase();
        const user = await User.findById(session.userId).select('permissions').lean();
        if (user) {
            permissions = user.permissions;
        }
    }

    return (
        <header className="h-[60px] lg:h-[80px] bg-white border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 lg:px-10 shrink-0">
            {/* Left: Logo */}
            <div className="flex items-center gap-8">
                <Link href="/app/dashboard" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <span className="hidden sm:inline text-2xl font-black text-slate-900 tracking-tight">AutoDesk</span>
                </Link>
            </div>

            {/* Right: Actions & Nav */}
            <div className="flex items-center gap-8">
                <DashboardNav role={role} permissions={permissions} />

                <div className="flex items-center gap-3">
                    <div className="w-px h-6 bg-slate-100 mx-1"></div>

                    {/* Notifications */}
                    <button className="relative w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all group">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-white"></span>
                    </button>

                    {/* Help */}
                    <button className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                </div>

                <div className="w-px h-8 bg-slate-100"></div>

                {/* User info Dropdown */}
                <UserProfile name={name} role={role} initials={initials} />
                
                {/* Mobile Menu Trigger */}
                <div className="lg:hidden">
                    <MobileMenu role={role} permissions={permissions} />
                </div>
            </div>
        </header>
    );
}
