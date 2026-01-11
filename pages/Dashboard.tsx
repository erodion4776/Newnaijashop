
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
  Staff
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  currentUser?: Staff | null;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser }) => {
  // Sales staff cannot toggle sensitive data, it's always hidden
  const isSales = currentUser?.role === 'Sales';
  const [showSensitiveData, setShowSensitiveData] = useState(!isSales);

  useEffect(() => {
    if (isSales) setShowSensitiveData(false);
  }, [isSales]);

  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const debts = useLiveQuery(() => db.debts.toArray()) || [];

  // Filter today's sales
  const todaySales = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return sales.filter(s => s.timestamp >= today);
  }, [sales]);

  // Metric Calculations
  const totalSalesToday = todaySales.reduce((acc, curr) => acc + curr.total_amount, 0);
  
  const totalStockValue = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.cost_price * p.stock_qty), 0);
  }, [products]);

  const expectedProfitOnStock = useMemo(() => {
    return products.reduce((acc, p) => acc + ((p.price - p.cost_price) * p.stock_qty), 0);
  }, [products]);

  const todaysInterest = useMemo(() => {
    let profit = 0;
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

  const totalDebt = debts.filter(d => d.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);
  const lowStock = products.filter(p => p.stock_qty <= 10).length;
  const unconfirmedTransfers = sales.filter(s => s.payment_method === 'transfer' && !s.confirmed_by).length;

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

  return (
    <div className="space-y-6">
      {/* Header with Privacy Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Shop Performance</h2>
          <p className="text-slate-400 text-sm font-medium">Real-time terminal analytics</p>
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

      {/* Primary Financial Grid */}
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

      {/* Stock Value & Profit Grid - Restricted */}
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

      {/* Alerts & Operational Stats */}
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
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 text-xl tracking-tight">Sales Analytics</h3>
            <select className="bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
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
            {sales.slice(-5).reverse().map((sale) => (
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
            {sales.length === 0 && (
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
