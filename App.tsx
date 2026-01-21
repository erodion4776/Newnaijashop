
import React, { useState, useEffect, useMemo, ErrorInfo, ReactNode, Component } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initSettings } from './db/db';
import { View, Staff } from './types';
import LZString from 'lz-string';
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
  AlertTriangle,
  ShieldCheck,
  Smartphone,
  Loader2,
  Key,
  Copy,
  Check,
  Zap,
  RefreshCw,
  XCircle,
  Wrench,
  QrCode,
  PartyPopper,
  User,
  ShieldAlert
} from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";
const MASTER_RECOVERY_PIN = "9999";

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

// Use Component from 'react' directly and provide type arguments for props and state to fix line 61 error
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState { 
    return { hasError: true, error }; 
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) { 
    console.error("Uncaught Terminal Error:", error, errorInfo); 
  }

  render() {
    if (this.state.hasError) {
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
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [isProcessingInvite, setIsProcessingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showScannerForJoin, setShowScannerForJoin] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  
  const [setupData, setSetupData] = useState({ shopName: '', adminName: '', adminPin: '' });

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.toArray()) || [];
  
  const isStaffDevice = localStorage.getItem('isStaffDevice') === 'true';

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
        const staffOnboarding = urlParams.get('staffData') || urlParams.get('data') || urlParams.get('invite');

        if (importData) {
          await handleMagicLinkImport(importData);
        } else if (staffOnboarding) {
          await handleStaffInvite(staffOnboarding);
        }
        setIsInitialized(true);
      } catch (err) {
        console.error("Initialization failed", err);
      }
    };
    start();
  }, []);

  // Intelligent pre-selection for new joiners
  useEffect(() => {
    if (isInitialized && !currentUser && staffList.length > 0) {
      const justJoined = localStorage.getItem('justJoined');
      const invitedName = localStorage.getItem('invitedStaffName');
      
      if (justJoined === 'true' && invitedName) {
        const staff = staffList.find(s => s.name === invitedName);
        if (staff && staff.id) {
          setSelectedStaffId(staff.id);
          setWelcomeMessage(`Welcome to ${settings?.shop_name || 'NaijaShop'}! Enter your PIN to start.`);
          localStorage.removeItem('justJoined');
        }
      } else if (selectedStaffId === '') {
        // Default to the first Admin in the list
        const admin = staffList.find(s => s.role === 'Admin');
        if (admin && admin.id) setSelectedStaffId(admin.id);
      }
    }
  }, [isInitialized, currentUser, staffList, settings]);

  const handleMagicLinkImport = async (compressed: string) => {
    setIsProcessingImport(true);
    try {
      const currentSettings = await db.settings.get('app_settings');
      if (currentSettings?.sync_key) {
        const result = await importWhatsAppBridgeData(compressed, currentSettings.sync_key);
        window.history.replaceState({}, document.title, window.location.pathname);
        alert(`Magic Import Success!\n${result.count} items processed.`);
      }
    } catch (err) {
      alert("Magic Import Failed. Ensure Sync Key matches.");
    } finally {
      setIsProcessingImport(false);
    }
  };

  const handleStaffInvite = async (compressed: string) => {
    setIsProcessingInvite(true);
    setInviteError(null);
    try {
      const json = LZString.decompressFromEncodedURIComponent(compressed);
      if (!json) throw new Error("CORRUPT_DATA");
      const data = JSON.parse(json);

      await (db as any).transaction('rw', [db.settings, db.staff], async () => {
        const s = await db.settings.get('app_settings');
        await db.settings.put({
          ...s,
          id: 'app_settings',
          shop_name: data.shop || data.shopName,
          sync_key: data.syncKey || data.masterSyncKey,
          is_setup_complete: true
        });

        const staffName = data.name || data.staffMember?.name;
        const exists = await db.staff.where('name').equals(staffName).first();
        if (!exists) {
          await db.staff.add({
            name: staffName,
            role: data.role || 'Sales',
            password: data.password,
            status: 'Active',
            created_at: Date.now()
          });
        }
        localStorage.setItem('justJoined', 'true');
        localStorage.setItem('invitedStaffName', staffName);
      });

      window.history.replaceState({}, document.title, '/');
      localStorage.setItem('isStaffDevice', 'true');
      setIsInitialized(true); 
    } catch (err) {
      setInviteError("Invite link invalid or expired.");
    } finally {
      setIsProcessingInvite(false);
    }
  };

  const handleSetupComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    await (db as any).transaction('rw', [db.settings, db.staff], async () => {
      await db.settings.update('app_settings', {
        shop_name: setupData.shopName,
        admin_name: setupData.adminName,
        admin_pin: setupData.adminPin,
        is_setup_complete: true
      });
      const adminId = await db.staff.add({
        name: setupData.adminName,
        role: 'Admin',
        password: setupData.adminPin,
        status: 'Active',
        created_at: Date.now()
      });
      const adminUser = await db.staff.get(adminId);
      if (adminUser) setCurrentUser(adminUser);
    });
    setCurrentView('dashboard');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const staff = staffList.find(s => s.id === Number(selectedStaffId));
    
    // Recovery Logic
    if (loginPassword === MASTER_RECOVERY_PIN) {
      const admin = staffList.find(s => s.role === 'Admin');
      if (admin) {
        setCurrentUser(admin);
        setCurrentView('settings');
        alert("Emergency Admin Access.");
        return;
      }
    }

    if (staff && staff.password === loginPassword) {
      setCurrentUser(staff);
      if (staff.role === 'Sales') setCurrentView('pos');
    } else {
      alert("Invalid Password or PIN");
    }
  };

  if (isProcessingInvite || isProcessingImport) {
    return (
      <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 size={80} className="animate-spin text-emerald-400 mb-8" />
        <h2 className="text-3xl font-black text-white">Linking Terminal...</h2>
      </div>
    );
  }

  if (showSplash) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-32 h-32 bg-white rounded-[2.5rem] p-6 flex items-center justify-center shadow-2xl animate-pulse-soft mb-8">
          <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
        </div>
        <h1 className="text-white text-4xl font-black tracking-tighter">NaijaShop POS</h1>
      </div>
    );
  }

  // Setup Guard: Only if NO users exist
  if (isInitialized && staffList.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        {showScannerForJoin && (
          <BarcodeScanner 
            onScan={(data) => { handleStaffInvite(data); setShowScannerForJoin(false); }} 
            onClose={() => setShowScannerForJoin(false)} 
          />
        )}
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Onboarding</h2>
            <p className="text-slate-500 font-medium">Initialize your shop terminal</p>
          </div>
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 space-y-8">
            <form onSubmit={handleSetupComplete} className="space-y-6">
              <input required type="text" placeholder="Shop Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={setupData.shopName} onChange={e => setSetupData({...setupData, shopName: e.target.value})} />
              <input required type="text" placeholder="Admin Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={setupData.adminName} onChange={e => setSetupData({...setupData, adminName: e.target.value})} />
              <input required type="password" maxLength={4} placeholder="Set Admin PIN (4 digits)" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl text-center" value={setupData.adminPin} onChange={e => setSetupData({...setupData, adminPin: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 shadow-xl transition-all">Start New Shop</button>
            </form>
            <div className="relative text-center"><span className="bg-white px-4 text-slate-300 font-black text-xs uppercase">Or</span><div className="absolute inset-0 top-1/2 -z-10 border-t border-slate-100"></div></div>
            <button onClick={() => setShowScannerForJoin(true)} className="w-full py-4 bg-slate-50 text-slate-600 rounded-[2rem] font-black text-xs uppercase tracking-widest border border-slate-200 flex items-center justify-center gap-3"><QrCode size={18} /> Join as Staff</button>
          </div>
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
                <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight">{settings?.shop_name || 'NaijaShop'}</h1>
          </div>

          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 space-y-8 relative overflow-hidden">
            {welcomeMessage && (
               <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in">
                 <PartyPopper size={18} className="text-emerald-600" />
                 <p className="text-xs font-bold text-emerald-800 leading-tight">{welcomeMessage}</p>
               </div>
            )}
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <select required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={selectedStaffId} onChange={(e) => setSelectedStaffId(Number(e.target.value))}>
                <option value="">Select Account</option>
                {staffList.sort((a,b) => (a.role === 'Admin' ? -1 : 1)).map(s => (
                  <option key={s.id} value={s.id!}>{s.name} ({s.role})</option>
                ))}
              </select>
              <input required type="password" placeholder="PIN / Password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 shadow-xl transition-all">Unlock Terminal</button>
            </form>
          </div>
          <button onClick={() => { const pin = prompt("Recovery PIN:"); if(pin === MASTER_RECOVERY_PIN) alert("Use 9999 as password for any Admin."); }} className="w-full text-center text-slate-300 text-[10px] font-black uppercase tracking-widest"><ShieldAlert size={12} className="inline mr-1" /> Recovery Options</button>
        </div>
      </div>
    );
  }

  return (
    <SyncProvider currentUser={currentUser}>
      <Layout activeView={currentView} setView={setCurrentView} shopName={settings?.shop_name || 'NaijaShop POS'} currentUser={currentUser} onLogout={() => { setCurrentUser(null); setWelcomeMessage(null); }}>
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
        {currentView === 'settings' && <div className="p-8 text-center text-slate-400 font-bold">Settings Hub (Admin Only)</div>}
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
