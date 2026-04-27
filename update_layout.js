const fs = require('fs');

const path = 'c:/Users/eesa/OneDrive/Desktop/car dealer software/src/app/app/vehicles/[id]/page.tsx';
let source = fs.readFileSync(path, 'utf8');

const renderMarker = '    /* ─── Render ───────────────────────────────────────────────────────────── */\r\n    return (\r\n        <div className="min-h-screen bg-[#F8FAFC]">';

let topPart = source.split('    /* ─── Render ───────────────────────────────────────────────────────────── */')[0];
if (!topPart) {
    topPart = source.split('    /* ─── Render ───────────────────────────────────────────────────────────── */\n')[0];
}

const restOfSource = source.substring(source.indexOf('    /* ─── Render ───────────────────────────────────────────────────────────── */'));

// Extract exactly the tab contents we want to preserve.
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

// Extract leads tab until exactly the `                )}` matching the end of that block
let tabLeads = getSection("{/* ═══ LEADS & DEALS TAB ════════════════════════════════════ */}", null);
const leadsEndIdx = tabLeads.lastIndexOf("                )}");
if(leadsEndIdx !== -1) {
    tabLeads = tabLeads.substring(0, leadsEndIdx + 18);
}

const newRender = `    /* ─── Render ───────────────────────────────────────────────────────────── */
    return (
        <div className="w-full py-6 sm:py-10 px-4 sm:px-6">
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e.target.files)} />

            {/* Header with Title and Global Actions */}
            <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Edit Vehicle</h1>
                    <p className="text-slate-500 font-medium mt-1 text-sm">Update the details, images, and sales channels for this vehicle.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <select
                        value={vehicle.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        className="px-5 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-600 focus:bg-white outline-none cursor-pointer uppercase tracking-widest shadow-sm"
                    >
                        {LIFECYCLE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-indigo-100/20 overflow-hidden min-h-[500px]">
                <div className="p-6 sm:p-10">
                    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        
                        {/* ─── Left Sidebar Navigation ─── */}
                        <div className="w-full lg:w-64 shrink-0">
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sticky top-6">
                                <div className="space-y-1">
                                    {TABS.map((tab) => {
                                        const isSeparatorBefore = tab.id === 'competitors' || tab.id === 'jobBoards' || tab.id === 'appointments';
                                        
                                        return (
                                            <div key={tab.id}>
                                                {isSeparatorBefore && <div className="h-px bg-slate-100 my-4" />}
                                                <button
                                                    onClick={() => setActiveTab(tab.id)}
                                                    className={\`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all \${
                                                        activeTab === tab.id
                                                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                            : 'text-slate-400 hover:bg-slate-50 opacity-80'
                                                    }\`}
                                                >
                                                    <span className="text-base">{tab.icon}</span>
                                                    {tab.label}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* ─── Main Content ─── */}
                        <div className="flex-1 space-y-8 min-w-0">
                            {/* Vehicle Header (Persists across tabs) */}
                            <div className="flex items-center gap-6 pb-6 border-b border-slate-50">
                                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner overflow-hidden text-3xl shrink-0">
                                    {vehicle.make.toLowerCase().includes('audi') ? '🚘' : '🚗'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="bg-[#FFD700] text-[#003399] px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-900 border-opacity-10 shadow-sm">
                                                🇬🇧 {(vehicle.vrm || vehicle.registration || vehicle.vehicle?.registration || 'UNREG').toUpperCase()}
                                            </span>
                                            <span className="text-slate-300 font-bold">/</span>
                                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider truncate max-w-[150px] sm:max-w-none">
                                                {vehicle.make} {vehicle.model}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {vehicle.createdAt && (
                                                <div className="hidden sm:flex px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 items-center gap-1.5 shadow-sm uppercase tracking-widest">
                                                    Added {formatDistanceToNow(new Date(vehicle.createdAt))} ago
                                                </div>
                                            )}
                                            <div className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-[10px] font-black shadow-sm shadow-indigo-200 uppercase tracking-widest">
                                                {vehicle.status}
                                            </div>
                                        </div>
                                    </div>
                                    <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-2 truncate">
                                        {vehicle.derivative || 'Vehicle Details'}
                                    </h2>
                                </div>
                            </div>

                            {/* ─── Tab Content ──────────────────────────────────────── */}
                            {activeTab === 'overview' && (
                                <div className="space-y-6 max-w-4xl">
                                    <div className="bg-[#F0FAF5] border border-[#BDE7D3] rounded-xl p-5 flex items-center justify-between shadow-sm">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-3 text-[#22A769] font-bold text-sm uppercase tracking-widest">
                                                <span className="text-lg leading-none -mt-1">↩</span> Sell Vehicle
                                            </div>
                                            <span className="text-xs text-[#22A769]/80 mt-1 font-bold">This vehicle is currently for sale</span>
                                        </div>
                                        <button className="bg-[#22A769] text-white text-xs font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg shadow-emerald-100 hover:bg-[#1C8C56] transition-colors">Sell</button>
                                    </div>

                                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 max-w-xl">
                                        <h3 className="text-[10px] font-black text-[#4D7CFF] uppercase tracking-[0.2em] mb-4">Advert Suggestions</h3>
                                        <ul className="space-y-5">
                                            {[
                                                { title: 'Add Interior Details', desc: 'Interior details help customers find their perfect vehicle more easily.' },
                                                { title: 'Add a Video', desc: 'Adding a video will help sell your vehicle faster.' },
                                                { title: 'Add ULEZ Compliance', desc: 'ULEZ compliance data is important to help customers find the right vehicle.' }
                                            ].map((s, idx) => (
                                                <li key={idx} className="flex gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 border border-blue-100">
                                                        <span className="font-bold text-sm">{idx + 1}</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-slate-700">{s.title}</div>
                                                        <div className="text-xs font-bold text-slate-400 mt-0.5">{s.desc}</div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

${tabVehicle}
${tabImages}
${tabOptions}
${tabSales.replace("activeTab === 'sales'", "activeTab === 'salesChannels'")}
${tabVehicleCheck}
${tabLeads}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
`;

const finalFile = topPart + newRender;
fs.writeFileSync(path, finalFile, 'utf8');
console.log('Successfully updated component layout!');
