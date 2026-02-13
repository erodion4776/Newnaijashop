import React, { useState, useEffect, ReactNode, Component } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initSettings } from './db/db';
import { View, Staff, SaleItem, Product } from './types';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import InventoryLedger from './pages/InventoryLedger';
import Debts from './pages/Debts';
import BusinessHub from './pages/BusinessHub';
import TransferStation from './pages/TransferStation';
import StaffManagement from './pages/StaffManagement';
import ActivityLog from './pages/ActivityLog';
import SecurityBackups from './pages/SecurityBackups';
import Settings from './pages/Settings';
import ExpenseTracker from './pages/ExpenseTracker';
import AuditTrail from './pages/AuditTrail';
import ActivationPage from './pages/ActivationPage';
import SetupShop from './pages/SetupShop';
import LandingPage from './pages/LandingPage';
import StockAudit from './pages/StockAudit';
import { 
  AlertTriangle,
  ShieldAlert,
  CreditCard,
  Loader2
} from 'lucide-react';
import { importWhatsAppBridgeData } from './services/syncService';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";
const MASTER_RECOVERY_PIN = "9999";
const PAYSTACK_PUBLIC_KEY = (import.meta as any).env?.VITE_PAYSTACK_PUBLIC_KEY || "pk_live_f001150495f27092c42d3d34d35e07663f707f15";

