
import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { 
  MessageSquare, 
  ClipboardPaste, 
  Share2, 
  CheckCircle2, 
  AlertCircle,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  Info,
  ArrowRightLeft,
  Copy,
  Check
} from 'lucide-react';
import { Staff, View } from '../types';
import { exportDataForWhatsApp, importWhatsAppBridgeData } from '../services/syncService';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface SyncStationProps {
  currentUser?: Staff | null;
  setView: (view: View) => void;
}

const SyncStation: React.FC<SyncStationProps> = ({ currentUser, setView }) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    db.settings.get('app_settings').then(setSettings);
  }, []);

  const handleExport = async () => {
    if (!settings?.sync_key) return alert("Sync Key missing.");
    setIsProcessing(true);
    try {
      const type = isAdmin ? 'STOCK' : 'SALES';
      const compressed = await exportDataForWhatsApp(type, settings.sync_key);
      const magicLink = `${window.location.origin}/?importData=${compressed}`;
      
      const message = isAdmin 
        ? `📦 NAIJASHOP STOCK UPDATE (${new Date().toLocaleDateString()}):\n\nStaff, click this link to update your inventory:\n${magicLink}`
        : `💰 NAIJASHOP SALES REPORT (${new Date().toLocaleDateString()}):\n\nBoss, click this link to import my sales:\n${magicLink}`;
      
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      
      if (!isAdmin) {
        // Mark pending sales as synced after export (optional: maybe wait for confirmation?)
        // For simplicity, we assume they'll reach the boss
        const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
        for (const sale of pendingSales) {
          await db.sales.update(sale.id!, { sync_status: 'synced' });
        }
      }
    } catch (e) {
      alert("Export Failed: " + e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!manualInput.trim()) return;
    if (!settings?.sync_key) return alert("Sync Key missing.");
    setIsProcessing(true);
    try {
      const result = await importWhatsAppBridgeData(manualInput.trim(), settings.sync_key);
      if (result.success) {
        alert(`Import Successful!\n${result.type === 'SALES' ? `${result.count} Sales Processed` : `${result.count} Products Updated`}`);
        setManualInput('');
        if (result.type === 'STOCK') setView('dashboard');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const copySyncKey = () => {
    if (settings?.sync_key) {
      navigator.clipboard.writeText(settings.sync_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-40px] bottom-[-40px] opacity-10">
          <MessageSquare size={240} />
        </div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="w-16 h-16 bg-white rounded-2xl p-2 flex items-center justify-center">
            <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tight">WhatsApp Bridge</h2>
            <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">
              Manual Data Sync Station
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Export Card */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-800">Export Terminal Data</h3>
            <p className="text-slate-500 text-sm">
              {isAdmin ? "Send latest stock list to Staff devices." : "Send pending sales to the Boss."}
            </p>
          </div>

          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4">
             <div className="flex items-center gap-3 text-emerald-600">
                <ShieldCheck size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">End-to-End Obfuscated</span>
             </div>
             <button 
                onClick={handleExport}
                disabled={isProcessing}
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
             >
                <Share2 size={24} />
                {isAdmin ? "Send Stock Update" : "Send Sales to Boss"}
             </button>
          </div>
        </div>

        {/* Import Card */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-800">Process Import Code</h3>
            <p className="text-slate-500 text-sm">Paste the magic code received on WhatsApp here.</p>
          </div>

          <div className="space-y-4">
            <textarea 
              className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[10px] outline-none focus:ring-2 focus:ring-emerald-500" 
              placeholder="Paste data bridge string here..." 
              value={manualInput} 
              onChange={(e) => setManualInput(e.target.value)} 
            />
            <button 
              onClick={handleImport} 
              disabled={isProcessing || !manualInput} 
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black active:scale-95 flex items-center justify-center gap-3"
            >
              <ClipboardPaste size={24} /> 
              Process Import
            </button>
          </div>
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center gap-8">
         <div className="p-4 bg-white rounded-2xl shadow-sm text-amber-600">
            <ShieldCheck size={48} />
         </div>
         <div className="flex-1 space-y-2">
            <h4 className="text-lg font-black text-amber-800">Security & Encryption</h4>
            <p className="text-sm text-amber-700 leading-relaxed">
              Data sent via the WhatsApp Bridge is compressed and encrypted using your unique <b>Sync Key</b>. 
              Only terminals with the same key can decode the information.
            </p>
            <div className="flex items-center gap-4 pt-2">
               <div className="bg-white border border-amber-200 px-4 py-2 rounded-xl flex items-center gap-2">
                  <code className="text-xs font-black text-slate-600">{settings?.sync_key}</code>
                  <button onClick={copySyncKey} className="text-amber-600 hover:text-amber-700">
                    {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                  </button>
               </div>
               <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Master Sync Key</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default SyncStation;
