
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  ClipboardCheck, 
  Calendar, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUp, 
  ArrowDown,
  Package,
  History,
  X,
  Filter
} from 'lucide-react';
import { StockSnapshot, Product } from '../types';

const StockAudit: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);

  const snapshots = useLiveQuery(
    () => db.stock_snapshots.where('date').equals(selectedDate).toArray(),
    [selectedDate]
  ) || [];

  const products = useLiveQuery(() => db.products.toArray()) || [];

  const filteredSnapshots = useMemo(() => {
    return snapshots.filter(snap => {
      const matchesSearch = snap.product_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const expected = snap.starting_qty + snap.added_qty - snap.sold_qty;
      const actual = snap.date === new Date().toISOString().split('T')[0]
        ? (products.find(p => p.id === snap.product_id)?.stock_qty || 0)
        : (snap.closing_qty !== undefined ? snap.closing_qty : 0);
      
      const hasDiscrepancy = expected !== actual;

      if (showDiscrepanciesOnly) return matchesSearch && hasDiscrepancy;
      return matchesSearch;
    });
  }, [snapshots, searchTerm, showDiscrepanciesOnly, products]);

  const stats = useMemo(() => {
    let totalExpected = 0;
    let totalActual = 0;
    let issues = 0;

    snapshots.forEach(snap => {
      const expected = snap.starting_qty + snap.added_qty - snap.sold_qty;
      const actual = snap.date === new Date().toISOString().split('T')[0]
        ? (products.find(p => p.id === snap.product_id)?.stock_qty || 0)
        : (snap.closing_qty !== undefined ? snap.closing_qty : 0);
      
      totalExpected += expected;
      totalActual += actual;
      if (expected !== actual) issues++;
    });

    return { totalExpected, totalActual, issues };
  }, [snapshots, products]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck size={28} className="text-indigo-600" /> Stock Audit Ledger
          </h3>
          <p className="text-sm text-slate-500 font-medium">Verify Start vs End stock for every business day</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="bg-white p-2 pl-4 rounded-2xl border border-slate-200 flex items-center gap-3 shadow-sm flex-1">
             <Calendar size={18} className="text-slate-400" />
             <input 
               type="date" 
               className="bg-transparent outline-none font-bold text-slate-800 text-sm py-2 pr-4"
               value={selectedDate}
               onChange={(e) => setSelectedDate(e.target.value)}
             />
          </div>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items Tracked</p>
           <p className="text-2xl font-black text-slate-800">{snapshots.length}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Unit Vol.</p>
           <p className="text-2xl font-black text-slate-800">{stats.totalActual}</p>
        </div>
        <div className={`p-5 rounded-3xl border shadow-sm transition-all ${stats.issues > 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>
           <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stats.issues > 0 ? 'text-rose-600' : 'text-slate-400'}`}>Discrepancies</p>
           <p className={`text-2xl font-black ${stats.issues > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
             {stats.issues > 0 ? `${stats.issues} Discrepancy Found` : 'Perfect Sync'}
           </p>
        </div>
        <button 
          onClick={() => setShowDiscrepanciesOnly(!showDiscrepanciesOnly)}
          className={`p-5 rounded-3xl border font-black text-xs uppercase tracking-widest transition-all ${showDiscrepanciesOnly ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200'}`}
        >
          <Filter size={16} className="inline mr-2" />
          {showDiscrepanciesOnly ? 'Showing Errors' : 'Show All Stock'}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Filter products by name..." 
          className="w-full pl-12 pr-4 h-14 bg-white border border-slate-200 rounded-[2rem] outline-none shadow-sm font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[3rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Start</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Restocked</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sold</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Expected</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actual Closing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSnapshots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-32 text-center text-slate-400 font-bold uppercase tracking-widest">
                    <History size={64} className="mx-auto mb-4 opacity-10" />
                    No snapshots found for this date
                  </td>
                </tr>
              ) : (
                filteredSnapshots.map(snap => {
                  const expected = snap.starting_qty + snap.added_qty - snap.sold_qty;
                  const actual = snap.date === new Date().toISOString().split('T')[0]
                    ? (products.find(p => p.id === snap.product_id)?.stock_qty || 0)
                    : (snap.closing_qty !== undefined ? snap.closing_qty : 0);
                  
                  const hasDiscrepancy = expected !== actual;
                  const diff = actual - expected;

                  return (
                    <tr key={snap.id} className={`hover:bg-slate-50/50 transition-colors ${hasDiscrepancy ? 'bg-rose-50/50' : ''}`}>
                      <td className="px-8 py-5">
                         <p className="font-black text-slate-800">{snap.product_name}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase">ID: #{snap.product_id}</p>
                      </td>
                      <td className="px-6 py-5 text-center font-bold text-slate-500">{snap.starting_qty}</td>
                      <td className="px-6 py-5 text-center">
                         <span className="text-emerald-600 font-black flex items-center justify-center gap-1">
                            <ArrowUp size={12}/> {snap.added_qty}
                         </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <span className="text-rose-600 font-black flex items-center justify-center gap-1">
                            <ArrowDown size={12}/> {snap.sold_qty}
                         </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                         <span className="px-3 py-1 bg-slate-100 rounded-full font-black text-slate-400">{expected}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <div className="flex flex-col items-end">
                            <span className={`text-xl font-black ${hasDiscrepancy ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {actual}
                            </span>
                            {hasDiscrepancy && (
                              <div className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-500">
                                <AlertTriangle size={10} /> MISSING {Math.abs(diff)} UNITS
                              </div>
                            )}
                         </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-200 flex flex-col md:flex-row items-center gap-6">
         <div className="w-14 h-14 bg-white text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
            <History size={28} />
         </div>
         <div className="flex-1 text-center md:text-left">
            <h4 className="font-black text-slate-800">About Stock Auditing</h4>
            <p className="text-sm text-slate-600 font-medium">The terminal captures starting stock every morning. If "Actual Closing" is less than "Expected", it means items were moved or removed without being logged as a sale or restock.</p>
         </div>
      </div>
    </div>
  );
};

export default StockAudit;
