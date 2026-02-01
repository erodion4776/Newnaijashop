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
  Wallet,
  AlertCircle,
  Building2,
  Utensils,
  Fuel,
  CreditCard,
  Minus
} from 'lucide-react';
import { Expense, Staff } from '../types';

interface ExpenseTrackerProps {
  currentUser?: Staff | null;
  isStaffLock?: boolean;
}

const EXPENSE_CATEGORIES = [
  { id: 'Fuel', icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'Rent', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'Staff', icon: Utensils, color: 'text-rose-600', bg: 'bg-rose-50' },
  { id: 'Others', icon: CreditCard, color: 'text-slate-600', bg: 'bg-slate-50' }
];

const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({ currentUser, isStaffLock }) => {
  const [formData, setFormData] = useState({
    category: 'Others',
    amount: '',
    description: ''
  });

  // Security: Only Admin/Manager can view if staff lock is active
  const isRestricted = (currentUser?.role === 'Sales' || isStaffLock) && currentUser?.role !== 'Admin';

  // Fetch all expenses sorted by most recent
  const expenses = useLiveQuery(() => db.expenses.orderBy('timestamp').reverse().toArray()) || [];

  const stats = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return {
      today: expenses
        .filter(e => e.timestamp >= today)
        .reduce((sum, e) => sum + e.amount, 0),
      count: expenses.length
    };
  }, [expenses]);

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
    const amt = Math.floor(Number(formData.amount));
    
    if (!amt || amt <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      await db.expenses.add({
        category: formData.category as any,
        amount: amt,
        description: formData.description.trim() || 'No details',
        timestamp: Date.now()
      });

      // Log to Security Audit Trail
      await db.audit_trail.add({
        action: 'Expense Logged',
        details: `₦${amt.toLocaleString()} spent on ${formData.category}`,
        staff_name: currentUser?.name || 'Admin',
        timestamp: Date.now()
      });

      setFormData({ category: 'Others', amount: '', description: '' });
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      console.error(err);
      alert("Error saving expense record.");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Permanently delete this expense record?")) {
      await db.expenses.delete(id);
    }
  };

  if (isRestricted) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center shadow-inner">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Access Restricted</h2>
        <p className="text-slate-500 max-w-xs font-medium leading-relaxed">
          Expense records contain sensitive financial data and are hidden during Staff Lockdown. Switch to Admin mode to view.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Summary Card */}
      <div className="bg-rose-600 p-8 rounded-[2.5rem] shadow-xl shadow-rose-900/10 flex items-center gap-6 relative overflow-hidden group">
        <div className="absolute right-[-10px] top-[-10px] opacity-10 text-white">
          <TrendingDown size={140} />
        </div>
        <div className="w-16 h-16 bg-white/20 backdrop-blur-md text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
          <Wallet size={32} />
        </div>
        <div>
          <p className="text-rose-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Spent Today</p>
          <p className="text-5xl font-black text-white tracking-tight">₦{stats.today.toLocaleString()}</p>
        </div>
      </div>

      {/* Log Form Section */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Plus size={20} className="text-rose-600" />
          <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Record New Cost</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-[0.1em]">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {EXPENSE_CATEGORIES.map(cat => (
                  <button 
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({...formData, category: cat.id})}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                      formData.category === cat.id 
                        ? 'bg-rose-50 border-rose-600 text-rose-700 shadow-sm' 
                        : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <cat.icon size={14} />
                    <span className="font-bold text-[10px] uppercase truncate">{cat.id}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-[0.1em]">Amount Spent (₦)</label>
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
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-[0.1em]">Details</label>
                <textarea 
                  rows={2}
                  placeholder="e.g. 5 Liters of Diesel for Generator"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-sm resize-none"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button 
              type="submit"
              className="w-full md:w-auto px-12 py-5 bg-rose-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-rose-900/20 hover:bg-rose-700 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <Receipt size={20} />
              Save Record
            </button>
          </div>
        </form>
      </div>

      {/* Ledger Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <History size={18} className="text-slate-400" />
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Chronicled Ledger</h4>
        </div>

        {expenses.length === 0 ? (
          <div className="py-20 text-center bg-white border border-dashed border-slate-300 rounded-[3rem] space-y-4">
            <Receipt size={48} className="mx-auto text-slate-100" />
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No expenses recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {(Object.entries(groupedExpenses) as [string, Expense[]][]).map(([date, items]) => (
              <div key={date} className="space-y-3">
                <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-4 border-l-2 border-rose-600 ml-2">{date}</h5>
                <div className="grid grid-cols-1 gap-3">
                  {items.map((e) => {
                    const catInfo = EXPENSE_CATEGORIES.find(c => c.id === e.category) || EXPENSE_CATEGORIES[3];
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
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <p className="text-2xl font-black text-rose-600 tabular-nums">₦{e.amount.toLocaleString()}</p>
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