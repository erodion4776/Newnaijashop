
import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Settings as SettingsIcon, 
  Landmark,
  Menu,
  X,
  ClipboardList,
  UserCog,
  LogOut,
  History,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Database,
  Lock,
  Download,
  TrendingDown,
  ShieldAlert as ShieldIcon,
  Lightbulb
} from 'lucide-react';
import { View, Staff } from '../types';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface LayoutProps {
  children: React.ReactNode;
  activeView: View;
  setView: (view: View) => void;
  shopName: string;
  currentUser: Staff | null;
  isStaffLock: boolean;
  toggleStaffLock: (active: boolean) => void;
  adminPin: string;
  onLogout: () => void;
  canInstall?: boolean;
  onInstall?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, setView, shopName, currentUser, isStaffLock, toggleStaffLock, adminPin, onLogout, canInstall, onInstall }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');

  const showAllFeatures = currentUser?.role === 'Admin' || (currentUser?.role === 'Manager' && !isStaffLock);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, restrict: true },
    { id: 'pos', label: 'Point of Sale', icon: ShoppingCart, restrict: false },
    { id: 'business-hub', label: 'Business Hub', icon: Lightbulb, restrict: true },
    { id: 'activity-log', label: 'Activity Log', icon: History, restrict: true },
    { id: 'audit-trail', label: 'Security Logs', icon: ShieldIcon, restrict: true },
    { id: 'expense-tracker', label: 'Expense Tracker', icon: TrendingDown, restrict: true },
    { id: 'transfer-station', label: 'Transfer Station', icon: Landmark, restrict: false },
    { id: 'inventory', label: 'Inventory', icon: Package, restrict: false },
    { id: 'inventory-ledger', label: 'Inventory Ledger', icon: ClipboardList, restrict: true },
    { id: 'debts', label: 'Debt Tracker', icon: Users, restrict: true },
    { id: 'staff-management', label: 'Manage Staff', icon: UserCog, restrict: true },
    { id: 'security-backups', label: 'Security & Backup', icon: Database, restrict: true },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, restrict: true },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (showAllFeatures) return true;
    if (item.restrict) return false;
    return true;
  });

  const handleUnlockChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockPin === adminPin) {
      toggleStaffLock(false);
      setShowUnlockModal(false);
      setUnlockPin('');
    } else {
      alert("Invalid Admin PIN");
      setUnlockPin('');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-emerald-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between pl-5 pr-4 py-6 border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl p-1.5 flex items-center justify-center shadow-lg overflow-hidden shrink-0">
              <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white leading-none">NaijaShop</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-emerald-100"><X size={24} /></button>
        </div>
        
        <nav className="mt-6 px-4 space-y-2 flex-1 overflow-y-auto scrollbar-hide">
          {filteredNavItems.map((item) => (
            <button key={item.id} onClick={() => { setView(item.id as View); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === item.id ? 'bg-emerald-700 text-white shadow-lg' : 'text-emerald-100 hover:bg-emerald-800'}`}>
              <item.icon size={20} /> <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-4 space-y-3">
          {canInstall && (
            <button 
              onClick={onInstall} 
              className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest text-emerald-400 hover:bg-white/10 transition-all"
            >
              <Download size={14} /> Install Terminal
            </button>
          )}

          {currentUser?.role === 'Admin' && (
            <button 
              onClick={() => isStaffLock ? setShowUnlockModal(true) : toggleStaffLock(true)} 
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isStaffLock ? 'bg-amber-500 text-white animate-pulse' : 'bg-white/10 text-emerald-400 hover:bg-white/20'}`}
            >
              {isStaffLock ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
              {isStaffLock ? 'Staff Locked' : 'Switch to Staff'}
            </button>
          )}

          <div className="p-4 bg-emerald-950/40 rounded-2xl border border-emerald-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-700 rounded-full flex items-center justify-center font-black text-sm uppercase">{currentUser?.name.substring(0, 2)}</div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate leading-none mb-1">{currentUser?.name}</p>
                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">
                  {isStaffLock && currentUser?.role !== 'Admin' ? 'Restricted' : currentUser?.role}
                </p>
              </div>
            </div>
            <button onClick={onLogout} className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest text-emerald-400 hover:text-white transition-colors"><LogOut size={14} /> Exit</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
            <h2 className="text-lg font-bold text-slate-800">{navItems.find(i => i.id === activeView)?.label || 'Terminal'}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            {isStaffLock && currentUser?.role !== 'Admin' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full text-amber-600">
                <ShieldAlert size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Locked Mode</span>
              </div>
            )}
            <div className="hidden sm:block text-right">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Local Terminal</p>
               <p className="text-xs font-bold text-slate-800 leading-none">{shopName}</p>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </section>
      </main>

      {showUnlockModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 text-center space-y-8 animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><Lock size={40} /></div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900">Admin Unlock</h3>
              <p className="text-slate-500 text-sm">Enter Admin PIN to deactivate Staff Lockdown.</p>
            </div>
            <form onSubmit={handleUnlockChallenge} className="space-y-6">
              <input 
                autoFocus
                type="password" 
                maxLength={4} 
                inputMode="numeric"
                className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-4xl text-center tracking-[0.5em] outline-none focus:ring-2 focus:ring-emerald-500" 
                value={unlockPin}
                onChange={e => setUnlockPin(e.target.value.replace(/\D/g, ''))}
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowUnlockModal(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cancel</button>
                <button type="submit" className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl hover:bg-emerald-700">Verify <ChevronRight size={18} /></button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
