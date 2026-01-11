
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Plus, 
  UserPlus, 
  Phone, 
  CheckCircle2, 
  MessageSquare, 
  CircleDollarSign, 
  X,
  History,
  Search,
  ArrowRight
} from 'lucide-react';
import { Debt } from '../types';

const Debts: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({ customer_name: '', phone: '', amount: 0 });

  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('app_settings'));

  const filteredDebts = debts.filter(d => 
    d.status === 'pending' && 
    (d.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) || d.phone.includes(searchTerm))
  );

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.debts.add({
      ...formData,
      amount: Number(formData.amount),
      status: 'pending',
      timestamp: Date.now()
    });
    setIsModalOpen(false);
    setFormData({ customer_name: '', phone: '', amount: 0 });
  };

  const handlePartialPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !selectedDebt.id) return;

    const newAmount = selectedDebt.amount - paymentAmount;
    const updateData: Partial<Debt> = {
      amount: Math.max(0, newAmount),
      status: newAmount <= 0 ? 'paid' : 'pending'
    };

    await db.debts.update(selectedDebt.id, updateData);
    setIsPaymentModalOpen(false);
    setSelectedDebt(null);
    setPaymentAmount(0);
  };

  const sendWhatsAppReminder = (debt: Debt) => {
    const shopName = settings?.shop_name || 'Our Shop';
    const message = `Hello ${debt.customer_name}, this is a friendly reminder from ${shopName} regarding your outstanding balance of ₦${debt.amount.toLocaleString()}. Please kindly settle this at your earliest convenience. Thank you!`;
    const encodedMessage = encodeURIComponent(message);
    const phone = debt.phone.startsWith('0') ? '234' + debt.phone.substring(1) : debt.phone;
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Customer Credit Ledger</h3>
          <p className="text-sm text-slate-500 font-medium">Manage outstanding balances and reminders</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search debtors..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none shadow-sm focus:ring-2 focus:ring-emerald-500 font-medium text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-2.5 rounded-2xl font-black hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20"
          >
            <UserPlus size={18} />
            Record Debt
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDebts.map((debt) => (
          <div key={debt.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-rose-200 transition-all">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner">
                  {debt.customer_name.charAt(0)}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-rose-200">Pending</span>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Since {new Date(debt.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
              <h4 className="font-black text-xl text-slate-800 tracking-tight">{debt.customer_name}</h4>
              <div className="flex items-center gap-2 text-slate-500 text-sm mt-1 font-bold">
                <Phone size={14} className="text-slate-300" />
                <span>{debt.phone}</span>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50 space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Total Balance</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tighter">₦{debt.amount.toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => sendWhatsAppReminder(debt)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
                >
                  <MessageSquare size={14} />
                  Remind
                </button>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setSelectedDebt(debt);
                    setPaymentAmount(debt.amount);
                    setIsPaymentModalOpen(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
                >
                  <CircleDollarSign size={16} />
                  Pay Debt
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredDebts.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white border border-dashed border-slate-300 rounded-[3rem] space-y-4">
            <History size={64} className="mx-auto text-slate-100" />
            <div>
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No active debts matching criteria</p>
              <p className="text-slate-300 text-sm font-medium mt-1">Add a new record or adjust your filters</p>
            </div>
          </div>
        )}
      </div>

      {/* New Debt Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">New Credit Entry</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddDebt} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Customer Full Name</label>
                  <input 
                    required
                    autoFocus
                    type="text" 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-700"
                    placeholder="e.g. Chinedu Okafor"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Phone Number (WhatsApp)</label>
                  <input 
                    required
                    type="tel" 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-slate-700"
                    placeholder="080..."
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Amount Owed (₦)</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-rose-500 font-black text-3xl text-center"
                    placeholder="0"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="pt-4">
                <button 
                  type="submit" 
                  className="w-full py-5 rounded-[2rem] font-black text-xl text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-2xl shadow-rose-600/30 active:scale-95"
                >
                  Confirm Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {isPaymentModalOpen && selectedDebt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-emerald-50/30">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Process Payment</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePartialPayment} className="p-8 space-y-6">
              <div className="text-center space-y-1 mb-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                 <h4 className="text-2xl font-black text-slate-900">{selectedDebt.customer_name}</h4>
                 <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500 border border-slate-200">
                    Owes: <span className="text-rose-600 font-black">₦{selectedDebt.amount.toLocaleString()}</span>
                 </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 text-center tracking-widest">Amount Paying Now (₦)</label>
                <input 
                  required
                  autoFocus
                  type="number" 
                  max={selectedDebt.amount}
                  min={1}
                  className="w-full px-6 py-6 bg-slate-50 border border-slate-200 rounded-[2.5rem] outline-none focus:ring-2 focus:ring-emerald-500 font-black text-4xl text-center text-emerald-600"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                />
                <div className="flex items-center justify-center gap-3 mt-6">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Balance After</p>
                    <p className="text-xl font-black text-slate-800">₦{(selectedDebt.amount - paymentAmount).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button 
                  type="submit" 
                  className="w-full py-5 rounded-[2rem] font-black text-xl text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  {paymentAmount >= selectedDebt.amount ? (
                    <>
                      <CheckCircle2 size={24} />
                      Full Settle
                    </>
                  ) : (
                    <>
                      <CircleDollarSign size={24} />
                      Post Partial Pay
                    </>
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Debts;
