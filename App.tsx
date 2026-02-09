import React, { useState, useEffect, ReactNode, Component } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'react-router-dom';
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
import StockAudit from './pages/StockAudit';
import SupportChat from './components/SupportChat';
import { 
  AlertTriangle,
  ShieldAlert,
  Loader2,
  X,
  Smartphone,
  MessageSquare,
  Key,
  ShieldCheck,
  CheckCircle2,
  Lock
} from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";
const MASTER_RECOVERY_PIN = "9999";
// Updated to use Netlify environment variables with the existing key as a fallback
const PAYSTACK_PUBLIC_KEY = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY || "pk_live_f001150495f27092c42d3d34d35e07663f707f15";

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

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState { 
    return { hasError: true, error }; 
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
    return (this as any).props.children;
  }
}

const AppContent: React.FC = () => {
  const location = useLocation();
  const [currentView, setCurrentView] = useState<View>('landing');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  const [isStaffLock, setIsStaffLock] = useState(localStorage.getItem('isStaffLock') === 'true');
  const [isMasterView, setIsMasterView] = useState(window.location.pathname.includes('master-control'));
  
  // Recovery States
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'initial' | 'reset'>('initial');
  const [masterCodeInput, setMasterCodeInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [parkTrigger, setParkTrigger] = useState(0);
  const [now, setNow] = useState(Date.now());

  const isAffiliateView = location.pathname.includes('affiliate');
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

  const handleStartSubscription = () => {
    if (!settings?.email) {
      alert("Please update your business email in Settings before subscribing.");
      setCurrentView('settings');
      return;
    }

    const handler = (window as any).PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: settings.email,
      amount: 10000 * 100, // ₦10,000 in kobo
      currency: "NGN",
      callback: (response: any) => {
        // Success: Redirect to activation view with reference
        window.location.href = `/?session=${response.reference}`;
      },
      onClose: () => {
        console.log("Payment window closed.");
      }
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
    } else alert("Invalid Password");
  };

  const handleForgotPin = () => {
    if (!selectedStaffId) {
      alert("Please select your account first.");
      return;
    }
    setRecoveryStep('initial');
    setMasterCodeInput('');
    setNewPin('');
    setConfirmNewPin('');
    setShowRecoveryModal(true);
  };

  const handleVerifyMasterCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterCodeInput === MASTER_RECOVERY_PIN) {
      setRecoveryStep('reset');
    } else {
      alert("Invalid Master Recovery Code. Please contact Support.");
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmNewPin) {
      alert("PINs do not match!");
      return;
    }
    if (newPin.length < 4) {
      alert("PIN must be at least 4 digits.");
      return;
    }

    try {
      const admin = staffList.find(s => s.role === 'Admin');
      if (admin && admin.id) {
        await db.staff.update(admin.id, { password: newPin });
        alert("Admin PIN updated successfully! You can now log in.");
        setShowRecoveryModal(false);
      } else {
        alert("System Error: Admin account not found.");
      }
    } catch (err) {
      alert("Failed to update PIN: " + err);
    }
  };

  const requestSupportReset = () => {
    const shopName = settings?.shop_name || 'NaijaShop User';
    const terminalId = settings?.terminal_id || 'UNKNOWN';
    const message = `Hello Support, I forgot my Admin PIN for Shop: ${shopName} (ID: ${terminalId}). Please assist.`;
    window.open(`https://wa.me/2348184774884?text=${encodeURIComponent(message)}`, '_blank');
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
  if (isAffiliateView) return <AffiliatePortal />;

  const s = settings as any;
  const isLicensed = settings?.license_expiry && settings.license_expiry > now;
  const trial = s?.installationDate ? getTrialRemainingTime(s.installationDate) : { totalMs: 999999, days: 30, hours: 0, minutes: 0 };
  const isTrialExpired = s?.installationDate && (trial.totalMs <= 0) && !s.isSubscribed && !isLicensed;

  if (isTrialExpired && currentView !== 'activation') {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3.5rem] text-center space-y-8">
          <ShieldAlert size={48} className="mx-auto text-emerald-600"/>
          <h2 className="text-3xl font-black">Trial Expired</h2>
          <p>Please subscribe to continue.</p>
          <button 
            onClick={handleStartSubscription}
            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl shadow-xl"
          >
            Activate Terminal (₦10,000)
          </button>
        </div>
      </div>
    );
  }

  if (isInitialized && (!settings?.is_setup_complete || staffList.length === 0)) {
    if (currentView === 'landing') return <LandingPage onStartTrial={() => setCurrentView('setup')} />;
    return <SetupShop onComplete={() => window.location.reload()} />;
  }

  if (!currentUser && currentView !== 'activation') {
    const selectedStaff = staffList.find(s => s.id === Number(selectedStaffId));
    const isAdminAccount = selectedStaff?.role === 'Admin';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-sm:px-4 max-w-sm space-y-10">
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
              
              <div className="text-right">
                <button 
                  type="button" 
                  onClick={handleForgotPin}
                  className="text-[10px] font-black text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-widest"
                >
                  Forgot PIN?
                </button>
              </div>

              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl active:scale-[0.98] transition-transform">Unlock Terminal</button>
            </form>
          </div>
        </div>

        {/* Recovery Modal */}
        {showRecoveryModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 shadow-2xl space-y-8 animate-in zoom-in duration-300 relative">
              <button 
                onClick={() => setShowRecoveryModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X size={24} />
              </button>

              {isAdminAccount ? (
                recoveryStep === 'initial' ? (
                  <div className="space-y-8">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                        <ShieldAlert size={32} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Security Recovery</h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        To reset your Admin PIN, you must contact NaijaShop Support.
                      </p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your Terminal ID</p>
                      <p className="text-lg font-black text-indigo-600 font-mono tracking-wider">{settings?.terminal_id || 'INITIALIZING...'}</p>
                    </div>

                    <button 
                      onClick={requestSupportReset}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all"
                    >
                      <MessageSquare size={18} /> Request Reset via WhatsApp
                    </button>

                    <div className="pt-4 border-t border-slate-100">
                       <form onSubmit={handleVerifyMasterCode} className="space-y-4">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enter Master Recovery Code</label>
                          <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input 
                              required
                              type="password" 
                              maxLength={4}
                              placeholder="••••"
                              className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-2xl tracking-[0.5em] focus:ring-2 focus:ring-emerald-500"
                              value={masterCodeInput}
                              onChange={e => setMasterCodeInput(e.target.value.replace(/\D/g, ''))}
                            />
                          </div>
                          <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest">Verify Code</button>
                       </form>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 animate-in slide-in-from-right duration-300">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                        <Lock size={32} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Set New PIN</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Admin Authorization Granted</p>
                    </div>

                    <form onSubmit={handleResetPin} className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">New Admin PIN</label>
                          <input 
                            required
                            autoFocus
                            type="password"
                            maxLength={4}
                            placeholder="••••"
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-3xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newPin}
                            onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirm PIN</label>
                          <input 
                            required
                            type="password"
                            maxLength={4}
                            placeholder="••••"
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-3xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-emerald-500"
                            value={confirmNewPin}
                            onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 active:scale-[0.98]"
                      >
                        Update Admin PIN
                      </button>
                    </form>
                  </div>
                )
              ) : (
                <div className="text-center space-y-8 py-4">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Smartphone size={32} />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Staff PIN Reset</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Please ask your Shop Owner (Admin) to reset your password in the <b>"Manage Staff"</b> section of the dashboard.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowRecoveryModal(false)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest"
                  >
                    Got it, Thanks
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <ErrorBoundary>
        <Layout 
          activeView={currentView} setView={setCurrentView} 
          shopName={settings?.shop_name || 'NaijaShop'} currentUser={currentUser} 
          isStaffLock={isStaffLock} toggleStaffLock={(v) => { setIsStaffLock(v); localStorage.setItem('isStaffLock', String(v)); }}
          adminPin={settings?.admin_pin || ''} onLogout={() => setCurrentUser(null)}
          trialRemaining={{...trial, label: s?.isSubscribed ? 'Pro License' : 'Free Trial', totalPeriod: s?.isSubscribed ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000}} isSubscribed={s?.isSubscribed}
          onSubscribe={handleStartSubscription}
        >
          {currentView === 'dashboard' && <Dashboard currentUser={currentUser} setView={setCurrentView} isStaffLock={isStaffLock} trialRemaining={{...trial, label: s?.isSubscribed ? 'Pro License' : 'Free Trial', totalPeriod: s?.isSubscribed ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000}} isSubscribed={s?.isSubscribed} onSubscribe={handleStartSubscription} />}
          {currentView === 'pos' && <POS setView={setCurrentView} currentUser={currentUser} cart={cart} setCart={setCart} parkTrigger={parkTrigger} />}
          {currentView === 'activity-log' && <ActivityLog currentUser={currentUser} />}
          {currentView === 'inventory' && <Inventory setView={setCurrentView} currentUser={currentUser} isStaffLock={isStaffLock} />}
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
          {currentView === 'activation' && <ActivationPage sessionRef={new URLSearchParams(window.location.search).get('session') || ''} onActivated={() => window.location.href = '/'} />}
        </Layout>
      </ErrorBoundary>
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