import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Terminal, 
  Users, 
  Store, 
  Search, 
  Download, 
  Copy, 
  CheckCircle2, 
  Loader2, 
  Lock, 
  ArrowRight,
  TrendingUp,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  Globe,
  RefreshCw,
  Award,
  ExternalLink,
  SearchCheck,
  CreditCard,
  UserCheck
} from 'lucide-react';

const MASTER_PIN = "8844";

interface NetlifySubmission {
  id: string;
  form_name: string;
  created_at: string;
  data: {
    'shop-name'?: string;
    'admin-name'?: string;
    'terminal-id'?: string;
    'referral-code-used'?: string;
    'marketer-name'?: string;
    'phone-number'?: string;
    'bank-name'?: string;
    'account-number'?: string;
  };
}

const MasterAdminHub: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState<'shops' | 'marketers'>('shops');
  const [searchTerm, setSearchTerm] = useState('');
  const [referralFilter, setReferralFilter] = useState<string | null>(null);
  const [paymentAuditInput, setPaymentAuditInput] = useState('');
  const [submissions, setSubmissions] = useState<NetlifySubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === MASTER_PIN) {
      setIsAuthenticated(true);
    } else {
      alert("Unauthorized Access. Terminal Locked.");
      window.location.href = "/";
    }
  };

  const fetchData = async () => {
    // Correctly using Vite environment variables with type casting for safety
    const SITE_ID = (import.meta as any).env.VITE_NETLIFY_SITE_ID;
    const ACCESS_TOKEN = (import.meta as any).env.VITE_NETLIFY_ACCESS_TOKEN;
    
    if (!SITE_ID || !ACCESS_TOKEN) {
      setError("Environment configuration missing. Check VITE_NETLIFY_SITE_ID and VITE_NETLIFY_ACCESS_TOKEN.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/submissions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) throw new Error("Invalid Access Token");
      if (response.status === 404) throw new Error("Site ID not found");
      if (!response.ok) throw new Error(`Satellite Connection Error: ${response.statusText}`);

      const data = await response.json();
      setSubmissions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  const shopRegistrations = useMemo(() => 
    submissions.filter(s => s.form_name === 'shop-registration'),
    [submissions]
  );

  const marketerRegistrations = useMemo(() => 
    submissions.filter(s => s.form_name === 'affiliate-registration'),
    [submissions]
  );

  // Link shops to marketers for stats - Matching referral-code-used with phone-number
  const marketerReferralMap = useMemo(() => {
    const map: Record<string, number> = {};
    shopRegistrations.forEach(shop => {
      const code = shop.data['referral-code-used'];
      if (code && code !== 'NONE') {
        map[code] = (map[code] || 0) + 1;
      }
    });
    return map;
  }, [shopRegistrations]);

  const filteredData = useMemo(() => {
    if (activeTab === 'shops') {
      let list = shopRegistrations;
      if (referralFilter) {
        list = list.filter(s => s.data['referral-code-used'] === referralFilter);
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        list = list.filter(s => Object.values(s.data).some(v => String(v).toLowerCase().includes(term)));
      }
      return list;
    } else {
      let list = marketerRegistrations;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        list = list.filter(s => Object.values(s.data).some(v => String(v).toLowerCase().includes(term)));
      }
      return list;
    }
  }, [activeTab, shopRegistrations, marketerRegistrations, searchTerm, referralFilter]);

  const auditedResult = useMemo(() => {
    if (!paymentAuditInput.trim()) return null;
    const terminalId = paymentAuditInput.trim();
    const shop = shopRegistrations.find(s => s.data['terminal-id'] === terminalId);
    if (!shop) return { found: false };
    
    const referrerCode = shop.data['referral-code-used'];
    const marketer = referrerCode !== 'NONE' 
      ? marketerRegistrations.find(m => m.data['phone-number'] === referrerCode)
      : null;

    return { 
      found: true, 
      shop, 
      marketer 
    };
  }, [paymentAuditInput, shopRegistrations, marketerRegistrations]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Details Copied to Clipboard");
  };

  const downloadCSV = () => {
    const list = activeTab === 'shops' ? shopRegistrations : marketerRegistrations;
    if (list.length === 0) return;
    const headers = Object.keys(list[0].data).join(',');
    const rows = list.map(s => Object.values(s.data).map(v => `"${v}"`).join(',')).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `NaijaShop_Empire_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-emerald-900/30 p-12 rounded-[3rem] shadow-[0_0_50px_rgba(16,185,129,0.1)] space-y-8 animate-in zoom-in duration-500">
          <div className="text-center space-y-4">
             <div className="w-20 h-20 bg-emerald-900/20 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20">
               <ShieldAlert size={40} />
             </div>
             <h2 className="text-3xl font-black text-white tracking-tight">Access Control</h2>
             <p className="text-emerald-500/60 font-bold uppercase tracking-widest text-[10px]">Restricted Domain • App Owner Only</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <input 
              autoFocus required type="password" maxLength={4} placeholder="ENTER MASTER PIN"
              className="w-full py-5 bg-slate-800 border border-slate-700 rounded-2xl text-center text-4xl font-black text-emerald-400 tracking-[0.5em] outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
            />
            <button className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-500 transition-all active:scale-95">
               Authenticate Session <ChevronRight size={24} />
            </button>
          </form>
          <button onClick={() => window.location.href = '/'} className="w-full text-center text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-300">Abort & Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-500 text-slate-950 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)]">
              <Terminal size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter">Empire Control</h1>
              <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                <Globe size={12} /> Live Satellite Monitor
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
               <div className="text-center px-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Shops</p>
                  <p className="text-2xl font-black text-emerald-400">{shopRegistrations.length}</p>
               </div>
               <div className="w-px h-8 bg-slate-800" />
               <div className="text-center px-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Marketers</p>
                  <p className="text-2xl font-black text-white">{marketerRegistrations.length}</p>
               </div>
            </div>
            <button onClick={() => window.location.href = '/'} className="p-4 bg-slate-800 rounded-2xl hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-all border border-slate-700">
               <LogOut size={24} />
            </button>
          </div>
        </header>

        {/* Payment Auditor Box */}
        <div className="bg-slate-900/50 border border-indigo-500/20 p-6 rounded-[2.5rem] flex flex-col md:flex-row gap-6 items-center animate-in slide-in-from-top-4">
          <div className="flex items-center gap-4 shrink-0">
             <div className="w-12 h-12 bg-indigo-900/30 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/20">
               <SearchCheck size={24} />
             </div>
             <div>
               <h4 className="font-black text-sm uppercase tracking-widest text-indigo-400">Payment Auditor</h4>
               <p className="text-[10px] text-slate-500 font-bold">Paste Hardware ID to find Referrer</p>
             </div>
          </div>
          <div className="relative flex-1 w-full">
            <input 
              type="text" 
              placeholder="e.g. NS-A1B2C3D4"
              className="w-full h-14 bg-slate-800 border border-slate-700 pl-6 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm tracking-widest transition-all"
              value={paymentAuditInput}
              onChange={e => setPaymentAuditInput(e.target.value.toUpperCase())}
            />
          </div>
          {auditedResult && auditedResult.found && (
            <div className="flex-1 bg-slate-950 p-4 rounded-2xl border border-emerald-500/20 flex items-center justify-between animate-in zoom-in">
               <div className="flex items-center gap-3">
                  <UserCheck size={20} className="text-emerald-400" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500">Pay To Referrer</p>
                    <p className="font-black text-sm text-white">
                      {auditedResult.marketer ? auditedResult.marketer.data['marketer-name'] : 'DIRECT (NO PAY)'}
                    </p>
                  </div>
               </div>
               {auditedResult.marketer && (
                 <button 
                  onClick={() => copyToClipboard(`${auditedResult.marketer?.data['bank-name']} | ${auditedResult.marketer?.data['account-number']}`)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                 >
                   <CreditCard size={12}/> Copy Bank
                 </button>
               )}
            </div>
          )}
        </div>

        {/* Control Bar */}
        <div className="flex flex-col md:flex-row gap-6 items-stretch md:items-center">
           <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shrink-0">
              <button 
                onClick={() => { setActiveTab('shops'); setReferralFilter(null); }}
                className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'shops' && !referralFilter ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                Retail Terminals
              </button>
              <button 
                onClick={() => { setActiveTab('marketers'); setReferralFilter(null); }}
                className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'marketers' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                Marketer Leads
              </button>
           </div>

           <div className="relative flex-1">
             <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
             <input 
               type="text" 
               placeholder={activeTab === 'shops' ? "Search Terminal ID..." : "Search Marketer Name..."}
               className="w-full h-16 bg-slate-900 border border-slate-800 pl-14 pr-6 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold transition-all placeholder:text-slate-700"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>

           <div className="flex gap-2">
             <button 
               onClick={fetchData} disabled={isLoading}
               className="p-5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-2xl border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
               title="Refresh Data"
             >
               <RefreshCw size={24} className={isLoading ? 'animate-spin' : ''} />
             </button>
             <button 
               onClick={downloadCSV}
               className="px-8 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 border border-slate-700"
             >
               <Download size={20} /> Export CSV
             </button>
           </div>
        </div>

        {referralFilter && (
          <div className="flex items-center gap-3 bg-emerald-900/20 p-4 rounded-2xl border border-emerald-500/20 animate-in slide-in-from-left-4">
             <Users size={16} className="text-emerald-400" />
             <p className="text-xs font-bold text-emerald-400">Filtering shops referred by: <span className="underline">{referralFilter}</span></p>
             <button onClick={() => setReferralFilter(null)} className="ml-auto text-[10px] font-black uppercase text-slate-500 hover:text-white">Clear Filter</button>
          </div>
        )}

        {/* Data View */}
        <div className="bg-slate-900 rounded-[3rem] border border-slate-800 shadow-2xl overflow-hidden min-h-[500px]">
           {isLoading ? (
             <div className="flex flex-col items-center justify-center py-40 gap-6">
                <Loader2 size={64} className="text-emerald-500 animate-spin" />
                <p className="text-emerald-500/40 font-black uppercase tracking-[0.3em] text-[10px]">Decrypting Registry...</p>
             </div>
           ) : error ? (
             <div className="flex flex-col items-center justify-center py-40 gap-4 text-rose-500 px-6 text-center">
                <ShieldAlert size={64} />
                <p className="font-black text-xl">{error}</p>
                <button onClick={fetchData} className="px-8 py-3 bg-slate-800 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:bg-slate-700 border border-slate-700 transition-all">Reconnect Bridge</button>
             </div>
           ) : filteredData.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-40 text-slate-600 gap-4">
                <Search size={64} className="opacity-20" />
                <p className="font-black uppercase tracking-widest text-xs">No satellite data found</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-950/50 border-b border-slate-800">
                      <tr>
                        {activeTab === 'shops' ? (
                          <>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Shop Identity</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Referrer Details</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware ID</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                          </>
                        ) : (
                          <>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Marketer Identity</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Referrals</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Settlement Details</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Actions</th>
                          </>
                        )}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/50">
                      {filteredData.map((sub) => {
                        const refCode = sub.data['referral-code-used'];
                        const referrer = refCode !== 'NONE' 
                          ? marketerRegistrations.find(m => m.data['phone-number'] === refCode)
                          : null;
                        const refCount = marketerReferralMap[sub.data['phone-number'] || ''] || 0;

                        return (
                          <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors group">
                            {activeTab === 'shops' ? (
                              <>
                                <td className="px-10 py-8">
                                  <p className="font-black text-lg text-white">{sub.data['shop-name']}</p>
                                  <p className="text-xs text-emerald-500/60 font-bold uppercase tracking-wide">{sub.data['admin-name']}</p>
                                </td>
                                <td className="px-10 py-8">
                                  {referrer ? (
                                    <div className="flex items-center gap-2 text-emerald-400">
                                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                      <div>
                                        <p className="font-black text-sm">{referrer.data['marketer-name']}</p>
                                        <p className="text-[9px] opacity-60 font-mono">({refCode})</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Direct Install</p>
                                  )}
                                </td>
                                <td className="px-10 py-8">
                                  <code className="bg-slate-950 px-3 py-1.5 rounded-lg text-indigo-400 font-mono text-sm border border-indigo-500/10">
                                    {sub.data['terminal-id']}
                                  </code>
                                </td>
                                <td className="px-10 py-8">
                                  <p className="text-xs font-bold text-slate-500">{new Date(sub.created_at).toLocaleDateString()}</p>
                                  <p className="text-[10px] font-medium text-slate-600">{new Date(sub.created_at).toLocaleTimeString()}</p>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-10 py-8">
                                  <div className="flex items-center gap-4">
                                     <div className="relative">
                                        <p className="font-black text-lg text-white">{sub.data['marketer-name']}</p>
                                        <p className="text-xs font-black text-emerald-400 tracking-wider">{sub.data['phone-number']}</p>
                                     </div>
                                     {refCount > 5 && (
                                       <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 flex items-center gap-2 animate-in zoom-in" title="Top Performer Badge">
                                          <Award size={16} />
                                          <span className="text-[9px] font-black uppercase tracking-widest">Top Performer</span>
                                       </div>
                                     )}
                                  </div>
                                </td>
                                <td className="px-10 py-8">
                                  <div className="flex items-center gap-4">
                                    <div className="text-center bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
                                      <p className="text-2xl font-black text-white">{refCount}</p>
                                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Shops</p>
                                    </div>
                                    <button 
                                      disabled={refCount === 0}
                                      onClick={() => { setReferralFilter(sub.data['phone-number'] || null); setActiveTab('shops'); }}
                                      className="p-3 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700 disabled:opacity-20"
                                      title="View referred shops"
                                    >
                                      <ExternalLink size={16} />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-10 py-8">
                                  <p className="text-sm font-bold text-white uppercase tracking-tight">{sub.data['bank-name']}</p>
                                  <p className="text-xs font-black text-slate-500 tracking-[0.1em]">{sub.data['account-number']}</p>
                                </td>
                                <td className="px-10 py-8 text-center flex items-center justify-center gap-2">
                                  <button 
                                    onClick={() => copyToClipboard(`${sub.data['bank-name']} | ${sub.data['account-number']}`)}
                                    className="p-3 bg-slate-950 hover:bg-emerald-600 hover:text-white rounded-xl text-slate-400 transition-all border border-slate-800"
                                    title="Copy Bank Details"
                                  >
                                    <Copy size={18} />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                   </tbody>
                </table>
             </div>
           )}
        </div>

        <footer className="text-center py-10 opacity-30">
           <p className="text-slate-500 font-black uppercase tracking-[0.5em] text-[8px]">Proprietary Data Monitor • Managed by Empire Logistics</p>
        </footer>
      </div>
    </div>
  );
};

export default MasterAdminHub;