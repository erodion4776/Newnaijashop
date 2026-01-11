
import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initSettings } from './db/db';
import { View, Staff } from './types';
import { generateRequestCode, validateLicense } from './utils/licensing';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import InventoryLedger from './pages/InventoryLedger';
import Debts from './pages/Debts';
import AIInsights from './pages/AIInsights';
import TransferStation from './pages/TransferStation';
import SyncStation from './pages/SyncStation';
import StaffManagement from './pages/StaffManagement';
import { 
  ShieldAlert, 
  Key, 
  Landmark, 
  Lock, 
  User, 
  ChevronRight, 
  CheckCircle2, 
  X,
  Store,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Terminal
} from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Fix: Use the imported Component class directly to ensure props and state are correctly inherited and recognized by the TypeScript compiler.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Terminal Error:", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-rose-100 space-y-8">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">System Interruption</h2>
              <p className="text-slate-500 text-sm">The terminal encountered an unexpected error. This might be due to a corrupted local cache.</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl text-left overflow-auto max-h-32 scrollbar-hide">
              <code className="text-[10px] text-rose-500 font-mono">{error?.message}</code>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={20} /> Reload Terminal
              </button>
              <button 
                onClick={async () => {
                  if(confirm("Clear local storage? This will delete your data.")) {
                    localStorage.clear();
                    // Fix: db.delete() is correctly inherited and recognized after fixing the inheritance in db.ts
                    await db.delete();
                    window.location.reload();
                  }
                }}
                className="text-xs font-black text-slate-300 uppercase tracking-widest hover:text-rose-500 transition-colors"
              >
                Factory Reset Device
              </button>
            </div>
          </div>
        </div>
      );
    }
    return children;
  }
}

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [onboardingSuccess, setOnboardingSuccess] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | 'admin' | ''>('');
  
  // Persistence for Staff Terminal Mode
  const [isStaffDevice, setIsStaffDevice] = useState(() => localStorage.getItem('isStaffDevice') === 'true');
  const [invitedStaffName, setInvitedStaffName] = useState(() => localStorage.getItem('invitedStaffName') || '');

  const [setupData, setSetupData] = useState({ shopName: '', adminName: '', adminPin: '' });

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.filter(s => s.status === 'Active').toArray()) || [];
  const requestCode = useMemo(() => generateRequestCode(), []);

  useEffect(() => {
    const start = async () => {
      try {
        await initSettings();
        
        const urlParams = new URLSearchParams(window.location.search);
        const onboardingData = urlParams.get('staffData') || urlParams.get('invite');
        
        if (onboardingData) {
          try {
            const decoded = JSON.parse(atob(onboardingData));
            
            // 1. Add/Update Staff Record
            let staffId;
            const existing = await db.staff.where('name').equals(decoded.name).first();
            if (!existing) {
              staffId = await db.staff.add({
                name: decoded.name,
                role: decoded.role,
                password: decoded.password,
                status: 'Active',
                created_at: Date.now()
              });
            } else {
              staffId = existing.id;
            }

            // 2. Set Device Metadata persistently
            localStorage.setItem('isStaffDevice', 'true');
            localStorage.setItem('invitedStaffName', decoded.name);
            setIsStaffDevice(true);
            setInvitedStaffName(decoded.name);
            
            // 3. Configure Local Settings for Staff Device to skip setup
            await db.settings.update('app_settings', {
              shop_name: decoded.shop || 'NaijaShop',
              is_setup_complete: true,
              license_key: 'STAFF-TERMINAL-ACTIVE' // Bypass license check for staff
            });

            setOnboardingSuccess('Terminal Access Activated!');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {
            console.error("Magic link processing failed:", e);
          }
        }
        
        setTimeout(() => setIsInitialized(true), 800);
      } catch (err: any) {
        console.error("Database initialization failed:", err);
        setInitError(err?.message || "Could not connect to local database.");
      }
    };
    start();
  }, []);

  // Pre-select staff on Staff Devices once the list is loaded
  useEffect(() => {
    if (isStaffDevice && staffList.length > 0 && selectedStaffId === '') {
      const staff = staffList.find(s => s.name === invitedStaffName);
      if (staff) {
        setSelectedStaffId(staff.id!);
      }
    }
  }, [isStaffDevice, staffList, invitedStaffName, selectedStaffId]);

  useEffect(() => {
    if (isInitialized && settings && settings.is_setup_complete && !isStaffDevice) {
      const { valid, error } = validateLicense(settings.license_key, settings.last_used_timestamp);
      if (!valid) {
        setLicenseError(error || 'Invalid License');
      } else {
        setLicenseError(null);
        const interval = setInterval(() => {
          db.settings.update('app_settings', { last_used_timestamp: Date.now() });
        }, 30000);
        return () => clearInterval(interval);
      }
    }
  }, [isInitialized, settings?.license_key, settings?.last_used_timestamp, settings?.is_setup_complete, isStaffDevice]);

  const resetSystem = async () => {
    if (confirm("DANGER: This will delete ALL local data. Proceed?")) {
      localStorage.clear();
      // Fix: db.delete() is correctly inherited and recognized after fixing the inheritance in db.ts
      await db.delete();
      window.location.reload();
    }
  };

  if (!isInitialized && !initError) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-8 animate-pulse-soft">
          <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-black/20">
            <span className="text-emerald-900 text-5xl font-black italic tracking-tighter">NS</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-white text-2xl font-black tracking-tight">NaijaShop POS</h1>
            <div className="flex items-center justify-center gap-3 text-emerald-400 font-black text-[10px] uppercase tracking-[0.3em]">
              <Loader2 size={12} className="animate-spin" /> Secure Terminal Starting
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white p-10 rounded-[3rem] shadow-2xl space-y-8 text-center border border-rose-100">
           <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
             <ShieldAlert size={40} />
           </div>
           <div className="space-y-2">
             <h2 className="text-2xl font-black text-slate-900">Storage Error</h2>
             <p className="text-slate-500 text-sm font-medium">{initError}</p>
           </div>
           <button 
             onClick={resetSystem}
             className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all flex items-center justify-center gap-2"
           >
             <RefreshCw size={18} /> Repair Terminal
           </button>
        </div>
      </div>
    );
  }

  if (settings && !settings.is_setup_complete && !isStaffDevice) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-3">
             <div className="w-20 h-20 bg-emerald-600 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-600/30">
                <Store size={40} className="text-white" />
             </div>
             <h1 className="text-2xl font-black text-slate-900 tracking-tight">Setup Your Shop</h1>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            await db.settings.update('app_settings', {
              shop_name: setupData.shopName,
              admin_name: setupData.adminName,
              admin_pin: setupData.adminPin,
              is_setup_complete: true,
              last_used_timestamp: Date.now()
            });
            setCurrentUser({ name: setupData.adminName, role: 'Admin', password: setupData.adminPin, status: 'Active', created_at: Date.now() });
          }} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-200 space-y-6">
            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Shop Name</label>
                  <input required placeholder="e.g. Bolu's Retail" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={setupData.shopName} onChange={(e) => setSetupData({...setupData, shopName: e.target.value})} />
               </div>
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Admin Name</label>
                  <input required placeholder="Full Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={setupData.adminName} onChange={(e) => setSetupData({...setupData, adminName: e.target.value})} />
               </div>
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Create PIN</label>
                  <input required type="password" placeholder="4 or 6 Digits" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black tracking-widest" value={setupData.adminPin} onChange={(e) => setSetupData({...setupData, adminPin: e.target.value})} />
               </div>
            </div>
            <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 group">
              Start Selling <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (licenseError && !isStaffDevice) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6 z-[1000]">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 text-center space-y-8 shadow-2xl animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert size={48} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 leading-tight">Terminal Locked</h1>
          <p className="text-slate-500 font-medium px-4">{licenseError}</p>
          <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Request Code</p>
            <p className="text-2xl font-black text-slate-800 tracking-widest font-mono">{requestCode}</p>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder="Enter License Key" className="w-full pl-12 pr-4 py-4 bg-slate-100 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold" onBlur={async (e) => { if(e.target.value) await db.settings.update('app_settings', { license_key: e.target.value }); }} />
            </div>
            <button onClick={resetSystem} className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-rose-500 transition-colors">Emergency Reset</button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-10">
          {onboardingSuccess && (
            <div className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-500">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} />
                <span className="text-sm font-bold">{onboardingSuccess}</span>
              </div>
              <button onClick={() => setOnboardingSuccess(null)}><X size={16} /></button>
            </div>
          )}
          <div className="text-center space-y-4">
             <div className="w-24 h-24 bg-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl rotate-3">
                <span className="text-white text-4xl font-black italic">NS</span>
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">{settings?.shop_name || 'NaijaShop'}</h1>
             {isStaffDevice && (
               <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                 <Terminal size={12} /> Staff Terminal Mode
               </div>
             )}
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            if (selectedStaffId === 'admin') {
              if (loginPassword === settings?.admin_pin) {
                setCurrentUser({ name: settings.admin_name, role: 'Admin', password: settings.admin_pin, status: 'Active', created_at: Date.now() });
              } else alert("Invalid PIN");
            } else {
              const staff = staffList.find(s => s.id === selectedStaffId);
              if (staff && staff.password === loginPassword) {
                setCurrentUser(staff);
                if (staff.role === 'Sales') setCurrentView('pos');
              } else alert("Invalid Password");
            }
          }} className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 space-y-8 animate-in zoom-in duration-300">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <select 
                    required 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold appearance-none disabled:opacity-50" 
                    value={selectedStaffId} 
                    onChange={(e) => setSelectedStaffId(e.target.value === 'admin' ? 'admin' : Number(e.target.value))}
                  >
                    {!isStaffDevice && <option value="">Select Account</option>}
                    {!isStaffDevice && <option value="admin">{settings?.admin_name} (Admin)</option>}
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                    {isStaffDevice && staffList.length === 0 && <option value="">No Staff Found</option>}
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input required type="password" placeholder="••••" className="w-full pl-12 pr-4 py-4 bg-slate-100 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black tracking-widest text-lg" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
              </div>
            </div>
            <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 group active:scale-95">Log In <ChevronRight /></button>
          </form>
          {!isStaffDevice && (
            <div className="text-center">
              <button onClick={resetSystem} className="flex items-center justify-center gap-2 mx-auto px-4 py-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-rose-500 transition-colors bg-white/50 rounded-full border border-slate-100"><RefreshCw size={12} /> Reset Terminal</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard currentUser={currentUser} />;
      case 'pos': return <POS setView={setCurrentView} />;
      case 'transfer-station': return <TransferStation setView={setCurrentView} />;
      case 'inventory': return <Inventory setView={setCurrentView} currentUser={currentUser} />;
      case 'inventory-ledger': return <InventoryLedger />;
      case 'debts': return <Debts />;
      case 'ai-insights': return <AIInsights />;
      case 'sync': return <SyncStation currentUser={currentUser} />;
      case 'staff-management': return <StaffManagement />;
      case 'settings': return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><Lock className="text-emerald-600" size={20} /> Identity</h3>
                <div className="space-y-4">
                  <input type="text" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={settings?.shop_name || ''} onChange={async (e) => await db.settings.update('app_settings', { shop_name: e.target.value })} />
                  <input type="password" placeholder="PIN" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={settings?.admin_pin || ''} onChange={async (e) => await db.settings.update('app_settings', { admin_pin: e.target.value })} />
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><Landmark className="text-emerald-600" size={20} /> Bank Details</h3>
                <div className="space-y-4">
                  <input type="text" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={settings?.bank_name || ''} onChange={async (e) => await db.settings.update('app_settings', { bank_name: e.target.value })} />
                  <input type="text" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold" value={settings?.account_number || ''} onChange={async (e) => await db.settings.update('app_settings', { account_number: e.target.value })} />
                </div>
              </div>
           </div>
        </div>
      );
      default: return <Dashboard currentUser={currentUser} />;
    }
  };

  return (
    <Layout activeView={currentView} setView={setCurrentView} shopName={settings?.shop_name || 'NaijaShop POS'} currentUser={currentUser} onLogout={() => setCurrentUser(null)}>
      {renderView()}
    </Layout>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;
