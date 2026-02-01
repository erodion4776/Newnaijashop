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
  CircleEllipsis
} from 'lucide-react';
import { Expense, Staff } from '../types';

interface ExpenseTrackerProps {
  currentUser?: Staff | null;
  isStaffLock?: boolean;
}

const CATEGORY_OPTIONS = [
  { id: 'Fuel (Gen)', icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'Shop Rent', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'Staff Lunch', icon: Utensils, color: 'text-rose-600', bg: 'bg-rose-50' },
  { id: 'Transport', icon: Car, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'Repairs', icon: Wrench, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'Others', icon: CircleEllipsis, color: 'text-slate-600', bg: 'bg-slate-50' }
];

const ExpenseTracker: React.FC<ExpenseTrackerProps> = ({ currentUser, isStaffLock }) => {
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Fuel (Gen)',
    amount: '',
    description: ''
  });

  // Check if user is staff and locked out
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

  // Grouping Logic
  const groupedExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    expenses.forEach(e => {
      const date = new Date(e.timestamp).toLocaleDateString('en-NG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(e);
    });
    return groups;
  }, [expenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      await db.expenses.add({
        category: formData.category as any,
        amount: Math.floor(Number(formData.amount)),
        description: formData.description.trim(),
        timestamp: Date.now()
      });

      // Log to Audit Trail
      await db.audit_trail.add({
        action: 'Expense Recorded',
        details: `Logged ₦${Number(formData.amount).toLocaleString()} for ${formData.category}: ${formData.description}`,
        staff_name: currentUser?.name || 'Admin',
        timestamp: Date.now()
      });

      setIsLogModalOpen(false);
      setFormData({ category: 'Fuel (Gen)', amount: '', description: '' });
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (err) {
      alert("Error saving expense");
    }
  };

  const handleDelete = async (id: number, e: Expense) => {
    if (confirm(`Delete this record for ₦${e.amount.toLocaleString()}?`)) {
      await db.expenses.delete(id);
      await db.audit_trail.add({
        action: 'Expense Deleted',
        details: `Removed expense record: ₦${e.amount.toLocaleString()} (${e.category})`,
        staff_name: currentUser?.name || 'Admin',
        timestamp: Date.now()
      });
    }
  };

  if (isRestricted) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center shadow-inner">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Access Restricted</h2>
        <p className="text-slate-500 max-w-xs font-medium">Expense tracking is hidden in Staff Mode. Please use Admin PIN to view financials.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      {/* HEADER & SUMMARY CARDS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Expense Tracker</h3>
          <p className="text-sm text-slate-500 font-medium">Manage your daily shop running costs</p>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="flex-1 md:w-48 bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Spent Today</p>
            <p className="text-xl font-black text-rose-600">₦{stats.today.toLocaleString()}</p>
          </div>
          <div className="flex-1 md:w-48 bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Spent This Month</p>
            <p className="text-xl font-black text-rose-600">₦{stats.month.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="bg-rose-600 rounded-[3rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-rose-900/20 relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] opacity-10 rotate-12">
          <TrendingDown size={200} />
        </div>
        <div className="relative z-10">
          <h4 className="text-2xl font-black tracking-tight">Need to log a new cost?</h4>
          <p className="text-rose-100 font-medium text-sm">Keep your profit records accurate by logging every kobo spent.</p>
        </div>
        <button 
          onClick={() => setIsLogModalOpen(true)}
          className="relative z-10 w-full md:w-auto px-10 py-5 bg-white text-rose-600 rounded-[2rem] font-black text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <Receipt size={24} />
          Record Expense
        </button>
      </div>

      {/* HISTORY LEDGER */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <History size={18} className="text-slate-400" />
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Recent Expenses</h4>
        </div>

        {expenses.length === 0 ? (
          <div className="py-20 text-center bg-white border border-dashed border-slate-300 rounded-[3rem] space-y-4">
            <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto">
              <Receipt size={32} />
            </div>
            <p className="text-slate-400 font-bold">No expenses recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedExpenses).map(([date, items]) => (
              <div key={date} className="space-y-3">
                <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-4">{date}</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((e) => {
                    const catInfo = CATEGORY_OPTIONS.find(c => c.id === e.category) || CATEGORY_OPTIONS[5];
                    return (
                      <div key={e.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between hover:border-rose-200 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                          <div className={`w-12 h-12 ${catInfo.bg} ${catInfo.color} rounded-2xl flex items-center justify-center shadow-inner`}>
                            <catInfo.icon size={24} />
                          </div>
                          <button 
                            onClick={() => e.id && handleDelete(e.id, e)}
                            className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        
                        <div>
                          <p className="text-2xl font-black text-slate-900 tracking-tighter">₦{e.amount.toLocaleString()}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{e.category}</p>
                          {e.description && (
                            <p className="text-sm text-slate-600 font-medium mt-3 bg-slate-50 p-3 rounded-2xl italic leading-relaxed border border-slate-100">
                              "{e.description}"
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                           <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                            {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                           <div className="w-6 h-6 bg-slate-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <ChevronRight size={14} className="text-slate-300" />
                           </div>
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

      {/* NEW EXPENSE MODAL */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-rose-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-200">
                  <Receipt size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-900">Log New Expense</h3>
              </div>
              <button onClick={() => setIsLogModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Expense Category</label>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORY_OPTIONS.map(cat => (
                    <button 
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({...formData, category: cat.id})}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                        formData.category === cat.id 
                          ? 'bg-rose-600 border-rose-600 text-white shadow-lg scale-105' 
                          : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <cat.icon size={16} />
                      <span className="font-black text-[10px] uppercase tracking-tighter truncate">{cat.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Amount Spent (₦)</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-rose-300">₦</span>
                  <input 
                    required
                    autoFocus
                    type="number" 
                    inputMode="numeric"
                    className="w-full pl-14 pr-6 py-6 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-4 focus:ring-rose-500/10 font-black text-4xl text-rose-600 transition-all"
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Description / Purpose</label>
                <input 
                  type="text" 
                  placeholder="e.g. Fuel for small generator"
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  className="w-full py-5 bg-rose-600 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-rose-900/30 hover:bg-rose-700 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <TrendingDown size={24} />
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker;