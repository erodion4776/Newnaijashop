import React, { useState, useMemo, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
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
  Users,  // Changed from Staff to Users
  RefreshCw,
  Wifi,
  MessageCircle,
  ArrowRight,
  Loader2,
  Info,
  Calendar,
  Clock,
  Receipt,
  TrendingDown,
  BarChart3,
  Send
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { View, Staff, Sale } from '../types';  // Import Staff type properly
import LZString from 'lz-string';  // Better compression than pako for this use case

interface DashboardProps {
  currentUser?: Staff | null;
  setView?: (view: View) => void;
}

type DateRange = '7days' | '30days' | 'today';

const Dashboard: React.FC<DashboardProps> = ({ currentUser, setView }) => {
  const isSales = currentUser?.role === 'Sales';
  const [showSensitiveData, setShowSensitiveData] = useState(!isSales);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [isSendingReport, setIsSendingReport] = useState(false);
  
  const chartParentRef = useRef<HTMLDivElement>(null);

  // Database queries
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const sales = useLiveQuery(() => db.sales.orderBy('timestamp').reverse().toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());

  // Safety timeout for chart loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChartLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Chart resize observer
  useLayoutEffect(() => {
    if (!chartParentRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setIsChartLoading(false);
        }
      }
    });

    resizeObserver.observe(chartParentRef.current);

    // Initial check
    if (chartParentRef.current.offsetWidth > 0) {
      setIsChartLoading(false);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Data ready check
  useEffect(() => {
    if (sales !== undefined && products !== undefined && debts !== undefined) {
      setIsDataReady(true);
      setTimeout(() => setIsChartLoading(false), 300);
    }
  }, [sales, products, debts]);

  // Get date boundaries
  const getDateBoundaries = useCallback(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    return {
      todayStart: today.getTime(),
      todayEnd: today.getTime() + 86400000,
      yesterdayStart: yesterday.getTime(),
      yesterdayEnd: today.getTime(),
      weekAgoStart: weekAgo.getTime(),
      monthAgoStart: monthAgo.getTime()
    };
  }, []);

  // Process chart data based on selected date range
  const processedChartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const numDays = dateRange === '30days' ? 30 : 7;
    
    try {
      const result = [];
      const now = new Date();
      
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);
        
        const startTs = d.getTime();
        const endTs = startTs + 86400000;
        
        const dayName = numDays <= 7 
          ? days[d.getDay()] 
          : `${d.getDate()}/${d.getMonth() + 1}`;
          
        const dayTotal = (sales || [])
          .filter(s => s.timestamp >= startTs && s.timestamp < endTs)
          .reduce((sum, s) => sum + (s.total_amount || 0), 0);
          
        result.push({
          name: dayName,
          amount: dayTotal,
          fullDate: d.toLocaleDateString(),
          isToday: i === 0
        });
      }
      
      return result;
    } catch (err) {
      console.error("Chart Processing Error:", err);
      return days.map(d => ({ name: d, amount: 0, fullDate: 'N/A', isToday: false }));
    }
  }, [sales, dateRange]);

  // Calculate today's sales
  const todaySales = useMemo(() => {
    if (!sales) return [];
    const { todayStart } = getDateBoundaries();
    return sales.filter(s => s.timestamp >= todayStart);
  }, [sales, getDateBoundaries]);

  // Calculate yesterday's sales for comparison
  const yesterdaySales = useMemo(() => {
    if (!sales) return [];
    const { yesterdayStart, yesterdayEnd } = getDateBoundaries();
    return sales.filter(s => s.timestamp >= yesterdayStart && s.timestamp < yesterdayEnd);
  }, [sales, getDateBoundaries]);

  // Totals
  const totalSalesToday = todaySales.reduce((acc, curr) => acc + curr.total_amount, 0);
  const totalSalesYesterday = yesterdaySales.reduce((acc, curr) => acc + curr.total_amount, 0);
  
  // Calculate trend percentage
  const salesTrend = useMemo(() => {
    if (totalSalesYesterday === 0) return { value: totalSalesToday > 0 ? '+100%' : '0%', type: 'up' as const };
    const change = ((totalSalesToday - totalSalesYesterday) / totalSalesYesterday) * 100;
    return {
      value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
      type: change >= 0 ? 'up' as const : 'down' as const
    };
  }, [totalSalesToday, totalSalesYesterday]);

  const totalStockValue = (products || []).reduce((acc, p) => acc + (p.cost_price * p.stock_qty), 0);
  const expectedProfitOnStock = (products || []).reduce((acc, p) => acc + ((p.price - p.cost_price) * p.stock_qty), 0);

  // Calculate today's profit
  const todaysProfit = useMemo(() => {
    if (!products) return 0;
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

  // Calculate yesterday's profit for comparison
  const yesterdaysProfit = useMemo(() => {
    if (!products) return 0;
    let profit = 0;
    yesterdaySales.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          profit += (item.price - product.cost_price) * item.quantity;
        }
      });
    });
    return profit;
  }, [yesterdaySales, products]);

  const profitTrend = useMemo(() => {
    if (yesterdaysProfit === 0) return { value: todaysProfit > 0 ? '+100%' : '0%', type: 'up' as const };
    const change = ((todaysProfit - yesterdaysProfit) / yesterdaysProfit) * 100;
    return {
      value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
      type: change >= 0 ? 'up' as const : 'down' as const
    };
  }, [todaysProfit, yesterdaysProfit]);

  const totalDebt = (debts || []).filter(d => d.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);
  const lowStock = (products || []).filter(p => p.stock_qty <= 10).length;
  const outOfStock = (products || []).filter(p => p.stock_qty === 0).length;
  
  // Check for unconfirmed transfers (safely handle missing property)
  const unconfirmedTransfers = (sales || []).filter(s => {
    if (s.payment_method !== 'transfer' && s.payment_method !== 'Bank Transfer') return false;
    return !(s as any).confirmed_by;
  }).length;

  // Recent activity (last 10 sales from today/recent)
  const recentActivity = useMemo(() => {
    if (!sales) return [];
    const { weekAgoStart } = getDateBoundaries();
    return sales
      .filter(s => s.timestamp >= weekAgoStart)
      .slice(0, 10);
  }, [sales, getDateBoundaries]);

  // Last sync text
  const lastSyncText = useMemo(() => {
    if (!settings?.last_synced_timestamp) return "Never";
    const diff = Date.now() - settings.last_synced_timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(settings.last_synced_timestamp).toLocaleDateString();
  }, [settings?.last_synced_timestamp]);

  const formatCurrency = (val: number, hideSensitive = false) => {
    if (hideSensitive && !showSensitiveData) return "₦ ****";
    return `₦${Math.floor(val).toLocaleString()}`;
  };

  // WhatsApp Report - Fixed for large data
  const handleWhatsAppReport = async () => {
    try {
      setIsSendingReport(true);
      
      const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
      
      if (pendingSales.length === 0) {
        alert("No pending sales to report.");
        setIsSendingReport(false);
        return;
      }

      const data = { 
        type: 'STAFF_SALES_REPORT', 
        staff: currentUser?.name || 'Unknown',
        sales: pendingSales,
        timestamp: Date.now()
      };
      
      // Use LZString for better compression and URL safety
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
      
      const message = `📦 STAFF SALES REPORT\n` +
        `👤 Staff: ${currentUser?.name || 'Terminal'}\n` +
        `📅 Date: ${new Date().toLocaleDateString()}\n` +
        `📊 Sales Count: ${pendingSales.length}\n` +
        `💰 Total: ₦${pendingSales.reduce((a, s) => a + s.total_amount, 0).toLocaleString()}\n\n` +
        `DATA:\n${compressed}`;
      
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    } catch (err) {
      console.error("Report error:", err);
      alert("Failed to generate report: " + err);
    } finally {
      setIsSendingReport(false);
    }
  };

  // Loading state
  if (!isDataReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={48} className="animate-spin text-emerald-600" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {isSales ? 'Sales Terminal' : 'Shop Performance'}
          </h2>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
              settings?.last_synced_timestamp && (Date.now() - settings.last_synced_timestamp < 300000)
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                : 'bg-amber-50 text-amber-600 border-amber-100'
            }`}>
              <RefreshCw size={10} className={
                !settings?.last_synced_timestamp || (Date.now() - settings.last_synced_timestamp > 300000) 
                  ? 'animate-pulse' 
                  : ''
              } />
              Sync: {lastSyncText}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Clock size={10} />
              {new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
        </div>
        
        {!isSales && (
          <button 
            onClick={() => setShowSensitiveData(!showSensitiveData)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm font-bold text-sm"
          >
            {showSensitiveData ? <EyeOff size={18} /> : <Eye size={18} />}
            {showSensitiveData ? 'Hide Profits' : 'Show Profits'}
          </button>
        )}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <StatCard 
          title="Today's Sales" 
          value={formatCurrency(totalSalesToday)} 
          trend={salesTrend.value}
          trendType={salesTrend.type}
          icon={<TrendingUp size={22} />}
          color="emerald"
          subtitle={`${todaySales.length} transactions`}
        />
        <StatCard 
          title="Today's Profit" 
          value={formatCurrency(todaysProfit, true)} 
          trend={profitTrend.value}
          trendType={profitTrend.type}
          icon={<Briefcase size={22} />}
          color="blue"
          subtitle="Net margin earned"
          isSensitive={!showSensitiveData}
        />
        <StatCard 
          title="Outstanding Debts" 
          value={formatCurrency(totalDebt)} 
          icon={<Wallet size={22} />}
          color="rose"
          subtitle={`${(debts || []).filter(d => d.status === 'pending').length} pending`}
          warning={totalDebt > 0}
        />
      </div>

      {/* Staff Sync Center */}
      {isSales && (
        <div className="bg-white p-6 lg:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg">
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
              className="group p-5 lg:p-6 bg-slate-50 border border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center gap-4 text-left"
            >
              <div className="p-4 bg-white rounded-xl shadow-sm text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <Wifi size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 leading-tight">Connect to Admin</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Wi-Fi Direct Sync</p>
              </div>
              <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
            </button>
            
            <button 
              onClick={handleWhatsAppReport}
              disabled={isSendingReport}
              className="group p-5 lg:p-6 bg-slate-50 border border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center gap-4 text-left disabled:opacity-50"
            >
              <div className="p-4 bg-white rounded-xl shadow-sm text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                {isSendingReport ? <Loader2 size={22} className="animate-spin" /> : <MessageCircle size={22} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-slate-800 leading-tight">WhatsApp Report</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Offline Fallback</p>
              </div>
              <ArrowRight size={20} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* Admin-Only: Stock Value Cards */}
      {showSensitiveData && !isSales && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900 rounded-[2rem] p-6 lg:p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
              <Layers size={160} />
            </div>
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.15em] mb-2">Stock Value</p>
                <h4 className="text-3xl lg:text-4xl font-black tracking-tighter truncate">
                  {formatCurrency(totalStockValue)}
                </h4>
                <p className="text-[10px] text-slate-500 font-bold mt-3 uppercase tracking-widest bg-white/5 inline-block px-3 py-1 rounded-full border border-white/5">
                  Investment in Inventory
                </p>
              </div>
              <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 flex-shrink-0">
                <Package size={28} className="text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="bg-emerald-900 rounded-[2rem] p-6 lg:p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
              <Coins size={160} />
            </div>
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-emerald-300/50 text-xs font-black uppercase tracking-[0.15em] mb-2">Potential Profit</p>
                <h4 className="text-3xl lg:text-4xl font-black tracking-tighter truncate">
                  {formatCurrency(expectedProfitOnStock)}
                </h4>
                <p className="text-[10px] text-emerald-400/80 font-bold mt-3 uppercase tracking-widest bg-white/5 inline-block px-3 py-1 rounded-full border border-white/5">
                  If All Stock Sold
                </p>
              </div>
              <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 flex-shrink-0">
                <ArrowUpRight size={28} className="text-emerald-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
        <StatCard 
          title="Unverified Transfers" 
          value={unconfirmedTransfers.toString()} 
          icon={<ShieldAlert size={22} />}
          color="blue"
          warning={unconfirmedTransfers > 0}
          subtitle="Awaiting confirmation"
        />
        <StatCard 
          title="Low Stock Alerts" 
          value={lowStock.toString()} 
          icon={<AlertTriangle size={22} />}
          color="amber"
          warning={lowStock > 0}
          subtitle={outOfStock > 0 ? `${outOfStock} out of stock` : 'Items need restocking'}
        />
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <BarChart3 size={20} className="text-emerald-600" />
              </div>
              <h3 className="font-black text-slate-800 text-lg tracking-tight">Sales Analytics</h3>
            </div>
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
          
          <div 
            ref={chartParentRef}
            className="relative w-full h-[300px] lg:h-[350px]"
          >
            {isChartLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 z-20 gap-3">
                <Loader2 size={32} className="animate-spin text-emerald-600" />
                <span className="text-xs font-bold text-slate-400">Loading chart...</span>
              </div>
            )}
            
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc', radius: 8 }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', 
                    padding: '12px 16px' 
                  }}
                  labelStyle={{ fontWeight: 700, color: '#64748b', fontSize: 12 }}
                  formatter={(value: number) => [`₦${value.toLocaleString()}`, 'Sales']}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={50}>
                  {processedChartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isToday ? '#059669' : '#10b981'} 
                      fillOpacity={entry.isToday ? 1 : 0.7} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Summary */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-600" />
              <span className="font-medium text-slate-500">Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500/70" />
              <span className="font-medium text-slate-500">Previous Days</span>
            </div>
            <div className="text-slate-400">
              Total: <span className="font-bold text-slate-600">
                ₦{processedChartData.reduce((a, d) => a + d.amount, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Receipt size={20} className="text-indigo-600" />
            </div>
            <h3 className="font-black text-slate-800 text-lg tracking-tight">Recent Sales</h3>
          </div>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {recentActivity.length > 0 ? (
              recentActivity.map((sale) => (
                <div 
                  key={sale.id} 
                  className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">
                      Sale #{String(sale.id).padStart(4, '0')}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <Clock size={10} />
                      <span className="font-medium">
                        {new Date(sale.timestamp).toLocaleString('en-NG', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-slate-900">
                      ₦{sale.total_amount.toLocaleString()}
                    </p>
                    <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full inline-block mt-1 ${
                      sale.payment_method === 'cash' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : sale.payment_method === 'transfer' || sale.payment_method === 'Bank Transfer' 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : sale.payment_method === 'pos'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-amber-100 text-amber-700'
                    }`}>
                      {sale.payment_method}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Receipt size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm font-bold text-slate-400">No recent sales</p>
                <p className="text-xs text-slate-300 mt-1">Transactions will appear here</p>
              </div>
            )}
          </div>
          
          {recentActivity.length > 0 && (
            <button 
              onClick={() => setView && setView('reports')}
              className="w-full mt-4 py-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              View All Reports <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ STAT CARD COMPONENT ============

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendType?: 'up' | 'down';
  color: 'emerald' | 'blue' | 'amber' | 'rose';
  warning?: boolean;
  subtitle?: string;
  isSensitive?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  trend, 
  trendType, 
  color, 
  warning,
  subtitle,
  isSensitive 
}) => {
  const colorStyles = {
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-100'
    },
    blue: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      border: 'border-indigo-100'
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100'
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      border: 'border-rose-100'
    },
  };

  const style = colorStyles[color];

  return (
    <div className={`bg-white p-6 lg:p-8 rounded-[2rem] shadow-sm border transition-all duration-300 ${
      warning 
        ? 'border-rose-200 bg-rose-50/30 ring-2 ring-rose-100' 
        : 'border-slate-200 hover:border-slate-300'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${style.bg} ${style.text}`}>
          {icon}
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full ${
            trendType === 'up' 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-rose-100 text-rose-700'
          }`}>
            {trendType === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </span>
        )}
      </div>
      
      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{title}</p>
      
      <h4 className={`text-2xl lg:text-3xl font-black text-slate-900 mt-1 tracking-tight ${
        isSensitive ? 'blur-sm select-none' : ''
      }`}>
        {value}
      </h4>
      
      {subtitle && (
        <p className="text-xs text-slate-400 mt-2 font-medium">{subtitle}</p>
      )}
    </div>
  );
};

export default Dashboard;
