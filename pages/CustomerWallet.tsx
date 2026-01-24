
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Wallet, Search, Phone, History, User, ArrowRight } from 'lucide-react';
import { CustomerWallet } from '../types';

const CustomerWalletView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const wallets = useLiveQuery(() => db.customer_wallets.toArray()) || [];

  const filteredWallets = useMemo(() => {
    if (!searchTerm.trim()) return wallets;
    return wallets.filter(w => w.phone.includes(searchTerm));
  }, [wallets, searchTerm]);

  const totalCredit = wallets.reduce((acc, curr) => acc + curr.balance, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Wallet className="text-emerald-600" /> Customer Wallets
          </h3>
          <p className="text-sm text-slate-500 font-medium">Digital credit stored for regular customers</p>
        </div>
      </div>

      <div className="bg-emerald-900 p-8 rounded-[2.5rem] text-white flex items-center justify-between shadow-xl">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Customer Credit</p>
          <h4 className="text-4xl font-black tracking-tighter">₦{totalCredit.toLocaleString()}</h4>
        </div>
        <Wallet size={48} className="opacity-20" />
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by phone number..." 
          className="w-full pl-12 pr-4 h-14 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWallets.map(wallet => (
          <div key={wallet.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Phone size={20} />
              </div>
              <div>
                <p className="text-xl font-black text-slate-800">{wallet.phone}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer ID: #{wallet.id}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Available Balance</p>
              <p className="text-2xl font-black text-emerald-600">₦{wallet.balance.toLocaleString()}</p>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase flex items-center gap-1">
                <History size={10} /> Last updated: {new Date(wallet.last_updated).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}

        {filteredWallets.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200 space-y-4">
            <Wallet size={48} className="mx-auto text-slate-100" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No active wallets found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerWalletView;
