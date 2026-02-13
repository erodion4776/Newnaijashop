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
  Smartphone,
  RefreshCw
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
  const isStaff = !isAdmin;

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

  /**
   * ADMIN STANDARDIZED EXPORT
   * Standardizes the package type and strips sensitive data for staff sync.
   */
  const handleWhatsAppExport = async () => {
    if (!settings) return;
    setIsProcessing(true);
    try {
      if (isAdmin) {
        // Logic for Admin to broadcast specialized Master Stock package
        const products = await db.products.toArray();
        // SECURITY: Remove sensitive cost data before sending to staff
        const safeProducts = products.map(({ cost_price, ...rest }) => rest);

        const syncPackage = {
          type: 'MASTER_STOCK_UPDATE',
          products: safeProducts,
          shopName: settings.shop_name,
          license_expiry: settings.license_expiry,
          timestamp: Date.now()
        };
        const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(syncPackage));
        window.open(`https://wa.me/?text=${encodeURIComponent('📦 MASTER STOCK UPDATE: ' + compressed)}`, '_blank');
      } else {
        // Logic for Staff to send sales data back to Boss
        const data = await generateBackupData(); // Staff sends full local snapshot for boss to merge/audit
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

  /**
   * ADMIN FULL RECOVERY HANDLER
   */
  const handleRestoreAction = async () => {
    if (!importCode.trim()) return alert("Oga, please paste your code first!");
    if (!confirm("Warning: This will delete all current data and restore your backup. Continue?")) return;
    
    setIsProcessing(true);
    const success = await restoreFromBackup(importCode);
    
    if (success) {
      alert("✅ Shop Restored Successfully!");
      window.location.href = '/'; 
    } else {
      alert("❌ Recovery Failed: Invalid backup code.");
      setIsProcessing(false);
    }
  };

  /**
   * RECEIVING LOGIC (Standardized)
   * Handles both specialized Master Stock packages and legacy structures.
   */
  const handleImport = async () => {
    const code = importCode.trim();
    if (!code) return alert("Oga, please paste your code first!");

    setIsProcessing(true);
    try {
      const decoded = LZString.decompressFromEncodedURIComponent(code);
      if (!decoded) throw new Error("Could not decode string");
      
      const data = JSON.parse(decoded);
      
      // Check if it is a specialized Stock Update or has products array
      if (data.type === 'MASTER_STOCK_UPDATE' || data.products) {
        // Fix: Cast db to any to resolve transaction property missing on custom NaijaShopDB type
        await (db as any).transaction('rw', [db.products, db.settings], async () => {
          await db.products.clear();
          
          // Ensure Numeric Conversion for all price and stock fields
          const formattedProducts = data.products.map((p: any) => ({
            ...p,
            price: Number(p.price),
            stock_qty: Number(p.stock_qty),
            low_stock_threshold: Number(p.low_stock_threshold || 5)
          }));
          
          await db.products.bulkAdd(formattedProducts);
          
          // Update only non-sensitive terminal settings (license)
          if (data.license_expiry) {
            await db.settings.update('app_settings', { 
              license_expiry: Number(data.license_expiry)
            });
          }
        });
        alert("✅ Stock Successfully Updated from Boss!");
        window.location.reload();
      } else {
        alert("❌ Invalid Code: This is not a stock update file.");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error: Invalid or Corrupted Sync Code.");
      setIsProcessing(false);
    }
  };

  if (!settings) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
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
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Owner WhatsApp</label>
              <input type="text" placeholder="e.g. 234..." className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={localWhatsApp} onChange={e => setLocalWhatsApp(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Group Invite Link</label>
              <input type="text" placeholder="https://chat.whatsapp.com/..." className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={localGroup} onChange={e => setLocalGroup(e.target.value)} />
            </div>
          </div>
          <button onClick={handleUpdateAutomation} disabled={isProcessing} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-50">
            {isProcessing ? 'Updating...' : 'Update Links'}
          </button>
        </div>
      )}

      {/* ACTION SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="font-black text-slate-800 uppercase text-xs">Export Data</h3>
          <div className="space-y-3">
            <button onClick={handleWhatsAppExport} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50">
              <Share2 size={20} /> {isAdmin ? 'Broadcast Master Stock' : 'Send Sales to Boss'}
            </button>
            {isAdmin && (
              <button onClick={() => downloadBackupFile(settings.shop_name)} className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-100 border border-slate-200">
                <Download size={20} /> Download .nshop File
              </button>
            )}
          </div>
          {isStaff && (
            <p className="text-[10px] text-slate-400 font-bold text-center italic">Use this to send today's work to the Boss on WhatsApp.</p>
          )}
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 text-center">
          <h3 className="font-black text-slate-800 uppercase text-xs">
            {isAdmin ? 'Restore System' : '📥 Update Shop Stock'}
          </h3>
          <p className="text-xs text-slate-500 font-medium px-4 leading-relaxed">
            {isAdmin 
              ? 'Restore your entire terminal from a backup code. Warning: This overwrites all data.' 
              : 'Paste the code sent by the Boss on WhatsApp here to update your products and prices.'}
          </p>
          <div className="space-y-2">
            <textarea 
              placeholder={isAdmin ? "Paste backup code here..." : "Paste code from Boss here"}
              className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-mono outline-none focus:ring-2 focus:ring-emerald-500 resize-none shadow-inner"
              value={importCode}
              onChange={e => setImportCode(e.target.value)}
            />
            {isStaff && (
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                Tip: Long-press in the box above to paste the code you copied from WhatsApp.
              </p>
            )}
          </div>
          <button 
            onClick={isAdmin ? handleRestoreAction : handleImport}
            disabled={isProcessing}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 transition-all shadow-lg"
          >
            {isProcessing ? (
              <><Loader2 className="animate-spin" size={20} /> ⏳ Processing...</>
            ) : (
              isAdmin ? <><Upload size={20} /> Perform Recovery</> : <><RefreshCw size={20} /> Sync My Inventory</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityBackups;