import Link from 'next/link';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { Typewriter } from '@/components/ui/Typewriter';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-white flex flex-col">
            <PublicHeader />

            {/* Hero */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight h-[120px] sm:h-auto flex flex-col items-center justify-center">
                        <Typewriter words={['The Complete', 'Revolutionary', 'Automotive']} />
                        <span>Dealership Platform</span>
                    </h1>
                    <p className="text-lg text-slate-500 mb-10 max-w-xl mx-auto">
                        Everything you need to manage inventory, streamline sales, and grow your modern automotive dealership.
                    </p>
                </div>
            </main>
        </div>
    );
}
