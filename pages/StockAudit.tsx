import React, { useState, useMemo } from 'react';
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
  Info,
  TrendingUp,
  Package,
  ArrowRight
} from 'lucide-react';
import { StockSnapshot, Product, Sale, InventoryLog } from '../types';

const StockAudit: React.FC = () => {
  const todayStr = useMemo(() => getLocalDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [searchTerm, setSearchTerm] = useState('');

  // Define time boundaries for the selected date in local time
  const timeRange = useMemo(() => {
    const start = new Date(`${selectedDate}T00:00:00`);
    const end = new Date(`${selectedDate}T23:59:59.999`);
    return { start: start.getTime(), end: end.getTime() };
  }, [selectedDate]);

  // LIVE DATA STREAMS: Watching all relevant tables for instant UI updates
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const snapshots = useLiveQuery(() => db.stock_snapshots.where('date').equals(selectedDate).toArray(), [selectedDate]) || [];
  const salesOnDate = useLiveQuery(() => db.sales.where('timestamp').between(timeRange.start, timeRange.end).toArray(), [selectedDate]) || [];
  const logsOnDate = useLiveQuery(() => db.inventory_logs.where('timestamp').between(timeRange.start, timeRange.end).toArray(), [selectedDate]) || [];

  const isToday = selectedDate === todayStr;

  /**
   * DYNAMIC AUDIT ENGINE
   * Merges current product state with historical logs to calculate opening and movement values
   */
  const auditRows = useMemo(() => {
    return products.map(product => {
      // Find the saved snapshot for this product on the selected date (mainly for Actual count/history)
      const snapshot = snapshots.find(s => s.product_id === product.id);
      
      // Calculate dynamic movements specifically for this product on the selected date
      const soldQty = salesOnDate.reduce((sum, sale) => {
        const item = sale.items.find(i => i.productId === product.id);
        return sum + (item ? Number(item.quantity) : 0);
      }, 0);

      const addedQty = logsOnDate.reduce((sum, log) => {
        if (log.product_id === product.id && (log.type === 'Restock' || log.type === 'Initial Stock')) {
          return sum + Number(log.quantity_changed);
        }
        return sum;
      }, 0);

      let starting: number;
      let expected: number;

      if (isToday) {
        // FORMULA: Starting = Current - Added Today + Sold Today
        // This calculates exactly what was on the shelf at 12:00 AM today
        starting = Number(product.stock_qty || 0) - addedQty + soldQty;
        expected = Number(product.stock_qty || 0); // Expected should always match current inventory today
      } else {
        // For history, rely on the locked starting quantity from the snapshot
        starting = Number(snapshot?.starting_qty || 0);
        expected = starting + addedQty - soldQty;
      }

      const actual = snapshot?.closing_qty;
      const hasDiscrepancy = actual !== undefined && actual !== expected;
      const diff = actual !== undefined ? actual - expected : 0;

      return {
        id: snapshot?.id, // ID from snapshot for updating Actual count
        productId: product.id,
        name: product.name,
        starting,
        added: addedQty,
        sold: soldQty,
        expected,
        actual,
        hasDiscrepancy,
        diff
      };
    }).filter(row => 
      row.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, snapshots, salesOnDate, logsOnDate, selectedDate, isToday, searchTerm]);

  /**
   * Actual Count Update Handler
   * If a snapshot doesn't exist yet for today (first time counting), we create it.
   */
  const updateActualCount = async (productRow: any, value: string) => {
    const numericVal = value === '' ? undefined : Number(value);
    
    try {
      if (productRow.id) {
        // Update existing snapshot
        await db.stock_snapshots.update(productRow.id, { closing_qty: numericVal });
      } else {
        // Create new snapshot for today to store this actual count
        await db.stock_snapshots.add({
          date: selectedDate,
          product_id: productRow.productId,
          product_name: productRow.name,
          starting_qty: productRow.starting,
          added_qty: productRow.added,
          sold_qty: productRow.sold,
          closing_qty: numericVal
        });
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const stats = useMemo(() => {
    return {
      total: auditRows.length,
      issues: auditRows.filter(r => r.hasDiscrepancy).length
    };
  }, [auditRows]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-[1.5rem] flex items-center justify-center shadow-inner">
            <ClipboardCheck size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Stock Audit Hub</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Digital vs Physical Reconciliation</p>
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
              max={todayStr}
            />
          </div>
        </div>
      </div>

      {/* DASHBOARD STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center shadow-inner">
            <Package size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items In Audit</p>
            <p className="text-2xl font-black text-slate-800">{stats.total}</p>
          </div>
        </div>
        
        <div className={`bg-white p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-5 ${stats.issues > 0 ? 'border-rose-100 bg-rose-50/50' : 'border-slate-100'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${stats.issues > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stats.issues > 0 ? 'text-rose-600' : 'text-slate-400'}`}>Integrity Issues</p>
            <p className={`text-2xl font-black ${stats.issues > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {stats.issues === 0 ? 'Clean Audit' : `${stats.issues} Discrepancies`}
            </p>
          </div>
        </div>

        <div className="bg-emerald-600 p-6 rounded-[2.5rem] shadow-lg flex items-center gap-5 relative overflow-hidden">
          <div className="absolute right-[-10px] top-[-10px] opacity-10"><TrendingUp size={100} /></div>
          <div className="w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center shadow-inner">
            <RefreshCw size={24} className="animate-pulse" />
          </div>
          <div className="text-white relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1">Live Sync</p>
            <p className="text-sm font-bold opacity-80">Connected to Inventory</p>
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
        <input 
          type="text" 
          placeholder="Filter audit ledger by product name..." 
          className="w-full pl-14 pr-6 h-16 bg-white border border-slate-200 rounded-[2rem] outline-none shadow-sm font-bold text-lg focus:ring-4 focus:ring-emerald-500/10 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* AUDIT TABLE */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Starting (12AM)</th>
                <th className="px-6 py-6 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center">Restocked (+)</th>
                <th className="px-6 py-6 text-[10px] font-black text-rose-600 uppercase tracking-widest text-center">Sold (-)</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Digital Stock</th>
                <th className="px-8 py-6 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right">Physical Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {auditRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                    No products found matching search.
                  </td>
                </tr>
              ) : (
                auditRows.map(row => (
                  <tr key={row.productId} className={`hover:bg-slate-50/50 transition-colors ${row.hasDiscrepancy ? 'bg-rose-50/30' : ''}`}>
                    <td className="px-8 py-6">
                      <p className="font-black text-slate-800">{row.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">SKU: #{row.productId}</p>
                    </td>
                    <td className="px-6 py-6 text-center font-bold text-slate-500 tabular-nums">
                      {row.starting}
                    </td>
                    <td className="px-6 py-6 text-center font-black text-emerald-600 tabular-nums">
                      +{row.added}
                    </td>
                    <td className="px-6 py-6 text-center font-black text-rose-600 tabular-nums">
                      -{row.sold}
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="px-4 py-1.5 bg-slate-100 rounded-full font-black text-slate-900 text-sm tabular-nums">
                        {row.expected}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <input 
                          type="number"
                          className={`w-24 px-4 py-2 border-2 rounded-2xl text-right font-black outline-none transition-all ${
                            row.hasDiscrepancy 
                              ? 'border-rose-400 bg-rose-50 text-rose-600 shadow-lg shadow-rose-200' 
                              : 'border-slate-100 bg-slate-50 text-emerald-600 focus:border-emerald-500'
                          }`}
                          value={row.actual ?? ''}
                          onChange={(e) => updateActualCount(row, e.target.value)}
                          placeholder={String(row.expected)}
                        />
                        {row.hasDiscrepancy && (
                          <span className="text-[9px] font-black uppercase text-rose-500 flex items-center gap-1">
                            <AlertTriangle size={10} /> 
                            {row.diff > 0 ? `+${row.diff}` : row.diff} UNITS DIFF
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER INFO */}
      <div className="bg-amber-50 rounded-[3rem] border border-amber-100 p-10 flex flex-col md:flex-row items-center gap-8 shadow-sm">
        <div className="w-16 h-16 bg-white text-amber-600 rounded-[1.5rem] flex items-center justify-center shadow-sm shrink-0 border border-amber-200">
          <Info size={32} />
        </div>
        <div className="text-center md:text-left flex-1">
          <h4 className="font-black text-slate-900 uppercase text-sm tracking-widest mb-2">Audit Hub Logic</h4>
          <p className="text-slate-600 font-medium leading-relaxed">
            Starting Stock represents your opening balance at 12:00 AM. Digital Stock updates live as you make sales or restock. 
            If your physical shelf count doesn't match the digital total, the row turns red to alert you of potential leakage.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockAudit;