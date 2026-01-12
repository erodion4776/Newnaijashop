
import React, { useState, useMemo, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { View } from '../types';
import pako from 'pako';

interface DashboardProps {
  currentUser?: Staff | null;
  setView?: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser, setView }) => {
  const isSales = currentUser?.role === 'Sales';
  const [showSensitiveData, setShowSensitiveData] = useState(!isSales);
  const [isDataReady, setIsDataReady] = useState(false);

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const sales = useLiveQuery(() => db.sales.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());

  // Determine when all critical data from Dexie is loaded
  useEffect(() => {
    if (sales !== undefined && products !== undefined && debts !== undefined && settings !== undefined) {
      setIsDataReady(true);
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

  useEffect(() => {
    if (isSales) setShowSensitiveData(false);
  }, [isSales]);

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

  const chartData = [
    { name: 'Mon', amount: 45000 },
    { name: 'Tue', amount: 52000 },
    { name: 'Wed', amount: 38000 },
    { name: 'Thu', amount: 65000 },
    { name: 'Fri', amount: 82000 },
    { name: 'Sat', amount: 91000 },
    { name: 'Sun', amount: 48000 },
  ];

  const formatCurrency = (val: number) => {
    if (!showSensitiveData) return "₦ ****";
    return `₦${Math.floor(val).toLocaleString()}`;
  };

  const handleWhatsAppReport = async () => {
    try {
      const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
      const data = { type: 'SALES_PUSH', sales: pendingSales };
      const compressed = pako.gzip(JSON.stringify(data));
      const b64 = btoa(String.fromCharCode.apply(null, Array.from(compressed)));
      window.open(`https://wa.me/?text=${encodeURIComponent(`📦 STAFF_SALES REPORT (${new Date().toLocaleDateString()}):\n${b64}`)}`, '_blank');
    } catch (err) {
      alert("Report failed: " + err);
    }
  };

  // Main Loading Spinner for Dashboard
  if (!isDataReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={48} className="animate-spin text-emerald-600" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing Terminal Data...</p>
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
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-emerald-600 text-white rounded-2xl">
               <RefreshCw size={24} />
             </div>
             <div>
               <h3 className="text-xl font-black text-slate-800">Sync Center</h3>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Keep your terminal up to date</p>
             </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => setView && setView('sync')}
              className="group p-6 bg-slate-50 border border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center gap-4 text-left"
            >
              <div className="p-4 bg-white rounded-2xl shadow-sm text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <Wifi size={24} />
              </div>
              <div className="flex-1">
                <p className="font-black text-slate-800 leading-tight">Connect to Admin (Wi-Fi)</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Send sales & get stock</p>
              </div>
              <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </button>
            <button 
              onClick={handleWhatsAppReport}
              className="group p-6 bg-slate-50 border border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center gap-4 text-left"
            >
              <div className="p-4 bg-white rounded-2xl shadow-sm text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <MessageCircle size={24} />
              </div>
              <div className="flex-1">
                <p className="font-black text-slate-800 leading-tight">Send WhatsApp Report</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manual offline fallback</p>
              </div>
              <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </button>
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
        {/* Parent Card for Sales Analytics */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col min-h-0 block">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 text-xl tracking-tight">Sales Analytics</h3>
            <select className="bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          {/* Chart Wrapper with explicit sizing for ResponsiveContainer */}
          <div className="w-full h-[300px] min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" aspect={2}>
              <BarChart data={chartData}>
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
                />
                <Bar dataKey="amount" radius={[10, 10, 0, 0]} barSize={45}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 5 ? '#059669' : '#10b981'} fillOpacity={index === 5 ? 1 : 0.8} />
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
                    sale.payment_method === 'transfer' ? 'bg-indigo-100 text-indigo-700' :
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

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, trendType, color, warning, isSensitive }) => {
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
