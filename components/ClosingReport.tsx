import React, { useState, useMemo } from 'react';
import { 
  Lock, 
  Moon, 
  CheckCircle2, 
  MessageSquare, 
  X, 
  TrendingUp, 
  LogOut,
  Loader2,
  Share2
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { generateBackupData } from '../utils/backup';
import { exportDataForWhatsApp } from '../services/syncService';
import BluetoothPrintService from '../services/BluetoothPrintService';
import WhatsAppService from '../services/WhatsAppService';
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

  const isSales = currentUser?.role === 'Sales';

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
      totalSales: sales.reduce((sum, s) => sum + s.total_amount, 0)
    };

    sales.forEach(sale => {
      const method = sale.payment_method.toLowerCase();
      if (method === 'cash') stats.cash += sale.total_amount;
      else if (method.includes('transfer')) stats.transfer += sale.total_amount;
      else if (method === 'pos') stats.pos += sale.total_amount;
    });

    return {
      ...stats,
      netTakeHome: stats.totalSales - stats.expenses
    };
  }, [sales, expenses]);

  const handleStaffReport = async () => {
    if (!settings?.sync_key) { alert("Security Key missing."); return; }
    setIsFinalizing(true);
    try {
      const result = await exportDataForWhatsApp('SALES', settings.sync_key, currentUser?.name);
      const text = `🏁 Daily Sales Report from ${currentUser?.name}.\n\nCode:\n${result.raw}\n\nPlease import to update Master Stock.`;
      await WhatsAppService.send(text, settings, 'DIRECT_REPORT');
      setBackupDone(true);
      setShowSuccess(true);
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
    setTimeout(() => { setShowSuccess(true); setIsFinalizing(false); }, 1500);
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-[2000] bg-emerald-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8">
          <Moon size={64} className="text-emerald-900" />
        </div>
        <h2 className="text-5xl font-black text-white">{isSales ? 'Report Sent' : 'Shop Closed'}</h2>
        <button onClick={onLogout} className="mt-8 px-10 py-5 bg-white text-emerald-900 rounded-[2rem] font-black text-xl flex items-center gap-3">Log Out</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1500] bg-slate-50 flex flex-col animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">
      <header className="bg-emerald-900 p-8 text-white flex items-center justify-between shrink-0">
        <h2 className="text-3xl font-black">Daily Closing</h2>
        <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-full"><X size={32} /></button>
      </header>
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-emerald-900 rounded-[3rem] p-10 text-white text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Total Sales Volume</p>
            <h3 className="text-6xl font-black">₦{summary.totalSales.toLocaleString()}</h3>
          </div>
          <button onClick={handleFinalize} disabled={isFinalizing} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">
            {isFinalizing ? <Loader2 className="animate-spin" size={24} /> : <Lock size={24} />} Finalize Closing
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClosingReport;