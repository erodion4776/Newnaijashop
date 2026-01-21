
import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { 
  MessageSquare, 
  ClipboardPaste, 
  Share2, 
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Lock,
  Loader2
} from 'lucide-react';
import { Staff, View } from '../types';
import { exportDataForWhatsApp, importWhatsAppBridgeData, generateSyncKey } from '../services/syncService';

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
      alert("Sync Success!");
      setManualInput('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!settings) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
        <h2 className="text-4xl font-black">Sync Station</h2>
        <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px]">Secure Bridge</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 space-y-6">
          <h3 className="text-2xl font-black">Export</h3>
          <button onClick={handleExport} disabled={isProcessing} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3">
            <Share2 size={24} /> {isAdmin ? "Send Stock Update" : "Send Sales to Boss"}
          </button>
        </div>
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 space-y-6">
          <h3 className="text-2xl font-black">Import</h3>
          <textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-[10px]" rows={5} value={manualInput} onChange={e => setManualInput(e.target.value)} />
          <button onClick={handleImport} disabled={isProcessing || !manualInput} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3">
            <ClipboardPaste size={24} /> Process Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncStation;
