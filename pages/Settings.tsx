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
  PlayCircle,
  X,
  ChevronRight,
  ShoppingCart,
  Package,
  Sparkles,
  Lock,
  Database,
  Smartphone,
  WifiOff,
  Search,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  MapPin,
  FileText,
  Printer,
  Bluetooth,
  AlertTriangle,
  CreditCard,
  Mail,
  Loader2
} from 'lucide-react';
import { Staff } from '../types';
import BluetoothPrintService from '../services/BluetoothPrintService';
import SubscriptionManager from '../components/SubscriptionManager';

const FAQ_DATA = [
  {
    q: "Does this app need data to work?",
    a: "No. NaijaShop is Offline-First. You can make sales, check stock, and view profits without 1kb of data. You only need internet for AI scanning and WhatsApp backups."
  },
  {
    q: "How do I stop my staff from seeing my profits?",
    a: "Go to 'Manage Staff' and create a 'Staff' account. When they log in, the app automatically hides all profit, cost price, and settings data. Only the Admin PIN can see these."
  },
  {
    q: "What if I lose my phone?",
    a: "Always use the 'Backup to WhatsApp' feature every night. If you get a new phone, simply install the app and 'Restore' your backup file to get all your data back."
  },
  {
    q: "How do I verify bank transfers?",
    a: "Use the 'Transfer Station' to show your details to the customer. Always wait for your bank's SMS or App alert before clicking 'Confirm Alert Received' in the app."
  },
  {
    q: "Can I use a barcode scanner?",
    a: "Yes! You can use your phone's camera or connect a Bluetooth/USB barcode scanner to your device for faster checkout."
  }
];

interface SettingsProps {
  currentUser: Staff | null;
  onSubscribe?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ currentUser, onSubscribe }) => {
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');

  // Bluetooth States
  const [btStatus, setBtStatus] = useState<'connected' | 'disconnected' | 'unsupported'>(
    BluetoothPrintService.isSupported() ? (BluetoothPrintService.isConnected() ? 'connected' : 'disconnected') : 'unsupported'
  );
  const [isConnectingBT, setIsConnectingBT] = useState(false);

  // FAQ states
  const [faqSearch, setFaqSearch] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const filteredFaq = FAQ_DATA.filter(item => 
    item.q.toLowerCase().includes(faqSearch.toLowerCase()) || 
    item.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  useEffect(() => {
    if (settings) {
      setShopName(settings.shop_name);
      setEmail(settings.email || '');
      setBankName(settings.bank_name || '');
      setAccountNumber(settings.account_number || '');
      setAccountName(settings.account_name || '');
      setShopAddress(settings.shop_address || '');
      setReceiptFooter(settings.receipt_footer || '');
    }
  }, [settings]);

  // Handle BT auto-reconnect on load
  useEffect(() => {
    if (btStatus === 'disconnected' && localStorage.getItem('last_printer_id')) {
        // Try background reconnect if possible
        BluetoothPrintService.connect().then(success => {
            if (success) setBtStatus('connected');
        }).catch(() => {});
    }
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'Admin') return;
    
    setIsSaving(true);
    try {
      await db.settings.update('app_settings', {
        shop_name: shopName,
        email: email,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        shop_address: shopAddress,
        receipt_footer: receiptFooter
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
      alert("Bluetooth printing is only supported on Chrome for Android. Please use 'Download PDF' instead.");
      return;
    }
    
    setIsConnectingBT(true);
    try {
      const success = await BluetoothPrintService.connect();
      if (success) setBtStatus('connected');
    } catch (err) {
      alert("Could not connect to printer. Ensure Bluetooth is ON and printer is in pairing mode.");
    } finally {
      setIsConnectingBT(false);
    }
  };

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <ShieldCheck size={64} className="text-slate-200" />
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">Admin Access Required</h2>
        <p className="text-slate-500 max-w-xs">This section is restricted to Administrators only.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          
          {settings && <SubscriptionManager settings={settings} onSubscribe={onSubscribe} />}

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Printer size={24} /></div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Thermal Printer</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Printer Status</p>
                <div className="flex items-center gap-2">
                  {btStatus === 'connected' ? (
                    <><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /><span className="font-bold text-slate-700">Connected: {BluetoothPrintService.getDeviceName()}</span></>
                  ) : btStatus === 'unsupported' ? (
                    <><div className="w-2 h-2 bg-rose-500 rounded-full" /><span className="font-bold text-slate-400 italic">Not Supported</span></>
                  ) : (
                    <><div className="w-2 h-2 bg-slate-300 rounded-full" /><span className="font-bold text-slate-400">Disconnected</span></>
                  )}
                </div>
              </div>
              <button 
                type="button"
                onClick={handleConnectPrinter}
                disabled={isConnectingBT || btStatus === 'unsupported'}
                className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all ${
                  btStatus === 'connected' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-600 text-white shadow-lg active:scale-95 disabled:opacity-50'
                }`}
              >
                {isConnectingBT ? <><Loader2 size={16} className="animate-spin" /> Searching...</> : (
                  <><Bluetooth size={16} /> {btStatus === 'connected' ? 'Change Printer' : 'Connect Printer'}</>
                )}
              </button>
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
              <div className="flex items-center gap-3"><div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><FileText size={24} /></div><h3 className="text-xl font-black text-slate-800 tracking-tight">Receipt Config</h3></div>
              <div className="space-y-4">
                <div><label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2"><MapPin size={12} /> Address</label><textarea className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold resize-none" rows={2} value={shopAddress} onChange={e => setShopAddress(e.target.value)} /></div>
                <div><label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2"><MessageCircle size={12} /> Footer Message</label><textarea className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold resize-none" rows={2} value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} /></div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3"><div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Landmark size={24} /></div><h3 className="text-xl font-black text-slate-800 tracking-tight">Bank Details</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Bank Name</label><input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={bankName} onChange={e => setBankName(e.target.value)} /></div>
                <div className="md:col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Account Number</label><input type="text" maxLength={10} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black" value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))} /></div>
                <div className="md:col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Account Name</label><input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold uppercase" value={accountName} onChange={e => setAccountName(e.target.value.toUpperCase())} /></div>
              </div>
            </div>
          </form>

          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3"><div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><HelpCircle size={24} /></div><h3 className="text-xl font-black text-slate-800 tracking-tight">FAQ</h3></div>
              <div className="relative flex-1 max-w-xs"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" value={faqSearch} onChange={e => setFaqSearch(e.target.value)} /></div>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredFaq.map((item, idx) => (
                <div key={idx}>
                  <button onClick={() => setActiveFaq(activeFaq === idx ? null : idx)} className="flex items-center justify-between w-full py-5 text-left"><span className="font-black text-slate-700">{item.q}</span>{activeFaq === idx ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</button>
                  {activeFaq === idx && <div className="pb-6 text-slate-500 font-medium leading-relaxed">{item.a}</div>}
                </div>
              ))}
            </div>
          </div>
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