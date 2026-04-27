const fs = require('fs');

const path = 'c:/Users/eesa/OneDrive/Desktop/car dealer software/src/app/app/vehicles/[id]/page.tsx';
let source = fs.readFileSync(path, 'utf8');

let topPart = source.split('    /* ─── Render ───────────────────────────────────────────────────────────── */')[0];

const restOfSource = source.substring(source.indexOf('    /* ─── Render ───────────────────────────────────────────────────────────── */'));

const getSection = (marker1, marker2) => {
    try {
        const startIdx = restOfSource.indexOf(marker1);
        if (startIdx === -1) return '';
        let endIdx = restOfSource.length;
        if (marker2) {
            endIdx = restOfSource.indexOf(marker2, startIdx);
            if (endIdx === -1) endIdx = restOfSource.length;
        }
        return restOfSource.substring(startIdx, endIdx);
    } catch(e) { return ''; }
}

const tabVehicle = getSection("{/* ═══ VEHICLE TAB ══════════════════════════════════════════ */}", "{/* ═══ IMAGES TAB ══════════════════════════════════════════ */}");
const tabImages = getSection("{/* ═══ IMAGES TAB ══════════════════════════════════════════ */}", "{/* ═══ OPTIONS TAB (Description & Features) ════════════════ */}");
const tabOptions = getSection("{/* ═══ OPTIONS TAB (Description & Features) ════════════════ */}", "{/* ═══ CHANNELS TAB ═════════════════════════════════════════ */}");
const tabSales = getSection("{/* ═══ CHANNELS TAB ═════════════════════════════════════════ */}", "{/* ═══ VRM LOOKUP TAB ══════════════════════════════════════ */}");
const tabVehicleCheck = getSection("{/* ═══ VRM LOOKUP TAB ══════════════════════════════════════ */}", "{/* ═══ LEADS & DEALS TAB ════════════════════════════════════ */}");

let tabLeads = getSection("{/* ═══ LEADS & DEALS TAB ════════════════════════════════════ */}", null);
const leadsEndIdx = tabLeads.lastIndexOf("                )}");
if(leadsEndIdx !== -1) {
    tabLeads = tabLeads.substring(0, leadsEndIdx + 18);
}

