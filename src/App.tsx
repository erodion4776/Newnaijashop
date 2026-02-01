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
import { performAutoSnapshot } from './utils/backup';
import { 
  AlertTriangle,
  ShieldAlert,
  CreditCard,
  AlertCircle,
  Clock,
  Loader2,
  ChevronLeft
} from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";
const MASTER_RECOVERY_PIN = "9999";

export const getTrialRemainingTime = (installationDate: number) => {
  const trialPeriod = 30 * 24 * 60 * 60 * 1000;
  const expiry = installationDate + trialPeriod;
  const remaining = expiry - Date.now();
  
  if (remaining <= 0) return { days: 0, hours: 0, minutes: 0, totalMs: 0 };
  
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  
  return { days, hours, minutes, totalMs: remaining };
};

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState;
  /**
   * Fix: Explicitly define props to resolve 'Property props does not exist' error 
   * which can occur in strict mode or specific TypeScript configurations when 
   * accessing this.props in class components.
   */
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    /**
     * Fix: Explicitly assign props to class instance.
     */
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
  const [currentView, setCurrentView] = useState<View>('landing');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  const [isStaffLock, setIsStaffLock] = useState(localStorage.getItem('isStaffLock') === 'true');
  const [isAffiliateView, setIsAffiliateView] = useState(window.location.pathname.includes('affiliate'));
  const [isMasterView, setIsMasterView] = useState(window.location.pathname.includes('master-control'));
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [activationSession, setActivationSession] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  const [now, setNow] = useState(Date.now());

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.toArray()) || [];

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    if (session) {
      setActivationSession(session);
      setCurrentView('activation');
    }

    const splashTimer = setTimeout(() => setShowSplash(false), 2000);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsPWA(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const checkPath = () => {
      setIsAffiliateView(window.location.pathname.includes('affiliate'));
      setIsMasterView(window.location.pathname.includes('master-control'));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('popstate', checkPath);
    return () => {
      clearTimeout(splashTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('popstate', checkPath);
    };
  }, []);

  useEffect(() => {
    initSettings().then(async () => {
      setIsInitialized(true);
      const s = await db.settings.get('app_settings');
      if (s) {
        await db.settings.update('app_settings', { last_used_timestamp: Date.now() });
      }
    });
  }, []);

  const s = settings as any;
  const isLicensed = settings?.license_expiry && settings.license_expiry > now;
  const trial = s?.installationDate ? getTrialRemainingTime(s.installationDate) : { totalMs: 9999999999, days: 30, hours: 0, minutes: 0 };
  const isTrialExpired = s?.installationDate && (trial.totalMs <= 0) && !s.isSubscribed && !isLicensed;
  const isTampered = s?.last_used_timestamp && (now < s.last_used_timestamp - 300000);

  const handlePaystackPayment = () => {
    setIsProcessingPayment(true);
    const handler = (window as any).PaystackPop.setup({
      key: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 
      email: 'customer@naijashop.pos',
      amount: 1000000, 
      currency: 'NGN',
      ref: 'NS-' + Math.floor((Math.random() * 1000000000) + 1),
      callback: (response: any) => {
        setIsProcessingPayment(false);
        window.location.href = `/?session=${response.reference}`;
      },
      onClose: () => setIsProcessingPayment(false)
    });
    handler.openIframe();
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallModal(false);
      }
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const staff = staffList.find(s => s.id === Number(selectedStaffId));
    if (loginPassword === MASTER_RECOVERY_PIN) {
      const admin = staffList.find(s => s.role === 'Admin');
      if (admin) {
        setCurrentUser(admin);
        setCurrentView('dashboard');
        return;
      }
    }
    if (staff && staff.password === loginPassword) {
      setCurrentUser(staff);
      if (staff.role === 'Sales') setCurrentView('pos');
      else setCurrentView('dashboard');
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

  if (isMasterView) return <MasterAdminHub />;

  if (isTampered) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl border border-rose-500/30 space-y-8">
          <div className="w-24 h-24 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Clock size={48} />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight leading-tight">Security Alert</h2>
          <p className="text-rose-200/60 font-medium leading-relaxed">System clock tampering detected. Oga, please ensure your phone date and time are set correctly.</p>
          <button onClick={() => window.location.reload()} className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black text-lg">Re-validate Terminal</button>
        </div>
      </div>
    );
  }

  if (isTrialExpired && currentView !== 'activation') {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-8">
          <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Trial Expired</h2>
          <p className="text-slate-500 font-medium">Oga, your 30-day trial has ended. Please subscribe to continue.</p>
          <button onClick={handlePaystackPayment} disabled={isProcessingPayment} className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl flex items-center justify-center gap-3">
            {isProcessingPayment ? <Loader2 className="animate-spin" /> : <CreditCard size={24} />} Subscribe Now
          </button>
        </div>
      </div>
    );
  }

  if (isAffiliateView) return <AffiliatePortal />;

  if (isInitialized && (!settings?.is_setup_complete || staffList.length === 0)) {
    if (showLanding) return <LandingPage onStartTrial={() => setShowLanding(false)} />;
    return <SetupShop onComplete={() => window.location.reload()} />;
  }

  if (!currentUser && currentView !== 'activation') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-10">
          <div className="text-center flex flex-col items-center">
             <div className="w-24 h-24 bg-white rounded-[2rem] p-4 flex items-center justify-center shadow-2xl border border-slate-100 mb-6">
                <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight">{settings?.shop_name || 'NaijaShop'}</h1>
          </div>
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 space-y-8">
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <select required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={selectedStaffId} onChange={(e) => setSelectedStaffId(Number(e.target.value))}>
                <option value="">Select Account</option>
                {staffList.sort((a,b) => (a.role === 'Admin' ? -1 : 1)).map(s => (
                  <option key={s.id} value={s.id!}>{s.name} ({s.role})</option>
                ))}
              </select>
              <input required type="password" placeholder="PIN / Password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
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
        activeView={currentView} 
        setView={setCurrentView} 
        shopName={settings?.shop_name || 'NaijaShop POS'} 
        currentUser={currentUser} 
        isStaffLock={isStaffLock}
        toggleStaffLock={toggleStaffLock}
        adminPin={settings?.admin_pin || ''}
        onLogout={() => setCurrentUser(null)}
        trialRemaining={trial}
        isSubscribed={s?.isSubscribed}
        onSubscribe={handlePaystackPayment}
      >
        {currentView === 'dashboard' && <Dashboard currentUser={currentUser} setView={setCurrentView} isStaffLock={isStaffLock} trialRemaining={trial} isSubscribed={s?.isSubscribed} onSubscribe={handlePaystackPayment} />}
        {currentView === 'pos' && <POS setView={setCurrentView} currentUser={currentUser} />}
        {currentView === 'activity-log' && <ActivityLog currentUser={currentUser} />}
        {currentView === 'audit-trail' && <AuditTrail />}
        {currentView === 'expense-tracker' && <ExpenseTracker />}
        {currentView === 'transfer-station' && <TransferStation setView={setCurrentView} />}
        {currentView === 'inventory' && <Inventory setView={setCurrentView} currentUser={currentUser} isStaffLock={isStaffLock} />}
        {currentView === 'inventory-ledger' && <InventoryLedger />}
        {currentView === 'debts' && <Debts />}
        {currentView === 'business-hub' && <BusinessHub />}
        {currentView === 'staff-management' && <StaffManagement />}
        {currentView === 'security-backups' && <SecurityBackups currentUser={currentUser} />}
        {currentView === 'settings' && <Settings currentUser={currentUser} />}
        {currentView === 'activation' && activationSession && (
          <ActivationPage 
            sessionRef={activationSession} 
            onActivated={() => {
              setActivationSession(null);
              window.history.replaceState({}, document.title, "/");
              setCurrentView('dashboard');
            }} 
          />
        )}
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
