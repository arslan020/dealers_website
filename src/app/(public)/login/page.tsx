'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isExpired = searchParams.get('expired') === 'true';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isExpired) {
            setError('Your session has expired. Please sign in again.');
        }
    }, [isExpired]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok || !data.ok) {
                setError(data.error?.message || 'Login failed. Please try again.');
                setLoading(false);
                return;
            }

            // Redirect based on role
            if (data.role === 'SUPER_ADMIN') {
                router.push('/app/admin');
            } else {
                router.push('/app/dashboard');
            }
        } catch {
            setError('Something went wrong. Please try again.');
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col md:flex-row font-sans">
            {/* Left Panel - Dark Blue */}
            <div className="w-full md:w-[40%] bg-[#2a2e4e] text-white p-8 md:p-12 flex flex-col relative overflow-hidden">
                {/* Background Car Icon (Watermark) */}
                <div className="absolute -bottom-16 -left-16 opacity-[0.05] pointer-events-none">
                    <svg className="w-96 h-96" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                    </svg>
                </div>

                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 mb-auto z-10 hover:opacity-80 transition-opacity">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2.5-2.5" />
                    </svg>
                    <span className="text-xl font-bold tracking-tight">AutoDesk</span>
                </Link>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full md:w-[60%] bg-white flex flex-col justify-center items-center p-8 md:p-12 relative min-h-[600px]">
                <div className="w-full max-w-md">
                    <h1 className="text-3xl font-semibold text-slate-800 mb-10">Welcome</h1>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm text-slate-600 mb-2">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400"
                                placeholder="you@email.com"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm text-slate-600">Password</label>
                                <a href="#" className="text-xs text-blue-500 hover:text-blue-600">Forgot Password?</a>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 pr-12"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3.5 px-4 rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Logging in...' : 'Log-In'}
                            </button>
                        </div>
                    </form>

                    <p className="mt-8 text-sm text-slate-500">
                        Don't have an account? <Link href="/try-free" className="text-blue-500 hover:text-blue-600 font-medium">Sign-Up</Link>
                    </p>

                    {/* App Store Badges */}
                    <div className="mt-16 flex flex-row items-center justify-center gap-4">
                        <div className="h-10 w-[120px] bg-black rounded-lg text-white flex items-center justify-center p-2 cursor-pointer border border-slate-200">
                            <div className="flex items-center gap-2">
                                <svg viewBox="0 0 384 512" className="w-5 h-5 fill-current">
                                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                                </svg>
                                <div>
                                    <div className="text-[8px] leading-none mb-0.5 opacity-80">Download on the</div>
                                    <div className="text-xs font-semibold leading-none">App Store</div>
                                </div>
                            </div>
                        </div>
                        <div className="h-10 w-[120px] bg-black rounded-lg text-white flex items-center justify-center p-2 cursor-pointer border border-slate-200">
                            <div className="flex items-center gap-2">
                                <svg viewBox="0 0 512 512" className="w-5 h-5 fill-current">
                                    <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
                                </svg>
                                <div>
                                    <div className="text-[8px] leading-none mb-0.5 opacity-80">GET IT ON</div>
                                    <div className="text-xs font-semibold leading-none">Google Play</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Floating Chat Icon */}
                <div className="absolute bottom-6 right-6 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-emerald-600 transition-colors">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>}>
            <LoginForm />
        </Suspense>
    );
}
