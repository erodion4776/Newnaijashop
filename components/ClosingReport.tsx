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
  ClipboardCheck,
  Share2
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { generateBackupData } from '../utils/backup';
import { exportDataForWhatsApp } from '../services/syncService';
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

  const isSales = currentUser?.role === 'Sales';

  // Fetch today's data
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayEnd = new Date().setHours(23, 59, 59, 999);

  const sales = useLiveQuery(() => 
    db.sales.where('timestamp').between(todayStart, todayEnd).toArray()
  ) || [];

  const expenses = useLiveQuery(() => 
    db.expenses.where('timestamp').between(todayStart, todayEnd).toArray()
  ) || [];

  const products = useLiveQuery(() => db.products.toArray()) || [];

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

      if (!isSales) {
        sale.items.forEach(item => {
          const product = pMap[item.productId];
          const cost = product || (item.price * 0.85);
          stats.interest += (item.price - cost) * item.quantity;
        });
      }
    });

    return {
      ...stats,
      netTakeHome: stats.totalSales - stats.expenses
    };
  }, [sales, expenses, products, isSales]);

  const handleStaffReport = async () => {
    if (!settings?.sync_key) { alert("Security Bridge Key not set. Please contact Admin."); return; }
    setIsFinalizing(true);
    try {
      const result = await exportDataForWhatsApp('SALES', settings.sync_key, currentUser?.name);
      if (result.raw === "FILE_DOWNLOADED") {
        alert("Report generated as a file. Send it to the Boss via WhatsApp!");
      } else {
        const text = `🏁 Daily Sales Report from ${currentUser?.name}.\n\nCode:\n${result.raw}\n\nPlease import to update Master Stock.`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      }
      setBackupDone(true);
      setTimeout(() => setShowSuccess(true), 1000);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleFinalize = async () => {
    if (isSales) {
      await handleStaffReport();
      return;
    }

    setIsFinalizing(true);
    await db.audit_trail.add({
      action: 'Daily Shop Closing',
      details: `Total Sales: ₦${summary.totalSales.toLocaleString()} | Expenses: ₦${summary.expenses.toLocaleString()} | Notes: ${closingNotes || 'None'}`,
      staff_name: currentUser?.name || 'Admin',
      timestamp: Date.now()
    });

    if (BluetoothPrintService.isConnected()) {
      try { await BluetoothPrintService.printZReport(summary, settings, closingNotes); } catch (e) {}
    }

    setTimeout(() => { setShowSuccess(true); setIsFinalizing(false); }, 1500);
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-[2000] bg-emerald-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
          <Moon size={64} className="text-emerald-900" />
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-5xl font-black text-white tracking-tighter">{isSales ? 'Report Sent' : 'Shop Closed'}</h2>
          <p className="text-emerald-300 font-bold text-xl">{isSales ? 'Your sales have been packed for the Boss.' : 'Market was good today, Oga! Enjoy your rest.'}</p>
          <button onClick={onLogout} className="w-full mt-8 py-5 bg-white text-emerald-900 rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 shadow-2xl hover:scale-105 transition-transform"><LogOut size={24} /> Secure & Log Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1500] bg-slate-50 flex flex-col animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
      <header className="bg-emerald-900 p-8 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md"><Moon size={32} /></div>
          <div><h2 className="text-3xl font-black tracking-tight leading-none">{isSales ? 'End of Day Report' : 'Daily Closing Ritual'}</h2><p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mt-1">{isSales ? 'Send records to Admin' : 'Z-Report Generation'}</p></div>
        </div>
        <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-full transition-colors"><X size={32} /></button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cash in Hand</p><h4 className="text-3xl font-black text-emerald-600">₦{summary.cash.toLocaleString()}</h4></div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank Transfers</p><h4 className="text-3xl font-black text-blue-600">₦{summary.transfer.toLocaleString()}</h4></div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expenses</p><h4 className="text-3xl font-black text-rose-600">₦{summary.expenses.toLocaleString()}</h4></div>
          </div>

          <div className="bg-emerald-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
             <div className="absolute right-[-20px] top-[-20px] opacity-10"><History size={180} /></div>
             <div className="relative z-10 space-y-2 text-center md:text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Total Sales Volume</p>
                <h3 className="text-6xl font-black tracking-tighter">₦{summary.totalSales.toLocaleString()}</h3>
                {!isSales && (
                   <div className="inline-flex items-center gap-2 bg-emerald-800 px-4 py-1.5 rounded-full text-[10px] font-black uppercase"><TrendingUp size={12} /> Today's Gain: ₦{summary.interest.toLocaleString()}</div>
                )}
             </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><CheckCircle2 size={18} className="text-slate-400" /></div>Closing Steps</h3>

            <div className="space-y-6">
              {isSales ? (
                <div className="p-6 rounded-[2rem] border-2 bg-emerald-50 border-emerald-100 animate-pulse">
                   <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black">1</div>
                      <div className="flex-1">
                         <h4 className="font-black text-lg text-emerald-900">Final Step: Report to Boss</h4>
                         <p className="text-sm text-emerald-700 font-medium mb-4">Click below to send all sales to Oga's WhatsApp. This will clear your terminal for tomorrow.</p>
                         <button onClick={handleFinalize} disabled={isFinalizing} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
                            {isFinalizing ? <Loader2 className="animate-spin" /> : <Share2 />} Send Sales Code to Boss
                         </button>
                      </div>
                   </div>
                </div>
              ) : (
                <>
                  <div className={`p-6 rounded-[2rem] border-2 transition-all ${backupDone ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-start gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${backupDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>{backupDone ? <CheckCircle2 size={24} /> : <span className="font-black">1</span>}</div><div className="flex-1"><h4 className="font-black text-lg">Mandatory Data Backup</h4><p className="text-sm text-slate-500 font-medium mb-4">Protect your data before closing.</p><button onClick={async () => { const d = await generateBackupData(); window.open(`https://wa.me/?text=${encodeURIComponent(d)}`); setBackupDone(true); }} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${backupDone ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white shadow-lg'}`}><MessageSquare size={18} /> {backupDone ? 'Backup Sent' : 'Backup to WhatsApp'}</button></div></div>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm"><FileText size={20} /></div><h4 className="font-black text-slate-800">Handover Notes</h4></div><textarea placeholder="Record shop events..." className="w-full p-6 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm min-h-[120px] resize-none" value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} /></div>
                  <button disabled={!backupDone || isFinalizing} onClick={handleFinalize} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">{isFinalizing ? <Loader2 className="animate-spin" size={24} /> : <Lock size={24} />} Finalize Closing Ritual</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClosingReport;