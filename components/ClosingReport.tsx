
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
  History
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
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
    
    // Create an audit log for the closing
    await db.audit_trail.add({
      action: 'Daily Shop Closing',
      details: `Total Sales: ₦${summary.totalSales.toLocaleString()} | Expenses: ₦${summary.expenses.toLocaleString()} | Notes: ${closingNotes || 'None'}`,
      staff_name: currentUser?.name || 'Admin',
      timestamp: Date.now()
    });

    // If bluetooth is connected, try to print automatically
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
    }, 1500);
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
          
          <div className="bg-emerald-900/50 border border-white/10 p-6 rounded-[2.5rem] mt-8 text-left space-y-4">
            <div className="flex justify-between items-center text-white/60 text-xs font-black uppercase tracking-widest">
               <span>Today's Performance</span>
               <span>{new Date().toLocaleDateString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <p className="text-[10px] text-emerald-400 font-black uppercase">Revenue</p>
                  <p className="text-2xl font-black text-white">₦{summary.totalSales.toLocaleString()}</p>
               </div>
               <div>
                  <p className="text-[10px] text-emerald-400 font-black uppercase">Net Profit</p>
                  <p className="text-2xl font-black text-white">₦{summary.interest.toLocaleString()}</p>
               </div>
            </div>
          </div>

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
      {/* Header */}
      <header className="bg-emerald-900 p-8 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
            <Moon size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight leading-none">Daily Closing Ritual</h2>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mt-1">Z-Report Generation</p>
          </div>
        </div>
        <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-full transition-colors">
          <X size={32} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Summary Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cash in Hand</p>
               <h4 className="text-3xl font-black text-emerald-600">₦{summary.cash.toLocaleString()}</h4>
               <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-slate-400">
                  <Banknote size={12} /> Actual Physical Cash
               </div>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bank Transfers</p>
               <h4 className="text-3xl font-black text-blue-600">₦{summary.transfer.toLocaleString()}</h4>
               <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-slate-400">
                  <Landmark size={12} /> Confirm alerts in App
               </div>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expenses (Runnings)</p>
               <h4 className="text-3xl font-black text-rose-600">₦{summary.expenses.toLocaleString()}</h4>
               <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-slate-400">
                  <TrendingDown size={12} /> Money spent today
               </div>
            </div>
          </div>

          <div className="bg-emerald-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
             <div className="absolute right-[-20px] top-[-20px] opacity-10"><History size={180} /></div>
             <div className="relative z-10 space-y-2 text-center md:text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Net Take-Home After Expenses</p>
                <h3 className="text-6xl font-black tracking-tighter">₦{summary.netTakeHome.toLocaleString()}</h3>
                <div className="inline-flex items-center gap-2 bg-emerald-800 px-4 py-1.5 rounded-full text-[10px] font-black uppercase">
                   <TrendingUp size={12} /> Today's Gain: ₦{summary.interest.toLocaleString()}
                </div>
             </div>
             <div className="relative z-10 w-full md:w-auto flex flex-col gap-2">
                <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/10 text-center">
                   <p className="text-[10px] font-black uppercase text-emerald-400 mb-1">Total Sales Count</p>
                   <p className="text-3xl font-black">{sales.length}</p>
                </div>
             </div>
          </div>

          {/* Checklist Form */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
               <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><CheckCircle2 size={18} className="text-slate-400" /></div>
               Closing Checklist
            </h3>

            <div className="space-y-6">
              {/* Step 1: Backup */}
              <div className={`p-6 rounded-[2rem] border-2 transition-all ${backupDone ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${backupDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {backupDone ? <CheckCircle2 size={24} /> : <span className="font-black">1</span>}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-black text-lg ${backupDone ? 'text-emerald-900' : 'text-slate-800'}`}>Mandatory Data Backup</h4>
                    <p className="text-sm text-slate-500 font-medium mb-4">Send a secure backup to your own WhatsApp before closing. This protects your data if this phone is lost tonight.</p>
                    <button 
                      onClick={handleBackup}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${backupDone ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white shadow-lg active:scale-95'}`}
                    >
                      <MessageSquare size={18} /> {backupDone ? 'Backup Sent to WhatsApp' : 'Step 1: Backup to WhatsApp'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes Field */}
              <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm"><FileText size={20} /></div>
                  <h4 className="font-black text-slate-800">Shop Handover Notes</h4>
                </div>
                <textarea 
                  placeholder="Type anything important that happened today... (e.g., 'Soldier came to buy fuel', 'Electricity issues')"
                  className="w-full p-6 bg-white border border-slate-200 rounded-3xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm min-h-[120px] resize-none"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                />
              </div>

              {/* Step 2: Finalize */}
              <div className={`p-6 rounded-[2rem] border-2 transition-all ${!backupDone ? 'opacity-40 grayscale' : 'bg-white border-emerald-100 shadow-xl'}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!backupDone ? 'bg-slate-200 text-slate-400' : 'bg-emerald-600 text-white animate-pulse'}`}>
                    <span className="font-black">2</span>
                  </div>
                  <div className="flex-1 space-y-6">
                    <div>
                      <h4 className="font-black text-lg text-slate-800">Finalize & Print Summary</h4>
                      <p className="text-sm text-slate-500 font-medium">Verify your totals and notes. Finalizing will generate the Z-Report and secure the terminal.</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-50">
                       <button 
                         disabled={!backupDone || isFinalizing}
                         onClick={handleFinalize}
                         className="flex-[2] py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
                       >
                         {isFinalizing ? <Loader2 className="animate-spin" size={24} /> : <Lock size={24} />}
                         Finalize Closing Ritual
                       </button>
                       {BluetoothPrintService.isConnected() && (
                         <button 
                           onClick={async () => {
                             setIsPrinting(true);
                             await BluetoothPrintService.printZReport(summary, settings, closingNotes);
                             setIsPrinting(false);
                           }}
                           className="flex-1 py-5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                         >
                           {isPrinting ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />}
                           Print Z-Report
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-10 opacity-40">
             <AlertTriangle size={16} />
             <p className="text-[10px] font-black uppercase tracking-widest">Only Oga or Manager should perform the closing ritual</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ClosingReport;
