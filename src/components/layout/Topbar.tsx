import { getSession } from '@/lib/session';
import { UserProfile } from './UserProfile';
import { DashboardNav } from './DashboardNav';
import { MobileMenu } from './MobileMenu';
import { NavActions } from './NavActions';
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
            <div className="flex items-center gap-6">
                <DashboardNav role={role} permissions={permissions} />

                <div className="flex items-center gap-2">
                    <NavActions />
                    <UserProfile name={name} role={role} initials={initials} />
                </div>
                
                {/* Mobile Menu Trigger */}
                <div className="lg:hidden">
                    <MobileMenu role={role} permissions={permissions} />
                </div>
            </div>
        </header>
    );
}
