
import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Eye,
  EyeOff,
  Coins,
  Briefcase,
  Layers,
  RefreshCw,
  MessageCircle,
  Loader2,
  Share2,
  MessageSquare,
  Lock,
  ShieldCheck,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { View, Staff } from '../types';
import { exportDataForWhatsApp } from '../services/syncService';

interface DashboardProps {
  currentUser?: Staff | null;
  setView?: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser, setView }) => {
  const isSales = currentUser?.role === 'Sales';
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const [showSensitiveData, setShowSensitiveData] = useState(!isSales);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const chartParentRef = useRef<HTMLDivElement>(null);

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const sales = useLiveQuery(() => db.sales.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());

  useEffect(() => {
    if (sales !== undefined && products !== undefined && debts !== undefined && settings !== undefined) {
      setIsDataReady(true);
      setTimeout(() => setIsChartLoading(false), 500);
    }
  }, [sales, products, debts, settings]);

  const todaySales = useMemo(() => {
    if (!sales) return [];
    const today = new Date().setHours(0, 0, 0, 0);
    return sales.filter(s => s.timestamp >= today);
  }, [sales]);

  const totalSalesToday = todaySales.reduce((acc, curr) => acc + curr.total_amount, 0);
  const totalStockValue = (products || []).reduce((acc, p) => acc + (p.cost_price * p.stock_qty), 0);
  const expectedProfitOnStock = (products || []).reduce((acc, p) => acc + ((p.price - p.cost_price) * p.stock_qty), 0);

  // Point 3: Admin Side Global Low Stock Detection
  const lowStockItems = useMemo(() => {
    if (!products) return [];
    return products.filter(p => p.stock_qty <= (p.low_stock_threshold || 5));
  }, [products]);

  const formatCurrency = (val: number) => {
    if (!showSensitiveData) return "₦ ****";
    return `₦${Math.floor(val).toLocaleString()}`;
  };

  const handleWhatsAppSync = async () => {
    if (!settings?.sync_key) {
      if (setView) setView('sync');
      return;
    }
    setIsSyncing(true);
    try {
      const { raw, summary } = await exportDataForWhatsApp('SALES', settings.sync_key, currentUser?.name);
      const magicLink = `${window.location.origin}/?importData=${raw}`;
      const message = `${summary}\n\nClick link to import:\n${magicLink}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      
      const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
      for (const sale of pendingSales) {
        await db.sales.update(sale.id!, { sync_status: 'synced' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRequestStockUpdate = () => {
    const message = `🏪 NAIJASHOP REQUEST: ${currentUser?.name}\n\nBoss, my inventory levels are getting low. Please send me a fresh Stock JSON link so I can verify real quantities in the main store.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (!isDataReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={48} className="animate-spin text-emerald-600" />
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Connecting Terminal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Terminal Overview</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Status: Operational</p>
        </div>
        {!isSales && (
          <button onClick={() => setShowSensitiveData(!showSensitiveData)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm font-bold text-sm">
            {showSensitiveData ? <EyeOff size={18} /> : <Eye size={18} />}
            {showSensitiveData ? 'Hide Financials' : 'View Financials'}
          </button>
        )}
      </div>

      {/* Point 3: Admin Critical Notification */}
      {isAdmin && lowStockItems.length > 0 && (
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-top-4">
          <div className="w-16 h-16 bg-rose-600 text-white rounded-3xl flex items-center justify-center shrink-0 shadow-lg">
            <AlertTriangle size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Critical Stock Alert</h3>
            <p className="text-sm text-slate-500 font-medium">There are <b>{lowStockItems.length} products</b> hitting reorder levels in the master catalog.</p>
          </div>
          <button onClick={() => setView && setView('inventory')} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all">
            View Items <ChevronRight size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Daily Revenue" value={formatCurrency(totalSalesToday)} trend="+4.2%" trendType="up" icon={<TrendingUp className="text-emerald-600" />} color="emerald" />
        <StatCard title="Pending Sync" value={sales?.filter(s => s.sync_status === 'pending').length.toString() || '0'} icon={<Layers className="text-indigo-600" />} color="blue" />
        <StatCard title="Outstanding Debt" value={formatCurrency(debts?.filter(d => d.status === 'pending').reduce((a,c) => a+c.amount, 0) || 0)} icon={<Wallet className="text-rose-600" />} color="rose" />
      </div>

      {isSales && (
        <div className="bg-emerald-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
          <div className="absolute right-[-40px] bottom-[-40px] opacity-10"><MessageSquare size={180} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white/20 rounded-2xl"><MessageCircle size={24} /></div>
              <div>
                <h3 className="text-xl font-black">Sync Bridge</h3>
                <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest">Linked to Admin Terminal</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={handleWhatsAppSync} 
                disabled={isSyncing} 
                className="group p-6 bg-white/10 border border-white/20 rounded-3xl hover:bg-white/20 transition-all flex items-center gap-4 text-left"
              >
                <div className="p-4 bg-emerald-600 rounded-2xl shadow-sm text-white">{isSyncing ? <Loader2 className="animate-spin" /> : <Share2 />}</div>
                <div>
                  <p className="font-black leading-tight">Sync Sales Report</p>
                  <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mt-1">Export JSON to Admin</p>
                </div>
              </button>
              
              <button 
                onClick={handleRequestStockUpdate} 
                className="group p-6 bg-white/10 border border-white/20 rounded-3xl hover:bg-white/20 transition-all flex items-center gap-4 text-left"
              >
                <div className="p-4 bg-amber-600 rounded-2xl shadow-sm text-white"><RefreshCw /></div>
                <div>
                  <p className="font-black leading-tight">Request Stock JSON</p>
                  <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mt-1">Get master store levels</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showSensitiveData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute right-[-20px] bottom-[-20px] opacity-10"><Layers size={180} /></div>
             <div className="relative z-10 flex items-center justify-between">
                <div>
                   <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-2">Inventory Cost Value</p>
                   <h4 className="text-4xl font-black tracking-tighter">{formatCurrency(totalStockValue)}</h4>
                </div>
                <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md border border-white/10"><Package size={32} className="text-emerald-400" /></div>
             </div>
          </div>

          <div className="bg-emerald-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute right-[-20px] bottom-[-20px] opacity-10"><Coins size={180} /></div>
             <div className="relative z-10 flex items-center justify-between">
                <div>
                   <p className="text-emerald-300/50 text-xs font-black uppercase tracking-[0.2em] mb-2">Unrealized Potential Profit</p>
                   <h4 className="text-4xl font-black tracking-tighter">{formatCurrency(expectedProfitOnStock)}</h4>
                </div>
                <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md border border-white/10"><ArrowUpRight size={32} className="text-emerald-400" /></div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{title: string, value: string, icon: any, trend?: string, trendType?: 'up' | 'down', color: string}> = ({ title, value, icon, trend, trendType, color }) => {
  const colors: {[key:string]:string} = { emerald: 'bg-emerald-50 text-emerald-600', blue: 'bg-indigo-50 text-indigo-600', rose: 'bg-rose-50 text-rose-600' };
  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:border-emerald-200 transition-all">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${colors[color]}`}>{icon}</div>
        {trend && (
          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${trendType === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{trend}</span>
        )}
      </div>
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
      <h4 className="text-2xl font-black text-slate-900 mt-1">{value}</h4>
    </div>
  );
};

export default Dashboard;
