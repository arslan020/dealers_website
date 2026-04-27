import Link from 'next/link';

export function PublicHeader() {
    return (
        <header className="px-6 lg:px-10 py-4 flex items-center justify-between border-b border-slate-200 sticky top-0 bg-white z-10 w-full">
            {/* Logo */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2.5-2.5" />
                    </svg>
                </div>
                <Link href="/" className="text-lg font-bold text-slate-900">AutoDesk</Link>
            </div>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-6">
                <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Home</Link>
                <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
                <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
                <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Watch Demo</a>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
                <Link href="/try-free" className="text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg transition-colors shadow-sm">
                    Try Free
                </Link>
                <Link href="/login" className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg transition-colors shadow-sm">
                    Log-In
                </Link>
            </div>
        </header>
    );
}
