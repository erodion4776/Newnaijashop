
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
  X, 
  Filter, 
  RefreshCw, 
  Loader2, 
  TrendingDown, 
  Info, 
  Plus, 
  Minus, 
  Shield 
} from 'lucide-react';
import { StockSnapshot, Product } from '../types';

const StockAudit: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasInitializedToday, setHasInitializedToday] = useState(false);

  // Use Dexie hooks to react to changes in snapshots and products
  const snapshots = useLiveQuery(
    () => db.stock_snapshots.where('date').equals(selectedDate).toArray(),
    [selectedDate]
  ) || [];

  const products = useLiveQuery(() => db.products.toArray()) || [];

  // Check if today's audit has been initialized
  useEffect(() => {
    const checkInitialization = async () => {
      const today = new Date().toISOString().split('T')[0];
      if (selectedDate === today) {
        const count = await db.stock_snapshots.where('date').equals(today).count();
        setHasInitializedToday(count > 0);
      }
    };
    checkInitialization();
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

  const updateCountedValue = async (snapshotId: number, newValue: string) => {
    const val = newValue === '' ? undefined : Number(newValue);
    try {
      await db.stock_snapshots.update(snapshotId, { closing_qty: val });
    } catch (err) {
      console.error("Failed to update counted value:", err);
    }
  };

  const handleCloseDayAudit = async () => {
    if (!confirm("Close today's audit? This will lock current product quantities as counted values for any items you haven't manually counted yet.")) return;
    
    setIsInitializing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const todaySnapshots = await db.stock_snapshots.where('date').equals(today).toArray();
      
      await (db as any).transaction('rw', [db.stock_snapshots], async () => {
        for (const snapshot of todaySnapshots) {
          if (snapshot.closing_qty === undefined) {
            const product = products.find(p => p.id === snapshot.product_id);
            if (product) {
              await db.stock_snapshots.update(snapshot.id!, {
                closing_qty: product.stock_qty
              });
            }
          }
        }
      });
      
      alert(`✅ Audit closed! All items locked with closing values.`);
    } catch (err) {
      console.error("Close audit error:", err);
      alert("Failed to close audit.");
    } finally {
      setIsInitializing(false);
    }
  };

  const filteredSnapshots = useMemo(() => {
    return snapshots.filter(snap => {
      const matchesSearch = snap.product_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const expected = Number(snap.starting_qty || 0) + Number(snap.added_qty || 0) - Number(snap.sold_qty || 0);
      const isTodayCurrent = snap.date === new Date().toISOString().split('T')[0];
      const actual = snap.closing_qty !== undefined 
        ? snap.closing_qty 
        : (isTodayCurrent ? (products.find(p => p.id === snap.product_id)?.stock_qty || 0) : 0);
      
      const hasDiscrepancy = expected !== actual;

      if (showDiscrepanciesOnly) return matchesSearch && hasDiscrepancy;
      return matchesSearch;
    });
  }, [snapshots, searchTerm, showDiscrepanciesOnly, products]);

  const stats = useMemo(() => {
    let totalExpected = 0;
    let totalActual = 0;
    let issues = 0;
    const isTodayCurrent = selectedDate === new Date().toISOString().split('T')[0];

    snapshots.forEach(snap => {
      const expected = Number(snap.starting_qty || 0) + Number(snap.added_qty || 0) - Number(snap.sold_qty || 0);
      const actual = snap.closing_qty !== undefined 
        ? snap.closing_qty 
        : (isTodayCurrent ? (products.find(p => p.id === snap.product_id)?.stock_qty || 0) : 0);
      
      totalExpected += expected;
      totalActual += actual;
      
      if (expected !== actual) issues++;
    });

    return { 
      total: snapshots.length, 
      issues,
      totalExpected,
      totalActual,
      variance: totalActual - totalExpected
    };
  }, [snapshots, products, selectedDate]);

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardCheck size={28} className="text-emerald-600" /> Stock Audit Hub
          </h3>
          <p className="text-sm text-slate-500 font-medium">Daily inventory verification system</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="bg-white p-2 pl-4 rounded-2xl border border-slate-200 flex items-center gap-3 shadow-sm flex-1">
             <Calendar size={18} className="text-slate-400" />
             <input 
               type="date" 
               className="bg-transparent outline-none font-bold text-slate-800 text-sm py-2 pr-4 w-full"
               value={selectedDate}
               onChange={(e) => setSelectedDate(e.target.value)}
             />
          </div>
        </div>
      </div>

      {/* Action Buttons for Today */}
      {isToday && (
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-[2rem] p-6 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-emerald-600" />
              <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Daily Audit Controls</h4>
            </div>
            <p className="text-sm text-slate-600 font-medium">
              {hasInitializedToday 
                ? "✅ Today's audit is active. Count items and enter values below." 
                : "⚠️ Start today's audit to begin tracking stock movements."}
            </p>
          </div>
          <div className="flex gap-2">
            {!hasInitializedToday ? (
              <button 
                onClick={handleManualInit}
                disabled={isInitializing}
                className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isInitializing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Start Today's Audit
              </button>
            ) : (
              <button 
                onClick={handleCloseDayAudit}
                disabled={isInitializing}
                className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isInitializing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Close Day & Lock Values
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center shadow-inner">
              <Package size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Items Tracked</p>
              <p className="text-2xl font-black text-slate-800">{stats.total}</p>
           </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
              <ArrowUp size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expected Stock</p>
              <p className="text-2xl font-black text-blue-600 tabular-nums">{stats.totalExpected}</p>
           </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
              <CheckCircle2 size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Actual Stock</p>
              <p className="text-2xl font-black text-emerald-600 tabular-nums">{stats.totalActual}</p>
           </div>
        </div>

        <div className={`p-6 rounded-[2rem] border transition-all shadow-sm flex items-center gap-4 ${stats.issues > 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${stats.issues > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {stats.issues > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Discrepancies</p>
              <p className={`text-2xl font-black ${stats.issues > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {stats.issues === 0 ? 'Perfect ✓' : stats.issues}
              </p>
           </div>
        </div>
      </div>

      {/* Variance Alert */}
      {stats.variance !== 0 && stats.total > 0 && (
        <div className={`p-6 rounded-[2rem] border-2 flex items-center gap-4 ${stats.variance > 0 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stats.variance > 0 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
            {stats.variance > 0 ? <ArrowUp size={24} /> : <ArrowDown size={24} />}
          </div>
          <div className="flex-1">
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-1">
              {stats.variance > 0 ? 'Surplus Detected' : 'Stock Shortage'}
            </h4>
            <p className="text-sm text-slate-600 font-medium">
              {stats.variance > 0 
                ? `You have ${Math.abs(stats.variance)} extra units. Items may have been added without logging.`
                : `You are missing ${Math.abs(stats.variance)} units. Items may have been removed without logging.`
              }
            </p>
          </div>
          <div className="text-3xl font-black tabular-nums">
            {stats.variance > 0 ? '+' : ''}{stats.variance}
          </div>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search items by name..." 
            className="w-full pl-14 pr-6 h-16 bg-white border border-slate-200 rounded-[2rem] outline-none shadow-sm font-medium transition-all focus:ring-2 focus:ring-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button 
          onClick={() => setShowDiscrepanciesOnly(!showDiscrepanciesOnly)}
          className={`px-6 py-4 rounded-[2rem] border font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 whitespace-nowrap ${showDiscrepanciesOnly ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 shadow-sm'}`}
        >
          <Filter size={18} />
          {showDiscrepanciesOnly ? 'Show All' : 'Only Errors'}
        </button>
      </div>

      {/* Main Audit Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Start Stock</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Restocked (+)</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sold (-)</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Expected</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actual Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-32 text-center space-y-6">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                      <History size={48} />
                    </div>
                    <div className="space-y-2">
                       <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No audit data for {selectedDate}</p>
                       {isToday && !hasInitializedToday && (
                         <button 
                           onClick={handleManualInit}
                           disabled={isInitializing}
                           className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                         >
                           {isInitializing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                           Initialize Today's Stock Audit
                         </button>
                       )}
                    </div>
                  </td>
                </tr>
              ) : filteredSnapshots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    No results matching your filters.
                  </td>
                </tr>
              ) : (
                filteredSnapshots.map(snap => {
                  const expected = Number(snap.starting_qty || 0) + Number(snap.added_qty || 0) - Number(snap.sold_qty || 0);
                  const isTodayCurrent = snap.date === new Date().toISOString().split('T')[0];
                  const actual = snap.closing_qty !== undefined 
                    ? snap.closing_qty 
                    : (isTodayCurrent ? (products.find(p => p.id === snap.product_id)?.stock_qty || 0) : 0);
                  
                  const hasDiscrepancy = expected !== actual;
                  const diff = actual - expected;

                  return (
                    <tr key={snap.id} className={`hover:bg-slate-50/50 transition-colors ${hasDiscrepancy ? 'bg-rose-50/30' : ''}`}>
                      <td className="px-8 py-6">
                         <p className="font-black text-slate-800">{snap.product_name}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SKU: #{snap.product_id}</p>
                      </td>
                      <td className="px-6 py-6 text-center font-bold text-slate-500 tabular-nums">{snap.starting_qty}</td>
                      <td className="px-6 py-6 text-center">
                         <span className="text-emerald-600 font-black flex items-center justify-center gap-1 tabular-nums">
                            <Plus size={12}/> {snap.added_qty}
                         </span>
                      </td>
                      <td className="px-6 py-6 text-center">
                         <span className="text-rose-600 font-black flex items-center justify-center gap-1 tabular-nums">
                            <Minus size={12}/> {snap.sold_qty}
                         </span>
                      </td>
                      <td className="px-6 py-6 text-center">
                         <span className="px-4 py-1.5 bg-slate-100 rounded-full font-black text-slate-500 text-xs tabular-nums">{expected}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex flex-col items-end">
                            <input 
                              type="number" 
                              className={`w-24 px-3 py-2 bg-slate-50 border-2 rounded-xl text-right font-black text-lg outline-none transition-all ${hasDiscrepancy ? 'border-rose-300 text-rose-600 focus:border-rose-500' : 'border-slate-100 text-emerald-600 focus:border-emerald-500'}`}
                              value={snap.closing_qty === undefined ? '' : snap.closing_qty}
                              onChange={(e) => updateCountedValue(snap.id!, e.target.value)}
                              placeholder={isTodayCurrent ? (products.find(p => p.id === snap.product_id)?.stock_qty || 0).toString() : '0'}
                            />
                            {hasDiscrepancy && (
                              <div className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-500 mt-1">
                                <AlertTriangle size={10} /> 
                                {diff > 0 ? `SURPLUS ${diff}` : `MISSING ${Math.abs(diff)}`} UNITS
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

      {/* Help Information */}
      <div className="bg-amber-50 rounded-[2rem] border border-amber-100 p-8 flex flex-col md:flex-row items-center gap-6 shadow-sm">
         <div className="w-14 h-14 bg-white text-amber-600 rounded-2xl flex items-center justify-center shadow-sm shrink-0 border border-amber-200">
            <Info size={28} />
         </div>
         <div className="flex-1 text-center md:text-left space-y-1">
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Manual Counting Instructions</h4>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              <strong>1. Count:</strong> Physically count items on your shelves. 
              <strong> 2. Enter:</strong> Type the number in the "Actual Count" field. 
              <strong> 3. Audit:</strong> The terminal will highlight discrepancies in red. Missing units often indicate sales made outside the terminal or errors in restock entry.
            </p>
         </div>
      </div>
    </div>
  );
};

export default StockAudit;
