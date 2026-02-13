import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
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
  AlertCircle,
  Smartphone
} from 'lucide-react';
import { Staff, Settings as SettingsType } from '../types';
import LZString from 'lz-string';
import { generateBackupData, restoreFromBackup, downloadBackupFile } from '../utils/backup';
import WhatsAppService from '../services/WhatsAppService';

interface SecurityBackupsProps {
  currentUser: Staff | null;
}

const SecurityBackups: React.FC<SecurityBackupsProps> = ({ currentUser }) => {
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const [isProcessing, setIsProcessing] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [localWhatsApp, setLocalWhatsApp] = useState('');
  const [localGroup, setLocalGroup] = useState('');

  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  // Load initial values safely
  useEffect(() => {
    if (settings) {
      setLocalWhatsApp(settings.admin_whatsapp_number || '');
      setLocalGroup(settings.whatsapp_group_link || '');
    }
  }, [settings]);

  const handleUpdateAutomation = async () => {
    setIsProcessing(true);
    try {
      await db.settings.update('app_settings', {
        admin_whatsapp_number: localWhatsApp,
        whatsapp_group_link: localGroup
      });
      alert("✅ Automation Links Updated!");
    } catch (err) {
      alert("Failed to save. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWhatsAppExport = async () => {
    setIsProcessing(true);
    try {
      const data = await generateBackupData();
      if (isAdmin) {
         // Logic for Admin to broadcast to group
         window.open(`https://wa.me/?text=${encodeURIComponent('📦 MASTER STOCK UPDATE: ' + data)}`, '_blank');
      } else {
         // Logic for Staff to send to Boss
         const bossNum = settings?.admin_whatsapp_number || '';
         window.open(`https://wa.me/${bossNum}?text=${encodeURIComponent('📥 STAFF SALES REPORT: ' + data)}`, '_blank');
      }
    } catch (e) {
      alert("Export failed");
    } finally {
      setIsProcessing(true);
      setTimeout(() => setIsProcessing(false), 2000);
    }
  };

  if (!settings) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10"><ShieldCheck size={180} /></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black italic">Security & Backups</h2>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">Data Fortress System</p>
        </div>
      </div>

      {/* ADMIN ONLY: Automation Config */}
      {isAdmin && (
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-lg space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><MessageSquare size={20} /></div>
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">WhatsApp Sync Automation</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Owner WhatsApp (e.g. 234...)" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={localWhatsApp} onChange={e => setLocalWhatsApp(e.target.value)} />
            <input type="text" placeholder="Group Invite Link" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={localGroup} onChange={e => setLocalGroup(e.target.value)} />
          </div>
          <button onClick={handleUpdateAutomation} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest">Update Links</button>
        </div>
      )}

      {/* ACTION SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="font-black text-slate-800 uppercase text-xs">Export Data</h3>
          <div className="space-y-3">
            <button onClick={handleWhatsAppExport} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg hover:bg-emerald-700 transition-all">
              <Share2 size={20} /> {isAdmin ? 'Broadcast Master Stock' : 'Send Sales to Boss'}
            </button>
            {isAdmin && (
              <button onClick={() => downloadBackupFile(settings.shop_name)} className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-100 border border-slate-200">
                <Download size={20} /> Download .nshop File
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 text-center">
          <h3 className="font-black text-slate-800 uppercase text-xs">Restore System</h3>
          <textarea 
            placeholder="Paste code here..." 
            className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-mono outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            value={importCode}
            onChange={e => setImportCode(e.target.value)}
          />
          <button 
            onClick={() => restoreFromBackup(importCode)}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3"
          >
            <Upload size={20} /> Perform Recovery
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityBackups;