import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ClipboardList, Play, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';

const StockAudit: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isInitializing, setIsInitializing] = useState(false);

  const products = useLiveQuery(() => db.products.toArray()) || [];
  const snapshots = useLiveQuery(() => 
    db.stock_snapshots.where('date').equals(selectedDate).toArray()
  ) || [];

  const startAudit = async () => {
    if (products.length === 0) return alert("No products found in inventory!");
    setIsInitializing(true);
    try {
      // Fix: Cast db to any to resolve the "Property 'transaction' does not exist" error
      await (db as any).transaction('rw', [db.stock_snapshots], async () => {
        for (const p of products) {
          await db.stock_snapshots.add({
            date: selectedDate,
            product_id: p.id!,
            product_name: p.name,
            starting_qty: p.stock_qty,
            added_qty: 0,
            sold_qty: 0,
            closing_qty: p.stock_qty
          });
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <ClipboardList size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">Daily Stock Audit</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Reconcile your physical stock</p>
          </div>
        </div>
        <input 
          type="date" 
          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {snapshots.length === 0 ? (
        <div className="bg-white p-12 rounded-[3rem] border border-dashed border-slate-200 text-center space-y-6">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
            <Calendar size={40} />
          </div>
          <div className="max-w-xs mx-auto">
            <h3 className="text-lg font-black text-slate-800">No Audit Data for this Date</h3>
            <p className="text-slate-400 text-sm mt-2">You haven't started a stock reconciliation for {selectedDate} yet.</p>
          </div>
          {selectedDate === new Date().toISOString().split('T')[0] && (
            <button 
              onClick={startAudit}
              disabled={isInitializing}
              className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 mx-auto shadow-xl hover:bg-emerald-700 transition-all active:scale-95"
            >
              {isInitializing ? 'Initializing...' : <><Play size={20} /> Start Today's Audit</>}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Start</th>
                  <th className="px-6 py-4 text-[10px] font-black text-emerald-500 uppercase tracking-widest text-center">Added</th>
                  <th className="px-6 py-4 text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">Sold</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center">Expected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700 text-sm">{s.product_name}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-400">{s.starting_qty}</td>
                    <td className="px-6 py-4 text-center font-black text-emerald-600">+{s.added_qty}</td>
                    <td className="px-6 py-4 text-center font-black text-rose-600">-{s.sold_qty}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-slate-100 rounded-lg font-black text-slate-800">
                        {s.starting_qty + s.added_qty - s.sold_qty}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockAudit;