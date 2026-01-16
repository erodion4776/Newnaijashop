
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
import BarcodeScanner from './components/BarcodeScanner';
import { SyncProvider } from './context/SyncProvider';
import { 
  ShieldAlert, 
  Key, 
  Lock, 
  User, 
  Store, 
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  Smartphone,
  Users,
  ArrowRight,
  Camera,
  LogOut,
  Loader2
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
  const [initError, setInitError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<number | 'admin' | ''>('');
  const [isJoining, setIsJoining] = useState(false);
  const [isProcessingJoin, setIsProcessingJoin] = useState(false);
  
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
        
        // 1. INVITE PRIORITY: Process URL data before checking setup status
        const urlParams = new URLSearchParams(window.location.search);
        const inviteData = urlParams.get('staffData') || urlParams.get('invite');
        
        if (inviteData && inviteData !== 'true') {
          await processStaffJoin(inviteData);
        }
        setIsInitialized(true);
      } catch (err: any) {
        setInitError(err?.message || "Could not connect to local database.");
      }
    };
    start();
  }, []);

  useEffect(() => {
    if (isInitialized && settings?.is_setup_complete) {
      if (isStaffDevice && invitedStaffName) {
        const staff = staffList.find(s => s.name === invitedStaffName);
        if (staff) setSelectedStaffId(staff.id!);
      } else if (staffList.length === 0) {
        setSelectedStaffId('admin');
      }
    }
  }, [isInitialized, settings?.is_setup_complete, staffList, isStaffDevice, invitedStaffName]);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupData.adminPin.length !== 4) return alert("PIN must be 4 digits");
    await db.settings.update('app_settings', {
      shop_name: setupData.shopName,
      admin_name: setupData.adminName,
      admin_pin: setupData.adminPin,
      is_setup_complete: true,
      last_used_timestamp: Date.now()
    });
  };

  const processStaffJoin = async (scannedText: string) => {
    setIsProcessingJoin(true);
    try {
      let dataToProcess = scannedText;
      
      // Handle URL vs Raw string
      if (scannedText.startsWith('http')) {
        const url = new URL(scannedText);
        const params = new URLSearchParams(url.search);
        dataToProcess = params.get('staffData') || params.get('invite') || '';
      }

      if (!dataToProcess) throw new Error("No data found");

      // Decompress the data
      let json = LZString.decompressFromEncodedURIComponent(dataToProcess);
      
      // Fallback for non-compressed legacy invites or base64
      if (!json) {
        try { json = atob(dataToProcess); } catch(e) { json = dataToProcess; }
      }

      const parsedData = JSON.parse(json);
      if (!parsedData.name || !parsedData.shop) throw new Error("Invalid format");

      // Immediate DB Provisioning
      await (db as any).transaction('rw', [db.staff, db.settings], async () => {
        // Clear potential partial setup
        await db.staff.clear(); 
        
        // Add the Staff member
        await db.staff.add({ 
          name: parsedData.name, 
          role: parsedData.role || 'Sales', 
          password: parsedData.password, 
          status: 'Active', 
          created_at: Date.now() 
        });
        
        // Provision the Shop Identity and Lock setup
        await db.settings.update('app_settings', { 
          shop_name: parsedData.shop, 
          is_setup_complete: true, 
          license_key: 'STAFF-TERMINAL-ACTIVE' 
        });
      });

      localStorage.setItem('isStaffDevice', 'true');
      localStorage.setItem('invitedStaffName', parsedData.name);

      // Brief pause for visual confirmation
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      console.error("Join Error:", e);
      setIsProcessingJoin(false);
      if (scannedText.startsWith('http') || scannedText.length > 20) {
        alert("Invalid Invite Code. Please ask the Admin for a new QR code.");
      }
    }
  };

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

  if (isJoining) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        {isProcessingJoin ? (
          <div className="bg-white p-12 rounded-[3rem] space-y-6 animate-in zoom-in">
             <Loader2 size={64} className="animate-spin text-emerald-600 mx-auto" />
             <div className="space-y-2">
               <h3 className="text-2xl font-black text-slate-900">Joining Shop...</h3>
               <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Provisioning Local Terminal</p>
             </div>
          </div>
        ) : (
          <>
            <BarcodeScanner onScan={processStaffJoin} onClose={() => setIsJoining(false)} />
            <div className="fixed bottom-10 left-0 right-0 p-6 flex flex-col items-center">
               <p className="text-white font-black uppercase tracking-widest text-xs mb-4">Scan Admin's Invite QR</p>
               <button onClick={() => setIsJoining(false)} className="px-8 py-3 bg-white/10 text-white rounded-xl font-bold border border-white/5">Cancel Join</button>
            </div>
          </>
        )}
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

          <form onSubmit={handleSetupSubmit} className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Business Name</label>
                <div className="relative">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input required type="text" placeholder="e.g. Kola's Supermarket" className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={setupData.shopName} onChange={e => setSetupData({...setupData, shopName: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin PIN</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input required type="password" maxLength={4} placeholder="****" className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl tracking-[0.5em]" value={setupData.adminPin} onChange={e => setSetupData({...setupData, adminPin: e.target.value})} />
                </div>
              </div>
            </div>
            <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 shadow-xl transition-all active:scale-95">Complete Setup</button>
            <div className="flex items-center gap-2 justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest"><ShieldCheck size={14} className="text-emerald-500" /> Secure Storage Active</div>
          </form>

          {/* JOIN BUTTON FOR STAFF */}
          <div className="text-center space-y-4">
             <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-slate-200"></div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">OR</span>
                <div className="h-px flex-1 bg-slate-200"></div>
             </div>
             <button onClick={() => setIsJoining(true)} className="group inline-flex items-center gap-3 px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-[2rem] hover:border-emerald-500 transition-all active:scale-95 shadow-sm">
                <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all"><Camera size={18} /></div>
                <div className="text-left">
                  <p className="text-sm font-black">Invited as Staff?</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Click here to Join Shop</p>
                </div>
                <ArrowRight size={18} className="ml-2 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
             </button>
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
                <img src={LOGO_URL} className="w-full h-full object-contain" alt="NaijaShop Logo" />
             </div>
             <h1 className="text-4xl font-black text-slate-900 tracking-tight">{settings?.shop_name || 'NaijaShop'}</h1>
             <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Digital POS Terminal</p>
          </div>
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600" />
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
            }} className="space-y-8">
              <div className="space-y-6">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <select required className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none appearance-none" value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value === 'admin' ? 'admin' : Number(e.target.value))}>
                    <option value="">Select Account</option>
                    {!isStaffDevice && <option value="admin">{settings?.admin_name} (Admin)</option>}
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                  </select>
                </div>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input required type="password" placeholder="PIN" className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 shadow-xl transition-all active:scale-95">Unlock Terminal</button>
            </form>
          </div>
          <div className="flex items-center gap-2 text-slate-300 justify-center">
            <Smartphone size={12} />
            <span className="text-[10px] font-black uppercase tracking-widest">Device Identity: {terminalId}</span>
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
