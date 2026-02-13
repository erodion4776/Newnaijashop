import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  TrendingUp, 
  PiggyBank, 
  TrendingDown, 
  Package, 
  Eye, 
  EyeOff, 
  Loader2, 
  Wifi, 
  Bell, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import RelayService from '../services/RelayService';

const Dashboard: React.FC<any> = ({ currentUser, setView, trialRemaining, isSubscribed, onSubscribe }) => {
  const [showSensitive, setShowSensitive] = useState(false);
  const [lastRelaySale, setLastRelaySale] = useState<any>(null);
  const chimeRef = useRef<HTMLAudioElement | null>(null);
  
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  // HANDLE REAL-TIME RELAY SALES
  useEffect(() => {
    if (isAdmin) {
      RelayService.listen('new-sale', async (sale) => {
        // Double Check Duplicate (ID Check)
        const exists = await db.sales.where('sale_id').equals(sale.sale_id).first();
        if (!exists) {
          // Play Chime
          if (!chimeRef.current) {
            chimeRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3');
          }
          chimeRef.current.play().catch(e => console.log("Sound muted by browser"));
          
          setLastRelaySale(sale);
          setTimeout(() => setLastRelaySale(null), 8000);
        }
      });
    }
  }, [isAdmin]);

  const stats = useMemo(() => {
    const today = new Date().setHours(0,0,0,0);
    const todaySales = sales.filter(s => s.timestamp >= today).reduce((sum, s) => sum + s.total_amount, 0);
    const totalProducts = products.length;
    const todayExp = expenses.filter(e => e.timestamp >= today).reduce((sum, e) => sum + e.amount, 0);
    return { todaySales, totalProducts, todayExp };
  }, [sales, products, expenses]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {/* Real-time Toast Notification */}
      {lastRelaySale && (
        <div className="fixed top-20 right-6 z-[200] animate-in slide-in-from-right duration-500">
          <div className="bg-emerald-600 text-white p-5 rounded-3xl shadow-2xl border-4 border-emerald-500 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
               <Bell className="animate-bounce" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Live Sale Received</p>
              <h4 className="text-xl font-black">₦{lastRelaySale.total_amount.toLocaleString()}</h4>
              <p className="text-xs font-bold opacity-80">from {lastRelaySale.staff_name}</p>
            </div>
            <ArrowUpRight className="text-emerald-400" />
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">Store Performance</h2>
        <button onClick={() => setShowSensitive(!showSensitive)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">
          {showSensitive ? <EyeOff size={16}/> : <Eye size={16}/>} {showSensitive ? 'Hide Profits' : 'Show Profits'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-2">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Sales</p>
            <p className="text-2xl font-black text-slate-900">₦{stats.todaySales.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-2">
          <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
            <Package size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Products</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalProducts}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-2">
          <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center">
            <TrendingDown size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Expenses</p>
            <p className="text-2xl font-black text-slate-900">₦{stats.todayExp.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 h-[350px]">
         <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[{name: 'Today', amount: stats.todaySales}]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} barSize={60} />
            </BarChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
};
export default Dashboard;