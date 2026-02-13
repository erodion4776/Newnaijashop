import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Database, 
  Download, 
  Upload, 
  CheckCircle2, 
  Loader2, 
  Zap, 
  MessageSquare,
  FileUp,
  MessageSquareCode,
  Save,
  Send,
  ShieldCheck,
  ShieldAlert,
  ClipboardPaste,
  RefreshCw,
  Users,
  Clock
} from 'lucide-react';
import { Staff, Settings as SettingsType } from '../types';
import { generateBackupData, restoreFromBackup, downloadBackupFile } from '../utils/backup';
import { exportDataForWhatsApp, importWhatsAppBridgeData } from '../services/syncService';
import WhatsAppService from '../services/WhatsAppService';

const SecurityBackups: React.FC<{ currentUser?: Staff | null }> = ({ currentUser }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [importString, setImportString] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settings = useLiveQuery(() => db.settings.get('app_settings')) as SettingsType | undefined;
  const [automationData, setAutomationData] = useState({
    admin_whatsapp_number: '',
    whatsapp_group_link: ''
  });

  const lastSyncTs = localStorage.getItem('last_sync_timestamp');

  useEffect(() => {
    if (settings) {
      setAutomationData({
        admin_whatsapp_number: settings.admin_whatsapp_number || '',
        whatsapp_group_link: settings.whatsapp_group_link || ''
      });
    }
  }, [settings]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleUpdateAutomation = async () => {
    setIsProcessing(true);
    try {
      await db.settings.update('app_settings', {
        admin_whatsapp_number: automationData.admin_whatsapp_number.replace(/\D/g, ''),
        whatsapp_group_link: automationData.whatsapp_group_link.trim()
      });
      showSuccess("Automation Links Updated!");
    } catch (err) {
      alert("Failed to update links");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateShopKey = async () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    const part = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const newKey = `NS-${part()}-${part()}`;
    await db.settings.update('app_settings', { sync_key: newKey });
    showSuccess("Security Key Generated!");
  };

  const handleWhatsAppBackup = async () => {
    setIsProcessing(true);
    try {
      const data = await generateBackupData();
      const text = `📦 NAIJASHOP BACKUP - ${new Date().toLocaleDateString()}\n\nCopy this code to restore:\n\n${data}`;
      await WhatsAppService.send(text, settings, 'DIRECT_REPORT');
      showSuccess("Backup Sent!");
    } catch (e) {
      alert("Failed to send");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePushMasterStock = async () => {
    if (!settings?.sync_key) { alert("Security Key missing. Visit Settings to set one."); return; }
    setIsSyncing(true);
    try {
      const result = await exportDataForWhatsApp('STOCK', settings.sync_key, currentUser?.name);
      if (result.raw !== "FILE_DOWNLOADED") {
        const text = result.summary.replace('[CompressedJSON]', result.raw);
        await WhatsAppService.send(text, settings, 'GROUP_UPDATE');
        showSuccess("Master Update Sent!");
      }
    } finally { setIsSyncing(false); }
  };

  const handleStaffSendReport = async () => {
    if (!settings?.sync_key) { alert("Security Key missing."); return; }
    setIsSyncing(true);
    try {
      const result = await exportDataForWhatsApp('SALES', settings.sync_key, currentUser?.name);
      if (result.raw !== "FILE_DOWNLOADED") {
        const text = result.summary.replace('[CompressedJSON]', result.raw);
        await WhatsAppService.send(text, settings, 'DIRECT_REPORT');
        showSuccess("Report Sent to Boss!");
      }
    } finally { setIsSyncing(false); }
  };

  const executeImport = async () => {
    if (!importString.trim() || !settings?.sync_key) return;
    setIsSyncing(true);
    try {
      const result = await importWhatsAppBridgeData(importString.trim(), settings.sync_key);
      if (result.type === 'STOCK') {
        showSuccess("Stock Updated from Boss!");
      } else {
        showSuccess(`Sync Success! Processed ${result.count || 0} items.`);
      }
      setImportString('');
    } catch (e: any) {
      alert("Import Failed: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const executeRestore = async (data: string) => {
    if (!data.trim() || !confirm("RESTORE WARNING: This will overwrite ALL local data. Proceed?")) return;
    setIsProcessing(true);
    const result = await restoreFromBackup(data.trim());
    setIsProcessing(false);
    if (result) {
      alert("Restore Successful! App will reload.");
      window.location.reload();
    } else alert("Restore Failed.");
  };

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const isStaff = currentUser?.role === 'Sales';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {success && (
        <div className="fixed top-4 right-4 z-[200] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle2 size={20} /> <span className="font-bold">{success}</span>
        </div>
      )}

      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10"><ShieldCheck size={180} /></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black">WhatsApp Sync Station</h2>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">
            {isStaff ? 'Terminal Records' : 'Master Control Station'}
          </p>
        </div>
      </div>

      {!settings?.sync_key && isAdmin && (
        <div className="bg-amber-50 border-2 border-dashed border-amber-300 p-8 rounded-[2.5rem] text-center space-y-4">
          <ShieldAlert className="mx-auto text-amber-600" size={48} />
          <h3 className="text-xl font-black text-amber-900">Security Key Missing</h3>
          <p className="text-amber-800 font-medium">Both Boss and Staff must use the same key to sync data securely.</p>
          <button onClick={generateShopKey} className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-3 mx-auto shadow-xl">
            <Zap size={20} /> 🔐 Generate My Shop Security Key
          </button>
        </div>
      )}

      {/* STAFF VIEW */}
      {isStaff && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[3rem] border-4 border-emerald-100 shadow-xl space-y-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
              <Send size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800">Submit Daily Work</h3>
              <p className="text-slate-500 font-medium">Send today's sales to your Oga's phone instantly.</p>
            </div>
            <button 
              onClick={handleStaffSendReport} 
              disabled={isSyncing}
              className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all"
            >
              {isSyncing ? <Loader2 className="animate-spin" /> : <MessageSquare size={24} />}
              📤 Send Today's Sales to Boss
            </button>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6 flex flex-col">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><RefreshCw size={24} /></div>
                 <h3 className="text-xl font-black text-slate-800">Receive Stock</h3>
               </div>
               {lastSyncTs && (
                 <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Last Updated</p>
                    <p className="text-[10px] font-bold text-indigo-600">{new Date(parseInt(lastSyncTs)).toLocaleDateString()}</p>
                 </div>
               )}
            </div>
            <p className="text-sm text-slate-500 font-medium">Paste the stock update code from your Oga below.</p>
            <textarea 
              placeholder="Paste master update code here..." 
              className="w-full p-4 bg-slate-50 border rounded-2xl font-mono text-[10px] h-24 outline-none focus:ring-2 focus:ring-indigo-500" 
              value={importString} 
              onChange={e => setImportString(e.target.value)} 
            />
            <button 
              onClick={executeImport} 
              disabled={!importString || isSyncing}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95"
            >
              {isSyncing ? <Loader2 className="animate-spin" /> : <ClipboardPaste size={20} />}
              📥 Update My Stock
            </button>
          </div>
        </div>
      )}

      {/* ADMIN VIEW */}
      {isAdmin && settings?.sync_key && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[3rem] border-4 border-indigo-100 shadow-xl space-y-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <RefreshCw size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800">Broadcast Stock</h3>
              <p className="text-slate-500 font-medium">Update prices and items on all staff phones at once.</p>
            </div>
            <button 
              onClick={handlePushMasterStock} 
              disabled={isSyncing}
              className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all"
            >
              {isSyncing ? <Loader2 className="animate-spin" /> : <Send size={24} />}
              🚀 Send Master Stock to Staff
            </button>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Users size={24} /></div>
              <h3 className="text-xl font-black text-slate-800">Process Staff Sales</h3>
            </div>
            <p className="text-sm text-slate-500 font-medium">Paste the sales code received from your staff to update ledger.</p>
            <textarea 
              placeholder="Paste sales code here..." 
              className="w-full p-4 bg-slate-50 border rounded-2xl font-mono text-[10px] h-24 outline-none focus:ring-2 focus:ring-emerald-500" 
              value={importString} 
              onChange={e => setImportString(e.target.value)} 
            />
            <button 
              onClick={executeImport} 
              disabled={!importString || isSyncing}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95"
            >
              {isSyncing ? <Loader2 className="animate-spin" /> : <Database size={20} />}
              ✅ Sync Records to Ledger
            </button>
          </div>
        </div>
      )}

      {/* AUTOMATION CONFIG (ADMIN ONLY) */}
      {isAdmin && (
        <div className="bg-white p-8 rounded-[3rem] border border-emerald-100 shadow-xl space-y-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><MessageSquareCode size={24} /></div>
              <div>
                <h3 className="text-xl font-black text-slate-800">WhatsApp Sync Automation</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Configuring destination links</p>
              </div>
            </div>
            <button onClick={handleUpdateAutomation} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all"><Save size={16} className="inline mr-1"/> Update Links</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Boss WhatsApp Number (for Staff Reports)</label>
              <input type="text" placeholder="e.g. 2348184774884" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={automationData.admin_whatsapp_number} onChange={e => setAutomationData({...automationData, admin_whatsapp_number: e.target.value.replace(/\D/g, '')})} />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Staff Group Link (for Master Updates)</label>
              <input type="text" placeholder="https://chat.whatsapp.com/..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={automationData.whatsapp_group_link} onChange={e => setAutomationData({...automationData, whatsapp_group_link: e.target.value})} />
            </div>
          </div>
        </div>
      )}

      {/* LEGACY BACKUP OPTIONS (ADMIN ONLY) */}
      {isAdmin && (
        <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200 space-y-6">
          <h3 className="text-lg font-black text-slate-800">Legacy Backup Tools</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={handleWhatsAppBackup} className="py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-sm"><MessageSquare size={16}/> Self Backup</button>
            <button onClick={() => downloadBackupFile(settings?.shop_name || 'Store')} className="py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-sm"><Download size={16}/> Download File</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityBackups;
