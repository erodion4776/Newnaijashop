import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getLocalDateString } from '../db/db';
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
  Info,
  TrendingUp,
  Package,
  ArrowRight
} from 'lucide-react';
import { StockSnapshot, Product } from '../types';

const StockAudit: React.FC = () => {
  // Use robust local date helper instead of UTC toISOString
  const todayStr = useMemo(() => getLocalDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Derive time boundaries for the selected date as LOCAL time
  const timeRange = useMemo(() => {
    const start = new Date(`${selectedDate}T00:00:00`);
    const end = new Date(`${selectedDate}T23:59:59.999`);
    return { start: start.getTime(), end: end.getTime() };
  }, [selectedDate]);

  // Reactive data streams
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const snapshots = useLiveQuery(() => db.stock_snapshots.where('date').equals(selectedDate).toArray(), [selectedDate]) || [];
  const salesOnDate = useLiveQuery(() => db.sales.where('timestamp').between(timeRange.start, timeRange.end).toArray(), [selectedDate]) || [];
  const logsOnDate = useLiveQuery(() => db.inventory_logs.where('timestamp').between(timeRange.start, timeRange.end).toArray(), [selectedDate]) || [];

  const isToday = selectedDate === todayStr;

  /**
   * Proactive Product Sync
   * Detects new products and calculates their true starting stock for today's audit.
   */
  const syncTodayAudit = async () => {
    if (!isToday || products.length === 0) return;
    setIsSyncing(true);
    try {
      const allProducts = await db.products.toArray();
      const existingSnapshots = await db.stock_snapshots.where('date').equals(selectedDate).toArray();
      const snapshotProductIds = new Set(existingSnapshots.map(s => s.product_id));

      const newSnapshots: StockSnapshot[] = [];
      
      for (const product of allProducts) {
        if (!snapshotProductIds.has(product.id!)) {
          // Calculate movements for today to back-calculate starting qty
          const soldToday = salesOnDate.reduce((acc, s) => {
            const qty = s.items.filter(i => i.productId === product.id).reduce((sum, i) => sum + Number(i.quantity), 0);
            return acc + qty;
          }, 0);

          const addedToday = logsOnDate.reduce((acc, l) => {
            if (l.product_id === product.id && (l.type === 'Restock' || l.type === 'Initial Stock')) {
              return acc + Number(l.quantity_changed);
            }
            return acc;
          }, 0);

          // Starting = Current - Added + Sold
          const starting = Number(product.stock_qty || 0) - Number(addedToday) + Number(soldToday);

          newSnapshots.push({
            date: selectedDate,
            product_id: product.id!,
            product_name: product.name,
            starting_qty: starting,
            added_qty: 0,
            sold_qty: 0,
            closing_qty: undefined
          });
        }
      }

      if (newSnapshots.length > 0) {
        await db.stock_snapshots.bulkAdd(newSnapshots);
      }
    } finally {
      // Small artificial delay for UI feedback
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  useEffect(() => {
    if (isToday) syncTodayAudit();
  }, [selectedDate, isToday, products.length]);

  /**
   * Main Audit Logic
   * Merges products and snapshots with LIVE calculations from sales and logs.
   */
  const auditRows = useMemo(() => {
    return products.map(product => {
      const snapshot = snapshots.find(s => s.product_id === product.id);
      if (!snapshot) return null;

      // Dynamic Movement Calculation
      const soldCount = salesOnDate.reduce((acc, s) => {
        const qty = s.items.filter(i => i.productId === product.id).reduce((sum, i) => sum + Number(i.quantity), 0);
        return acc + qty;
      }, 0);

      const addedCount = logsOnDate.reduce((acc, l) => {
        if (l.product_id === product.id && (l.type === 'Restock' || l.type === 'Initial Stock')) {
          return acc + Number(l.quantity_changed);
        }
        return acc;
      }, 0);

      const starting = Number(snapshot.starting_qty || 0);
      const expected = starting + addedCount - soldCount;
      const actual = snapshot.closing_qty !== undefined ? Number(snapshot.closing_qty) : expected;
      const hasDiscrepancy = expected !== actual;

      return {
        id: snapshot.id!,
        name: product.name,
        productId: product.id!,
        starting,
        added: addedCount,
        sold: soldCount,
        expected,
        actual: snapshot.closing_qty,
        hasDiscrepancy,
        diff: actual - expected
      };
    }).filter(Boolean).filter(row => 
      row!.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, snapshots, salesOnDate, logsOnDate, searchTerm]);

  const updateActualCount = async (snapshotId: number, value: string) => {
    const numericVal = value === '' ? undefined : Number(value);
    try {
      await db.stock_snapshots.update(snapshotId, { closing_qty: numericVal });
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const stats = useMemo(() => {
    const rows = auditRows as any[];
    return {
      total: rows.length,
      issues: rows.filter(r => r.hasDiscrepancy).length
    };
  }, [auditRows]);

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
          {isToday && (
            <button 
              onClick={syncTodayAudit}
              disabled={isSyncing}
              className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all disabled:opacity-50"
              title="Refresh Audit Data"
            >
              <RefreshCw size={24} className={isSyncing ? 'animate-spin' : ''} />
            </button>
          )}
          <div className="flex-1 bg-slate-50 p-2 pl-4 rounded-2xl border border-slate-200 flex items-center gap-3">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="date" 
              className="bg-transparent outline-none font-bold text-slate-800 py-2 w-full"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={todayStr}
            />
          </div>
        </div>
      </div>

      {/* DASHBOARD STATS */}
      {snapshots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center shadow-inner">
              <Package size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items Audited</p>
              <p className="text-2xl font-black text-slate-800">{stats.total}</p>
            </div>
          </div>
          <div className={`bg-white p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-5 ${stats.issues > 0 ? 'border-rose-100 bg-rose-50/50' : 'border-slate-100'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${stats.issues > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stats.issues > 0 ? 'text-rose-600' : 'text-slate-400'}`}>Issues Found</p>
              <p className={`text-2xl font-black ${stats.issues > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {stats.issues === 0 ? 'Balanced' : `${stats.issues} Discrepancies`}
              </p>
            </div>
          </div>
          <div className="bg-emerald-600 p-6 rounded-[2.5rem] shadow-lg flex items-center gap-5 relative overflow-hidden">
            <div className="absolute right-[-10px] top-[-10px] opacity-10"><TrendingUp size={100} /></div>
            <div className="w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center shadow-inner">
              <RefreshCw size={24} />
            </div>
            <div className="text-white relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1">Real-Time Mode</p>
              <p className="text-sm font-bold opacity-80">Synced with POS</p>
            </div>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTERS */}
      {snapshots.length > 0 && (
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
          <input 
            type="text" 
            placeholder="Search audit ledger..." 
            className="w-full pl-14 pr-6 h-16 bg-white border border-slate-200 rounded-[2rem] outline-none shadow-sm font-bold text-lg focus:ring-4 focus:ring-emerald-500/10 transition-all"
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
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Starting</th>
                  <th className="px-6 py-6 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center">Added (+)</th>
                  <th className="px-6 py-6 text-[10px] font-black text-rose-600 uppercase tracking-widest text-center">Sold (-)</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Expected</th>
                  <th className="px-8 py-6 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right">Actual Closing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {auditRows.map(row => (
                  <tr key={row!.id} className={`hover:bg-slate-50/50 transition-colors ${row!.hasDiscrepancy ? 'bg-rose-50/30' : ''}`}>
                    <td className="px-8 py-6">
                      <p className="font-black text-slate-800">{row!.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">SKU: #{row!.productId}</p>
                    </td>
                    <td className="px-6 py-6 text-center font-bold text-slate-500 tabular-nums">{row!.starting}</td>
                    <td className="px-6 py-6 text-center font-black text-emerald-600 tabular-nums">+{row!.added}</td>
                    <td className="px-6 py-6 text-center font-black text-rose-600 tabular-nums">-{row!.sold}</td>
                    <td className="px-6 py-6 text-center">
                      <span className="px-4 py-1.5 bg-slate-100 rounded-full font-black text-slate-900 text-sm tabular-nums">
                        {row!.expected}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <input 
                          type="number"
                          className={`w-24 px-4 py-2 border-2 rounded-2xl text-right font-black outline-none transition-all ${
                            row!.hasDiscrepancy 
                              ? 'border-rose-400 bg-rose-50 text-rose-600 shadow-lg shadow-rose-200' 
                              : 'border-slate-100 bg-slate-50 text-emerald-600 focus:border-emerald-500'
                          }`}
                          value={row!.actual ?? ''}
                          onChange={(e) => updateActualCount(row!.id, e.target.value)}
                          placeholder={String(row!.expected)}
                        />
                        {row!.hasDiscrepancy && (
                          <span className="text-[9px] font-black uppercase text-rose-500 flex items-center gap-1">
                            <AlertTriangle size={10} /> 
                            {row!.diff > 0 ? `+${row!.diff}` : row!.diff} UNITS DIFF
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-40 text-center bg-white border border-dashed border-slate-200 rounded-[4rem] space-y-6">
           <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
             <History size={64} />
           </div>
           <div className="space-y-2 px-6">
              <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No Audit Record Found</p>
              <p className="text-slate-300 font-medium max-w-xs mx-auto">There is no stock snapshot data for {selectedDate}. If this is today, the hub will sync automatically.</p>
              {isToday && (
                <button 
                  onClick={syncTodayAudit}
                  className="mt-6 px-10 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 mx-auto"
                >
                  <RefreshCw size={18} /> Sync Audit Ledger
                </button>
              )}
           </div>
        </div>
      )}

      {/* FOOTER INFO */}
      <div className="bg-amber-50 rounded-[3rem] border border-amber-100 p-10 flex flex-col md:flex-row items-center gap-8 shadow-sm">
        <div className="w-16 h-16 bg-white text-amber-600 rounded-[1.5rem] flex items-center justify-center shadow-sm shrink-0 border border-amber-200">
          <Info size={32} />
        </div>
        <div className="text-center md:text-left flex-1">
          <h4 className="font-black text-slate-900 uppercase text-sm tracking-widest mb-2">How Audit Hub Works</h4>
          <p className="text-slate-600 font-medium leading-relaxed">
            The Terminal uses the formula: <b>Opening Stock + Today's Restocks - Today's Sales = Expected Closing</b>. 
            If your physical count is different (red rows), it means stock was lost, stolen, or moved without recording it in the POS.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockAudit;