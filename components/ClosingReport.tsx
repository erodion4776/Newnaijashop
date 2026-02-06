import React, { useState, useMemo } from 'react';
import { 
  Lock, 
  Moon, 
  CheckCircle2, 
  MessageSquare, 
  Printer, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Banknote, 
  Landmark, 
  CreditCard, 
  LogOut,
  FileText,
  Loader2,
  AlertTriangle,
  History,
  ClipboardCheck
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getLocalDateString } from '../db/db';
import { generateBackupData } from '../utils/backup';
import BluetoothPrintService from '../services/BluetoothPrintService';
import { Staff, Settings } from '../types';

interface ClosingReportProps {
  onClose: () => void;
  currentUser: Staff | null;
  onLogout: () => void;
  settings: Settings | undefined;
}

const ClosingReport: React.FC<ClosingReportProps> = ({ onClose, currentUser, onLogout, settings }) => {
  const [backupDone, setBackupDone] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // Robust local date logic
  const todayDate = useMemo(() => getLocalDateString(), []);

  // Fetch today's data in local time boundaries
  const todayStart = useMemo(() => new Date(`${todayDate}T00:00:00`).getTime(), [todayDate]);
  const todayEnd = useMemo(() => new Date(`${todayDate}T23:59:59.999`).getTime(), [todayDate]);

  const sales = useLiveQuery(() => 
    db.sales.where('timestamp').between(todayStart, todayEnd).toArray()
  , [todayStart, todayEnd]) || [];

  const expenses = useLiveQuery(() => 
    db.expenses.where('timestamp').between(todayStart, todayEnd).toArray()
  , [todayStart, todayEnd]) || [];

  const products = useLiveQuery(() => db.products.toArray()) || [];
  const snapshots = useLiveQuery(() => db.stock_snapshots.where('date').equals(todayDate).toArray(), [todayDate]) || [];

  const summary = useMemo(() => {
    const stats = {
      cash: 0,
      transfer: 0,
      pos: 0,
      expenses: expenses.reduce((sum, e) => sum + e.amount, 0),
      interest: 0,
      totalSales: 0
    };

    const pMap: Record<number, number> = {};
    products.forEach(p => { if(p.id) pMap[p.id] = p.cost_price; });

    sales.forEach(sale => {
      stats.totalSales += sale.total_amount;
      const method = sale.payment_method.toLowerCase();
      
      if (method === 'cash') stats.cash += sale.total_amount;
      else if (method.includes('transfer')) stats.transfer += sale.total_amount;
      else if (method === 'pos') stats.pos += sale.total_amount;
      else if (method === 'split') {
        stats.cash += (sale.cash_amount || 0);
        stats.pos += (sale.total_amount - (sale.cash_amount || 0));
      }

      sale.items.forEach(item => {
        const cost = pMap[item.productId] || (item.price * 0.85);
        stats.interest += (item.price - cost) * item.quantity;
      });
    });

    return {
      ...stats,
      netTakeHome: stats.totalSales - stats.expenses
    };
  }, [sales, expenses, products]);

  const handleBackup = async () => {
    const data = await generateBackupData();
    const text = `🌙 NAIJASHOP CLOSING BACKUP - ${new Date().toLocaleDateString()}\n\nShop: ${settings?.shop_name}\nSales: ₦${summary.totalSales.toLocaleString()}\n\nCopy this code to your private chat to secure your wealth:\n\n${data}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setBackupDone(true);
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    
    try {
      await (db as any).transaction('rw', [db.audit_trail, db.stock_snapshots, db.products], async () => {
        // 1. Log Closure in Audit Trail
        await db.audit_trail.add({
          action: 'Daily Shop Closing',
          details: `Total Sales: ₦${summary.totalSales.toLocaleString()} | Expenses: ₦${summary.expenses.toLocaleString()} | Notes: ${closingNotes || 'None'}`,
          staff_name: currentUser?.name || 'Admin',
          timestamp: Date.now()
        });

        // 2. Finalize Stock Snapshots - Store Actual Closing based on current digital stock
        for (const p of products) {
          await db.stock_snapshots
            .where({ date: todayDate, product_id: p.id })
            .modify({ closing_qty: p.stock_qty });
        }
      });

      // 3. Bluetooth Print Z-Report
      if (BluetoothPrintService.isConnected()) {
        try {
          await BluetoothPrintService.printZReport(summary, settings, closingNotes);
        } catch (e) {
          console.error("Auto-print failed", e);
        }
      }

      setTimeout(() => {
        setShowSuccess(true);
        setIsFinalizing(false);
      }, 1000);
    } catch (err) {
      alert("Closing failed. Please try again.");
      setIsFinalizing(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-[2000] bg-emerald-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
          <Moon size={64} className="text-emerald-900" />
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-5xl font-black text-white tracking-tighter">Shop Closed</h2>
          <p className="text-emerald-300 font-bold text-xl">Market was good today, Oga! Enjoy your rest.</p>
          <button 
            onClick={onLogout}
            className="w-full mt-8 py-5 bg-white text-emerald-900 rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 shadow-2xl hover:scale-105 transition-transform"
          >
            <LogOut size={24} /> Secure & Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1500] bg-slate-50 flex flex-col animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
      <header className="bg-emerald-900 p-8 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md"><Moon size={32} /></div>
          <div>
            <h2 className="text-3xl font-black tracking-tight leading-none">Daily Closing Ritual</h2>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mt-1">Z-Report & Audit Sync</p>
          </div>
        </div>
        <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-full transition-colors"><X size={32} /></button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cash in Hand</p>
               <h4 className="text-3xl font-black text-emerald-600">₦{summary.cash.toLocaleString()}</h4>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Transfers</p>
               <h4 className="text-3xl font-black text-blue-600">₦{summary.transfer.toLocaleString()}</h4>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expenses</p>
               <h4 className="text-3xl font-black text-rose-600">₦{summary.expenses.toLocaleString()}</h4>
            </div>
          </div>

          <div className="bg-emerald-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
             <div className="absolute right-[-20px] top-[-20px] opacity-10"><History size={180} /></div>
             <div className="relative z-10 space-y-2 text-center md:text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Net Take-Home</p>
                <h3 className="text-6xl font-black tracking-tighter">₦{summary.netTakeHome.toLocaleString()}</h3>
                <div className="inline-flex items-center gap-2 bg-emerald-800 px-4 py-1.5 rounded-full text-[10px] font-black uppercase">
                   <TrendingUp size={12} /> Today's Gain: ₦{summary.interest.toLocaleString()}
                </div>
             </div>
          </div>

          {/* STOCK AUDIT PREVIEW */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <ClipboardCheck size={24} className="text-indigo-600" /> Stock Audit Summary
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
               <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-black uppercase text-slate-400">Product</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-400 text-center">Start</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-400 text-center">Added</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-400 text-center">Sold</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-400 text-center">Expected</th>
                      <th className="px-4 py-3 font-black uppercase text-slate-400 text-center">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.slice(0, 15).map(snap => {
                      const product = products.find(p => p.id === snap.product_id);
                      const expected = Number(snap.starting_qty || 0) + Number(snap.added_qty || 0) - Number(snap.sold_qty || 0);
                      const actual = product?.stock_qty || 0;
                      const hasDiscrepancy = expected !== actual;

                      return (
                        <tr key={snap.id} className={`border-b last:border-0 ${hasDiscrepancy ? 'bg-rose-50' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 font-bold truncate max-w-[120px]">{snap.product_name}</td>
                          <td className="px-4 py-3 text-center">{snap.starting_qty}</td>
                          <td className="px-4 py-3 text-center text-emerald-600">+{snap.added_qty}</td>
                          <td className="px-4 py-3 text-center text-rose-600">-{snap.sold_qty}</td>
                          <td className="px-4 py-3 text-center font-bold text-slate-400">{expected}</td>
                          <td className="px-4 py-3 text-center font-black">{actual} {hasDiscrepancy && <AlertTriangle size={12} className="inline ml-1 text-rose-500" />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
               {snapshots.length > 15 && (
                 <p className="text-center py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Showing Top 15 - Full report in Audit Hub</p>
               )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
               <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><CheckCircle2 size={18} className="text-slate-400" /></div>
               Closing Checklist
            </h3>

            <div className="space-y-6">
              <div className={`p-6 rounded-[2rem] border-2 transition-all ${backupDone ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${backupDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {backupDone ? <CheckCircle2 size={24} /> : <span className="font-black">1</span>}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-lg">Data Backup</h4>
                    <p className="text-sm text-slate-500 font-medium mb-4">Send a secure backup to your own WhatsApp before closing.</p>
                    <button onClick={handleBackup} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest ${backupDone ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white shadow-lg'}`}>
                      <MessageSquare size={18} /> {backupDone ? 'Backup Sent' : 'Step 1: Backup to WhatsApp'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm"><FileText size={20} /></div>
                  <h4 className="font-black text-slate-800">Handover Notes</h4>
                </div>
                <textarea 
                  placeholder="Record any important shop events from today..."
                  className="w-full p-6 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm min-h-[120px] resize-none"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                />
              </div>

              <button 
                disabled={!backupDone || isFinalizing}
                onClick={handleFinalize}
                className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
              >
                {isFinalizing ? <Loader2 className="animate-spin" size={24} /> : <Lock size={24} />}
                Finalize Closing Ritual
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClosingReport;