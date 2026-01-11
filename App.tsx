
import React, { useState, useEffect, useMemo } from 'react';
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
import { 
  ShieldAlert, 
  Key, 
  Landmark, 
  Lock, 
  Save, 
  ShieldCheck, 
  User, 
  Eye, 
  EyeOff, 
  Loader2, 
  ChevronRight, 
  CheckCircle2, 
  X,
  Store,
  RefreshCw,
  Zap
} from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [onboardingSuccess, setOnboardingSuccess] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | 'admin' | ''>('');

  // Setup Form State
  const [setupData, setSetupData] = useState({ shopName: '', adminName: '', adminPin: '' });

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const staffList = useLiveQuery(() => db.staff.filter(s => s.status === 'Active').toArray()) || [];
  const requestCode = useMemo(() => generateRequestCode(), []);

  useEffect(() => {
    const start = async () => {
      await initSettings();
      
      // Check for onboarding link via staffData or invite parameter
      const urlParams = new URLSearchParams(window.location.search);
      const onboardingData = urlParams.get('staffData') || urlParams.get('invite');
      
      if (onboardingData) {
        try {
          // Decode the base64 encoded JSON data
          const decoded = JSON.parse(atob(onboardingData));
          const existing = await db.staff.where('name').equals(decoded.name).first();
          
          if (!existing) {
            await db.staff.add({
              name: decoded.name,
              role: decoded.role,
              password: decoded.password,
              status: 'Active',
              created_at: Date.now()
            });
          }
          
          // Set success message for the login screen
          setOnboardingSuccess('Staff Account Activated!');
          
          // Clean the URL to remove sensitive long strings from the address bar
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
          console.error("Failed to decode onboarding data", e);
        }
      }

      setIsInitialized(true);
    };
    start();
  }, []);

  // License & Anti-Tamper Logic
  useEffect(() => {
    if (isInitialized && settings && settings.is_setup_complete) {
      const { valid, error } = validateLicense(settings.license_key, settings.last_used_timestamp);
      if (!valid) {
        setLicenseError(error || 'Invalid License');
      } else {
        setLicenseError(null);
        const interval = setInterval(() => {
          db.settings.update('app_settings', { last_used_timestamp: Date.now() });
        }, 30000);
        return () => clearInterval(interval);
      }
    }
  }, [isInitialized, settings?.license_key, settings?.last_used_timestamp, settings?.is_setup_complete]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData.adminPin || (setupData.adminPin.length !== 4 && setupData.adminPin.length !== 6)) {
      alert("PIN must be 4 or 6 digits");
      return;
    }

    await db.settings.update('app_settings', {
      shop_name: setupData.shopName,
      admin_name: setupData.adminName,
      admin_pin: setupData.adminPin,
      is_setup_complete: true,
      last_used_timestamp: Date.now()
    });

    const adminUser: Staff = { 
      name: setupData.adminName, 
      role: 'Admin', 
      password: setupData.adminPin, 
      status: 'Active', 
      created_at: Date.now() 
    };
    setCurrentUser(adminUser);
    setCurrentView('dashboard');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStaffId === 'admin') {
      if (loginPassword === settings?.admin_pin) {
        setCurrentUser({ name: settings.admin_name || 'Administrator', role: 'Admin', password: settings.admin_pin, status: 'Active', created_at: Date.now() });
      } else {
        alert("Invalid Admin PIN");
      }
    } else {
      const staff = staffList.find(s => s.id === selectedStaffId);
      if (staff && staff.password === loginPassword) {
        setCurrentUser(staff);
        if (staff.role === 'Sales') setCurrentView('pos');
      } else {
        alert("Invalid Password");
      }
    }
    setLoginPassword('');
  };

  const resetSystem = async () => {
    if (confirm("DANGER: This will delete ALL local data (Products, Sales, Staff). Proceed?")) {
      await db.delete();
      window.location.reload();
    }
  };

  if (!isInitialized) return null;

  // 1. First-Time Setup Flow
  if (settings && !settings.is_setup_complete) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-3">
             <div className="w-20 h-20 bg-emerald-600 rounded-[1.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-600/30">
                <Store size={40} className="text-white" />
             </div>
             <div className="space-y-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Setup Your Shop</h1>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Initialize NaijaShop Terminal</p>
             </div>
          </div>

          <form onSubmit={handleSetup} className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-200 space-y-6">
            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Shop Name</label>
                  <input 
                    required
                    autoFocus
                    placeholder="e.g. Bolu's Retail"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    value={setupData.shopName}
                    onChange={(e) => setSetupData({...setupData, shopName: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Admin Full Name</label>
                  <input 
                    required
                    placeholder="e.g. John Doe"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    value={setupData.adminName}
                    onChange={(e) => setSetupData({...setupData, adminName: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Create Admin PIN</label>
                  <input 
                    required
                    type="password"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="4 or 6 Digits"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black tracking-widest"
                    value={setupData.adminPin}
                    onChange={(e) => setSetupData({...setupData, adminPin: e.target.value})}
                  />
               </div>
            </div>

            <button 
              type="submit"
              className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 group active:scale-95"
            >
              Start Selling <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
          
          <p className="text-center text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em] px-10">
            Offline-first architecture. All data remains on this device.
          </p>
        </div>
      </div>
    );
  }

  // Lock Screen for License Failure
  if (licenseError) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6 z-[1000] overflow-y-auto">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-8 md:p-12 text-center space-y-8 shadow-2xl animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 leading-tight">Terminal Locked</h1>
            <p className="text-slate-500 font-medium px-4">{licenseError}</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Request Code</p>
            <p className="text-2xl font-black text-slate-800 tracking-widest font-mono">{requestCode}</p>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input 
                type="text"
                placeholder="Enter License Key"
                className="w-full pl-12 pr-4 py-4 bg-slate-100 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold transition-all"
                onBlur={async (e) => {
                   if(e.target.value) await db.settings.update('app_settings', { license_key: e.target.value });
                }}
              />
            </div>
            <button 
              onClick={resetSystem}
              className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-rose-500 transition-colors"
            >
              Emergency Factory Reset
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. OPay Style Login Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {onboardingSuccess && (
          <div className="bg-emerald-600 text-white p-4 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-500">
            <CheckCircle2 size={20} />
            <span className="text-sm font-bold uppercase tracking-widest">{onboardingSuccess}</span>
            <button onClick={() => setOnboardingSuccess(null)} className="ml-4 opacity-70 hover:opacity-100"><X size={16} /></button>
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-10">
            <div className="text-center space-y-4">
               <div className="w-24 h-24 bg-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-600/30 rotate-3 transition-transform hover:rotate-0">
                  <span className="text-white text-4xl font-black italic">NS</span>
               </div>
               <div className="space-y-1">
                 <h1 className="text-3xl font-black text-slate-900 tracking-tight">{settings?.shop_name || 'NaijaShop'}</h1>
                 <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Merchant Terminal Access</p>
               </div>
            </div>

            <form onSubmit={handleLogin} className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-200 space-y-8 animate-in zoom-in duration-300">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terminal User</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <select 
                      required
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold appearance-none transition-all"
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value === 'admin' ? 'admin' : Number(e.target.value))}
                    >
                      <option value="">Select Account</option>
                      <option value="admin">{settings?.admin_name} (Admin)</option>
                      {staffList.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input 
                      required
                      type="password"
                      placeholder="••••"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black tracking-widest text-lg"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 group active:scale-95"
              >
                Log In <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            <div className="text-center space-y-4">
              <p className="text-xs text-slate-400 font-medium">Terminal ID: <span className="font-mono text-slate-600">{requestCode}</span></p>
              <button 
                onClick={resetSystem}
                className="flex items-center justify-center gap-2 mx-auto px-4 py-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-rose-500 transition-colors bg-white/50 rounded-full border border-slate-100"
              >
                <RefreshCw size={12} /> Reset System
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard currentUser={currentUser} />;
      case 'pos': return <POS setView={setCurrentView} />;
      case 'transfer-station': return <TransferStation setView={setCurrentView} />;
      case 'inventory': return <Inventory setView={setCurrentView} />;
      case 'inventory-ledger': return <InventoryLedger />;
      case 'debts': return <Debts />;
      case 'ai-insights': return <AIInsights />;
      case 'sync': return <SyncStation />;
      case 'staff-management': return <StaffManagement />;
      case 'settings': return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Lock className="text-emerald-600" size={20} /> Store Identity
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Shop Name</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    value={settings?.shop_name || ''}
                    onChange={async (e) => await db.settings.update('app_settings', { shop_name: e.target.value })}
                  />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Admin Full Name</label>
                   <input 
                     type="text" 
                     className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                     value={settings?.admin_name || ''}
                     onChange={async (e) => await db.settings.update('app_settings', { admin_name: e.target.value })}
                   />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Admin Security PIN</label>
                  <input 
                    type="password" 
                    maxLength={6}
                    placeholder="****"
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold tracking-widest"
                    value={settings?.admin_pin || ''}
                    onChange={async (e) => await db.settings.update('app_settings', { admin_pin: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Landmark className="text-emerald-600" size={20} /> Payment Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Bank Institution</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    value={settings?.bank_name || ''}
                    onChange={async (e) => await db.settings.update('app_settings', { bank_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Account Number</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono"
                    value={settings?.account_number || ''}
                    onChange={async (e) => await db.settings.update('app_settings', { account_number: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Account Name</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black uppercase"
                    value={settings?.account_name || ''}
                    onChange={async (e) => await db.settings.update('app_settings', { account_name: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="pt-10 flex justify-center">
             <button 
                onClick={resetSystem}
                className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest border border-rose-100 hover:bg-rose-600 hover:text-white transition-all shadow-xl shadow-rose-200"
             >
                <Zap size={16} /> Delete All Store Data
             </button>
          </div>
        </div>
      );
      default: return <Dashboard currentUser={currentUser} />;
    }
  };

  return (
    <Layout 
      activeView={currentView} 
      setView={setCurrentView} 
      shopName={settings?.shop_name || 'NaijaShop POS'}
      currentUser={currentUser}
      onLogout={() => setCurrentUser(null)}
    >
      {renderView()}
    </Layout>
  );
};

export default App;
