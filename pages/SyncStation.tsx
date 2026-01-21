import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { 
  ClipboardPaste, 
  Share2, 
  RefreshCw,
  Loader2,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { Staff, View } from '../types';
import { exportDataForWhatsApp, importWhatsAppBridgeData } from '../services/syncService';

interface SyncStationProps {
  currentUser?: Staff | null;
  setView: (view: View) => void;
}

const SyncStation: React.FC<SyncStationProps> = ({ currentUser, setView }) => {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  const fetchSettings = async () => {
    const s = await db.settings.get('app_settings');
    setSettings(s);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleExport = async () => {
    if (!settings?.sync_key) return;
    setIsProcessing(true);
    try {
      const type = isAdmin ? 'STOCK' : 'SALES';
      const compressed = await exportDataForWhatsApp(type, settings.sync_key);
      const magicLink = `${window.location.origin}/?importData=${compressed}`;
      const message = `🏪 NAIJASHOP UPDATE:\n\nClick link to sync:\n${magicLink}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!manualInput.trim() || !settings?.sync_key) return;
    setIsProcessing(true);
    try {
      const result = await importWhatsAppBridgeData(manualInput.trim(), settings.sync_key);
      if (result.type === 'KEY_UPDATE') {
        alert("Security Bridge Updated! Your keys are now aligned with the Admin.");
        fetchSettings();
      } else {
        alert("Sync Success!");
      }
      setManualInput('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!settings) return null;

  const keyFingerprint = settings.sync_key ? settings.sync_key.substring(0, 5) : 'NONE';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <ShieldCheck size={180} />
        </div>
        <h2 className="text-4xl font-black">Sync Station</h2>
        <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px]">Secure Bridge Terminal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 space-y-6 flex flex-col">
          <div className="flex-1 space-y-4">
             <h3 className="text-2xl font-black text-slate-800">Export</h3>
             <p className="text-sm text-slate-500 font-medium">Send local data to the other terminal via WhatsApp.</p>
          </div>
          <button onClick={handleExport} disabled={isProcessing} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all">
            {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Share2 size={24} />} 
            {isAdmin ? "Send Stock Update" : "Send Sales to Boss"}
          </button>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 space-y-6">
          <h3 className="text-2xl font-black text-slate-800">Manual Import</h3>
          <textarea 
            placeholder="Paste sync string here..."
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[10px] outline-none focus:ring-2 focus:ring-slate-400" 
            rows={5} 
            value={manualInput} 
            onChange={e => setManualInput(e.target.value)} 
          />
          <button onClick={handleImport} disabled={isProcessing || !manualInput} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
            <ClipboardPaste size={24} /> Process Import
          </button>
        </div>
      </div>

      <div className="text-center pt-8">
        <div className="inline-flex items-center gap-3 bg-slate-100 px-6 py-2.5 rounded-full border border-slate-200">
           <Lock size={14} className="text-slate-400" />
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
             Security Fingerprint: <span className="text-emerald-600 ml-1">{keyFingerprint}...</span>
           </span>
        </div>
        <p className="text-[9px] text-slate-400 font-bold mt-3 uppercase tracking-wider">
          Admins and Staff should have the same fingerprint for successful sync.
        </p>
      </div>
    </div>
  );
};

export default SyncStation;