
import React, { useState, useEffect, ErrorInfo, ReactNode, Component } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initSettings } from './db/db';
import { View, Staff } from './types';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import InventoryLedger from './pages/InventoryLedger';
import Debts from './pages/Debts';
import AIInsights from './pages/AIInsights';
import TransferStation from './pages/TransferStation';
import StaffManagement from './pages/StaffManagement';
import ActivityLog from './pages/ActivityLog';
import SecurityBackups from './pages/SecurityBackups';
import Settings from './pages/Settings';
import ExpenseTracker from './pages/ExpenseTracker';
import InstallModal from './components/InstallModal';
import SupportChat from './components/SupportChat';
import { performAutoSnapshot } from './utils/backup';
import { 
  AlertTriangle,
  Loader2,
  Lock,
  ShieldAlert
} from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";
const MASTER_RECOVERY_PIN = "9999";

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState;
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.props = props;
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
  const [isStaffLock, setIsStaffLock] = useState(localStorage.getItem('isStaffLock') === 'true');
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  const [setupData, setSetupData] = useState({ shopName: '', adminName: '', adminPin: '' });

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.toArray()) || [];

  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 2000);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsPWA(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      clearTimeout(splashTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    initSettings().then(() => setIsInitialized(true));
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        performAutoSnapshot();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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
    if (!isPWA) {
      setTimeout(() => setShowInstallModal(true), 1500);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallModal(false);
        alert('NaijaShop is now on your Home Screen!');
      }
    } else {
      alert('To install: Tap the "Share" button in Safari and select "Add to Home Screen".');
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const staff = staffList.find(s => s.id === Number(selectedStaffId));
    if (loginPassword === MASTER_RECOVERY_PIN) {
      const admin = staffList.find(s => s.role === 'Admin');
      if (admin) {
        setCurrentUser(admin);
        setCurrentView('settings');
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

  const toggleStaffLock = (active: boolean) => {
    setIsStaffLock(active);
    localStorage.setItem('isStaffLock', active.toString());
  };

  if (showSplash || !isInitialized) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-32 h-32 bg-white rounded-[2.5rem] p-6 flex items-center justify-center shadow-2xl animate-pulse-soft mb-8">
          <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
        </div>
        <h1 className="text-white text-4xl font-black tracking-tighter">NaijaShop POS</h1>
      </div>
    );
  }

  if (isInitialized && staffList.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
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
    <>
      <Layout 
        activeView={currentView} 
        setView={setCurrentView} 
        shopName={settings?.shop_name || 'NaijaShop POS'} 
        currentUser={currentUser} 
        isStaffLock={isStaffLock}
        toggleStaffLock={toggleStaffLock}
        adminPin={settings?.admin_pin || ''}
        onLogout={() => { setCurrentUser(null); }}
        canInstall={!!deferredPrompt || (!isPWA && /iPhone|iPad|iPod/.test(navigator.userAgent))}
        onInstall={handleInstallClick}
      >
        {showInstallModal && <InstallModal onInstall={handleInstallClick} onClose={() => setShowInstallModal(false)} />}
        {currentView === 'dashboard' && <Dashboard currentUser={currentUser} setView={setCurrentView} isStaffLock={isStaffLock} />}
        {currentView === 'pos' && <POS setView={setCurrentView} currentUser={currentUser} />}
        {currentView === 'activity-log' && <ActivityLog currentUser={currentUser} />}
        {currentView === 'expense-tracker' && <ExpenseTracker />}
        {currentView === 'transfer-station' && <TransferStation setView={setCurrentView} />}
        {currentView === 'inventory' && <Inventory setView={setCurrentView} currentUser={currentUser} isStaffLock={isStaffLock} />}
        {currentView === 'inventory-ledger' && <InventoryLedger />}
        {currentView === 'debts' && <Debts />}
        {currentView === 'ai-insights' && <AIInsights />}
        {currentView === 'staff-management' && <StaffManagement />}
        {currentView === 'security-backups' && <SecurityBackups currentUser={currentUser} />}
        {currentView === 'settings' && <Settings currentUser={currentUser} />}
      </Layout>
      <SupportChat />
    </>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);

export default App;
