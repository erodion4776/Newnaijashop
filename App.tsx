
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
import { importWhatsAppBridgeData } from './services/syncService';
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
  Key
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
  
  const [setupData, setSetupData] = useState({ shopName: '', adminName: '', adminPin: '' });

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.filter(s => s.status === 'Active').toArray()) || [];
  const terminalId = useMemo(() => generateRequestCode(), []);

  const [isStaffDevice] = useState(() => localStorage.getItem('isStaffDevice') === 'true');
  const [invitedStaffName] = useState(() => localStorage.getItem('invitedStaffName') || '');

  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    const start = async () => {
      try {
        await initSettings();
        
        // Handle URL Magic Links
        const urlParams = new URLSearchParams(window.location.search);
        const importData = urlParams.get('importData');
        const staffOnboarding = urlParams.get('staffData');

        if (importData) {
          await handleMagicLinkImport(importData);
        } else if (staffOnboarding) {
          await handleStaffOnboarding(staffOnboarding);
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
        alert(`Magic Import Success!\n${result.count} items processed.`);
        window.history.replaceState({}, document.title, "/");
      }
    } catch (err) {
      alert("Magic Import Failed. Ensure your Sync Key matches.");
    } finally {
      setIsProcessingImport(false);
    }
  };

  const handleStaffOnboarding = async (compressed: string) => {
    try {
      const json = LZString.decompressFromEncodedURIComponent(compressed);
      if (!json) return;
      const data = JSON.parse(json);
      
      await db.settings.update('app_settings', { 
        shop_name: data.shop, 
        sync_key: data.syncKey,
        is_setup_complete: true 
      });
      
      await db.staff.clear();
      await db.staff.add({
        name: data.name,
        role: data.role,
        password: data.password,
        status: 'Active',
        created_at: Date.now()
      });
      
      localStorage.setItem('isStaffDevice', 'true');
      localStorage.setItem('invitedStaffName', data.name);
      alert("Welcome to the shop! Your terminal is now configured.");
      window.location.reload();
    } catch (err) {
      alert("Onboarding failed.");
    }
  };

  if (isProcessingImport) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 size={64} className="animate-spin text-white mb-6" />
        <h2 className="text-3xl font-black text-white">Decrypting Bridge Data...</h2>
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
          <div className="max-w-4xl mx-auto space-y-6">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black text-slate-800 mb-4">Security Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Master Sync Key (For WhatsApp Bridge)</label>
                    <input className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono" value={settings?.sync_key} onChange={async (e) => await db.settings.update('app_settings', { sync_key: e.target.value })} />
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
