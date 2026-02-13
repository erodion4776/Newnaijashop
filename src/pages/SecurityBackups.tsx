import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import LZString from 'lz-string';
import { 
  ShieldCheck, 
  Database, 
  MessageSquare, 
  Download, 
  Upload, 
  Share2, 
  Loader2, 
  Copy,
  CheckCircle2,
  Zap,
  RefreshCw,
  FileUp,
  MessageSquareCode,
  Save,
  ShieldAlert,
  Send,
  History
} from 'lucide-react';
import { Staff, Settings as SettingsType } from '../types';
import { generateBackupData, restoreFromBackup, downloadBackupFile, performAutoSnapshot } from '../utils/backup';
import WhatsAppService from '../services/WhatsAppService';

const SYNC_HEADER = "NS_V2_";

/**
 * Local XOR Cipher to salt the data with the Master Security Key
 */
const xorCipher = (text: string, key: string): string => {
  if (!key) return text;
  return text.split('').map((char, i) => 
    String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join('');
};

const SecurityBackups: React.FC<{ currentUser?: Staff | null }> = ({ currentUser }) => {
  // Fail-Safe Role Check
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';
  const isStaff = !isAdmin;

  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [importString, setImportString] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data Loading with Guard
  const settings = useLiveQuery(() => db.settings.get('app_settings')) as SettingsType | undefined;
  
  const [formData, setFormData] = useState({
    admin_whatsapp_number: '',
    whatsapp_group_link: ''
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        admin_whatsapp_number: settings?.admin_whatsapp_number || '',
        whatsapp_group_link: settings?.whatsapp_group_link || ''
      });
    }
  }, [settings]);

  // Loading State Spinner
  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
        <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Loading Vault...</p>
      </div>
    );
  }

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleUpdateAutomation = async () => {
    setIsProcessing(true);
    try {
      await db.settings.update('app_settings', {
        admin_whatsapp_number: formData.admin_whatsapp_number.replace(/\D/g, ''),
        whatsapp_group_link: formData.whatsapp_group_link.trim()
      });
      showSuccess("Automation Links Updated!");
    } catch (err) {
      console.error(err);
      alert("Failed to update links. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateShopKey = async () => {
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
      const part = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
      const newKey = `NS-${part()}-${part()}`;
      await db.settings.update('app_settings', { sync_key: newKey });
      showSuccess("Security Key Generated!");
    } catch (e) {
      alert("Error generating key.");
    }
  };

  const handleWhatsAppBackup = async () => {
    setIsProcessing(true);
    try {
      const data = await generateBackupData();
      const text = `📦 NAIJASHOP BACKUP - ${new Date().toLocaleDateString()}\n\nCopy this code to restore:\n\n${data}`;
      await WhatsAppService.send(text, settings, 'DIRECT_REPORT');
      showSuccess("Backup Sent!");
    } catch (e) {
      alert("Failed to send backup to WhatsApp.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBroadcastStock = async () => {
    if (!settings?.sync_key) { 
      alert("Security Key missing. Please generate one first."); 
      return; 
    }

    setIsSyncing(true);
    try {
      const { exportDataForWhatsApp: exportFn } = await import('../services/syncService');
      const result = await exportFn('STOCK', settings.sync_key, currentUser?.name);
      
      if (result.raw !== "FILE_DOWNLOADED") {
        const text = result.summary.replace('[CompressedJSON]', result.raw);
        await WhatsAppService.send(text, settings, 'GROUP_UPDATE');
        showSuccess("Stock Broadcast Sent!");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate broadcast code.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStaffSendReport = async () => {
    if (!settings?.sync_key) { alert("Security Key missing. Contact Boss."); return; }
    setIsSyncing(true);
    try {
      const { exportDataForWhatsApp: exportFn } = await import('../services/syncService');
      const result = await exportFn('SALES', settings.sync_key, currentUser?.name);
      const text = `🏁 Daily Sales Report from ${currentUser?.name}.\n\nCode:\n${result.raw}\n\nPlease import to update Master Stock.`;
      await WhatsAppService.send(text, settings, 'DIRECT_REPORT');
      showSuccess("Report Sent to Boss!");
    } catch (e) {
      alert("Sync failed. Check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const snapshotTs = localStorage.getItem('naijashop_snapshot_ts');

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {success && (
        <div className="fixed top-4 right-4 z-[200] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle2 size={20} /> <span className="font-bold">{success}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10"><ShieldCheck size={180} /></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black">Security & Backup</h2>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">
            {isAdmin ? 'Master Control Station' : 'Terminal Records Portal'}
          </p>
        </div>
      </div>

      {/* SECTION 1: EXPORT / DOWNLOAD */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Download size={24} /></div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">Export Records</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isAdmin ? (
            <>
              <button 
                onClick={handleWhatsAppBackup} 
                disabled={isProcessing}
                className="py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
              >
                <MessageSquare size={24} /> Backup to WhatsApp
              </button>
              <button 
                onClick={() => downloadBackupFile(settings?.shop_name || 'Store')}
                className="py-6 bg-slate-50 text-slate-700 border border-slate-200 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <Download size={24} /> Download .nshop File
              </button>
              <button 
                onClick={handleBroadcastStock}
                disabled={isSyncing}
                className="md:col-span-2 py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
              >
                {isSyncing ? <Loader2 className="animate-spin" /> : <Send size={24} />} 🚀 Broadcast Master Stock
              </button>
            </>
          ) : (
            <button 
              onClick={handleStaffSendReport} 
              disabled={isSyncing}
              className="md:col-span-2 py-8 bg-emerald-600 text-white rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 shadow-2xl active:scale-95 transition-all"
            >
              {isSyncing ? <Loader2 className="animate-spin" /> : <MessageSquare size={32} />}
              📤 Send Today's Sales to Boss
            </button>
          )}
        </div>
      </div>

      {/* SECTION 2: WHATSAPP CONFIGURATION (Admin Only) */}
      {isAdmin && (
        <div className="bg-white p-8 rounded-[3rem] border border-emerald-100 shadow-xl space-y-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><MessageSquareCode size={24} /></div>
              <div>
                <h3 className="text-xl font-black text-slate-800">WhatsApp Configuration</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Routing Automations</p>
              </div>
            </div>
            <button 
              onClick={handleUpdateAutomation} 
              disabled={isProcessing}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all flex items-center gap-2"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Save size={16} />} Update Links
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Owner WhatsApp Number</label>
              <input 
                type="text" 
                placeholder="e.g. 2348184774884" 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                value={formData?.admin_whatsapp_number || ''} 
                onChange={e => setFormData({...formData, admin_whatsapp_number: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Staff Group Link</label>
              <input 
                type="text" 
                placeholder="https://chat.whatsapp.com/..." 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                value={formData?.whatsapp_group_link || ''} 
                onChange={e => setFormData({...formData, whatsapp_group_link: e.target.value})} 
              />
            </div>
          </div>

          {!settings?.sync_key && (
            <div className="pt-4 border-t border-slate-100">
               <button 
                onClick={generateShopKey}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3"
               >
                 <Zap size={18} /> Generate Master Security Key
               </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: RESTORE SYSTEM / INPUT */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Upload size={24} /></div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">
            {isAdmin ? 'Process Staff Sales' : 'Receive Stock Update'}
          </h3>
        </div>
        
        <div className="space-y-6">
          <p className="text-sm text-slate-500 font-medium">
            {isAdmin 
              ? 'Paste the sales code received from your staff to update your shop ledger.' 
              : 'Paste the master update code from your Oga below to update your stock levels.'}
          </p>
          
          <textarea 
            placeholder="Paste code here..." 
            className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl font-mono text-[10px] h-32 outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-inner" 
            value={importString} 
            onChange={e => setImportString(e.target.value)} 
          />

          <button 
            onClick={async () => {
              if (!importString.trim()) return;
              setIsSyncing(true);
              try {
                const { importWhatsAppBridgeData: importFn } = await import('../services/syncService');
                const result = await importFn(importString.trim(), settings?.sync_key || '');
                showSuccess(`Processing Success! Result: ${result.type}`);
                setImportString('');
                if (result.type === 'STOCK') {
                  setTimeout(() => alert("Inventory Updated! Refreshing terminal..."), 500);
                  setTimeout(() => window.location.reload(), 2000);
                }
              } catch(e: any) {
                alert("Import Error: " + (e.message || "Invalid code or key mismatch."));
              } finally {
                setIsSyncing(false);
              }
            }} 
            disabled={!importString.trim() || isSyncing}
            className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="animate-spin" /> : <Database size={20} />}
            {isAdmin ? '✅ Sync Records to Ledger' : '📥 Update My Stock'}
          </button>
        </div>
      </div>

      {/* Snapshot Footer */}
      <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6">
         <History size={32} className="text-emerald-600 shrink-0" />
         <div className="flex-1 text-center md:text-left">
            <h4 className="font-black text-slate-800">Local Snapshot System</h4>
            {snapshotTs && <p className="text-[10px] text-emerald-600 font-black uppercase">Last Auto-Save: {new Date(parseInt(snapshotTs)).toLocaleString()}</p>}
         </div>
         <button onClick={async () => { await performAutoSnapshot(); showSuccess("Snapshot captured!"); }} className="px-6 py-3 bg-white border border-emerald-200 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm">Capture Now</button>
      </div>
    </div>
  );
};

export default SecurityBackups;