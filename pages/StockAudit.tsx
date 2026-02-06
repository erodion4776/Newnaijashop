import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeDailyStock } from '../db/db';
import { 
  ClipboardCheck, 
  Calendar, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  RefreshCw, 
  Loader2, 
  Play,
  Shield,
  Info
} from 'lucide-react';

const StockAudit: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasInitializedToday, setHasInitializedToday] = useState(false);

  // Live data streams from Dexie
  const snapshots = useLiveQuery(
    () => db.stock_snapshots.where('date').equals(selectedDate).toArray(),
    [selectedDate]
  ) || [];

  const products = useLiveQuery(() => db.products.toArray()) || [];

  // Check initialization status for today's date
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
        alert("⚠️ No products found in inventory. Add products first to start an audit.");
      } else {
        alert(`✅ Stock Audit initialized for today with ${count} items.`);
        setHasInitializedToday(true);
      }
    } catch (err) {
      console.error("Initialization error:", err);
      alert("❌ Failed to initialize audit.");
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
      const actual = snap.closing_qty !== undefined ? snap.closing_qty : expected;
      if (expected !== actual) issues++;
    });
    return { issues, total: snapshots.length };
  }, [snapshots]);

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* HEADER CARD */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-[1.5rem] flex items-center justify-center shadow-inner">
            <ClipboardCheck size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Stock Audit Hub</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Verify physical inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 bg-slate-50 p-2 pl-4 rounded-2xl border border-slate-200 flex items-center gap-3">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="date" 
              className="bg-transparent outline-none font-bold text-slate-800 py-2 w-full"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>

      {/* RITUAL INITIALIZATION */}
      {isToday && !hasInitializedToday && (
        <div className="bg-emerald-600 p-12 rounded-[3.5rem] text-white text-center space-y-8 shadow-2xl shadow-emerald-900/20 relative overflow-hidden">
           <div className="absolute right-[-30px] top-[-30px] opacity-10 rotate-12"><Shield size={220} /></div>
           <div className="relative z-10 space-y-6">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto border border-white/20">
                <Play size={32} className="fill-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black tracking-tight">Start Today's Audit</h3>
                <p className="text-emerald-100 font-medium max-w-md mx-auto text-lg">Initialize the ledger to capture opening balances and track movements for all products.</p>
              </div>
              <button 
                onClick={handleManualInit}
                disabled={isInitializing}
                className="px-12 py-5 bg-white text-emerald-600 rounded-[2.5rem] font-black text-xl hover:scale-105 transition-all shadow-2xl disabled:opacity-50 flex items-center gap-3 mx-auto"
              >
                {isInitializing ? <Loader2 className="animate-spin" /> : <RefreshCw size={24} />}
                Initialize Ledger
              </button>
           </div>
        </div>
      )}

      {/* DASHBOARD STATS */}
      {snapshots.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items Tracked</p>
            <p className="text-2xl font-black text-slate-800">{stats.total}</p>
          </div>
          <div className={`bg-white p-6 rounded-[2rem] border shadow-sm ${stats.issues > 0 ? 'border-rose-100 bg-rose-50/50' : 'border-slate-100'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stats.issues > 0 ? 'text-rose-600' : 'text-slate-400'}`}>Issues Found</p>
            <p className={`text-2xl font-black ${stats.issues > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {stats.issues === 0 ? 'All Correct' : `${stats.issues} Errors`}
            </p>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      {snapshots.length > 0 && (
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
          <input 
            type="text" 
            placeholder="Search products in audit..." 
            className="w-full pl-14 pr-6 h-16 bg-white border border-slate-200 rounded-3xl outline-none shadow-sm font-bold text-lg focus:ring-4 focus:ring-emerald-500/10 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* AUDIT TABLE */}
      {snapshots.length > 0 ? (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Identity</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Start</th>
                  <th className="px-6 py-6 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center">Added</th>
                  <th className="px-6 py-6 text-[10px] font-black text-rose-600 uppercase tracking-widest text-center">Sold</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Expected</th>
                  <th className="px-8 py-6 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right">Physical Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSnapshots.map(snap => {
                  const expected = Number(snap.starting_qty || 0) + Number(snap.added_qty || 0) - Number(snap.sold_qty || 0);
                  const actual = snap.closing_qty !== undefined ? snap.closing_qty : expected;
                  const hasDiscrepancy = expected !== actual;

                  return (
                    <tr key={snap.id} className={`hover:bg-slate-50/50 transition-colors ${hasDiscrepancy ? 'bg-rose-50/30' : ''}`}>
                      <td className="px-8 py-6">
                        <p className="font-black text-slate-800">{snap.product_name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {snap.product_id}</p>
                      </td>
                      <td className="px-6 py-6 text-center font-bold text-slate-500 tabular-nums">{snap.starting_qty}</td>
                      <td className="px-6 py-6 text-center font-black text-emerald-600 tabular-nums">+{snap.added_qty}</td>
                      <td className="px-6 py-6 text-center font-black text-rose-600 tabular-nums">-{snap.sold_qty}</td>
                      <td className="px-6 py-6 text-center">
                        <span className="px-4 py-1.5 bg-slate-100 rounded-full font-black text-slate-900 text-sm tabular-nums">
                          {expected}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <input 
                            type="number"
                            className={`w-24 px-4 py-2 border-2 rounded-2xl text-right font-black outline-none transition-all ${
                              hasDiscrepancy 
                                ? 'border-rose-400 bg-rose-50 text-rose-600 shadow-lg shadow-rose-200' 
                                : 'border-slate-100 bg-slate-50 text-emerald-600 focus:border-emerald-500'
                            }`}
                            value={snap.closing_qty ?? ''}
                            onChange={(e) => updateActualCount(snap.id!, e.target.value)}
                            placeholder={String(expected)}
                          />
                          {hasDiscrepancy && (
                            <span className="text-[9px] font-black uppercase text-rose-500 flex items-center gap-1">
                              <AlertTriangle size={10} /> Discrepancy Found
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !isToday && (
          <div className="py-40 text-center bg-white border border-dashed border-slate-200 rounded-[4rem] space-y-6">
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
               <History size={64} />
             </div>
             <div className="space-y-2">
                <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No Audit Record Found</p>
                <p className="text-slate-300 font-medium max-w-xs mx-auto">There is no stock snapshot data for {selectedDate}.</p>
             </div>
          </div>
        )
      )}

      {/* FOOTER INFO */}
      <div className="bg-amber-50 rounded-[3rem] border border-amber-100 p-10 flex flex-col md:flex-row items-center gap-8 shadow-sm">
        <div className="w-16 h-16 bg-white text-amber-600 rounded-[1.5rem] flex items-center justify-center shadow-sm shrink-0 border border-amber-200">
          <Info size={32} />
        </div>
        <div className="text-center md:text-left flex-1">
          <h4 className="font-black text-slate-900 uppercase text-sm tracking-widest mb-2">How to use Audit Hub</h4>
          <p className="text-slate-600 font-medium leading-relaxed">
            The terminal calculates your <b>Expected Stock</b> by taking the morning balance, adding restocks, and subtracting sales. 
            If your <b>Physical Count</b> is different (red boxes), it means stock has been lost, stolen, or damaged.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockAudit;