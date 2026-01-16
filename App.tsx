
import React, { useState, useEffect, useMemo, ErrorInfo, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initSettings } from './db/db';
import { View, Staff } from './types';
import { generateRequestCode, validateLicense } from './utils/licensing';
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
import { SyncProvider } from './context/SyncProvider';
import { 
  ShieldAlert, 
  Key, 
  Landmark, 
  Lock, 
  User, 
  ChevronRight, 
  CheckCircle2, 
  X,
  Store,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Terminal
} from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Terminal Error:", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    // Fix: Explicitly casting 'this' to any to resolve the issue where the TypeScript compiler fails to recognize the inherited 'props' property from React.Component.
    const { children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-rose-100 space-y-8">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={40} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">System Interruption</h2>
              <p className="text-slate-500 text-sm">The terminal encountered an unexpected error.</p>
            </div>
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
  const [initError, setInitError] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [onboardingSuccess, setOnboardingSuccess] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | 'admin' | ''>('');
  
  const [isStaffDevice, setIsStaffDevice] = useState(() => localStorage.getItem('isStaffDevice') === 'true');
  const [invitedStaffName, setInvitedStaffName] = useState(() => localStorage.getItem('invitedStaffName') || '');

  const [setupData, setSetupData] = useState({ shopName: '', adminName: '', adminPin: '' });

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.filter(s => s.status === 'Active').toArray()) || [];
  const requestCode = useMemo(() => generateRequestCode(), []);

  // Prevent browser sleep (Wake Lock API)
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn("Wake Lock not supported or failed", err);
      }
    };
    requestWakeLock();
    return () => { if (wakeLock) wakeLock.release(); };
  }, []);

  useEffect(() => {
    const start = async () => {
      try {
        await initSettings();
        const urlParams = new URLSearchParams(window.location.search);
        const onboardingData = urlParams.get('staffData') || urlParams.get('invite');
        
        if (onboardingData) {
          try {
            const decoded = JSON.parse(atob(onboardingData));
            let staffId;
            const existing = await db.staff.where('name').equals(decoded.name).first();
            if (!existing) {
              staffId = await db.staff.add({ name: decoded.name, role: decoded.role, password: decoded.password, status: 'Active', created_at: Date.now() });
            }
            localStorage.setItem('isStaffDevice', 'true');
            localStorage.setItem('invitedStaffName', decoded.name);
            setIsStaffDevice(true);
            setInvitedStaffName(decoded.name);
            await db.settings.update('app_settings', { shop_name: decoded.shop || 'NaijaShop', is_setup_complete: true, license_key: 'STAFF-TERMINAL-ACTIVE' });
            setOnboardingSuccess('Terminal Access Activated!');
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {}
        }
        setTimeout(() => setIsInitialized(true), 1200);
      } catch (err: any) {
        setInitError(err?.message || "Could not connect to local database.");
      }
    };
    start();
  }, []);

  useEffect(() => {
    if (isStaffDevice && staffList.length > 0 && selectedStaffId === '') {
      const staff = staffList.find(s => s.name === invitedStaffName);
      if (staff) setSelectedStaffId(staff.id!);
    }
  }, [isStaffDevice, staffList, invitedStaffName, selectedStaffId]);

  if (!isInitialized && !initError) {
    return (
      <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 size={48} className="animate-spin text-emerald-400 mb-4" />
        <h1 className="text-white text-xl font-black">NaijaShop POS</h1>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-10">
          <div className="text-center flex flex-col items-center">
             <div className="w-24 h-24 bg-white rounded-[2rem] p-4 flex items-center justify-center shadow-2xl border border-slate-100">
                <img src={LOGO_URL} className="w-full h-full object-contain" alt="NaijaShop Logo" />
             </div>
             <h1 className="text-4xl font-black text-slate-900 mt-6">{settings?.shop_name || 'NaijaShop'}</h1>
          </div>
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
          }} className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 space-y-8">
            <div className="space-y-6">
              <select required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value === 'admin' ? 'admin' : Number(e.target.value))}>
                <option value="">Select Account</option>
                {!isStaffDevice && <option value="admin">{settings?.admin_name} (Admin)</option>}
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
              </select>
              <input required type="password" placeholder="PIN" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </div>
            <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 shadow-xl shadow-emerald-600/30">Log In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <SyncProvider currentUser={currentUser}>
      <Layout activeView={currentView} setView={setCurrentView} shopName={settings?.shop_name || 'NaijaShop POS'} currentUser={currentUser} onLogout={() => setCurrentUser(null)}>
        {currentView === 'dashboard' && <Dashboard currentUser={currentUser} setView={setCurrentView} />}
        {currentView === 'pos' && <POS setView={setCurrentView} currentUser={currentUser} />}
        {currentView === 'transfer-station' && <TransferStation setView={setCurrentView} />}
        {currentView === 'inventory' && <Inventory setView={setCurrentView} currentUser={currentUser} />}
        {currentView === 'inventory-ledger' && <InventoryLedger />}
        {currentView === 'debts' && <Debts />}
        {currentView === 'ai-insights' && <AIInsights />}
        {currentView === 'sync' && <SyncStation currentUser={currentUser} setView={setCurrentView} />}
        {currentView === 'staff-management' && <StaffManagement />}
        {currentView === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black text-slate-800">Shop Identity</h3>
                <input className="w-full px-5 py-3 mt-4 bg-slate-50 border border-slate-200 rounded-xl" value={settings?.shop_name} onChange={async (e) => await db.settings.update('app_settings', { shop_name: e.target.value })} />
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
