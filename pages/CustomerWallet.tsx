
import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Wallet, Search, Phone, History, User, ArrowRight, TrendingUp, TrendingDown, Clock, X, ChevronRight } from 'lucide-react';
import { WalletTransaction } from '../types';

const CustomerWalletView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  
  // Use useLiveQuery to fetch all records from requested 'wallets' table
  const wallets = useLiveQuery(() => db.wallets.toArray()) || [];
  
  // Debug log as requested
  useEffect(() => {
    console.log('Current Wallets:', wallets);
  }, [wallets]);

  // Fetch transactions for selected customer
  const transactions = useLiveQuery(() => 
    selectedCustomer ? db.wallet_transactions.where('phone').equals(selectedCustomer.phone).reverse().sortBy('timestamp') : Promise.resolve([])
  , [selectedCustomer]);

  // Calculate Total Credit: Sum of all balances in the table
  const totalCredit = useMemo(() => wallets.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0), [wallets]);

  // Search/Filter Logic: Find customer by phone number or name
  const filteredWallets = useMemo(() => {
    if (!searchTerm.trim()) return wallets;
    const term = searchTerm.toLowerCase();
    return wallets.filter(w => 
      (w.phone && w.phone.includes(term)) || 
      (w.name && w.name.toLowerCase().includes(term))
    );
  }, [wallets, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Wallet className="text-emerald-600" /> Customer Wallet Hub
          </h3>
          <p className="text-sm text-slate-500 font-medium">Manage digital change and customer credit</p>
        </div>
      </div>

      {/* Total Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-emerald-900 p-8 rounded-[2.5rem] text-white flex items-center justify-between shadow-xl relative overflow-hidden">
          <div className="absolute right-[-20px] top-[-20px] opacity-10">
            <Wallet size={180} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Total Customer Credit</p>
            <h4 className="text-5xl font-black tracking-tighter">₦{totalCredit.toLocaleString()}</h4>
          </div>
          <div className="relative z-10 hidden sm:block">
            <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/10">
              <p className="text-[10px] font-black uppercase text-emerald-400">Unique Wallets</p>
              <p className="text-2xl font-black">{wallets.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center">
           <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Active Accounts</p>
           <p className="text-lg font-black text-slate-800">
            {wallets.length > 0 
              ? `${wallets.filter(w => w.balance > 0).length} Credited`
              : 'No Records'
            }
           </p>
        </div>
      </div>

      {/* Search Header */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Find customer by phone or name..." 
          className="w-full pl-12 pr-4 h-16 bg-white border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-emerald-500 font-bold shadow-sm transition-all"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Customer List Table Style */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        {filteredWallets.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-50 text-slate-100 rounded-full flex items-center justify-center mx-auto">
              <Wallet size={48} />
            </div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No wallets found. Save change during checkout to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWallets.map(wallet => (
                  <tr key={wallet.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                          <Phone size={18} />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 tracking-tight">{wallet.phone}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{wallet.name || 'Regular Customer'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <p className="text-xl font-black text-emerald-600">₦{Number(wallet.balance).toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Last Activity: {new Date(wallet.lastUpdated).toLocaleDateString()}</p>
                    </td>
                    <td className="px-8 py-5">
                      <button 
                        onClick={() => setSelectedCustomer(wallet)}
                        className="mx-auto flex items-center justify-center w-10 h-10 bg-slate-100 text-slate-500 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction History Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-emerald-50/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedCustomer.phone}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedCustomer.name || 'Customer Profile'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400"><X size={24} /></button>
            </div>
            
            <div className="p-6 bg-slate-50/50 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Credit</p>
                <p className="text-3xl font-black text-emerald-600">₦{Number(selectedCustomer.balance).toLocaleString()}</p>
              </div>
              <Wallet size={32} className="text-emerald-100" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock size={12} /> Transaction Timeline
              </h4>
              {transactions?.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-slate-400 italic">No transaction history found.</p>
                </div>
              ) : (
                transactions?.map((tx: WalletTransaction) => (
                  <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'Credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {tx.type === 'Credit' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{tx.details || (tx.type === 'Credit' ? 'Money Saved' : 'Balance Used')}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{new Date(tx.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className={`font-black text-sm ${tx.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'Credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t bg-slate-50/50">
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:bg-black transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerWalletView;
