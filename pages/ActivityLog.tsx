
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  History, 
  Calendar, 
  Search, 
  Receipt, 
  Share2, 
  Printer, 
  User, 
  Clock, 
  X,
  CreditCard,
  Banknote,
  Users,
  ChevronRight,
  TrendingUp,
  FileText,
  Loader2,
  Landmark,
  ShieldCheck
} from 'lucide-react';
import { Sale, SaleItem } from '../types';

const ActivityLog: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  }, [selectedDate]);

  const settings = useLiveQuery(() => db.settings.get('app_settings'));

  const sales = useLiveQuery(
    () => db.sales.where('timestamp').between(dateRange.start, dateRange.end).reverse().toArray(),
    [dateRange]
  );

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    if (!searchTerm) return sales;
    const term = searchTerm.toLowerCase();
    return sales.filter(s => 
      s.sale_id?.toLowerCase().includes(term) || 
      s.staff_name?.toLowerCase().includes(term) ||
      s.payment_method.toLowerCase().includes(term)
    );
  }, [sales, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="flex items-center gap-4 bg-white p-2 pl-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <Calendar className="text-slate-400" size={18} />
          <input type="date" className="py-3 pr-6 bg-transparent outline-none font-bold text-slate-800 cursor-pointer" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>

        <div className="flex gap-4">
          <div className="flex-1 lg:flex-none bg-emerald-600 rounded-[2rem] p-4 px-8 text-white shadow-xl flex items-center gap-4">
            <div className="p-2 bg-white/20 rounded-xl"><TrendingUp size={20} /></div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Daily Total</p>
              <p className="text-xl font-black">₦{filteredSales.reduce((a,c)=>a+c.total_amount,0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input type="text" placeholder="Search by Staff or ID..." className="w-full h-16 pl-14 pr-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm outline-none font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Source (Staff)</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Reference</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors cursor-pointer group" onClick={() => setSelectedSale(sale)}>
                  <td className="px-8 py-5"><span className="text-xs font-bold text-slate-500 tabular-nums">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-[10px] uppercase">{sale.staff_name?.substring(0, 2) || 'ST'}</div>
                      <span className="font-bold text-slate-800 text-sm">{sale.staff_name || 'System Terminal'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-mono text-[9px] text-slate-400 tracking-tighter uppercase">{sale.sale_id?.substring(0,13) || 'LEGACY-ID'}...</td>
                  <td className="px-8 py-5"><p className="font-black text-slate-900">₦{sale.total_amount.toLocaleString()}</p></td>
                  <td className="px-8 py-5 text-right">
                    {sale.sync_status === 'synced' ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-full"><ShieldCheck size={10} /> Audited</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-full"><Clock size={10} /> Local Only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSale && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Digital Receipt</h3>
              <button onClick={() => setSelectedSale(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
               <div className="text-center pb-6 border-b-2 border-dashed border-slate-100">
                  <h4 className="text-2xl font-black text-slate-900">{settings?.shop_name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Terminal Audit Log</p>
                  <p className="text-[9px] font-mono text-slate-300 mt-4 break-all uppercase">TX: {selectedSale.sale_id}</p>
               </div>
               <div className="space-y-3">
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-600 font-medium">{item.name} x{item.quantity}</span>
                      <span className="font-black text-slate-900">₦{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
               </div>
               <div className="pt-6 border-t-2 border-dashed border-slate-100 flex justify-between items-center">
                  <span className="font-black text-slate-400 uppercase text-xs">Total Amount</span>
                  <span className="text-3xl font-black text-emerald-600 tracking-tighter">₦{selectedSale.total_amount.toLocaleString()}</span>
               </div>
               <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Logged By</span>
                  <span className="text-slate-800">{selectedSale.staff_name}</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
