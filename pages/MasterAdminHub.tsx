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
  RefreshCw
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
    // Vite uses import.meta.env for environment variables
    // Fix: Cast import.meta to any to allow access to env property in environments where Vite types aren't globally extended.
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

      if (response.status === 401) {
        throw new Error("Invalid Access Token");
      }
      if (response.status === 404) {
        throw new Error("Site ID not found");
      }
      if (!response.ok) {
        throw new Error(`Satellite Connection Error: ${response.statusText}`);
      }

      const data = await response.json();
      setSubmissions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const shopRegistrations = useMemo(() => 
    submissions.filter(s => s.form_name === 'shop-registration'),
    [submissions]
  );

  const marketerRegistrations = useMemo(() => 
    submissions.filter(s => s.form_name === 'affiliate-registration'),
    [submissions]
  );

  const filteredData = useMemo(() => {
    const list = activeTab === 'shops' ? shopRegistrations : marketerRegistrations;
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(s => 
      Object.values(s.data).some(v => String(v).toLowerCase().includes(term))
    );
  }, [activeTab, shopRegistrations, marketerRegistrations, searchTerm]);

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
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
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
              autoFocus
              required
              type="password" 
              maxLength={4}
              placeholder="ENTER MASTER PIN"
              className="w-full py-5 bg-slate-800 border border-slate-700 rounded-2xl text-center text-4xl font-black text-emerald-400 tracking-[0.5em] outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              value={pinInput}
              onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
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
      <div className="max-w-7xl mx-auto space-y-10">
        
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

        {/* Control Bar */}
        <div className="flex flex-col md:flex-row gap-6 items-stretch md:items-center">
           <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shrink-0">
              <button 
                onClick={() => setActiveTab('shops')}
                className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'shops' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                Retail Terminals
              </button>
              <button 
                onClick={() => setActiveTab('marketers')}
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
               onClick={fetchData}
               disabled={isLoading}
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
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Shop & Owner</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware ID</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Campaigns</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                          </>
                        ) : (
                          <>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Marketer Identity</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Phone Number</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Settlement Details</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Copy</th>
                          </>
                        )}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/50">
                      {filteredData.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors group">
                          {activeTab === 'shops' ? (
                            <>
                              <td className="px-10 py-8">
                                <p className="font-black text-lg text-white">{sub.data['shop-name']}</p>
                                <p className="text-xs text-emerald-500/60 font-bold uppercase tracking-wide">{sub.data['admin-name']}</p>
                              </td>
                              <td className="px-10 py-8">
                                <code className="bg-slate-950 px-3 py-1.5 rounded-lg text-emerald-400 font-mono text-sm border border-emerald-500/10">
                                  {sub.data['terminal-id']}
                                </code>
                              </td>
                              <td className="px-10 py-8">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${sub.data['referral-code-used'] !== 'NONE' ? 'bg-indigo-900/40 text-indigo-400 border-indigo-400/20' : 'bg-slate-950 text-slate-600 border-slate-800'}`}>
                                  {sub.data['referral-code-used']}
                                </span>
                              </td>
                              <td className="px-10 py-8">
                                <p className="text-xs font-bold text-slate-500">{new Date(sub.created_at).toLocaleDateString()}</p>
                                <p className="text-[10px] font-medium text-slate-600">{new Date(sub.created_at).toLocaleTimeString()}</p>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-10 py-8">
                                <p className="font-black text-lg text-white">{sub.data['marketer-name']}</p>
                                <p className="text-[10px] font-bold text-emerald-500/40 uppercase tracking-[0.2em]">Verified Partner</p>
                              </td>
                              <td className="px-10 py-8">
                                <p className="font-black text-emerald-400 tracking-wider">{sub.data['phone-number']}</p>
                              </td>
                              <td className="px-10 py-8">
                                <p className="text-sm font-bold text-white uppercase tracking-tight">{sub.data['bank-name']}</p>
                                <p className="text-xs font-black text-slate-500 tracking-[0.1em]">{sub.data['account-number']}</p>
                              </td>
                              <td className="px-10 py-8 text-center">
                                <button 
                                  onClick={() => copyToClipboard(`${sub.data['bank-name']} | ${sub.data['account-number']}`)}
                                  className="p-3 bg-slate-950 hover:bg-emerald-600 hover:text-white rounded-xl text-slate-400 transition-all border border-slate-800 group-hover:border-emerald-500/30"
                                >
                                  <Copy size={18} />
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
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