// Fix: Updated getLicenseRemainingTime to include hours and minutes to resolve type mismatch on Layout prop
export const getLicenseRemainingTime = (settings: any) => {
  const now = Date.now();
  const isSubscribed = !!settings?.isSubscribed;
  const trialPeriod = 30 * 24 * 60 * 60 * 1000;
  const proPeriod = 365 * 24 * 60 * 60 * 1000;
  const totalPeriod = isSubscribed ? proPeriod : trialPeriod;
  let expiry = isSubscribed ? (settings?.license_expiry || (now + proPeriod)) : ((settings?.installationDate || now) + trialPeriod);
  const totalMs = Math.max(0, expiry - now);
  const days = Math.floor(totalMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((totalMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((totalMs % (60 * 60 * 1000)) / (60 * 1000));
  const percentage = (totalMs / totalPeriod) * 100;
  return { days, hours, minutes, percentage, totalMs, totalPeriod, label: isSubscribed ? 'Pro License' : 'Free Trial' };
};

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  constructor(props: ErrorBoundaryProps) { super(props); }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl space-y-8">
            <AlertTriangle size={40} className="mx-auto text-rose-600" />
            <h2 className="text-2xl font-black">System Interruption</h2>
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black">Reload Terminal</button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('landing');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joiningShopName, setJoiningShopName] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isStaffLock, setIsStaffLock] = useState(localStorage.getItem('isStaffLock') === 'true');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [parkTrigger, setParkTrigger] = useState(0);

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.toArray()) || [];

  /**
   * THE JOIN ENGINE: Early Interception
   * STRICT INSTRUCTION: Priority check for invites before any routing.
   */
  useEffect(() => {
    const runInit = async () => {
      await initSettings();
      
      const urlParams = new URLSearchParams(window.location.search);
      const inviteData = urlParams.get('invite') || urlParams.get('data');
      
      if (inviteData) {
        setIsJoining(true);
        try {
          // Handshake logic inside importWhatsAppBridgeData for STAFF_INVITE type
          const result = await importWhatsAppBridgeData(inviteData, ''); 
          if (result.success && result.type === 'STAFF_INVITE') {
            setJoiningShopName(result.shop_name);
            // Allow 1 second for DB to commit and for visual feedback
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Clean URL and switch view to login (null currentUser shows login screen)
            window.history.replaceState({}, '', '/');
          }
        } catch (err) {
          console.error("Critical Invite Join Error:", err);
        } finally {
          setIsJoining(false);
        }
      }
      
      setIsInitialized(true);
      setTimeout(() => setShowSplash(false), 1500);
    };
    runInit();
  }, []);

  // Pre-fill logic: If we just joined, auto-select the invited staff in dropdown
  useEffect(() => {
    if (staffList.length > 0 && !selectedStaffId) {
      // Find the most recently added staff (likely the invited one)
      const latestStaff = [...staffList].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
      if (latestStaff?.id) setSelectedStaffId(latestStaff.id);
    }
  }, [staffList]);

  const handleStartSubscription = async () => {
    const currentSettings = await db.settings.get('app_settings');
    if (!currentSettings?.email) { alert("Please save a business email in Settings first."); setCurrentView('settings'); return; }
    const handler = (window as any).PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: currentSettings.email,
      amount: 10000 * 100,
      currency: "NGN",
      callback: (res: any) => { window.location.href = `/?session=${res.reference}`; }
    });
    handler.openIframe();
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const staff = staffList.find(s => s.id === Number(selectedStaffId));
    if (loginPassword === MASTER_RECOVERY_PIN) {
      const admin = staffList.find(s => s.role === 'Admin');
      if (admin) { setCurrentUser(admin); setCurrentView('dashboard'); return; }
    }
    if (staff && staff.password === loginPassword) {
      setCurrentUser(staff);
      setCurrentView(staff.role === 'Sales' ? 'pos' : 'dashboard');
    } else alert("Invalid PIN");
  };

  if (showSplash || !isInitialized || isJoining) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-6 text-center">
        <img src={LOGO_URL} className="w-32 h-32 object-contain animate-pulse" alt="Logo" />
        <h1 className="text-white text-4xl font-black mt-8">NaijaShop</h1>
        {isJoining && (
          <div className="mt-8 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="flex items-center justify-center gap-3 text-emerald-300">
                <Loader2 className="animate-spin" size={20} />
                <p className="font-bold tracking-widest uppercase text-xs">Connecting to terminal...</p>
             </div>
             {joiningShopName && <p className="text-white font-black text-xl tracking-tight italic">"{joiningShopName}"</p>}
          </div>
        )}
      </div>
    );
  }

  const licenseInfo = getLicenseRemainingTime(settings);
  if (licenseInfo.totalMs <= 0 && !settings?.isSubscribed && currentView !== 'activation') {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3.5rem] text-center space-y-8 max-w-md w-full shadow-2xl">
          <ShieldAlert size={48} className="mx-auto text-rose-600" />
          <h2 className="text-3xl font-black">Trial Expired</h2>
          <button onClick={handleStartSubscription} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl"><CreditCard className="inline mr-2"/> Subscribe Now (₦10k/Yr)</button>
        </div>
      </div>
    );
  }

  if (!settings?.is_setup_complete || (staffList.length === 0 && !settings?.shop_name)) {
    if (currentView === 'landing') return <LandingPage onStartTrial={() => setCurrentView('setup')} />;
    return <SetupShop onComplete={() => window.location.reload()} />;
  }

  if (!currentUser && new URLSearchParams(window.location.search).get('session')) {
    return <ActivationPage sessionRef={new URLSearchParams(window.location.search).get('session')!} onActivated={() => window.location.href = '/'} />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-sm:px-4 max-w-sm space-y-10 animate-in fade-in duration-700">
          <div className="text-center flex flex-col items-center">
             <div className="w-24 h-24 bg-white rounded-[2rem] p-4 shadow-2xl border border-slate-100 mb-6">
                <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight">{settings?.shop_name || 'NaijaShop'}</h1>
          </div>
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200">
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terminal Account</label>
                <select required className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={selectedStaffId} onChange={(e) => setSelectedStaffId(Number(e.target.value))}>
                  <option value="">Select Account</option>
                  {staffList.map(s => <option key={s.id} value={s.id!}>{s.name} ({s.role})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access PIN</label>
                <input required type="password" inputMode="numeric" placeholder="••••" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-black text-center text-3xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-emerald-500" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value.replace(/\D/g, ''))} />
              </div>
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl hover:bg-emerald-700 transition-all active:scale-[0.98]">Unlock Terminal</button>
            </form>
          </div>
          <div className="text-center">
            <button onClick={() => setCurrentView('setup')} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors">Register New Terminal Account</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      activeView={currentView} setView={setCurrentView} 
      shopName={settings?.shop_name || 'NaijaShop'} currentUser={currentUser} 
      isStaffLock={isStaffLock} toggleStaffLock={v => { setIsStaffLock(v); localStorage.setItem('isStaffLock', String(v)); }}
      adminPin={settings?.admin_pin || ''} onLogout={() => setCurrentUser(null)}
      trialRemaining={licenseInfo} isSubscribed={settings?.isSubscribed}
      onSubscribe={handleStartSubscription}
    >
      {currentView === 'dashboard' && <Dashboard currentUser={currentUser} setView={setCurrentView} isStaffLock={isStaffLock} trialRemaining={licenseInfo} isSubscribed={settings?.isSubscribed} onSubscribe={handleStartSubscription} />}
      {currentView === 'pos' && <POS setView={setCurrentView} currentUser={currentUser} cart={cart} setCart={setCart} parkTrigger={parkTrigger} />}
      {currentView === 'inventory' && <Inventory setView={setCurrentView} currentUser={currentUser} isStaffLock={isStaffLock} />}
      {currentView === 'activity-log' && <ActivityLog currentUser={currentUser} />}
      {currentView === 'settings' && <Settings currentUser={currentUser} onSubscribe={handleStartSubscription} />}
      {currentView === 'business-hub' && <BusinessHub />}
      {currentView === 'audit-trail' && <AuditTrail />}
      {currentView === 'expense-tracker' && <ExpenseTracker currentUser={currentUser} isStaffLock={isStaffLock} />}
      {currentView === 'transfer-station' && <TransferStation setView={setCurrentView} />}
      {currentView === 'inventory-ledger' && <InventoryLedger />}
      {currentView === 'stock-audit' && <StockAudit />}
      {currentView === 'debts' && <Debts />}
      {currentView === 'staff-management' && <StaffManagement />}
      {currentView === 'security-backups' && <SecurityBackups currentUser={currentUser} />}
      {currentView === 'activation' && <ActivationPage sessionRef={new URLSearchParams(window.location.search).get('session')!} onActivated={() => window.location.href = '/'} />}
    </Layout>
  );
};

const App: React.FC = () => (<ErrorBoundary><AppContent /></ErrorBoundary>);
export default App;
