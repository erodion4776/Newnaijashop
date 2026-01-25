import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  Wallet,
  ShieldAlert,
  Eye,
  EyeOff,
  Coins,
  Layers,
  ChevronRight,
  Loader2,
  Banknote,
  PiggyBank,
  BellRing,
  TrendingDown,
  Lightbulb,
  Zap,
  Gift,
  CreditCard
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Staff, Product, Sale } from '../types';
import NotificationService from '../services/NotificationService';

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
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(Notification.permission);
  
  const chartParentRef = useRef<HTMLDivElement>(null);

  const sales = useLiveQuery(() => db.sales.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());
  const expenses = useLiveQuery(() => db.expenses.toArray());
  const settings = useLiveQuery(() => db.settings.get('app_settings'));

  useEffect(() => {
    NotificationService.checkDailyReport();
    NotificationService.checkInactivityReminder();
  }, []);

  useEffect(() => {
    if (sales !== undefined && products !== undefined && debts !== undefined && expenses !== undefined) {
      setIsDataReady(true);
      setTimeout(() => setIsChartLoading(false), 500);
    }
  }, [sales, products, debts, expenses]);

  const handleEnableNotifs = async () => {
    const result = await NotificationService.requestPermission();
    setNotifPermission(result);
  };

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
    let lifeSales = 0;
    let lifeInterest = 0;
    let todayExp = 0;
    let lifeExp = 0;

    sales.forEach(sale => {
      const isToday = sale.timestamp >= today;
      
      lifeSales += sale.total_amount;
      if (isToday) todaySales += sale.total_amount;

      sale.items.forEach(item => {
        const product = productMap[item.productId];
        const cost = product?.cost_price || 0;
        const margin = (item.price - cost) * item.quantity;
        
        lifeInterest += margin;
        if (isToday) todayInterest += margin;
      });
    });

    expenses.forEach(exp => {
      const isToday = exp.timestamp >= today;
      lifeExp += exp.amount;
      if (isToday) todayExp += exp.amount;
    });

    return { 
      todaySales, 
      todayNet: todayInterest - todayExp, 
      lifeSales, 
      lifeNet: lifeInterest - lifeExp,
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
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading Terminal Data...</p>
      </div>
    );
  }

  const renderTrialBar = () => {
    if (isSubscribed || !trialRemaining) return null;

    const { days, hours, minutes } = trialRemaining;
    
    let bgColor = "bg-emerald-50 border-emerald-200 text-emerald-900";
    let iconColor = "bg-emerald-600";
    let message = `🎁 Free Trial Active: ${days}d ${hours}h remaining`;
    let urgency = "normal";

    if (days < 3) {
      bgColor = "bg-rose-50 border-rose-200 text-rose-900 animate-pulse";
      iconColor = "bg-rose-600";
      message = `🚨 URGENT: Only ${hours}h ${minutes}m left! Subscribe now to avoid lockout.`;
      urgency = "critical";
    } else if (days < 7) {
      bgColor = "bg-amber-50 border-amber-200 text-amber-900";
      iconColor = "bg-amber-600";
      message = `⚠️ Trial Ending Soon: ${days}d ${hours}h left. Subscribe to keep your data safe.`;
      urgency = "warning";
    }

    return (
      <div className={`p-4 rounded-2xl flex items-center justify-between border shadow-sm transition-all duration-500 mb-6 ${bgColor}`}>
        <div className="flex items-center gap-3">
           <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${iconColor}`}>
              {urgency === 'critical' ? <ShieldAlert size={16} /> : <Zap size={16} />}
           </div>
           <p className="text-xs font-bold leading-tight">
             {message}
           </p>
        </div>
        <button 
          onClick={onSubscribe}
          className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all flex items-center gap-2 ${iconColor} hover:brightness-110`}
        >
          <CreditCard size={14} /> Subscribe Now
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Trial Status Banner */}
      {renderTrialBar()}

      {/* Notification Banner */}
      {notifPermission === 'default' && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <BellRing size={20} />
            </div>
            <p className="text-sm font-bold text-emerald-900">🔔 Stay Updated: Enable notifications for daily sales reports and security alerts.</p>
          </div>
          <button 
            onClick={handleEnableNotifs}
            className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm"
          >
            Enable
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Store Performance</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Status: Active</p>
        </div>
        {canSeeFinancials && (
          <button 
            onClick={() => setShowSensitiveData(!showSensitiveData)} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all shadow-sm font-black text-xs uppercase tracking-widest ${showSensitiveData ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {showSensitiveData ? <EyeOff size={18} /> : <Eye size={18} />}
            {showSensitiveData ? 'Hide Profits' : 'Show Profits'}
          </button>
        )}
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><TrendingUp size={24} /></div>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Today's Sales</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.todaySales)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner"><PiggyBank size={24} /></div>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimated Profit</p>
            <p className="text-2xl font-black text-emerald-600">{formatCurrency(stats.todayNet, true)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner"><TrendingDown size={24} /></div>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Today's Expenses</p>
            <p className="text-2xl font-black text-rose-600">{formatCurrency(stats.todayExp)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center shadow-inner"><Package size={24} /></div>
            {lowStockItems.length > 0 && <span className="bg-rose-100 text-rose-600 px-2 py-1 rounded-lg text-[10px] font-black">{lowStockItems.length} Low</span>}
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Products</p>
            <p className="text-2xl font-black text-slate-900">{products?.length || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
              <Layers size={16} className="text-emerald-500" /> Sales Trend (7 Days)
            </h4>
          </div>
          <div className="h-[300px] w-full" ref={chartParentRef}>
            {isChartLoading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-slate-200" size={40} /></div>
            ) : (
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
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6 relative overflow-hidden">
            <div className="absolute right-[-20px] top-[-20px] opacity-10"><Coins size={120} /></div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Receivables</p>
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
              "Regularly backup your terminal records to WhatsApp to prevent business data loss if your phone is stolen."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;