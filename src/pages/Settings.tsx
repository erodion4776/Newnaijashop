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
  ChevronRight,
  ShoppingCart,
  Package,
  Sparkles,
  Lock,
  Search,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  MapPin,
  FileText,
  Printer,
  Bluetooth,
  Mail,
  Loader2,
  Share2,
  Users,
  MessageSquare
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
  
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [adminWhatsapp, setAdminWhatsapp] = useState('');
  const [groupLink, setGroupLink] = useState('');

  const [btStatus, setBtStatus] = useState<'connected' | 'disconnected' | 'unsupported'>(
    BluetoothPrintService.isSupported() ? (BluetoothPrintService.isConnected() ? 'connected' : 'disconnected') : 'unsupported'
  );
  const [isConnectingBT, setIsConnectingBT] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const filteredFaq = FAQ_DATA.filter(item => item.q.toLowerCase().includes(faqSearch.toLowerCase()) || item.a.toLowerCase().includes(faqSearch.toLowerCase()));

  useEffect(() => {
    if (settings) {
      setShopName(settings.shop_name);
      setEmail(settings.email || '');
      setBankName(settings.bank_name || '');
      setAccountNumber(settings.account_number || '');
      setAccountName(settings.account_name || '');
      setShopAddress(settings.shop_address || '');
      setReceiptFooter(settings.receipt_footer || '');
      setAdminWhatsapp(settings.admin_whatsapp_number || '');
      setGroupLink(settings.whatsapp_group_link || '');
    }
  }, [settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'Admin') return;
    setIsSaving(true);
    try {
      await db.settings.update('app_settings', {
        shop_name: shopName, 
        email, 
        bank_name: bankName, 
        account_number: accountNumber,
        account_name: accountName, 
        shop_address: shopAddress, 
        receipt_footer: receiptFooter,
        admin_whatsapp_number: adminWhatsapp,
        whatsapp_group_link: groupLink
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

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldCheck size={64} className="text-slate-200" />
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Admin Access Required</h2>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10"><SettingsIcon size={180} /></div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black">Terminal Settings</h2>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-1">Configure your shop identities</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {settings && <SubscriptionManager settings={settings} onSubscribe={onSubscribe} />}

          {/* WhatsApp Sync Configuration Section - ADMIN ONLY */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><MessageSquare size={24} /></div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">WhatsApp Sync Configuration</h3>
            </div>
            <div className="space-y-4">
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Admin WhatsApp Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 2348184774884"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" 
                    value={adminWhatsapp} 
                    onChange={e => setAdminWhatsapp(e.target.value.replace(/\D/g, ''))} 
                  />
                  <p className="text-[10px] text-slate-400 mt-2 ml-1 italic font-medium">Format: Country code first, no plus (+) sign.</p>
               </div>
               <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">WhatsApp Shop Group Link</label>
                  <input 
                    type="url" 
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" 
                    value={groupLink} 
                    onChange={e => setGroupLink(e.target.value)} 
                  />
                  <p className="text-[10px] text-slate-400 mt-2 ml-1 italic font-medium">The group where all staff will receive stock updates.</p>
               </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-8">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3"><div className="p-3 bg-slate-50 text-slate-600 rounded-2xl"><Store size={24} /></div><h3 className="text-xl font-black text-slate-800 tracking-tight">Business Details</h3></div>
              <div className="space-y-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Shop Name</label><input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={shopName} onChange={e => setShopName(e.target.value)} /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Email</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="email" className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={email} onChange={e => setEmail(e.target.value)} placeholder="business@example.com" /></div></div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3"><div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Landmark size={24} /></div><h3 className="text-xl font-black text-slate-800 tracking-tight">Bank Details</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Bank Name</label><input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={bankName} onChange={e => setBankName(e.target.value)} /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Account Number</label><input type="text" maxLength={10} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black" value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))} /></div>
                <div className="md:col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Account Name</label><input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold uppercase" value={accountName} onChange={e => setAccountName(e.target.value.toUpperCase())} /></div>
              </div>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6 shadow-xl sticky top-6">
            <h4 className="font-black text-lg tracking-tight">Terminal Control</h4>
            <button onClick={handleSaveSettings} disabled={isSaving} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} Update Terminal
            </button>
            {showSuccess && <div className="flex items-center gap-2 justify-center text-emerald-400 font-bold text-xs"><CheckCircle2 size={16} /> Updated!</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;