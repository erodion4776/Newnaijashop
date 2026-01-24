
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Plus, 
  Wallet, 
  X, 
  Trash2, 
  Fuel, 
  Home, 
  Users, 
  CircleEllipsis, 
  Calendar,
  History,
  TrendingDown,
  ChevronRight
} from 'lucide-react';
import { Expense } from '../types';

const CATEGORIES = [
  { id: 'Fuel', icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'Rent', icon: Home, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'Salary', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'Others', icon: CircleEllipsis, color: 'text-slate-600', bg: 'bg-slate-50' }
];

const ExpenseTracker: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Fuel' as Expense['category'],
    amount: '',
    description: ''
  });

  const expenses = useLiveQuery(() => db.expenses.orderBy('timestamp').reverse().toArray()) || [];

  const totalExpenses = useMemo(() => 
    expenses.reduce((sum, e) => sum + e.amount, 0), 
  [expenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) return;

    await db.expenses.add({
      category: formData.category,
      amount: Number(formData.amount),
      description: formData.description,
      timestamp: Date.now()
    });

    setIsModalOpen(false);
    setFormData({ category: 'Fuel', amount: '', description: '' });
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this expense record?")) {
      await db.expenses.delete(id);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Expense Tracker</h3>
          <p className="text-sm text-slate-500 font-medium">Log your shop running costs</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-rose-600 text-white px-8 py-3 rounded-2xl font-black hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20 w-full md:w-auto"
        >
          <Plus size={20} /> Record Expense
        </button>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-[1.5rem] flex items-center justify-center shrink-0">
          <TrendingDown size={32} />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Expenses Tracked</p>
          <h4 className="text-4xl font-black text-slate-900 tracking-tighter">₦{totalExpenses.toLocaleString()}</h4>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
          <History size={14} /> Historical Records
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {expenses.map((expense) => {
            const cat = CATEGORIES.find(c => c.id === expense.category);
            const Icon = cat?.icon || CircleEllipsis;
            
            return (
              <div key={expense.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:border-rose-200 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 ${cat?.bg} ${cat?.color} rounded-2xl flex items-center justify-center shadow-inner`}>
                    <Icon size={24} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(expense.timestamp).toLocaleDateString()}</p>
                    <button onClick={() => handleDelete(expense.id!)} className="text-slate-300 hover:text-rose-600 p-1 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">₦{expense.amount.toLocaleString()}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{expense.category}</p>
                  {expense.description && (
                    <p className="text-sm text-slate-400 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                      "{expense.description}"
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {expenses.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-300 rounded-[3rem] space-y-4">
              <Calendar size={48} className="mx-auto text-slate-100" />
              <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No expenses logged yet</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900">New Shop Cost</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Select Category</label>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map(cat => (
                    <button 
                      key={cat.id} 
                      type="button"
                      onClick={() => setFormData({...formData, category: cat.id as any})}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${formData.category === cat.id ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-105' : 'bg-slate-50 border-transparent text-slate-400'}`}
                    >
                      <cat.icon size={18} />
                      <span className="font-black text-[10px] uppercase tracking-widest">{cat.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Amount Spent (₦)</label>
                <input 
                  required
                  autoFocus
                  type="number" 
                  className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-rose-500 font-black text-3xl text-center"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Description (Optional)</label>
                <textarea 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                  placeholder="e.g. Fuel for generator"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <button type="submit" className="w-full py-5 bg-rose-600 text-white rounded-[2rem] font-black text-xl shadow-xl hover:bg-rose-700 transition-all flex items-center justify-center gap-3">
                Save Record <ChevronRight size={20} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker;
