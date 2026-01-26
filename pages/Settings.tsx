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
  CreditCard
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

const Settings: React.FC<{ currentUser: Staff | null }> = ({ currentUser }) => {
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  
  const [shopName, setShopName] = useState('');
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
      setBankName(settings.bank_name || '');
      setAccountNumber(settings.account_number || '');
      setAccountName(settings.account_name || '');
      setShopAddress(settings.shop_address || '');
      setReceiptFooter(settings.receipt_footer || '');
    }
  }, [settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'Admin') return;
    
    setIsSaving(true);
    try {
      await db.settings.update('app_settings', {
        shop_name: shopName,
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

  const handleSubscriptionSuccess = (ref: string) => {
    // Navigate to activation screen
    window.location.href = `/?session=${ref}`;
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          
          {/* Subscription Manager */}
          {settings && (
            <SubscriptionManager 
              settings={settings} 
              onSuccess={handleSubscriptionSuccess} 
            />
          )}

          {/* Support & Tutorial Section */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 p-8 opacity-5">
              <HelpCircle size={80} />
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><HelpCircle size={24} /></div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Support & Learning</h3>
            </div>
            <p className="text-sm text-slate-500 font-medium">New to NaijaShop? Learn how to manage your business like a pro with our interactive guide.</p>
            
            <button 
              onClick={() => setShowTutorial(true)}
              className="w-full md:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
            >
              <PlayCircle size={20} />
              Open Quick Start Guide
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-8">
            {/* Bluetooth Printer Section */}
            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Printer size={24} /></div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Thermal Printer</h3>
              </div>
              <p className="text-sm text-slate-500 font-medium">Connect a physical thermal printer for professional receipts.</p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Printer Status</p>
                  <div className="flex items-center gap-2">
                    {btStatus === 'connected' ? (
                      <>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="font-bold text-slate-700">Connected: {BluetoothPrintService.getDeviceName()}</span>
                      </>
                    ) : btStatus === 'unsupported' ? (
                      <>
                        <div className="w-2 h-2 bg-rose-500 rounded-full" />
                        <span className="font-bold text-slate-400 italic">Not Supported on this Device</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-slate-300 rounded-full" />
                        <span className="font-bold text-slate-400">Disconnected</span>
                      </>
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
                  {isConnectingBT ? 'Searching...' : (
                    <>
                      <Bluetooth size={16} /> 
                      {btStatus === 'connected' ? 'Change Printer' : 'Connect Printer'}
                    </>
                  )}
                </button>
              </div>
              
              {btStatus === 'unsupported' && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800">
                  <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    <b>iOS Alert:</b> Bluetooth printing is not available in Safari on iPhone. For the best experience, use the "Download PDF" option at checkout.
                  </p>
                </div>
              )}
            </div>

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

            {/* Receipt Customization */}
            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><FileText size={24} /></div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Receipt Customization</h3>
              </div>
              <p className="text-sm text-slate-500 font-medium">These details appear on your thermal and digital receipts.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                    <MapPin size={12} /> Shop Address
                  </label>
                  <textarea 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold resize-none" 
                    rows={2}
                    value={shopAddress}
                    onChange={e => setShopAddress(e.target.value)}
                    placeholder="e.g. Suite 4, Alaba International Market, Lagos"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                    <MessageCircle size={12} /> Footer Message (e.g. Return Policy)
                  </label>
                  <textarea 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold resize-none" 
                    rows={2}
                    value={receiptFooter}
                    onChange={e => setReceiptFooter(e.target.value)}
                    placeholder="e.g. Thanks for your patronage! No refund after payment."
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
          </form>

          {/* Help Center & FAQ */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><HelpCircle size={24} /></div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Help Center & FAQ</h3>
              </div>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search answers..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  value={faqSearch}
                  onChange={e => setFaqSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredFaq.map((item, idx) => (
                <div key={idx} className="group">
                  <button 
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="flex items-center justify-between w-full py-5 text-left transition-all"
                  >
                    <span className="font-black text-slate-700 group-hover:text-emerald-600 transition-colors pr-4">{item.q}</span>
                    {activeFaq === idx ? (
                      <ChevronUp size={20} className="text-emerald-500 shrink-0" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-300 shrink-0" />
                    )}
                  </button>
                  {activeFaq === idx && (
                    <div className="pb-6 text-slate-500 font-medium leading-relaxed animate-in slide-in-from-top-2 duration-200">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6 shadow-xl sticky top-6">
            <h4 className="font-black text-lg tracking-tight">Actions</h4>
            <div className="space-y-3">
              <button 
                onClick={handleSaveSettings}
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
            </div>
          </div>
        </div>
      </div>

      {showTutorial && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-50 rounded-[4rem] w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
            <div className="p-8 md:p-12 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">NaijaShop User Guide</h3>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Master Your Terminal in 5 Steps</p>
              </div>
              <button 
                onClick={() => setShowTutorial(false)}
                className="p-4 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X size={32} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 scrollbar-hide">
              <TutorialStep 
                num="1"
                title="Selling & POS"
                icon={<ShoppingCart className="text-emerald-600" />}
                color="bg-emerald-50"
                description="Tap products to add to cart. If a customer needs to 'quickly buy something else', use the Park Sale button to save their items."
              />

              <TutorialStep 
                num="2"
                title="Manage Stock"
                icon={<Package className="text-blue-600" />}
                color="bg-blue-50"
                description="Add products manually or use the AI Guru to scan your handwritten notebooks. Set Low Stock Thresholds to get red alerts."
              />

              <TutorialStep 
                num="3"
                title="Consult the Guru"
                icon={<Sparkles className="text-amber-600" />}
                color="bg-amber-50"
                description="NaijaShop Guru analyzes your sales to tell you which products move fastest."
              />

              <TutorialStep 
                num="4"
                title="Oga Mode (Security)"
                icon={<Lock className="text-rose-600" />}
                color="bg-rose-50"
                description="Use 'Switch to Staff' when leaving attendants in the shop. This hides your profits and settings."
              />

              <TutorialStep 
                num="5"
                title="Data Protection"
                icon={<Database className="text-indigo-600" />}
                color="bg-indigo-50"
                description="NaijaShop works 100% offline. Go to 'Security & Backups' to send a copy of your records to WhatsApp."
              />
            </div>

            <div className="p-8 bg-white border-t border-slate-200 shrink-0">
              <button 
                onClick={() => setShowTutorial(false)}
                className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl hover:bg-emerald-700 transition-all active:scale-[0.98]"
              >
                I'm Ready to Start Selling!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TutorialStep: React.FC<{num: string, title: string, icon: any, color: string, description: string}> = ({ num, title, icon, color, description }) => (
  <div className="flex gap-6 md:gap-10">
    <div className="flex flex-col items-center shrink-0">
      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center font-black text-xl text-slate-800 shadow-inner`}>
        {num}
      </div>
      <div className="flex-1 w-px bg-slate-200 my-4" />
    </div>
    <div className="space-y-3 pb-4">
      <div className="flex items-center gap-3">
        {/* Fix: Cast icon to React.ReactElement<any> to resolve the 'size' property type error when using cloneElement. */}
        {React.cloneElement(icon as React.ReactElement<any>, { size: 24 })}
        <h4 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h4>
      </div>
      <p className="text-slate-500 leading-relaxed font-medium text-lg">
        {description}
      </p>
    </div>
  </div>
);

export default Settings;