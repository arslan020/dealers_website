'use client';

export default function AnalyticsPage() {
    return (
        <div className="w-full py-10 px-4 sm:px-10">
            <div className="mb-10">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Vehicle Analytics</h1>
                <p className="text-slate-500 font-medium mt-1">Deep insights into your inventory performance and market valuations.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm">
                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                        Stock Value Trends
                    </h3>
                    <div className="h-64 bg-slate-50 rounded-3xl flex items-center justify-center border-2 border-dashed border-slate-100 relative group cursor-pointer overflow-hidden">
                        <div className="relative z-10 text-center">
                            <p className="text-slate-400 font-bold mb-2">Connect AutoTrader Analytics</p>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg shadow-sm">Coming Soon</span>
                        </div>
                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors"></div>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-sm">
                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        Market Comparison
                    </h3>
                    <div className="h-64 bg-slate-50 rounded-3xl flex items-center justify-center border-2 border-dashed border-slate-100 relative group cursor-pointer overflow-hidden">
                        <div className="relative z-10 text-center">
                            <p className="text-slate-400 font-bold mb-2">Synchronize Real-time Prices</p>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg shadow-sm">Coming Soon</span>
                        </div>
                        <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors"></div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white shadow-2xl overflow-hidden relative">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1">
                        <h2 className="text-2xl font-black mb-4">Intelligent Valuations</h2>
                        <p className="text-slate-400 font-medium leading-relaxed">Our AI analyzes thousands of local market entries to give you the most accurate valuation for every vehicle in your stock. Buy smarter, sell faster.</p>
                    </div>
                    <button className="px-10 py-5 bg-white text-slate-900 font-black rounded-2xl shadow-xl transition-all uppercase tracking-widest text-sm hover:bg-indigo-50 active:scale-95 whitespace-nowrap">Unlock Pro Features</button>
                </div>
                {/* Visual Flair */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -mr-48 -mt-48 blur-3xl"></div>
            </div>
        </div>
    );
}
