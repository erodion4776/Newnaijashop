
import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Settings, 
  Sparkles,
  Landmark,
  Menu,
  X,
  RefreshCw,
  ClipboardList,
  UserCog,
  LogOut
} from 'lucide-react';
import { View, Staff } from '../types';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface LayoutProps {
  children: React.ReactNode;
  activeView: View;
  setView: (view: View) => void;
  shopName: string;
  currentUser: Staff | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, setView, shopName, currentUser, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Manager', 'Sales'] },
    { id: 'pos', label: 'Point of Sale', icon: ShoppingCart, roles: ['Admin', 'Manager', 'Sales'] },
    { id: 'transfer-station', label: 'Transfer Station', icon: Landmark, roles: ['Admin', 'Manager', 'Sales'] },
    { id: 'inventory', label: 'Inventory', icon: Package, roles: ['Admin', 'Manager', 'Sales'] },
    { id: 'inventory-ledger', label: 'Inventory Ledger', icon: ClipboardList, roles: ['Admin', 'Manager'] },
    { id: 'debts', label: 'Debt Tracker', icon: Users, roles: ['Admin', 'Manager'] },
    { id: 'staff-management', label: 'Manage Staff', icon: UserCog, roles: ['Admin'] },
    { id: 'ai-insights', label: 'AI Business Hub', icon: Sparkles, roles: ['Admin', 'Manager'] },
    { id: 'sync', label: 'Sync & Backup', icon: RefreshCw, roles: ['Admin', 'Sales'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['Admin'] },
  ];

  const visibleNavItems = navItems.filter(item => 
    currentUser && item.roles.includes(currentUser.role)
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-emerald-900 text-white transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between pl-5 pr-4 py-6 border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl p-1.5 flex items-center justify-center shadow-lg overflow-hidden shrink-0">
              <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white leading-none">NaijaShop</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-emerald-100 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 px-4 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-hide">
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id as View);
                setIsSidebarOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                ${activeView === item.id 
                  ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-900/20' 
                  : 'text-emerald-100 hover:bg-emerald-800'}
              `}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 space-y-4">
          <div className="p-4 bg-emerald-950/40 rounded-2xl border border-emerald-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-700 rounded-full flex items-center justify-center font-black text-sm uppercase">
                {currentUser?.name.substring(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate leading-none mb-1">{currentUser?.name}</p>
                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">{currentUser?.role}</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest text-emerald-400 hover:text-white transition-colors"
            >
              <LogOut size={14} /> Log Out
            </button>
          </div>
          
          <div className="px-2">
            <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-1">Store Terminal</p>
            <p className="text-xs font-medium truncate opacity-60">{shopName}</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-bold text-slate-800">
              {navItems.find(i => i.id === activeView)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Station Active</span>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
