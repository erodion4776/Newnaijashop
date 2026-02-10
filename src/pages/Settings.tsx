import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Settings as SettingsIcon, 
  Landmark, 
  Save, 
  CheckCircle2, 
  ShieldCheck, 
  Store,
  HelpCircle,
  X,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  MapPin,
  FileText,
  Printer,
  Mail,
  Loader2,
  User
} from 'lucide-react';
import { Staff, Settings as SettingsType } from '../types';
import BluetoothPrintService from '../services/BluetoothPrintService';
import SubscriptionManager from '../components/SubscriptionManager';

const FAQ_DATA = [
  { q: "Does this app need data to work?", a: "No. NaijaShop is Offline-First. You can make sales, check stock, and view profits without 1kb of data. You only need internet for AI scanning and WhatsApp backups." },
  { q: "How do I stop my staff from seeing my profits?", a: "Go to 'Manage Staff' and create a 'Staff' account. When they log in, the app automatically hides all profit, cost price, and settings data. Only the Admin PIN can see these." },
  { q: "What if I lose my phone?", a: "Always use the 'Backup to WhatsApp' feature every night. If you get a new phone, simply install the app and 'Restore' your backup file to get all your data back." },
  { q: "How do I verify bank transfers?", a: "Use the 'Transfer Station' to show your details to the customer. Always wait for your bank's SMS or App alert before clicking 'Confirm Alert Received' in the app." },
  { q: "Can I use a barcode scanner?", a: "Yes! You can use your phone's camera or connect a Bluetooth/USB barcode scanner to your device for faster checkout." }
];

interface SettingsProps {
  currentUser: Staff | null;
  onSubscribe?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ currentUser, onSubscribe }) => {
  const settings = useLiveQuery(() => db.settings.get('app_settings')) as SettingsType | undefined;
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    shop_name: '',
    admin_name: '',
    email: '',
    bank_name: '',
    account_number: '',
    account_name: '',
    shop_address: '',
    receipt_footer: ''
  });

  const [btStatus, setBtStatus] = useState<'connected' | 'disconnected' | 'unsupported'>(
    BluetoothPrintService.isSupported() ? (BluetoothPrintService.isConnected() ? 'connected' : 'disconnected') : 'unsupported'
  );
  const [isConnectingBT, setIsConnectingBT] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        shop_name: settings.shop_name || '',
        admin_name: settings.admin_name || '',
        email: settings.email || '',
        bank_name: settings.bank_name || '',
        account_number: settings.account_number || '',
        account_name: settings.account_name || '',
        shop_address: settings.shop_address || '',
        receipt_footer: settings.receipt_footer || ''
      });
    }
  }, [settings]);

  if (currentUser?.role.toLowerCase() !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldCheck size={64} className="text-slate-200" />
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Admin Access Required</h2>
      </div>
    );
  }

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await db.settings.update('app_settings', {
        shop_name: formData.shop_name,
        admin_name: formData.admin_name,
        email: formData.email,
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        account_name: formData.account_name,
        shop_address: formData.shop_address,
        receipt_footer: formData.receipt_footer
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      alert("Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectPrinter = async () => {
    if (btStatus === 'unsupported') {
      alert("Bluetooth printing is only supported on Chrome for Android.");
      return;
    }
    setIsConnectingBT(true);
    try {
      const success = await BluetoothPrintService.connect();
      if (success) setBtStatus('connected');
    } catch (err) {
      alert("Could not connect to printer.");
    } finally {
      setIsConnectingBT(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10"><SettingsIcon size={180} /></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black">Terminal Control</h2>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">Configure your shop identities</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {settings && <SubscriptionManager settings={settings} onSubscribe={onSubscribe} />}

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl"><Store size={24} /></div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Business Identity</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Shop Name</label>
                <input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.shop_name} onChange={e => setFormData({...formData, shop_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Admin Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input type="text" className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.admin_name} onChange={e => setFormData({...formData, admin_name: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Business Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input type="email" className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="business@example.com" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Landmark size={24} /></div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Bank Transfer Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Bank Name</label>
                <input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.bank_name} onChange={e => setFormData({...formData, bank_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Account Number</label>
                <input type="text" maxLength={10} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black" value={formData.account_number} onChange={e => setFormData({...formData, account_number: e.target.value.replace(/\D/g, '')})} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Account Name</label>
                <input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold uppercase" value={formData.account_name} onChange={e => setFormData({...formData, account_name: e.target.value.toUpperCase()})} />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><FileText size={24} /></div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Receipt Settings</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2"><MapPin size={12} /> Shop Address</label>
                <textarea className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold resize-none" rows={2} value={formData.shop_address} onChange={e => setFormData({...formData, shop_address: e.target.value})} />
              </div>
              <div>
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2"><MessageCircle size={12} /> Footer Message</label>
                <textarea className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold resize-none" rows={2} value={formData.receipt_footer} onChange={e => setFormData({...formData, receipt_footer: e.target.value})} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6 shadow-xl sticky top-6">
            <h4 className="font-black text-lg tracking-tight">Terminal Hardware</h4>
            <div className="space-y-3">
               <p className="text-[10px] font-black text-slate-500 uppercase">Hardware Options</p>
               <div className="flex items-center gap-2 p-3 bg-slate-800 rounded-xl border border-slate-700">
                  <Printer size={16} className={btStatus === 'connected' ? 'text-emerald-400' : 'text-slate-500'} />
                  <span className="text-xs font-bold truncate">{btStatus === 'connected' ? BluetoothPrintService.getDeviceName() : 'Disconnected'}</span>
               </div>
               <button onClick={handleConnectPrinter} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-black text-[10px] uppercase transition-all border border-slate-700">{btStatus === 'connected' ? 'Change Printer' : 'Connect Printer'}</button>
            </div>
            <button onClick={() => handleSaveSettings()} disabled={isSaving} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg disabled:opacity-50">
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} Save All Changes
            </button>
            {showSuccess && <div className="flex items-center gap-2 justify-center text-emerald-400 font-bold text-xs"><CheckCircle2 size={16} /> Updated!</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;