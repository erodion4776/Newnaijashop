import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TrendingUp, PiggyBank, TrendingDown, Package, Eye, EyeOff, Loader2, Wifi, Bell } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useSync } from '../hooks/context/SyncProvider';

const Dashboard: React.FC<any> = ({ currentUser, setView, trialRemaining, isSubscribed, onSubscribe }) => {
  const [showSensitive, setShowSensitive] = useState(false);
  const { status, relay } = useSync();
  const [lastRelayEvent, setLastRelayEvent] = useState<any>(null);
  
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const stats = useMemo(() => {
    const today = new Date().setHours(0,0,0,0);
    const todaySales = sales.filter(s => s.timestamp >= today).reduce((sum, s) => sum + s.total_amount, 0);
    const totalProducts = products.length;
    const todayExp = expenses.filter(e => e.timestamp >= today).reduce((sum, e) => sum + e.amount, 0);
    
    let totalInterest = 0;
    if (isAdmin) {
      const pMap: Record<number, number> = {};
      products.forEach(p => { if(p.id) pMap[p.id] = p.cost_price; });
      sales.filter(s => s.timestamp >= today).forEach(sale => {
        sale.items.forEach(item => {
          const cost = pMap[item.productId] || (item.price * 0.85);
          totalInterest += (item.price - cost) * item.quantity;
        });
      });
    }

    return { todaySales, totalProducts, todayExp, totalInterest };
  }, [sales, products, expenses, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      relay.on('new-sale', (data) => {
        setLastRelayEvent({ type: 'sale', data });
        setTimeout(() => setLastRelayEvent(null), 5000);
      });
    }
  }, [relay, isAdmin]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-slate-800">Store Performance</h2>
          {lastRelayEvent && (
            <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full animate-bounce shadow-sm border border-emerald-200">
               <Bell size={14} className="fill-emerald-600" />
               <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                 Sale Received from {lastRelayEvent.data.staff_name}!
               </span>
            </div>
          )}
        </div>
        <button onClick={() => setShowSensitive(!showSensitive)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">
          {showSensitive ? <EyeOff size={16}/> : <Eye size={16}/>} {showSensitive ? 'Hide Profits' : 'Show Profits'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-2">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Sales</p>
            <p className="text-2xl font-black text-slate-900">₦{stats.todaySales.toLocaleString()}</p>
          </div>
        </div>

        {isAdmin && showSensitive && (
          <div className="bg-emerald-900 p-6 rounded-[2rem] shadow-xl flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute right-[-10px] top-[-10px] opacity-10 text-white"><PiggyBank size={80} /></div>
            <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Today's Profit</p>
              <p className="text-2xl font-black text-white">₦{stats.totalInterest.toLocaleString()}</p>
            </div>
          </div>
        )}

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