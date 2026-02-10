import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Database, 
  Download, 
  Upload, 
  CheckCircle2, 
  Loader2, 
  Lock,
  History,
  Zap,
  MessageSquare,
  FileUp,
  MessageSquareCode,
  Users,
  Save,
  Send
} from 'lucide-react';
import { Staff, Settings as SettingsType } from '../types';
import { generateBackupData, restoreFromBackup, downloadBackupFile, performAutoSnapshot } from '../utils/backup';
import { exportDataForWhatsApp } from '../services/syncService';
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

  const handleDownload = async () => {
    setIsProcessing(true);
    await downloadBackupFile(currentUser?.name || 'Store');
    setIsProcessing(false);
    showSuccess("Backup Downloaded!");
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

  const handlePushUpdate = async () => {
    if (!settings?.sync_key) { alert("Security Key missing."); return; }
    setIsSyncing(true);
    try {
      const result = await exportDataForWhatsApp('STOCK', settings.sync_key, currentUser?.name);
      if (result.raw !== "FILE_DOWNLOADED") {
        const text = result.summary.replace('[CompressedJSON]', result.raw);
        await WhatsAppService.send(text, settings, 'GROUP_UPDATE');
        showSuccess("Inventory Pushed!");
      }
    } finally { setIsSyncing(false); }
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

  const isAdmin = currentUser?.role === 'Admin';
  const snapshotTs = localStorage.getItem('naijashop_snapshot_ts');

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {success && (
        <div className="fixed top-4 right-4 z-[200] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle2 size={20} /> <span className="font-bold">{success}</span>
        </div>
      )}

      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10"><Database size={180} /></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black">Security & Backups</h2>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">Safeguard Your Business</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Download size={24} /></div>
             <h3 className="text-xl font-black text-slate-800">Export Records</h3>
          </div>
          <div className="space-y-3">
            <button onClick={handleWhatsAppBackup} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95"><MessageSquare size={20} /> Send to My WhatsApp</button>
            <button onClick={handleDownload} disabled={isProcessing} className="w-full py-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl font-black flex items-center justify-center gap-3"><Download size={20} /> Download .nshop File</button>
            {isAdmin && <button onClick={handlePushUpdate} disabled={isSyncing} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-3"><Send size={20} /> Push Update to All</button>}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Upload size={24} /></div>
             <h3 className="text-xl font-black text-slate-800">Restore System</h3>
          </div>
          <div className="space-y-4">
            <input type="file" ref={fileInputRef} className="hidden" accept=".nshop,.json" onChange={e => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = ev => executeRestore(ev.target?.result as string); r.readAsText(f); } }} />
            <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-black flex items-center justify-center gap-3"><FileUp size={20} /> Upload .nshop File</button>
            <textarea placeholder="Paste backup code here..." className="w-full p-4 bg-slate-50 border rounded-2xl font-mono text-[10px] h-24" value={importString} onChange={e => setImportString(e.target.value)} />
            <button onClick={() => executeRestore(importString)} disabled={!importString} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3"><Zap size={20} /> Perform Recovery</button>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3rem] border border-emerald-100 shadow-xl space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><MessageSquareCode size={24} /></div>
            <div>
              <h3 className="text-xl font-black text-slate-800">WhatsApp Sync Automation</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Direct reporting links</p>
            </div>
          </div>
          <button onClick={handleUpdateAutomation} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all"><Save size={16} className="inline mr-1"/> Update Links</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Owner WhatsApp Number</label>
            <input type="text" placeholder="e.g. 2348184774884" className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-bold" value={automationData.admin_whatsapp_number} onChange={e => setAutomationData({...automationData, admin_whatsapp_number: e.target.value.replace(/\D/g, '')})} />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Staff Group Link</label>
            <input type="text" placeholder="https://chat.whatsapp.com/..." className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-bold" value={automationData.whatsapp_group_link} onChange={e => setAutomationData({...automationData, whatsapp_group_link: e.target.value})} />
          </div>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6">
         <History size={32} className="text-emerald-600 shrink-0" />
         <div className="flex-1 text-center md:text-left">
            <h4 className="font-black text-slate-800">Auto-Snapshot System</h4>
            {snapshotTs && <p className="text-[10px] text-emerald-600 font-black uppercase">Last: {new Date(parseInt(snapshotTs)).toLocaleString()}</p>}
         </div>
         <button onClick={async () => { await performAutoSnapshot(); showSuccess("Snapshot captured!"); }} className="px-6 py-3 bg-white border border-emerald-200 text-emerald-600 rounded-xl font-black text-xs">Force Snapshot</button>
      </div>
    </div>
  );
};

export default SecurityBackups;