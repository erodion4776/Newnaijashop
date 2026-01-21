
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
  Staff,
  RefreshCw,
  Wifi,
  MessageCircle,
  ArrowRight,
  Loader2,
  Info,
  Share2,
  MessageSquare
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { View } from '../types';
import { exportDataForWhatsApp } from '../services/syncService';

interface DashboardProps {
  currentUser?: Staff | null;
  setView?: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser, setView }) => {
  const isSales = currentUser?.role === 'Sales';
  const [showSensitiveData, setShowSensitiveData] = useState(!isSales);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Recharts dimensions fix
  const [chartWidth, setChartWidth] = useState(0);
  const chartParentRef = useRef<HTMLDivElement>(null);

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const sales = useLiveQuery(() => db.sales.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChartLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const processedChartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fallback = days.map(d => ({ name: d, amount: 0, fullDate: 'N/A' }));

    try {
      const result = [];
      const now = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0); 
        
        const startTs = d.getTime();
        const endTs = startTs + 86400000;
        
        const dayName = days[d.getDay()];
        const dayTotal = (sales || [])
          .filter(s => s.timestamp >= startTs && s.timestamp < endTs)
          .reduce((sum, s) => sum + (s.total_amount || 0), 0);
          
        result.push({
          name: dayName,
          amount: dayTotal,
          fullDate: d.toLocaleDateString()
        });
      }
      return result;
    } catch (err) {
      console.error("Chart Processing Error:", err);
      return fallback;
    }
  }, [sales]);

  useLayoutEffect(() => {
    if (!chartParentRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartWidth(entry.contentRect.width);
        setIsChartLoading(false);
      }
    });
    resizeObserver.observe(chartParentRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (sales !== undefined && products !== undefined && debts !== undefined && settings !== undefined) {
      setIsDataReady(true);
      setTimeout(() => setIsChartLoading(false), 500);
    }
  }, [sales, products, debts, settings]);

  const lastSyncText = useMemo(() => {
    if (!settings?.last_synced_timestamp) return "Never Synced";
    const diff = Date.now() - settings.last_synced_timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    return new Date(settings.last_synced_timestamp).toLocaleTimeString();
  }, [settings?.last_synced_timestamp]);

  const todaySales = useMemo(() => {
    if (!sales) return [];
    const today = new Date().setHours(0, 0, 0, 0);
    return sales.filter(s => s.timestamp >= today);
  }, [sales]);

  const totalSalesToday = todaySales.reduce((acc, curr) => acc + curr.total_amount, 0);
  const totalStockValue = (products || []).reduce((acc, p) => acc + (p.cost_price * p.stock_qty), 0);
  const expectedProfitOnStock = (products || []).reduce((acc, p) => acc + ((p.price - p.cost_price) * p.stock_qty), 0);

  const todaysInterest = useMemo(() => {
    let profit = 0;
    if (!products) return 0;
    todaySales.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          profit += (item.price - product.cost_price) * item.quantity;
        }
      });
    });
    return profit;
  }, [todaySales, products]);

  const totalDebt = (debts || []).filter(d => d.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);
  const lowStock = (products || []).filter(p => p.stock_qty <= 10).length;
  const unconfirmedTransfers = (sales || []).filter(s => s.payment_method === 'transfer' && !s.confirmed_by).length;

  const formatCurrency = (val: number) => {
    if (!showSensitiveData) return "₦ ****";
    return `₦${Math.floor(val).toLocaleString()}`;
  };

  const handleWhatsAppSync = async () => {
    if (!settings?.sync_key) return alert("Sync Key not configured.");
    setIsSyncing(true);
    try {
      const compressed = await exportDataForWhatsApp('SALES', settings.sync_key);
      const magicLink = `${window.location.origin}/?importData=${compressed}`;
      const message = `💰 NAIJASHOP SALES REPORT (${new Date().toLocaleDateString()}):\n\nBoss, click this link to import my sales:\n${magicLink}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      
      // Local sync update
      const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
      for (const sale of pendingSales) {
        await db.sales.update(sale.id!, { sync_status: 'synced' });
      }
    } catch (err) {
      alert("Sync failed: " + err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isDataReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={48} className="animate-spin text-emerald-600" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Accessing Terminal Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Shop Performance</h2>
          <div className="flex items-center gap-2 mt-1">
             <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
               settings?.last_synced_timestamp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
             }`}>
                <RefreshCw size={10} className={settings?.last_synced_timestamp && (Date.now() - settings.last_synced_timestamp < 300000) ? '' : 'animate-pulse'} />
                Sync: {lastSyncText}
             </div>
          </div>
        </div>
        {!isSales && (
          <button 
            onClick={() => setShowSensitiveData(!showSensitiveData)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm font-bold text-sm"
          >
            {showSensitiveData ? <EyeOff size={18} /> : <Eye size={18} />}
            {showSensitiveData ? 'Hide Profits' : 'Show Profits'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Sales (Today)" 
          value={formatCurrency(totalSalesToday)} 
          trend="+12.5%" 
          trendType="up"
          icon={<TrendingUp className="text-emerald-600" />}
          color="emerald"
        />
        <StatCard 
          title="Today's Interest" 
          value={formatCurrency(todaysInterest)} 
          icon={<Briefcase className="text-indigo-600" />}
          color="blue"
          isSensitive
        />
        <StatCard 
          title="Outstanding Debts" 
          value={formatCurrency(totalDebt)} 
          icon={<Wallet className="text-rose-600" />}
          color="rose"
        />
      </div>

      {isSales && (
        <div className="bg-emerald-900 p-8 rounded-[2.5rem] text-white space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute right-[-40px] bottom-[-40px] opacity-10">
            <MessageSquare size={180} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white/20 rounded-2xl">
                <MessageCircle size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black">WhatsApp Data Bridge</h3>
                <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest">Connect to Admin Terminal</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={handleWhatsAppSync}
                disabled={isSyncing}
                className="group p-6 bg-white/10 border border-white/20 rounded-3xl hover:bg-white/20 transition-all flex items-center gap-4 text-left"
              >
                <div className="p-4 bg-emerald-600 rounded-2xl shadow-sm text-white">
                  {isSyncing ? <Loader2 className="animate-spin" size={24} /> : <Share2 size={24} />}
                </div>
                <div className="flex-1">
                  <p className="font-black leading-tight">Send Sales to Boss</p>
                  <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mt-1">Export via WhatsApp</p>
                </div>
                <ArrowRight size={20} className="text-white/40 group-hover:translate-x-1 transition-all" />
              </button>
              <button 
                onClick={() => setView && setView('sync')}
                className="group p-6 bg-white/10 border border-white/20 rounded-3xl hover:bg-white/20 transition-all flex items-center gap-4 text-left"
              >
                <div className="p-4 bg-emerald-600 rounded-2xl shadow-sm text-white">
                  <RefreshCw size={24} />
                </div>
                <div className="flex-1">
                  <p className="font-black leading-tight">Data Sync Station</p>
                  <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mt-1">Manual Import hub</p>
                </div>
                <ArrowRight size={20} className="text-white/40 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showSensitiveData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
                <Layers size={180} />
             </div>
             <div className="relative z-10 flex items-center justify-between">
                <div>
                   <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-2">Total Stock Value</p>
                   <h4 className="text-4xl font-black tracking-tighter">
                      {formatCurrency(totalStockValue)}
                   </h4>
                   <p className="text-[10px] text-slate-500 font-bold mt-4 uppercase tracking-widest bg-white/5 inline-block px-3 py-1 rounded-full border border-white/5">
                      Investment in Inventory
                   </p>
                </div>
                <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md border border-white/10">
                   <Package size={32} className="text-emerald-400" />
                </div>
             </div>
          </div>

          <div className="bg-emerald-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
             <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
                <Coins size={180} />
             </div>
             <div className="relative z-10 flex items-center justify-between">
                <div>
                   <p className="text-emerald-300/50 text-xs font-black uppercase tracking-[0.2em] mb-2">Expected Profit on Stock</p>
                   <h4 className="text-4xl font-black tracking-tighter">
                      {formatCurrency(expectedProfitOnStock)}
                   </h4>
                   <p className="text-[10px] text-emerald-400/80 font-bold mt-4 uppercase tracking-widest bg-white/5 inline-block px-3 py-1 rounded-full border border-white/5">
                      Untapped Margin
                   </p>
                </div>
                <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md border border-white/10">
                   <ArrowUpRight size={32} className="text-emerald-400" />
                </div>
             </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard 
          title="Unverified Transfers" 
          value={unconfirmedTransfers.toString()} 
          icon={<ShieldAlert className="text-indigo-600" />}
          color="blue"
          warning={unconfirmedTransfers > 0}
        />
        <StatCard 
          title="Low Stock Alerts" 
          value={lowStock.toString()} 
          icon={<AlertTriangle className="text-amber-600" />}
          color="amber"
          warning={lowStock > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden min-h-0 block">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 text-xl tracking-tight">Sales Analytics</h3>
            <select className="bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          
          <div 
            ref={chartParentRef}
            className="relative block w-full h-[350px] overflow-hidden"
            style={{ height: '350px', width: '100%', display: 'block' }}
          >
            {isChartLoading && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 z-20 text-gray-400 gap-3">
                 <Loader2 className="animate-spin text-emerald-600" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Calibrating Analytics Hub...</span>
               </div>
            )}
            
            <ResponsiveContainer 
              width="100%" 
              height={350} 
              minWidth={0} 
              minHeight={0}
              debounce={50}
            >
              <BarChart data={processedChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                  dy={15}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px 16px' }}
                  itemStyle={{ fontWeight: 900, color: '#0f172a' }}
                  formatter={(value: number) => [`₦${value.toLocaleString()}`, 'Daily Total']}
                />
                <Bar dataKey="amount" radius={[10, 10, 0, 0]} barSize={45}>
                  {processedChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 6 ? '#059669' : '#10b981'} fillOpacity={index === 6 ? 1 : 0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden relative">
          <h3 className="font-black text-slate-800 text-xl mb-8 tracking-tight">Activity Log</h3>
          <div className="space-y-6 relative z-10">
            {(sales || []).slice(-5).reverse().map((sale) => (
              <div key={sale.id} className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <p className="font-black text-slate-800">Sale #{sale.id}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(sale.timestamp).toLocaleTimeString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900 text-lg">
                    {sale.payment_method === 'transfer' && !sale.confirmed_by ? '₦ ----' : `₦${sale.total_amount.toLocaleString()}`}
                  </p>
                  <p className={`text-[9px] uppercase font-black tracking-[0.15em] px-2 py-0.5 rounded-full inline-block ${
                    sale.payment_method === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                    sale.payment_method === 'transfer' || sale.payment_method === 'Bank Transfer' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {sale.payment_method}
                  </p>
                </div>
              </div>
            ))}
            {(sales || []).length === 0 && (
              <div className="text-center py-20">
                <p className="text-sm font-bold text-slate-300">Awaiting transactions...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendType?: 'up' | 'down';
  color: 'emerald' | 'blue' | 'amber' | 'rose';
  warning?: boolean;
  isSensitive?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, trendType, color, warning }) => {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border transition-all duration-300 ${warning ? 'border-rose-200 bg-rose-50/20 scale-[1.02]' : 'border-slate-200 hover:border-emerald-200'}`}>
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl shadow-inner ${colors[color]}`}>
          {icon}
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${trendType === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {trend}
            {trendType === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          </span>
        )}
      </div>
      <p className="text-slate-400 text-xs font-black uppercase tracking-widest">{title}</p>
      <h4 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">{value}</h4>
    </div>
  );
};

export default Dashboard;
