'use client';

import Link from 'next/link';
import { PublicHeader } from '@/components/layout/PublicHeader';

export default function TryFreePage() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <PublicHeader />
            <main className="flex-1 flex items-center justify-center p-6 lg:p-12">
                <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">

                    {/* Left Column: Text Content */}
                    <div className="pt-8">
                        <h1 className="text-3xl font-bold text-slate-900 mb-4">Try For Free</h1>
                        <p className="text-slate-600 mb-8 max-w-sm">
                            Begin exploring AutoDesk - no payment details are required!
                        </p>

                        <h2 className="text-xl font-bold text-slate-900 mb-6">No Commitments!</h2>

                        <ul className="space-y-5 mb-10">
                            <li className="flex gap-3">
                                <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">All membership plans include a 30-day free trial with no commitments.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">There are no set-up fees, minimum terms, or cancellation fees.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">Payment details won't be required until the end of your free trial.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="mt-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">You can upgrade, downgrade or cancel your membership plan at any time.</p>
                            </li>
                        </ul>

                        <h2 className="text-lg font-bold text-slate-900 mb-2">Have Questions?</h2>
                        <p className="text-slate-600 text-sm">
                            Please <a href="#" className="font-semibold text-blue-600 hover:text-blue-700">contact us</a> if you have any questions about AutoDesk.
                        </p>
                    </div>

                    {/* Right Column: Sign Up Form */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-emerald-500 px-6 py-5">
                            <h2 className="text-lg font-bold text-white">Start Your 30-Day Free Trial</h2>
                        </div>
                        <div className="p-6 sm:p-8 space-y-6">
                            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact name</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                                    <input
                                        type="email"
                                        placeholder="you@domain.com"
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone number (inc. country code)</label>
                                    <div className="flex">
                                        <select className="px-3 py-2.5 bg-slate-50 border border-slate-200 border-r-0 text-sm rounded-l-lg focus:outline-none text-slate-700">
                                            <option>+44</option>
                                            <option>+1</option>
                                        </select>
                                        <input
                                            type="tel"
                                            placeholder="7000123123"
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 flex items-start gap-3">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="terms"
                                            type="checkbox"
                                            className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500"
                                        />
                                    </div>
                                    <label htmlFor="terms" className="text-xs text-slate-500 leading-relaxed">
                                        I agree to the <a href="#" className="text-blue-600 hover:text-blue-700">terms of service</a>, and understand I will receive account related communications.
                                    </label>
                                </div>

                                <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-sm text-slate-500">
                                        Already have an account? <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700">Log-In</Link>
                                    </span>
                                    <button
                                        type="button"
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        Sign-Up
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
