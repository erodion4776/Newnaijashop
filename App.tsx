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
import MasterAdminHub from './pages/MasterAdminHub';
import InstallModal from './components/InstallModal';
import SupportChat from './components/SupportChat';
import { performAutoSnapshot } from './utils/backup';
import { 
  AlertTriangle,
  Lock,
  ShieldAlert,
  CreditCard,
  AlertCircle,
  ChevronLeft,
  Clock,
  Loader2
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
  const [isAffiliateView, setIsAffiliateView] = useState(window.location.pathname.includes('affiliate'));
  const [isMasterView, setIsMasterView] = useState(window.location.pathname.includes('master-control'));
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [activationSession, setActivationSession] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.toArray()) || [];

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
      // Security Check: Anti-Time Travel Update
      const s = await db.settings.get('app_settings');
      if (s) {
        await db.settings.update('app_settings', { last_used_timestamp: Date.now() });
      }
    });
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        performAutoSnapshot();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Trial & Security Logic (Derived State)
  const trialPeriod = 30 * 24 * 60 * 60 * 1000;
  const s = settings as any;
  const isLicensed = settings?.license_expiry && settings.license_expiry > Date.now();
  const isTrialExpired = s?.installationDate && (Date.now() > s.installationDate + trialPeriod) && !s.isSubscribed && !isLicensed;
  
  // Anti-Time Travel Detection: Current time is notably behind last recorded usage
  const isTampered = s?.last_used_timestamp && (Date.now() < s.last_used_timestamp - 300000); // 5 min drift tolerance

  const handlePaystackPayment = () => {
    setIsProcessingPayment(true);
    const handler = (window as any).PaystackPop.setup({
      key: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 
      email: 'customer@naijashop.pos',
      amount: 1000000, // ₦10,000.00
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

  // PUBLIC ROUTE: Master Control (EXEMPT FROM LOCKS)
  if (isMasterView) {
    return <MasterAdminHub />;
  }

  // SECURITY: Clock Tampering Guard
  if (isTampered) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl border border-rose-500/30 space-y-8">
          <div className="w-24 h-24 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Clock size={48} />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-white tracking-tight leading-tight">Security Alert</h2>
            <p className="text-rose-200/60 font-medium leading-relaxed">
              System clock tampering detected. Oga, please ensure your phone date and time are set correctly to use NaijaShop.
            </p>
          </div>
          <button onClick={() => window.location.reload()} className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black text-lg shadow-xl">Re-validate Terminal</button>
        </div>
      </div>
    );
  }

  // TRIAL LOCKOUT: 30-day Free Trial Guard
  if (isTrialExpired && currentView !== 'activation') {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] text-center space-y-8 animate-in zoom-in">
          <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={48} />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight">Trial Expired</h2>
            <p className="text-slate-500 font-medium leading-relaxed">
              Oga, your 30-day free trial has ended. To continue using <b>NaijaShop</b> and protect your records, please subscribe.
            </p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Annual Subscription</p>
             <p className="text-3xl font-black text-slate-900">₦10,000<span className="text-sm font-bold text-slate-400">/Year</span></p>
          </div>
          <button 
            onClick={handlePaystackPayment}
            disabled={isProcessingPayment}
            className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95"
          >
            {isProcessingPayment ? <Loader2 className="animate-spin" /> : <CreditCard size={24} />} 
            Subscribe Now
          </button>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Instant Activation • Secure via Paystack</p>
        </div>
      </div>
    );
  }

  // PUBLIC ROUTE: Affiliate Portal
  if (isAffiliateView) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          <button onClick={() => { window.history.pushState({}, '', '/'); setIsAffiliateView(false); }} className="mb-6 flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-emerald-600 transition-all">
            <ChevronLeft size={14} /> Back to Terminal
          </button>
          <AffiliatePortal />
        </div>
      </div>
    );
  }

  // ONBOARDING: Setup Shop
  if (isInitialized && (!settings?.is_setup_complete || staffList.length === 0)) {
    return <SetupShop onComplete={() => window.location.reload()} />;
  }

  // LICENSE EXPIRED: Annual License Guard
  if (isLicensed === false && s?.isSubscribed && currentView !== 'activation') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-rose-100 text-center space-y-8">
          <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <AlertCircle size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">License Expired</h2>
            <p className="text-slate-500 leading-relaxed font-medium">Your annual NaijaShop license has ended. Please renew to continue using the terminal.</p>
          </div>
          <button 
            onClick={handlePaystackPayment}
            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95"
          >
            <CreditCard size={24} /> Renew License Now
          </button>
        </div>
      </div>
    );
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

          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 space-y-8 relative overflow-hidden">
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <select required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={selectedStaffId} onChange={(e) => setSelectedStaffId(Number(e.target.value))}>
                <option value="">Select Account</option>
                {staffList.sort((a,b) => (a.role === 'Admin' ? -1 : 1)).map(s => (
                  <option key={s.id} value={s.id!}>{s.name} ({s.role})</option>
                ))}
              </select>
              <input required type="password" placeholder="PIN / Password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
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