const originalRender = `    /* ─── Render ───────────────────────────────────────────────────────────── */
    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} />

            {/* ─── Main Layout structure: Sidebar + Content ──────────────── */}
            <div className="flex max-w-[1600px] mx-auto min-h-screen">
                
                {/* ─── Sidebar Navigation ──────────────────────────────────── */}
                <aside className="w-64 shrink-0 bg-white border-r border-slate-200 py-6 hidden md:block">
                    {/* VRM Badge in Sidebar */}
                    <div className="mb-6 px-4">
                        <div className="bg-[#FFD700] rounded-md border border-slate-900 flex items-stretch overflow-hidden h-12 shadow-sm">
                            <div className="bg-[#003399] w-8 flex items-center justify-center flex-col text-white font-black text-[8px] leading-none px-1">
                                <div>🇬🇧</div>
                                <div className="mt-4">UK</div>
                            </div>
                            <div className="flex-1 flex items-center justify-center font-black text-2xl text-slate-900 tracking-widest font-mono">
                                {(vehicle.vrm || vehicle.registration || vehicle.vehicle?.registration || 'UNREG').toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <nav className="space-y-0.5 px-2">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all \${
                                    activeTab === tab.id
                                        ? 'bg-[#F0F4F8] text-indigo-700 border-l-4 border-indigo-600 font-bold'
                                        : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'
                                }\`}
                            >
                                <span className={\`text-base \${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}\`}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </aside>

            {/* ─── Content ────────────────────────────────────────────────── */}
            <main className="flex-1 bg-[#F8FAFC]">
                {/* Breadcrumb Header */}
                <header className="px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-slate-400">
                        <a href="/app/vehicles" className="hover:text-indigo-600 transition-colors">
                            Vehicles
                        </a>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-900">{vehicle.status}</span>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-900">{(vehicle.vrm || vehicle.registration || vehicle.vehicle?.registration || 'UNREG').toUpperCase()}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-slate-400 hover:text-slate-700 transition-colors bg-white px-3 py-1.5 rounded-md border border-slate-200">
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[7px]">?</span>
                            Help
                        </button>
                    </div>
                </header>

                <div className="p-8">
                    {/* Title & Status Bar inside Main Area matching MotorDesk */}
                    <div className="mb-6">
                        <h2 className="text-sm font-semibold text-slate-800 mb-3">Overview</h2>
                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-start justify-between relative">
                            {/* Top Right: Status & Save Controls */}
                            <div className="absolute top-4 right-6 flex gap-3">
                                <select
                                    value={vehicle.status}
                                    onChange={e => handleStatusChange(e.target.value)}
                                    className="text-xs font-semibold text-slate-500 border border-slate-200 rounded px-2 py-1.5 hover:bg-slate-50 outline-none cursor-pointer"
                                    title="Vehicle Status"
                                >
                                    {LIFECYCLE_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <button 
                                    onClick={handleSaveVehicleFields}
                                    disabled={saving}
                                    className="text-xs font-semibold text-white bg-[#4D7CFF] rounded px-4 py-1.5 hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? 'Saving...' : 'Save Updates'}
                                </button>
                            </div>

                            {/* Left Side: Vehicle Info */}
                            <div className="flex items-center gap-6 mt-2">
                                <div className="w-16 h-16 rounded-full border border-slate-200 flex items-center justify-center bg-white shadow-sm shrink-0 text-3xl text-slate-300 overflow-hidden">
                                     {vehicle.make.toLowerCase().includes('audi') ? (
                                         <span className="font-serif">🚘</span>
                                     ) : '🚗'}
                                </div>
                                <div>
                                    <h1 className="text-[15px] font-semibold text-slate-800 tracking-tight">{vehicle.make} {vehicle.model} {vehicle.derivative}</h1>
                                    <div className="flex items-center gap-2 mt-2 text-xs font-medium text-slate-500">
                                        <span>{vehicle.year}</span>
                                        <span className="text-slate-300">|</span>
                                        <span>{vehicle.mileage ? \`\${vehicle.mileage.toLocaleString()} miles\` : '0 miles'}</span>
                                        <span className="text-slate-300">|</span>
                                        <span>{vehicle.fuelType || 'Unknown'}</span>
                                        <span className="text-slate-300">|</span>
                                        <span>{vehicle.transmission || 'Unknown'}</span>
                                        <span className="text-slate-300">|</span>
                                        <span className="text-slate-800">£{vehicle.price?.toLocaleString() || 'POA'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Quick Stats */}
                            <div className="flex items-center gap-3 mt-8 mr-64">
                                <div className="bg-[#F8FAFC] px-6 py-4 rounded-lg flex flex-col items-center justify-center min-w-[110px] border border-slate-100">
                                    <span className="text-[10px] font-semibold text-slate-500 mb-1.5">Added</span>
                                    <span className="text-[13px] font-semibold text-slate-800 whitespace-nowrap">{vehicle.createdAt ? formatDistanceToNow(new Date(vehicle.createdAt)) : 'N/A'}</span>
                                </div>
                                <div className="bg-[#F8FAFC] px-6 py-4 rounded-lg flex flex-col items-center justify-center min-w-[110px] border border-slate-100">
                                    <span className="text-[10px] font-semibold text-slate-500 mb-1.5">For Sale</span>
                                    <span className="text-[13px] font-semibold text-slate-800 whitespace-nowrap">{vehicle.createdAt ? formatDistanceToNow(new Date(vehicle.createdAt)) : 'N/A'}</span>
                                </div>
                                <div className="bg-[#F8FAFC] px-6 py-4 rounded-lg flex flex-col items-center justify-center min-w-[110px] border border-slate-100">
                                    <span className="text-[10px] font-semibold text-slate-500 mb-1.5">Price Change</span>
                                    <span className="text-[13px] font-semibold text-slate-800 whitespace-nowrap">{vehicle.updatedAt ? formatDistanceToNow(new Date(vehicle.updatedAt)) : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Center / Left Column (wider) */}
                        <div className="lg:col-span-2 space-y-6">
                            
                            {/* Sell Vehicle Banner */}
                            <div className="bg-[#F0FAF5] border border-[#BDE7D3] rounded-xl p-5 flex items-center justify-between shadow-sm">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-3 text-[#22A769] font-semibold text-[15px]">
                                        <span className="text-xl leading-none -mt-1">↩</span> Sell Vehicle
                                    </div>
                                    <span className="text-[13px] text-[#22A769]/80 mt-1 ml-7">This vehicle is for sale</span>
                                </div>
                                <button className="bg-[#4D7CFF] text-white text-sm font-semibold px-8 py-2.5 rounded hover:bg-blue-600 transition-colors">Sell Vehicle</button>
                            </div>

                            {/* Advert Suggestions */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden">
                                <h3 className="text-[15px] font-semibold text-slate-800 mb-5 pb-5 border-b border-slate-100">Advert Suggestions</h3>
                                <ul className="space-y-6 pl-2">
                                    <li className="flex items-start gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#4D7CFF] mt-2 shrink-0"></div>
                                        <div>
                                            <div className="text-[14px] font-semibold text-[#4D7CFF] hover:underline cursor-pointer">Add Interior Details</div>
                                            <div className="text-[13px] text-slate-500 mt-1">Interior details help customers find their perfect vehicle more easily.</div>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#4D7CFF] mt-2 shrink-0"></div>
                                        <div>
                                            <div className="text-[14px] font-semibold text-[#4D7CFF] hover:underline cursor-pointer">Add a Video</div>
                                            <div className="text-[13px] text-slate-500 mt-1">Adding a video will help sell your vehicle faster.</div>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#4D7CFF] mt-2 shrink-0"></div>
                                        <div>
                                            <div className="text-[14px] font-semibold text-[#4D7CFF] hover:underline cursor-pointer">Add ULEZ Compliance</div>
                                            <div className="text-[13px] text-slate-500 mt-1">ULEZ compliance data is important to help customers find the right vehicle.</div>
                                        </div>
                                    </li>
                                </ul>
                            </div>

                            {/* Performance Line Chart Area */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                <div className="flex justify-between items-center mb-10 pb-4 border-b border-transparent">
                                    <h3 className="text-[15px] font-semibold text-slate-800">Performance</h3>
                                    <select className="text-xs text-slate-500 border border-slate-200 rounded-md px-3 py-1.5 outline-none font-semibold appearance-none bg-white">
                                        <option>Past Week ▾</option>
                                    </select>
                                </div>
                                {/* Simple flat chart placeholder */}
                                <div className="h-44 border-l border-b border-slate-200 relative flex flex-col justify-between pl-4 mb-2 ml-4">
                                    <span className="absolute -left-6 -top-2 text-[11px] font-semibold text-slate-400">2</span>
                                    <span className="absolute -left-6 top-1/2 -mt-2 text-[11px] font-semibold text-slate-400">1</span>
                                    <span className="absolute -left-6 -bottom-2 text-[11px] font-semibold text-slate-400">0</span>
                                    
                                    <div className="absolute inset-0 top-1/2 mt-1 w-full h-[2px] bg-[#4D7CFF]"></div>
                                    
                                    <div className="flex w-full justify-between absolute -bottom-6 left-0 px-2 text-[9px] font-bold text-slate-400">
                                        <span>18/03/2026</span>
                                        <span>19/03/2026</span>
                                        <span>20/03/2026</span>
                                        <span>21/03/2026</span>
                                        <span>22/03/2026</span>
                                        <span>23/03/2026</span>
                                        <span>24/03/2026</span>
                                    </div>
                                </div>
                                
                                <div className="flex justify-center gap-6 mt-10 mb-6 border-b border-slate-100 pb-8 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-blue-600"></div> Leads</div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-indigo-500"></div> Appointments</div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-sky-400"></div> Website Searches</div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-purple-400"></div> Website Views</div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-orange-400"></div> Website Other</div>
                                </div>

                                {/* Mini data table */}
                                <div className="grid grid-cols-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider py-3">
                                    <div className="flex items-center gap-2">DATE <span className="text-[8px] opacity-60">▼</span></div>
                                    <div className="flex items-center gap-2">LEADS <span className="text-[8px] opacity-60">⇅</span></div>
                                    <div className="flex items-center gap-2">APPOINTMENTS <span className="text-[8px] opacity-60">⇅</span></div>
                                    <div className="flex items-center gap-2">WEBSITE SEARCHES <span className="text-[8px] opacity-60">⇅</span></div>
                                    <div className="flex items-center gap-2">WEBSITE VIEWS <span className="text-[8px] opacity-60">⇅</span></div>
                                </div>
                                <div className="grid grid-cols-5 text-[13px] font-semibold text-slate-600 py-4 border-t border-slate-100">
                                    <div>{(new Date()).toLocaleDateString('en-GB')}</div>
                                    <div>{metrics?.lastWeek?.advertViews ? Math.floor(metrics.lastWeek.advertViews * 0.05) : 0}</div>
                                    <div>0</div>
                                    <div>{metrics?.lastWeek?.searchViews || 0}</div>
                                    <div>{metrics?.lastWeek?.advertViews || 0}</div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column (narrower widgets) */}
                        <div className="space-y-6">
                            {[ 
                                { title: 'Leads', btn: 'Create Lead', extra: [{id: '#269', status: 'Inquiry', rel: '11 days ago', st: 'Closed'}, {id: '#270', status: 'Inquiry', rel: '12 days ago', st: 'Closed'}, {id: '#271', status: 'Inquiry', rel: 'Last month', st: 'Closed'}] }, 
                                { title: 'Tags', btn: 'Edit Tags', select: 'Select Tags' }, 
                                { title: 'Deals', btn: 'Create Deal', extra: [{id: '#000008', status: 'AutoTrader', rel: '2 months ago', st: 'Begin'}, {id: '#000059', status: 'AutoTrader', rel: '12 days ago', st: 'Begin'}] }, 
                                { title: 'Orders', btn: 'Create Order' }, 
                                { title: 'Vehicle Invoices', btn: 'Sell Vehicle' }, 
                                { title: 'Condition Reports', btn: 'Add Report' }
                            ].map((w, i) => (
                                <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                                    <div className={\`flex items-center justify-between \${w.extra || w.select ? 'mb-4' : ''}\`}>
                                        <h3 className="text-[15px] font-semibold text-slate-800">{w.title}</h3>
                                        {w.btn && <button className="text-[12px] font-semibold text-[#4D7CFF] border border-[#DCE4FF] rounded-md px-3 py-1.5 hover:bg-blue-50 transition-colors bg-white">{w.btn}</button>}
                                    </div>
                                    {w.select && (
                                        <select className="w-full border border-slate-200 text-xs font-semibold text-slate-400 rounded-md p-2.5 outline-none appearance-none bg-white">
                                            <option>{w.select}</option>
                                        </select>
                                    )}
                                    {w.extra && w.extra.length > 0 && (
                                        <div className="space-y-4 pt-2">
                                            {w.extra.map((ex, j) => (
                                                <div key={j} className="flex justify-between items-center text-[12px]">
                                                    <div>
                                                        <div className="font-semibold text-[#4D7CFF] hover:underline cursor-pointer">{ex.title || \`Lead \${ex.id}\`}</div>
                                                        <div className="text-slate-400 uppercase tracking-widest text-[9px] font-bold mt-1">{ex.status}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-slate-800 font-semibold">{ex.st}</div>
                                                        <div className="text-slate-400 font-semibold mt-1">{ex.rel}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

${tabVehicle}
${tabImages}
${tabOptions}
${tabSales.replace("activeTab === 'salesChannels'", "activeTab === 'sales'")}
${tabVehicleCheck}
${tabLeads}
                </div>
            </main>
            </div>
        </div>
    );
}
`;

const finalFile = topPart + '    /* ─── Render ───────────────────────────────────────────────────────────── */\n' + originalRender.substring(originalRender.indexOf('    return ('));
fs.writeFileSync(path, finalFile, 'utf8');
console.log('Successfully reverted component layout back to MotorDesk reference style!');
