
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Settings as SettingsIcon, 
  Landmark, 
  Save, 
  CheckCircle2, 
  ShieldCheck, 
  User, 
  Key, 
  Store,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { Staff } from '../types';

const Settings: React.FC<{ currentUser: Staff | null }> = ({ currentUser }) => {
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [shopName, setShopName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  useEffect(() => {
    if (settings) {
      setShopName(settings.shop_name);
      setBankName(settings.bank_name || '');
      setAccountNumber(settings.account_number || '');
      setAccountName(settings.account_name || '');
    }
  }, [settings]);

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'Admin') return;
    
    setIsSaving(true);
    try {
      await db.settings.update('app_settings', {
        shop_name: shopName,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      alert("Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldCheck size={64} className="text-slate-200" />
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Admin Access Required</h2>
        <p className="text-slate-500 max-w-xs">This section contains sensitive shop configurations and is restricted to Administrators only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <SettingsIcon size={180} />
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black">Terminal Settings</h2>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">Configure your shop identities</p>
        </div>
      </div>

      <form onSubmit={handleSaveBankDetails} className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {/* General Shop Info */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl"><Store size={24} /></div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Store Identity</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Display Shop Name</label>
                <input 
                  type="text" 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Bank Details Section */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Landmark size={24} /></div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Bank Transfer Details</h3>
            </div>
            <p className="text-sm text-slate-500 font-medium">Configure the account shown to customers during bank transfers. Ensure these details are correct to avoid lost payments.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Bank Name</label>
                <input 
                  required
                  placeholder="e.g. OPay, Zenith, Kuda"
                  type="text" 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Account Number (10 Digits)</label>
                <input 
                  required
                  maxLength={10}
                  placeholder="0000000000"
                  type="text" 
                  inputMode="numeric"
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black tracking-widest" 
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Account Name / Business Name</label>
                <input 
                  required
                  placeholder="e.g. NAIJA RETAIL STORE"
                  type="text" 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold uppercase" 
                  value={accountName}
                  onChange={e => setAccountName(e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6 shadow-xl sticky top-6">
            <h4 className="font-black text-lg tracking-tight">Actions</h4>
            <div className="space-y-3">
              <button 
                type="submit"
                disabled={isSaving}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/40 disabled:opacity-50"
              >
                {isSaving ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span> : <Save size={20} />}
                Update Terminal
              </button>
              
              {showSuccess && (
                <div className="flex items-center gap-2 justify-center text-emerald-400 font-bold text-xs animate-in slide-in-from-bottom-2">
                  <CheckCircle2 size={16} /> Changes applied successfully
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-white/10 space-y-4">
              <div className="flex items-center gap-3 text-white/50">
                <ShieldCheck size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Admin Authorization Active</span>
              </div>
              <p className="text-[10px] text-white/30 leading-relaxed uppercase font-bold">
                Updates to bank details take effect immediately across all terminal screens including the customer transfer station.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Settings;
