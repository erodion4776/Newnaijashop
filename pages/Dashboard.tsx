
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  Wallet,
  ArrowUpRight,
  ShieldAlert,
  Eye,
  EyeOff,
  Coins,
  Layers,
  ChevronRight,
  Loader2,
  Sparkles,
  Lightbulb,
  WifiOff,
  Banknote,
  PiggyBank,
  Briefcase,
  BellRing,
  TrendingDown
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Staff, Product, Sale } from '../types';
import { getAIInsights } from '../services/geminiService';
import NotificationService from '../services/NotificationService';

interface DashboardProps {
  currentUser?: Staff | null;
  setView?: (view: any) => void;
  isStaffLock?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser, setView, isStaffLock = false }) => {
  const canSeeFinancials = currentUser?.role === 'Admin' || (currentUser?.role === 'Manager' && !isStaffLock);
  
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [guruTip, setGuruTip] = useState<any>(null);
  const [isLoadingTip, setIsLoadingTip] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(Notification.permission);
  
  const chartParentRef = useRef<HTMLDivElement>(null);

  const sales = useLiveQuery(() => db.sales.toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());
  const expenses = useLiveQuery(() => db.expenses.toArray());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check for daily report and inactivity
    NotificationService.checkDailyReport();
    NotificationService.checkInactivityReminder();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (sales !== undefined && products !== undefined && debts !== undefined && expenses !== undefined) {
      setIsDataReady(true);
      setTimeout(() => setIsChartLoading(false), 500);
    }
  }, [sales, products, debts, expenses]);

  useEffect(() => {
    if (isOnline && isDataReady && sales && sales.length >= 5 && !guruTip && !isLoadingTip) {
      setIsLoadingTip(true);
      getAIInsights(sales, products || []).then(insights => {
        if (insights && insights.length > 0) {
          setGuruTip(insights[0]);
        }
        setIsLoadingTip(false);
      }).catch(() => setIsLoadingTip(false));
    }
  }, [isOnline, isDataReady, sales, products]);

  const handleEnableNotifs = async () => {
    const result = await NotificationService.requestPermission();
    setNotifPermission(result);
  };

  // Product lookup map for efficient interest calculations
  const productMap = useMemo(() => {
    const map: Record<number, Product> = {};
    if (products) {
      products.forEach(p => { if (p.id) map[p.id] = p; });
    }
    return map;
  }, [products]);

  // 1. KPI Calculations including Net Profit
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

  return (
    <div className="space-y-6">
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

      {/* KPI Section - OPay Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Today's Sales" 
          value={formatCurrency(stats.todaySales)} 
          icon={<TrendingUp size={20} />} 
          color="emerald" 
        />
        <StatCard 
          title="Today's Net Profit" 
          value={formatCurrency(stats.todayNet, true)} 
          icon={<PiggyBank size={20} />} 
          color="gold" 
          subtitle={stats.todayExp > 0 ? `After ₦${stats.todayExp.toLocaleString()} expenses` : ''}
        />
        <StatCard 
          title="Life Net Profit" 
          value={formatCurrency(stats.lifeNet, true)} 
          icon={<Coins size={20} />} 
          color="emerald-deep" 
        />
        <StatCard 
          title="Today's Expenses" 
          value={formatCurrency(stats.todayExp)} 
          icon={<TrendingDown size={20} />} 
          color="rose" 
        />
      </div>

      {/* AI Guru Quick Tip Section */}
      {isOnline ? (
        (guruTip || isLoadingTip) && (
          <div className="bg-emerald-900 rounded-[2.5rem] p-6 text-white relative overflow-hidden border border-emerald-700 shadow-xl animate-in fade-in slide-in-from-bottom-4">
             <div className="absolute right-[-20px] top-[-20px] opacity-10">
               <Sparkles size={140} />
             </div>
             <div className="relative z-10 flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 border border-white/10">
                   {isLoadingTip ? <Loader2 size={24} className="animate-spin text-emerald-300" /> : <Lightbulb size={24} className="text-amber-300" />}
                </div>
                <div className="flex-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-2">
                     <Sparkles size={12} /> NaijaShop Guru Tip
                   </p>
                   {isLoadingTip ? (
                     <p className="text-sm font-medium animate-pulse">Analyzing sales velocity for insights...</p>
                   ) : (
                     <div>
                       <h4 className="font-black text-lg leading-tight mb-1">{guruTip.title}</h4>
                       <p className="text-sm text-emerald-100/80 font-medium">{guruTip.description}</p>
                     </div>
                   )}
                </div>
                {setView && (
                  <button onClick={() => setView('ai-insights')} className="hidden sm:flex self-center items-center gap-1 text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-2 rounded-xl hover:bg-white/20 transition-all">
                    More Hub <ChevronRight size={14} />
                  </button>
                )}
             </div>
          </div>
        )
      ) : (
        <div className="bg-amber-50 border border-amber-100 rounded-[2.5rem] p-6 flex items-center gap-4 text-amber-800">
           <WifiOff size={24} className="shrink-0" />
           <p className="text-sm font-bold">Guru Tips offline. Turn on data for smart business insights.</p>
        </div>
      )}

      {lowStockItems.length > 0 && (
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-top-4">
          <div className="w-16 h-16 bg-rose-600 text-white rounded-3xl flex items-center justify-center shrink-0 shadow-lg">
            <AlertTriangle size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Critical Stock Alert</h3>
            <p className="text-sm text-slate-500 font-medium">There are <b>{lowStockItems.length} items</b> hitting reorder levels in your inventory.</p>
          </div>
          <button onClick={() => setView && setView('inventory')} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all">
            View Items <ChevronRight size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden min-h-0 block">
          <h3 className="font-black text-slate-800 text-xl tracking-tight mb-8">Sales Velocity (7 Days)</h3>
          <div ref={chartParentRef} className="relative block w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} dy={10} />
                <YAxis hide />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="amount" radius={[10, 10, 0, 0]} barSize={40}>
                  {processedChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === 6 ? '#059669' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
           <h3 className="font-black text-slate-800 text-xl tracking-tight mb-6">Recent Log</h3>
           <div className="space-y-5">
              {(sales || []).slice(-5).reverse().map(sale => (
                <div key={sale.id} className="flex justify-between items-center pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-slate-800">₦{sale.total_amount.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-100 rounded text-slate-500">{sale.payment_method}</span>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{title: string, value: string, icon: any, color: string, subtitle?: string}> = ({ title, value, icon, color, subtitle }) => {
  const styles: {[key:string]:string} = { 
    emerald: 'bg-emerald-600 text-white', 
    'emerald-deep': 'bg-emerald-900 text-white',
    gold: 'bg-amber-500 text-white', 
    'gold-deep': 'bg-amber-700 text-white',
    rose: 'bg-rose-600 text-white'
  };

  return (
    <div className={`${styles[color]} p-6 rounded-[2rem] shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform`}>
      <div className="absolute right-[-10px] top-[-10px] opacity-10 group-hover:scale-110 transition-transform">
        {React.cloneElement(icon as React.ReactElement, { size: 80 })}
      </div>
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center mb-4">
          {icon}
        </div>
        <div>
          <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">{title}</p>
          <h4 className="text-2xl font-black mt-1 tracking-tight">{value}</h4>
          {subtitle && <p className="text-[9px] font-bold text-white/60 mt-1 uppercase tracking-wider">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
