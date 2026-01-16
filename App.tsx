
import React, { useState, useEffect, useMemo, ErrorInfo, ReactNode } from 'react';
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
import { SyncProvider } from './context/SyncProvider';
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
  Terminal,
  ShieldCheck,
  UserCheck,
  Smartphone
} from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Terminal Error:", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-rose-100 space-y-8">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">System Interruption</h2>
              <p className="text-slate-500 text-sm">The terminal encountered an unexpected error.</p>
            </div>
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg">Reload Terminal</button>
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
  const [showSplash, setShowSplash] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<number | 'admin' | ''>('');
  
  // Setup Form State
  const [setupData, setSetupData] = useState({ shopName: '', adminName: '', adminPin: '' });

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.filter(s => s.status === 'Active').toArray()) || [];
  const terminalId = useMemo(() => generateRequestCode(), []);

  const [isStaffDevice] = useState(() => localStorage.getItem('isStaffDevice') === 'true');
  const [invitedStaffName] = useState(() => localStorage.getItem('invitedStaffName') || '');

  // 1. Splash Screen Timer
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(splashTimer);
  }, []);

  // 2. Database Initialization
  useEffect(() => {
    const start = async () => {
      try {
        await initSettings();
        
        // Handle magic link onboarding
        const urlParams = new URLSearchParams(window.location.search);
        const onboardingData = urlParams.get('staffData') || urlParams.get('invite');
        
        if (onboardingData) {
          try {
            const decoded = JSON.parse(atob(onboardingData));
            const existing = await db.staff.where('name').equals(decoded.name).first();
            if (!existing) {
              await db.staff.add({ 
                name: decoded.name, 
                role: decoded.role, 
                password: decoded.password, 
                status: 'Active', 
                created_at: Date.now() 
              });
            }
            localStorage.setItem('isStaffDevice', 'true');
            localStorage.setItem('invitedStaffName', decoded.name);
            await db.settings.update('app_settings', { 
              shop_name: decoded.shop || 'NaijaShop', 
              is_setup_complete: true, 
              license_key: 'STAFF-TERMINAL-ACTIVE' 
            });
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {
            console.error("Magic link failed:", e);
          }
        }
        setIsInitialized(true);
      } catch (err: any) {
        setInitError(err?.message || "Could not connect to local database.");
      }
    };
    start();
  }, []);

  // 3. Auto-selection logic
  useEffect(() => {
    if (isInitialized && settings?.is_setup_complete) {
      if (isStaffDevice && invitedStaffName) {
        const staff = staffList.find(s => s.name === invitedStaffName);
        if (staff) setSelectedStaffId(staff.id!);
      } else if (staffList.length === 0) {
        setSelectedStaffId('admin');
      }
    }
  }, [isInitialized, settings?.is_setup_complete, staffList, isStaffDevice, invitedStaffName]);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupData.adminPin.length !== 4) return alert("PIN must be 4 digits");
    
    await db.settings.update('app_settings', {
      shop_name: setupData.shopName,
      admin_name: setupData.adminName,
      admin_pin: setupData.adminPin,
      is_setup_complete: true,
      last_used_timestamp: Date.now()
    });
  };

  // STEP 1: SPLASH SCREEN
  if (showSplash) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-6 text-center transition-all duration-700 animate-in fade-in">
        <div className="w-32 h-32 bg-white rounded-[2.5rem] p-6 flex items-center justify-center shadow-2xl animate-pulse-soft mb-8">
          <img src={LOGO_URL} className="w-full h-full object-contain" alt="NaijaShop Logo" />
        </div>
        <div className="space-y-2">
           <h1 className="text-white text-4xl font-black tracking-tighter">NaijaShop POS</h1>
           <div className="flex items-center justify-center gap-2">
             <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
             <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
             <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
             <p className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.2em] ml-2">Secure Terminal Starting...</p>
           </div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-rose-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl text-center space-y-6">
          <ShieldAlert size={64} className="mx-auto text-rose-500" />
          <h2 className="text-2xl font-black text-slate-900">Initialization Failed</h2>
          <p className="text-slate-500">{initError}</p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black">Retry Connection</button>
        </div>
      </div>
    );
  }

  // STEP 2: FIRST-TIME SETUP
  if (isInitialized && settings && !settings.is_setup_complete) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-inter">
        <div className="w-full max-w-md space-y-8 animate-in slide-in-from-bottom-8 duration-700">
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Setup Your Shop</h2>
            <p className="text-slate-500 font-medium">Configure your primary terminal profile</p>
          </div>

          <form onSubmit={handleSetupSubmit} className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Business Name</label>
                <div className="relative">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input required type="text" placeholder="e.g. Kola's Supermarket" className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={setupData.shopName} onChange={e => setSetupData({...setupData, shopName: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Full Name</label>
                <div className="relative">
                  <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input required type="text" placeholder="Main Administrator" className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={setupData.adminName} onChange={e => setSetupData({...setupData, adminName: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Secure 4-Digit PIN</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input required type="password" maxLength={4} placeholder="****" className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl outline-none focus:ring-2 focus:ring-emerald-500 tracking-[0.5em]" value={setupData.adminPin} onChange={e => setSetupData({...setupData, adminPin: e.target.value})} />
                </div>
              </div>
            </div>

            <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 shadow-xl shadow-emerald-600/30 transition-all active:scale-95">Complete Setup</button>
            
            <div className="flex items-center gap-2 justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <ShieldCheck size={14} className="text-emerald-500" />
              Encrypted Local Storage Active
            </div>
          </form>
        </div>
      </div>
    );
  }

  // STEP 3: REFINED LOGIN (OPAY STYLE)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-10 animate-in fade-in duration-500">
          <div className="text-center flex flex-col items-center">
             <div className="w-24 h-24 bg-white rounded-[2rem] p-4 flex items-center justify-center shadow-2xl border border-slate-100 mb-6">
                <img src={LOGO_URL} className="w-full h-full object-contain" alt="NaijaShop Logo" />
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight">{settings?.shop_name || 'NaijaShop'}</h1>
             <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Digital POS Terminal</p>
          </div>

          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600" />
            
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
            }} className="space-y-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Terminal Account</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <select required className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none appearance-none" value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value === 'admin' ? 'admin' : Number(e.target.value))}>
                      <option value="">Select Account</option>
                      {!isStaffDevice && <option value="admin">{settings?.admin_name} (Admin)</option>}
                      {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Access PIN</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input required type="password" placeholder="PIN" className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:ring-2 focus:ring-emerald-500" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 shadow-xl shadow-emerald-600/30 transition-all active:scale-95">Unlock Terminal</button>
            </form>

            <button onClick={() => alert("Contact Master Admin at support@naijashop.pos to reset your terminal PIN.")} className="w-full text-center text-slate-400 text-xs font-bold hover:text-emerald-600 transition-colors">Forgot PIN?</button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-slate-300 bg-white/50 px-4 py-1.5 rounded-full border border-slate-100">
              <Smartphone size={12} />
              <span className="text-[10px] font-black uppercase tracking-widest">Device Identity: {terminalId}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SyncProvider currentUser={currentUser}>
      <Layout activeView={currentView} setView={setCurrentView} shopName={settings?.shop_name || 'NaijaShop POS'} currentUser={currentUser} onLogout={() => setCurrentUser(null)}>
        {currentView === 'dashboard' && <Dashboard currentUser={currentUser} setView={setCurrentView} />}
        {currentView === 'pos' && <POS setView={setCurrentView} currentUser={currentUser} />}
        {currentView === 'transfer-station' && <TransferStation setView={setCurrentView} />}
        {currentView === 'inventory' && <Inventory setView={setCurrentView} currentUser={currentUser} />}
        {currentView === 'inventory-ledger' && <InventoryLedger />}
        {currentView === 'debts' && <Debts />}
        {currentView === 'ai-insights' && <AIInsights />}
        {currentView === 'sync' && <SyncStation currentUser={currentUser} setView={setCurrentView} />}
        {currentView === 'staff-management' && <StaffManagement />}
        {currentView === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black text-slate-800">Shop Identity</h3>
                <input className="w-full px-5 py-3 mt-4 bg-slate-50 border border-slate-200 rounded-xl" value={settings?.shop_name} onChange={async (e) => await db.settings.update('app_settings', { shop_name: e.target.value })} />
             </div>
          </div>
        )}
      </Layout>
    </SyncProvider>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;
