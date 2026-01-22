
import React, { useState } from 'react';
import { 
  Database, 
  Download, 
  Share2, 
  Upload, 
  CheckCircle2, 
  Loader2, 
  Lock,
  History,
  AlertTriangle,
  RefreshCw,
  Zap,
  MessageSquare
} from 'lucide-react';
import { Staff } from '../types';
import { generateBackupData, restoreFromBackup, downloadBackupFile, performAutoSnapshot } from '../utils/backup';

const SecurityBackups: React.FC<{ currentUser?: Staff | null }> = ({ currentUser }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [importString, setImportString] = useState('');

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    await downloadBackupFile(currentUser?.name || 'Store');
    setIsProcessing(false);
    showSuccess("Backup File Downloaded!");
  };

  const handleWhatsAppBackup = async () => {
    setIsProcessing(true);
    const data = await generateBackupData();
    const text = `📦 NAIJASHOP BACKUP - ${new Date().toLocaleDateString()}\n\nCopy this code to restore your terminal:\n\n${data}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setIsProcessing(false);
  };

  const handleRestore = async () => {
    if (!importString.trim()) return;
    if (!confirm("RESTORE WARNING: This will overwrite ALL current local data with the backup contents. Proceed?")) return;
    
    setIsProcessing(true);
    const result = await restoreFromBackup(importString.trim());
    setIsProcessing(false);
    
    if (result) {
      alert("Restore Successful! The app will now reload.");
      window.location.reload();
    } else {
      alert("Restore Failed. The backup data may be invalid.");
    }
  };

  const snapshotTs = localStorage.getItem('naijashop_snapshot_ts');

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {success && (
        <div className="fixed top-4 right-4 z-[200] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle2 size={20} /> <span className="font-bold">{success}</span>
        </div>
      )}

      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <Database size={180} />
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black">Security & Backups</h2>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">Single Device Safeguard System</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Download size={24} /></div>
             <h3 className="text-xl font-black text-slate-800">Export Data</h3>
          </div>
          <p className="text-sm text-slate-500 font-medium">Protect your business by saving a copy of all products and sales locally or to WhatsApp.</p>
          <div className="space-y-3">
            <button 
              onClick={handleDownload}
              disabled={isProcessing}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95"
            >
              <Download size={20} /> Download .nshop File
            </button>
            <button 
              onClick={handleWhatsAppBackup}
              disabled={isProcessing}
              className="w-full py-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-emerald-100 transition-all active:scale-95"
            >
              <MessageSquare size={20} /> Send to My WhatsApp
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Upload size={24} /></div>
             <h3 className="text-xl font-black text-slate-800">Restore System</h3>
          </div>
          <textarea 
            placeholder="Paste your backup code here..."
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[10px] outline-none focus:ring-2 focus:ring-indigo-500 h-24"
            value={importString}
            onChange={e => setImportString(e.target.value)}
          />
          <button 
            onClick={handleRestore}
            disabled={isProcessing || !importString}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95"
          >
            <Zap size={20} /> Perform Recovery
          </button>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6">
         <div className="w-16 h-16 bg-white text-emerald-600 rounded-3xl flex items-center justify-center shadow-sm">
            <History size={32} />
         </div>
         <div className="flex-1 text-center md:text-left">
            <h4 className="font-black text-slate-800">Auto-Snapshot System</h4>
            <p className="text-sm text-slate-500 font-medium">The terminal automatically captures a local snapshot every 10 sales for emergency recovery.</p>
            {snapshotTs && (
              <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-2">Last Snapshot: {new Date(parseInt(snapshotTs)).toLocaleString()}</p>
            )}
         </div>
         <button 
           onClick={async () => { await performAutoSnapshot(); showSuccess("Snapshot captured!"); }}
           className="px-6 py-3 bg-white border border-emerald-200 text-emerald-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all"
         >
           Force Snapshot
         </button>
      </div>

      <div className="text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
          <Lock size={12} /> Secure Local Encryption Active
        </p>
      </div>
    </div>
  );
};

export default SecurityBackups;
