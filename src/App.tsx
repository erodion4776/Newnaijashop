
import React, { useState, useEffect, ErrorInfo, ReactNode, Component } from 'react';
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
import AffiliatePortal from './pages/AffiliatePortal';
import SetupShop from './pages/SetupShop';
import LandingPage from './pages/LandingPage';
import MasterAdminHub from './pages/MasterAdminHub';
import InstallModal from './components/InstallModal';
import SupportChat from './components/SupportChat';
import { 
  AlertTriangle,
  ShieldAlert,
  CreditCard,
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";
const MASTER_RECOVERY_PIN = "9999";

export const getTrialRemainingTime = (installationDate: number) => {
  const trialPeriod = 30 * 24 * 60 * 60 * 1000;
  const expiry = installationDate + trialPeriod;
  const remaining = expiry - Date.now();
  if (remaining <= 0) return { days: 0, hours: 0, minutes: 0, totalMs: 0 };
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 1000));
  const minutes = Math.floor((remaining % (60 * 1000)) / (60 * 1000));
  return { days, hours, minutes, totalMs: remaining };
};

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

/**
 * Fix: Explicitly extended Component (named import) to resolve 
 * 'Property props does not exist' and 'Property state does not exist' errors 
 * by ensuring correct type inheritance.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Explicitly initialize state property to help compiler track instance members
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState { 
    return { hasError: true, error }; 
  }

  render() {
    // Fix: Access state through this.state
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
    // Fix: Cast 'this' to any to access children when inheritance is not correctly resolved by the compiler
    return (this as any).props.children;
  }
}

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('landing');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  const [isStaffLock, setIsStaffLock] = useState(localStorage.getItem('isStaffLock') === 'true');
  const [isAffiliateView, setIsAffiliateView] = useState(window.location.pathname.includes('affiliate'));
  const [isMasterView, setIsMasterView] = useState(window.location.pathname.includes('master-control'));
  
  // Lifted Global Cart State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [parkTrigger, setParkTrigger] = useState(0);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.toArray()) || [];

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('session')) setCurrentView('activation');
    setTimeout(() => setShowSplash(false), 2000);
    const handleBeforeInstallPrompt = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    initSettings().then(() => setIsInitialized(true));
  }, []);

  const handleAddToCart = (product: Product, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { productId: product.id!, name: product.name, price: product.price, quantity }];
    });
    setCurrentView('pos');
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
    } else alert("Invalid Password");
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

  if (isMasterView) return <MasterAdminHub />;

  const s = settings as any;
  const isLicensed = settings?.license_expiry && settings.license_expiry > now;
  const trial = s?.installationDate ? getTrialRemainingTime(s.installationDate) : { totalMs: 999999, days: 30, hours: 0, minutes: 0 };
  const isTrialExpired = s?.installationDate && (trial.totalMs <= 0) && !s.isSubscribed && !isLicensed;

  if (isTrialExpired && currentView !== 'activation') {
    return <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-6"><div className="bg-white p-12 rounded-[3.5rem] text-center space-y-8"><ShieldAlert size={48} className="mx-auto text-emerald-600"/><h2 className="text-3xl font-black">Trial Expired</h2><p>Please subscribe to continue.</p></div></div>;
  }

  if (isInitialized && (!settings?.is_setup_complete || staffList.length === 0)) {
    if (currentView === 'landing') return <LandingPage onStartTrial={() => setCurrentView('setup')} />;
    return <SetupShop onComplete={() => window.location.reload()} />;
  }

  if (!currentUser && currentView !== 'activation') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-10">
          <div className="text-center flex flex-col items-center">
             <div className="w-24 h-24 bg-white rounded-[2rem] p-4 shadow-2xl border border-slate-100 mb-6">
                <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight">{settings?.shop_name || 'NaijaShop'}</h1>
          </div>
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200">
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <select required className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold" value={selectedStaffId} onChange={(e) => setSelectedStaffId(Number(e.target.value))}>
                <option value="">Select Account</option>
                {staffList.map(s => <option key={s.id} value={s.id!}>{s.name} ({s.role})</option>)}
              </select>
              <input required type="password" placeholder="PIN" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl">Unlock Terminal</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout 
        activeView={currentView} setView={setCurrentView} 
        shopName={settings?.shop_name || 'NaijaShop'} currentUser={currentUser} 
        isStaffLock={isStaffLock} toggleStaffLock={(v) => { setIsStaffLock(v); localStorage.setItem('isStaffLock', String(v)); }}
        adminPin={settings?.admin_pin || ''} onLogout={() => setCurrentUser(null)}
        trialRemaining={trial} isSubscribed={s?.isSubscribed}
      >
        {currentView === 'dashboard' && <Dashboard currentUser={currentUser} setView={setCurrentView} isStaffLock={isStaffLock} trialRemaining={trial} isSubscribed={s?.isSubscribed} />}
        {currentView === 'pos' && <POS setView={setCurrentView} currentUser={currentUser} cart={cart} setCart={setCart} parkTrigger={parkTrigger} />}
        {currentView === 'activity-log' && <ActivityLog currentUser={currentUser} />}
        {currentView === 'inventory' && <Inventory setView={setCurrentView} currentUser={currentUser} isStaffLock={isStaffLock} />}
        {currentView === 'settings' && <Settings currentUser={currentUser} />}
        {currentView === 'business-hub' && <BusinessHub />}
        {currentView === 'audit-trail' && <AuditTrail />}
        {currentView === 'expense-tracker' && <ExpenseTracker currentUser={currentUser} isStaffLock={isStaffLock} />}
        {currentView === 'transfer-station' && <TransferStation setView={setCurrentView} />}
        {currentView === 'inventory-ledger' && <InventoryLedger />}
        {currentView === 'debts' && <Debts />}
        {currentView === 'staff-management' && <StaffManagement />}
        {currentView === 'security-backups' && <SecurityBackups currentUser={currentUser} />}
        {currentView === 'activation' && <ActivationPage sessionRef={new URLSearchParams(window.location.search).get('session') || ''} onActivated={() => window.location.href = '/'} />}
      </Layout>
      <SupportChat 
        currentUser={currentUser} cart={cart} onClearCart={() => setCart([])}
        onNavigate={setCurrentView} onAddToCart={handleAddToCart}
        onParkOrder={() => { setCurrentView('pos'); setParkTrigger(prev => prev + 1); }}
      />
    </>
  );
};

const App: React.FC = () => (<ErrorBoundary><AppContent /></ErrorBoundary>);
export default App;
