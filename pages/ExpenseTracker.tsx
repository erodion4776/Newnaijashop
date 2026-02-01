import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Plus, 
  Trash2, 
  Receipt,
  Calendar,
  History,
  TrendingDown,
  ChevronRight,
  Wallet,
  AlertCircle,
  X,
  CreditCard,
  Briefcase,
  Wrench,
  Car,
  Utensils,
  Fuel,
  Building2,
  CircleEllipsis,
  Minus
} from 'lucide-react';
import { Expense, Staff } from '../types';

interface ExpenseTrackerProps {
  currentUser?: Staff | null;
  isStaffLock?: boolean;
}

const NAIJA_CATEGORIES = [
  { id: 'Fuel (Gen)', icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'Shop Rent', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'Staff Lunch', icon: Utensils, color: 'text-rose-600', bg: 'bg-rose-50' },
  { id: 'Transport', icon: Car, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'Repairs', icon: Wrench, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'Others', icon: CircleEllipsis, color: 'text-slate-600', bg: 'bg-slate-50' }
];

const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({ currentUser, isStaffLock }) => {
  const [formData, setFormData] = useState({
    category: 'Fuel (Gen)',
    amount: '',
    description: ''
  });

  // Security Check: Hide from staff if lockdown is active
  const isRestricted = currentUser?.role === 'Sales' || isStaffLock;

  // Real-time data fetching
  const expenses = useLiveQuery(() => db.expenses.orderBy('timestamp').reverse().toArray()) || [];

  // Summary Calculations
  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return {
      today: expenses
        .filter(e => e.timestamp >= startOfToday)
        .reduce((sum, e) => sum + e.amount, 0),
      month: expenses
        .filter(e => e.timestamp >= startOfMonth)
        .reduce((sum, e) => sum + e.amount, 0)
    };
  }, [expenses]);

  // Grouping Logic for the Ledger
  const groupedExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    expenses.forEach(e => {
      const dateKey = new Date(e.timestamp).toLocaleDateString('en-NG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(e);
    });
    return groups;
  }, [expenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(formData.amount);
    
    if (!amt || amt <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      await db.expenses.add({
        category: formData.category as any, // Bypass strict type for Naija categories
        amount: Math.floor(amt),
        description: formData.description.trim() || 'No description',
        timestamp: Date.now()
      });

      // Clear form
      setFormData({ category: 'Fuel (Gen)', amount: '', description: '' });
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      alert("Error saving expense. Please try again.");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this expense record?")) {
      await db.expenses.delete(id);
    }
  };

  if (isRestricted) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Access Restricted</h2>
        <p className="text-slate-500 max-w-xs font-medium">Financial records are hidden during Staff Lockdown. Switch to Admin mode to view expenses.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-6 relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-5 text-rose-600">
            <TrendingDown size={140} />
          </div>
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Wallet size={32} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Spent Today</p>
            <p className="text-3xl font-black text-rose-600 tracking-tight">₦{stats.today.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-rose-600 p-8 rounded-[2.5rem] shadow-xl shadow-rose-900/10 flex items-center gap-6 relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-10 text-white">
            <Calendar size={140} />
          </div>
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            <CreditCard size={32} />
          </div>
          <div>
            <p className="text-rose-100 text-[10px] font-black uppercase tracking-widest mb-1">Total This Month</p>
            <p className="text-3xl font-black text-white tracking-tight">₦{stats.month.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 2. Log New Expense Section */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Plus size={20} className="text-rose-600" />
          <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Log New Expense</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Category</label>
              <select 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold appearance-none cursor-pointer"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {NAIJA_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.id}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Amount (₦)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-rose-300">₦</span>
                <input 
                  required
                  type="number"
                  inputMode="numeric"
                  className="w-full pl-9 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-black text-xl text-rose-600"
                  placeholder="0"
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Description</label>
              <input 
                type="text"
                placeholder="e.g. Fuel for small gen"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>

          <button 
            type="submit"
            className="mt-8 w-full md:w-auto px-12 py-5 bg-rose-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-rose-900/20 hover:bg-rose-700 transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            <Receipt size={20} />
            Record Expense
          </button>
        </form>
      </div>

      {/* 3. Recent Expenses List */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <History size={18} className="text-slate-400" />
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Recent Expense Ledger</h4>
        </div>

        {expenses.length === 0 ? (
          <div className="py-20 text-center bg-white border border-dashed border-slate-300 rounded-[3rem]">
            <Receipt size={48} className="mx-auto text-slate-100 mb-3" />
            <p className="text-slate-400 font-bold text-sm">No expenses recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Fix: Explicitly cast Object.entries to the correct type to avoid 'unknown' type inference on 'items' array */}
            {(Object.entries(groupedExpenses) as [string, Expense[]][]).map(([date, items]) => (
              <div key={date} className="space-y-3">
                <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-4">{date}</h5>
                <div className="grid grid-cols-1 gap-3">
                  {items.map((e) => {
                    const catInfo = NAIJA_CATEGORIES.find(c => c.id === e.category) || NAIJA_CATEGORIES[5];
                    return (
                      <div key={e.id} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between hover:border-rose-200 transition-all group">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 ${catInfo.bg} ${catInfo.color} rounded-2xl flex items-center justify-center shadow-inner`}>
                            <catInfo.icon size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{e.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{e.category}</span>
                              <span className="w-1 h-1 bg-slate-200 rounded-full" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <p className="text-xl font-black text-rose-600">₦{e.amount.toLocaleString()}</p>
                          <button 
                            onClick={() => e.id && handleDelete(e.id)}
                            className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default ExpenseTracker;