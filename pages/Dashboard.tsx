import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  Wallet,
  Eye,
  EyeOff,
  Coins,
  Layers,
  ChevronRight,
  Loader2,
  PiggyBank,
  TrendingDown,
  Lightbulb,
  Zap,
  CreditCard,
  CheckCircle2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Staff, Product, Sale } from '../types';

interface DashboardProps {
  currentUser?: Staff | null;
  setView?: (view: any) => void;
  isStaffLock?: boolean;
  trialRemaining?: { days: number, hours: number, minutes: number, totalMs: number };
  isSubscribed?: boolean;
  onSubscribe?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser, setView, isStaffLock = false, trialRemaining, isSubscribed, onSubscribe }) => {
  const canSeeFinancials = currentUser?.role === 'Admin' || (currentUser?.role === 'Manager' && !isStaffLock);
  
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);

  const sales = useLiveQuery(() => db.sales.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());
  const expenses = useLiveQuery(() => db.expenses.toArray());

  useEffect(() => {
    if (sales !== undefined && products !== undefined && debts !== undefined && expenses !== undefined) {
      setIsDataReady(true);
    }
  }, [sales, products, debts, expenses]);

  const productMap = useMemo(() => {
    const map: Record<number, Product> = {};
    if (products) {
      products.forEach(p => { if (p.id) map[p.id] = p; });
    }
    return map;
  }, [products]);

  const stats = useMemo(() => {
    if (!sales || !products || !expenses) return { todaySales: 0, todayNet: 0, lifeSales: 0, lifeNet: 0, todayExp: 0 };
    
    const today = new Date().setHours(0, 0, 0, 0);
    let todaySales = 0;
    let todayInterest = 0;
    let todayExp = 0;

    sales.forEach(sale => {
      const isToday = sale.timestamp >= today;
      if (isToday) {
        todaySales += sale.total_amount;
        sale.items.forEach(item => {
          const product = productMap[item.productId];
          const cost = product?.cost_price || 0;
          todayInterest += (item.price - cost) * item.quantity;
        });
      }
    });

    expenses.forEach(exp => {
      const isToday = exp.timestamp >= today;
      if (isToday) todayExp += exp.amount;
    });

    return { 
      todaySales, 
      todayNet: todayInterest - todayExp,
      todayExp
    };
  }, [sales, productMap, expenses]);

  const formatCurrency = (val: number, isSensitive: boolean = false) => {
    if (isSensitive && !showSensitiveData) return "₦ ****";
    if (!canSeeFinancials && isSensitive) return "₦ ****";
    return `₦${Math.floor(val).toLocaleString()}`;
  };

  const processedChartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0); 
      const startTs = d.getTime();
      const endTs = startTs + 86400000;
      const dayTotal = (sales || []).filter(s => s.timestamp >= startTs && s.timestamp < endTs).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      result.push({ name: days[d.getDay()], amount: dayTotal });
    }
    return result;
  }, [sales]);

  const lowStockItems = useMemo(() => {
    if (!products) return [];
    return products.filter(p => p.stock_qty <= (p.low_stock_threshold || 5));
  }, [products]);

  if (!isDataReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={48} className="animate-spin text-emerald-600" />
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Accessing Terminal Records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Trial Banner */}
      {!isSubscribed && trialRemaining && (
        <div className={`p-4 rounded-2xl flex items-center justify-between border shadow-sm transition-all ${trialRemaining.days < 5 ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
          <div className="flex items-center gap-3">
             <Zap size={16} className={trialRemaining.days < 5 ? 'text-rose-600' : 'text-emerald-600'} />
             <p className="text-xs font-bold leading-tight">
               Trial Active: {trialRemaining.days} Days Left. Subscribe to keep your terminal secure.
             </p>
          </div>
          <button onClick={onSubscribe} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Upgrade</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Daily Summary</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Status: Operational</p>
        </div>
        {canSeeFinancials && (
          <button 
            onClick={() => setShowSensitiveData(!showSensitiveData)} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all shadow-sm font-black text-xs uppercase tracking-widest ${showSensitiveData ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {showSensitiveData ? <EyeOff size={18} /> : <Eye size={18} />}
            {showSensitiveData ? 'Hide Financials' : 'Show Financials'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><TrendingUp size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Today's Revenue</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.todaySales)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner"><PiggyBank size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Gain (Today)</p>
            <p className="text-2xl font-black text-emerald-600">{formatCurrency(stats.todayNet, true)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner"><TrendingDown size={24} /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Expenses</p>
            <p className="text-2xl font-black text-rose-600">{formatCurrency(stats.todayExp)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center shadow-inner"><Package size={24} /></div>
            {lowStockItems.length > 0 && <span className="bg-rose-100 text-rose-600 px-2 py-1 rounded-lg text-[10px] font-black">{lowStockItems.length} Low</span>}
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inventory Items</p>
            <p className="text-2xl font-black text-slate-900">{products?.length || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-8 flex items-center gap-2">
            <Layers size={16} className="text-emerald-500" /> Weekly Sales Volume
          </h4>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="amount" radius={[8, 8, 8, 8]} barSize={32}>
                  {processedChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === processedChartData.length - 1 ? '#10b981' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6 relative overflow-hidden shadow-xl">
            <div className="absolute right-[-20px] top-[-20px] opacity-10"><Coins size={120} /></div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Outstanding</p>
              <h4 className="text-4xl font-black tracking-tight">₦{(debts || []).reduce((acc, curr) => acc + (curr.status === 'pending' ? curr.amount : 0), 0).toLocaleString()}</h4>
              <button onClick={() => setView && setView('debts')} className="mt-6 w-full flex items-center justify-center gap-2 py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                Manage Debts <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="bg-emerald-50 p-8 rounded-[3rem] border border-emerald-100 space-y-6">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-white text-emerald-600 rounded-xl flex items-center justify-center shadow-sm"><Lightbulb size={20} /></div>
               <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Oga Tip</h4>
            </div>
            <p className="text-sm text-emerald-800 font-medium leading-relaxed italic">
              "Regularly sync your terminal data with the Master Stock to ensure your staff see the correct prices and quantities."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;