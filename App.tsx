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
import { performAutoSnapshot } from './utils/backup';
import { AlertTriangle, ShieldAlert, CreditCard, AlertCircle, ChevronLeft, Clock, Loader2 } from 'lucide-react';

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
  const [activationSession, setActivationSession] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [now, setNow] = useState(Date.now());

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.toArray()) || [];

  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 2000);
    initSettings().then(() => setIsInitialized(true));
    return () => clearTimeout(splashTimer);
  }, []);

  if (showSplash || !isInitialized) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-6">
        <div className="w-32 h-32 bg-white rounded-[2.5rem] p-6 flex items-center justify-center shadow-2xl mb-8">
          <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
        </div>
        <h1 className="text-white text-4xl font-black">NaijaShop POS</h1>
      </div>
    );
  }

  if (isMasterView) return <MasterAdminHub />;
  if (isAffiliateView) return <div className="p-8"><AffiliatePortal /></div>;
  if (isInitialized && (!settings?.is_setup_complete || staffList.length === 0)) {
    return <SetupShop onComplete={() => window.location.reload()} />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border w-full max-w-sm space-y-8">
          <h1 className="text-2xl font-black text-center">{settings?.shop_name || 'NaijaShop'}</h1>
          <form onSubmit={(e) => {
            e.preventDefault();
            const staff = staffList.find(s => s.id === Number(selectedStaffId));
            if (staff && staff.password === loginPassword) setCurrentUser(staff);
            else alert("Invalid PIN");
          }} className="space-y-6">
            <select required className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold" value={selectedStaffId} onChange={(e) => setSelectedStaffId(Number(e.target.value))}>
              <option value="">Select Account</option>
              {staffList.map(s => <option key={s.id} value={s.id!}>{s.name}</option>)}
            </select>
            <input required type="password" placeholder="PIN" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black">Unlock Terminal</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      activeView={currentView} setView={setCurrentView} 
      shopName={settings?.shop_name || 'NaijaShop'} 
      currentUser={currentUser} 
      isStaffLock={isStaffLock} toggleStaffLock={setIsStaffLock}
      adminPin={settings?.admin_pin || ''}
      onLogout={() => setCurrentUser(null)}
    >
      {currentView === 'dashboard' && <Dashboard currentUser={currentUser} setView={setCurrentView} />}
      {currentView === 'pos' && <POS setView={setCurrentView} currentUser={currentUser} />}
      {currentView === 'inventory' && <Inventory setView={setCurrentView} currentUser={currentUser} />}
      {currentView === 'activity-log' && <ActivityLog currentUser={currentUser} />}
      {currentView === 'settings' && <Settings currentUser={currentUser} />}
    </Layout>
  );
};

const App: React.FC = () => <AppContent />;
export default App;
