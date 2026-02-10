import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
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
  MessageSquare,
  FileUp,
  MessageSquareCode,
  Users,
  Settings,
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

  // WhatsApp Automation State
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
      alert("Failed to update automation links");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    await downloadBackupFile(currentUser?.name || 'Store');
    setIsProcessing(false);
    showSuccess("Backup File Downloaded!");
  };

  const handleWhatsAppBackup = async () => {
    setIsProcessing(true);
    try {
      const data = await generateBackupData();
      const text = `📦 NAIJASHOP BACKUP - ${new Date().toLocaleDateString()}\n\nCopy this code to restore your terminal:\n\n${data}`;
      
      // STRICT INSTRUCTION: Uses stored admin_whatsapp_number
      await WhatsAppService.send(text, settings, 'DIRECT_REPORT');
      showSuccess("Backup sent to WhatsApp!");
    } catch (e) {
      alert("Failed to send backup");
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
        // STRICT INSTRUCTION: Uses stored whatsapp_group_link via WhatsAppService
        await WhatsAppService.send(text, settings, 'GROUP_UPDATE');
        showSuccess("Inventory pushed to Group!");
      }
    } finally { setIsSyncing(false); }
  };

  const executeRestore = async (data: string) => {
    if (!data.trim()) return;
    if (!confirm("RESTORE WARNING: This will overwrite ALL current local data with the backup contents. Proceed?")) return;
    
    setIsProcessing(true);
    const result = await restoreFromBackup(data.trim());
    setIsProcessing(false);
    
    if (result) {
      alert("Restore Successful! The app will now reload.");
      window.location.reload();
    } else {
      alert("Restore Failed. The backup data may be invalid.");
    }
  };

  const handleRestore = async () => {
    await executeRestore(importString);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'nshop' && extension !== 'json') {
      alert('Invalid file format. Please upload a valid .nshop backup file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportString(content);
        await executeRestore(content);
      }
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      alert("Error reading file.");
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  const snapshotTs = localStorage.getItem('naijashop_snapshot_ts');
  const isAdmin = currentUser?.role === 'Admin';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
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
        {/* Export Data Section */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Download size={24} /></div>
             <h3 className="text-xl font-black text-slate-800">Export Data</h3>
          </div>
          <p className="text-sm text-slate-500 font-medium">Protect your business by saving a copy of all products and sales locally or to WhatsApp.</p>
          <div className="space-y-3">
            <button 
              onClick={handleWhatsAppBackup}
              disabled={isProcessing}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <MessageSquare size={20} /> Send to My WhatsApp
            </button>
            <button 
              onClick={handleDownload}
              disabled={isProcessing}
              className="w-full py-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-emerald-100 transition-all active:scale-95"
            >
              <Download size={20} /> Download .nshop File
            </button>
            {isAdmin && (
              <button 
                onClick={handlePushUpdate}
                disabled={isSyncing}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95"
              >
                {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} Push Update to All
              </button>
            )}
          </div>
        </div>

        {/* Restore System Section */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Upload size={24} /></div>
             <h3 className="text-xl font-black text-slate-800">Restore System</h3>
          </div>

          <div className="space-y-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".nshop, .json"
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-200 transition-all active:scale-95"
            >
              {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <FileUp size={20} />} 
              Upload .nshop File
            </button>

            <div className="flex items-center gap-4 py-2">
              <div className="h-px bg-slate-100 flex-1" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">OR</span>
              <div className="h-px bg-slate-100 flex-1" />
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
      </div>

      {/* WhatsApp Sync Automation - NEW HOME */}
      <div className="bg-white p-8 rounded-[3rem] border border-emerald-100 shadow-xl space-y-8 animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <MessageSquareCode size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">WhatsApp Sync Automation</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configure direct reporting links</p>
            </div>
          </div>
          <button 
            onClick={handleUpdateAutomation}
            disabled={isProcessing}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Update Automation Links
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Owner WhatsApp Number</label>
            <div className="relative">
               <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
               <input 
                  type="text" 
                  placeholder="e.g. 2348184774884" 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  value={automationData.admin_whatsapp_number}
                  onChange={e => setAutomationData({...automationData, admin_whatsapp_number: e.target.value.replace(/\D/g, '')})}
                />
            </div>
            <p className="text-[9px] text-slate-400 mt-2 ml-1 italic font-medium">Format: Country code (234), no plus (+).</p>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Staff Group Link</label>
            <div className="relative">
               <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
               <input 
                  type="text" 
                  placeholder="https://chat.whatsapp.com/..." 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  value={automationData.whatsapp_group_link}
                  onChange={e => setAutomationData({...automationData, whatsapp_group_link: e.target.value})}
                />
            </div>
            <p className="text-[9px] text-slate-400 mt-2 ml-1 italic font-medium">The group where staff receive inventory updates.</p>
          </div>
        </div>
      </div>

      {/* Auto Snapshot Info */}
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