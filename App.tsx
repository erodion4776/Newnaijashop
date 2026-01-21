
import React, { useState, useEffect, useMemo, ErrorInfo, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initSettings } from './db/db';
import { View, Staff } from './types';
import LZString from 'lz-string';
import { generateRequestCode } from './utils/licensing';
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
import ActivityLog from './pages/ActivityLog';
import BarcodeScanner from './components/BarcodeScanner';
import { SyncProvider } from './context/SyncProvider';
import { importWhatsAppBridgeData, generateSyncKey } from './services/syncService';
import { 
  Lock, 
  User, 
  Store, 
  AlertTriangle,
  ShieldCheck,
  Smartphone,
  ArrowRight,
  Camera,
  Loader2,
  CheckCircle2,
  Key,
  Copy,
  Check,
  Zap,
  Info,
  RefreshCw,
  Wifi,
  XCircle
} from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("Uncaught Terminal Error:", error, errorInfo); }
  render() {
    const { hasError } = this.state;
    const { children } = (this as any).props;
    if (hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-rose-100 space-y-8">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={40} /></div>
            <h2 className="text-2xl font-black text-slate-900">System Interruption</h2>
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
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<number | 'admin' | ''>('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [isProcessingInvite, setIsProcessingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  
  const [setupData, setSetupData] = useState({ shopName: '', adminName: '', adminPin: '' });

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.filter(s => s.status === 'Active').toArray()) || [];
  const terminalId = useMemo(() => generateRequestCode(), []);

  const [isStaffDevice] = useState(() => localStorage.getItem('isStaffDevice') === 'true');

  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    const start = async () => {
      try {
        await initSettings();
        
        const urlParams = new URLSearchParams(window.location.search);
        const importData = urlParams.get('importData');
        const staffOnboarding = urlParams.get('staffData');

        if (importData) {
          await handleMagicLinkImport(importData);
        } else if (staffOnboarding) {
          await handleStaffInvite(staffOnboarding);
        }

        setIsInitialized(true);
      } catch (err: any) {
        console.error("Initialization failed", err);
      }
    };
    start();
  }, []);

  const handleMagicLinkImport = async (compressed: string) => {
    setIsProcessingImport(true);
    try {
      const currentSettings = await db.settings.get('app_settings');
      if (currentSettings?.sync_key) {
        const result = await importWhatsAppBridgeData(compressed, currentSettings.sync_key);
        // Clean URL after import
        window.history.replaceState({}, document.title, window.location.pathname);
        alert(`Magic Import Success!\n${result.count} items processed.`);
      } else {
        alert("Sync Key missing. Please generate one in Sync Station.");
      }
    } catch (err) {
      alert("Magic Import Failed. Ensure your Sync Key matches.");
    } finally {
      setIsProcessingImport(false);
    }
  };

  /**
   * ATOMIC PROVISIONING: Handle staff joins with URL cleaning and state sync.
   */
  const handleStaffInvite = async (compressed: string) => {
    setIsProcessingInvite(true);
    setInviteError(null);
    try {
      const json = LZString.decompressFromEncodedURIComponent(compressed);
      if (!json) throw new Error("CORRUPT_DATA");
      
      const data = JSON.parse(json);

      // 1. Atomic Provisioning
      await (db as any).transaction('rw', [db.settings, db.staff], async () => {
        await db.settings.update('app_settings', { 
          shop_name: data.shop, 
          sync_key: data.syncKey,
          is_setup_complete: true,
          last_used_timestamp: Date.now()
        });
        
        // Remove existing staff to ensure only the invited one is present on staff devices
        await db.staff.clear();
        await db.staff.add({
          name: data.name,
          role: data.role,
          password: data.password,
          status: 'Active',
          created_at: Date.now()
        });
      });

      // 2. URL Cleaning (Stop the Loop)
      window.history.replaceState({}, document.title, window.location.pathname);

      // 3. State Synchronization
      localStorage.setItem('isStaffDevice', 'true');
      localStorage.setItem('invitedStaffName', data.name);
      
      // Force immediate re-initialization to trigger Login View
      setIsInitialized(true);
    } catch (err) {
      console.error("Invite processing error:", err);
      setInviteError("Invite Failed. Please ask Admin for a new link.");
    } finally {
      setIsProcessingInvite(false);
    }
  };

  const copyKeyToClipboard = () => {
    if (settings?.sync_key) {
      navigator.clipboard.writeText(settings.sync_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const resetTerminal = async () => {
    if (confirm("This will wipe all local data and reset the terminal. Proceed?")) {
      await db.delete();
      localStorage.clear();
      window.location.href = '/';
    }
  };

  // 4. THE WELCOME GUARD: Processing invite screen
  if (isProcessingInvite || isProcessingImport) {
    return (
      <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative">
          <Loader2 size={80} className="animate-spin text-emerald-400 mb-8" />
          <ShieldCheck size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight">Establishing Secure Bridge...</h2>
        <p className="text-emerald-300 font-bold uppercase tracking-[0.2em] text-[10px] mt-4">NaijaShop Security Handshake in progress</p>
      </div>
    );
  }

  // 5. ERROR CATCHING: Invite failure UI
  if (inviteError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-rose-100 space-y-8 animate-in zoom-in">
          <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <XCircle size={56} />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-slate-900">Handshake Failed</h2>
            <p className="text-slate-500 font-medium leading-relaxed">{inviteError}</p>
          </div>
          <div className="pt-4 space-y-4">
            <button onClick={() => window.location.href = '/'} className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl hover:bg-emerald-700 transition-all">Try Again</button>
            <button onClick={resetTerminal} className="w-full py-4 text-rose-500 font-black text-xs uppercase tracking-widest hover:bg-rose-50 rounded-2xl">Reset Terminal App</button>
          </div>
        </div>
      </div>
    );
  }

  if (showSplash) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-6 text-center transition-all duration-700 animate-in fade-in">
        <div className="w-32 h-32 bg-white rounded-[2.5rem] p-6 flex items-center justify-center shadow-2xl animate-pulse-soft mb-8">
          <img src={LOGO_URL} className="w-full h-full object-contain" alt="NaijaShop Logo" />
        </div>
        <div className="space-y-2">
           <h1 className="text-white text-4xl font-black tracking-tighter">NaijaShop POS</h1>
           <p className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.2em]">Secure Terminal Starting...</p>
        </div>
      </div>
    );
  }

  if (isInitialized && settings && !settings.is_setup_complete) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 animate-in slide-in-from-bottom-8 duration-700">
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Setup Your Shop</h2>
            <p className="text-slate-500 font-medium">Create the primary terminal profile</p>
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
          }} className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 space-y-6">
            <input required type="text" placeholder="Shop Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={setupData.shopName} onChange={e => setSetupData({...setupData, shopName: e.target.value})} />
            <input required type="text" placeholder="Admin Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={setupData.adminName} onChange={e => setSetupData({...setupData, adminName: e.target.value})} />
            <input required type="password" maxLength={4} placeholder="Admin PIN" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl" value={setupData.adminPin} onChange={e => setSetupData({...setupData, adminPin: e.target.value})} />
            <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 shadow-xl transition-all">Complete Setup</button>
          </form>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-10">
          <div className="text-center flex flex-col items-center">
             <div className="w-24 h-24 bg-white rounded-[2rem] p-4 flex items-center justify-center shadow-2xl border border-slate-100 mb-6">
                <img src={LOGO_URL} className="w-full h-full object-contain" alt="NaijaShop Logo" />
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight">{settings?.shop_name || 'NaijaShop'}</h1>
             <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Digital POS Terminal</p>
          </div>
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 space-y-8">
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
            }} className="space-y-6">
              <select required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value === 'admin' ? 'admin' : Number(e.target.value))}>
                <option value="">Select Account</option>
                {!isStaffDevice && <option value="admin">{settings?.admin_name} (Admin)</option>}
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
              </select>
              <input required type="password" placeholder="PIN / Password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 shadow-xl transition-all">Unlock Terminal</button>
            </form>
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
        {currentView === 'activity-log' && <ActivityLog />}
        {currentView === 'transfer-station' && <TransferStation setView={setCurrentView} />}
        {currentView === 'inventory' && <Inventory setView={setCurrentView} currentUser={currentUser} />}
        {currentView === 'inventory-ledger' && <InventoryLedger />}
        {currentView === 'debts' && <Debts />}
        {currentView === 'ai-insights' && <AIInsights />}
        {currentView === 'sync' && <SyncStation currentUser={currentUser} setView={setCurrentView} />}
        {currentView === 'staff-management' && <StaffManagement />}
        {currentView === 'settings' && currentUser?.role === 'Admin' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
             <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
                <div>
                   <h3 className="text-2xl font-black text-slate-800 tracking-tight">Shop Identity</h3>
                   <p className="text-slate-500 text-sm">Control how your business appears on receipts and terminals.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Business Name</label>
                    <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={settings?.shop_name} onChange={async (e) => await db.settings.update('app_settings', { shop_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Admin Display Name</label>
                    <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={settings?.admin_name} onChange={async (e) => await db.settings.update('app_settings', { admin_name: e.target.value })} />
                  </div>
                </div>
             </div>

             <div className="bg-emerald-900 p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
                <div className="absolute right-[-20px] top-[-20px] opacity-10">
                  <Key size={180} />
                </div>
                <div className="relative z-10 space-y-6">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/20 rounded-2xl"><Zap size={24} /></div>
                      <div>
                        <h3 className="text-xl font-black">Shop Sync Key</h3>
                        <p className="text-emerald-300 font-bold uppercase tracking-widest text-[10px]">Security Bridge Configuration</p>
                      </div>
                   </div>

                   <div className="bg-white/10 p-6 rounded-3xl border border-white/10 space-y-4">
                      <p className="text-sm leading-relaxed text-emerald-50/80 font-medium">
                        This key must be the same on both Admin and Staff phones for WhatsApp Sync to work. Use this to manually link terminals.
                      </p>
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="flex-1 w-full bg-emerald-950/50 px-6 py-4 rounded-2xl font-mono text-lg font-black tracking-widest border border-emerald-800/50 flex items-center justify-between">
                           {settings?.sync_key || 'MISSING_KEY'}
                           <button onClick={copyKeyToClipboard} className="text-emerald-400 hover:text-white transition-colors">
                              {copiedKey ? <Check size={20} /> : <Copy size={20} />}
                           </button>
                        </div>
                        <button 
                           onClick={async () => {
                             if(confirm("Regenerating the sync key will unlink all current staff terminals until they are updated with the new key. Proceed?")) {
                               await db.settings.update('app_settings', { sync_key: generateSyncKey() });
                             }
                           }}
                           className="w-full sm:w-auto px-6 py-4 bg-white text-emerald-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                        >
                           <RefreshCw size={14} /> Regenerate
                        </button>
                      </div>
                   </div>

                   <div className="flex items-center gap-2 text-emerald-300">
                      <Info size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Invite QR codes automatically include this key</span>
                   </div>
                </div>
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
