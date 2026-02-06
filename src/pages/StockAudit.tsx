import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDailyStock } from '../db/db';
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
  RefreshCw, 
  Loader2, 
  Plus, 
  Minus, 
  Play,
  Shield,
  Info
} from 'lucide-react';
import { StockSnapshot } from '../types';

const StockAudit: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasInitializedToday, setHasInitializedToday] = useState(false);

  // Live data streams
  const snapshots = useLiveQuery(
    () => db.stock_snapshots.where('date').equals(selectedDate).toArray(),
    [selectedDate]
  ) || [];

  const products = useLiveQuery(() => db.products.toArray()) || [];

  // Check initialization status for today
  useEffect(() => {
    const checkInit = async () => {
      const today = new Date().toISOString().split('T')[0];
      if (selectedDate === today) {
        const count = await db.stock_snapshots.where('date').equals(today).count();
        setHasInitializedToday(count > 0);
      }
    };
    checkInit();
  }, [selectedDate, snapshots.length]);

  const handleManualInit = async () => {
    setIsInitializing(true);
    try {
      const count = await initializeDailyStock();
      if (count === 0) {
        alert("No products found in inventory to track. Please add products first.");
      } else {
        alert(`✅ Audit initialized with ${count} items!`);
        setHasInitializedToday(true);
      }
    } catch (err) {
      console.error("Initialization error:", err);
      alert("Failed to initialize audit. Please try again.");
    } finally {
      setIsInitializing(false);
    }
  };

  const updateActualCount = async (snapshotId: number, value: string) => {
    const numericVal = value === '' ? undefined : Number(value);
    try {
      await db.stock_snapshots.update(snapshotId, { closing_qty: numericVal });
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const filteredSnapshots = useMemo(() => {
    return snapshots.filter(snap => 
      snap.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [snapshots, searchTerm]);

  const stats = useMemo(() => {
    let issues = 0;
    snapshots.forEach(snap => {
      const expected = Number(snap.starting_qty || 0) + Number(snap.added_qty || 0) - Number(snap.sold_qty || 0);
      const actual = snap.closing_qty !== undefined ? snap.closing_qty : 0;
      if (expected !== actual) issues++;
    });
    return { issues, total: snapshots.length };
  }, [snapshots]);

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">Daily Stock Audit</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Reconcile physical counts</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Calendar size={18} className="text-slate-400 hidden sm:block" />
          <input 
            type="date" 
            className="flex-1 md:w-48 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* INITIALIZATION CTA */}
      {isToday && !hasInitializedToday && (
        <div className="bg-emerald-600 p-10 rounded-[3rem] text-white text-center space-y-6 shadow-2xl shadow-emerald-900/20 relative overflow-hidden">
           <div className="absolute right-[-20px] top-[-20px] opacity-10"><Shield size={180} /></div>
           <div className="relative z-10 space-y-4">
              <h3 className="text-2xl font-black">🚀 Start Today's Stock Audit</h3>
              <p className="text-emerald-100 font-medium max-w-xs mx-auto">Capture your opening stock levels to track discrepancies throughout the day.</p>
              <button 
                onClick={handleManualInit}
                disabled={isInitializing}
                className="px-10 py-5 bg-white text-emerald-600 rounded-[2rem] font-black text-lg hover:scale-105 transition-all shadow-xl disabled:opacity-50 flex items-center gap-3 mx-auto"
              >
                {isInitializing ? <Loader2 className="animate-spin" /> : <Play size={20} />}
                Initialize Ledger
              </button>
           </div>
        </div>
      )}

      {/* SEARCH AND STATS */}
      {snapshots.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Filter products..." 
              className="w-full pl-12 pr-4 h-14 bg-white border border-slate-200 rounded-2xl outline-none shadow-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className={`px-6 py-4 rounded-2xl border font-black text-xs uppercase tracking-widest flex items-center gap-2 ${stats.issues > 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
            {stats.issues > 0 ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
            {stats.issues > 0 ? `${stats.issues} Discrepancies` : 'Stock in Sync'}
          </div>
        </div>
      )}

      {/* MAIN TABLE */}
      {snapshots.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Starting</th>
                  <th className="px-6 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center">Restocked (+)</th>
                  <th className="px-6 py-5 text-[10px] font-black text-rose-600 uppercase tracking-widest text-center">Sold (-)</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Expected</th>
                  <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right">Actual Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSnapshots.map(snap => {
                  const expected = Number(snap.starting_qty || 0) + Number(snap.added_qty || 0) - Number(snap.sold_qty || 0);
                  const actual = snap.closing_qty !== undefined ? snap.closing_qty : 0;
                  const hasDiscrepancy = expected !== actual;

                  return (
                    <tr key={snap.id} className={`hover:bg-slate-50/50 transition-colors ${hasDiscrepancy ? 'bg-rose-50/30' : ''}`}>
                      <td className="px-8 py-5 font-bold text-slate-800">{snap.product_name}</td>
                      <td className="px-6 py-5 text-center font-bold text-slate-400">{snap.starting_qty}</td>
                      <td className="px-6 py-5 text-center font-black text-emerald-600">+{snap.added_qty}</td>
                      <td className="px-6 py-5 text-center font-black text-rose-600">-{snap.sold_qty}</td>
                      <td className="px-6 py-5 text-center">
                        <span className="px-3 py-1 bg-slate-100 rounded-lg font-black text-slate-800">{expected}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <input 
                          type="number"
                          className={`w-24 px-3 py-2 border-2 rounded-xl text-right font-black outline-none transition-all ${hasDiscrepancy ? 'border-rose-300 text-rose-600' : 'border-slate-100 text-emerald-600'}`}
                          value={snap.closing_qty ?? ''}
                          onChange={(e) => updateActualCount(snap.id!, e.target.value)}
                          placeholder="Count..."
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {snapshots.length === 0 && !isToday && (
        <div className="py-32 text-center bg-white border border-dashed border-slate-200 rounded-[3rem] space-y-4">
           <History size={64} className="mx-auto text-slate-100" />
           <p className="text-slate-400 font-black uppercase text-xs">No audit record for {selectedDate}</p>
        </div>
      )}

      {/* HELP INFO */}
      <div className="bg-amber-50 rounded-[2rem] border border-amber-100 p-8 flex flex-col md:flex-row items-center gap-6">
         <div className="w-14 h-14 bg-white text-amber-600 rounded-2xl flex items-center justify-center shadow-sm border border-amber-200 shrink-0">
            <Info size={28} />
         </div>
         <div className="text-center md:text-left">
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Manual Counting Ritual</h4>
            <p className="text-sm text-slate-600 font-medium">Count your physical stock and enter it in the "Actual Count" column. Red rows indicate stock missing or sold without being recorded in the terminal.</p>
         </div>
      </div>
    </div>
  );
};

export default StockAudit;