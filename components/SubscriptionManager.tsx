import React, { useState } from 'react';
import { CreditCard, ShieldCheck, ShieldAlert, Loader2, Calendar, Lock } from 'lucide-react';
import { Settings } from '../types';

interface SubscriptionManagerProps {
  settings: Settings;
  onSuccess: (reference: string) => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ settings, onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const isLicensed = settings.license_expiry && settings.license_expiry > Date.now();
  const expiryDate = settings.license_expiry ? new Date(settings.license_expiry).toLocaleDateString() : 'N/A';

  const handlePaystackPayment = (e?: React.MouseEvent) => {
    // Stop form refresh if button is inside a form
    if (e) e.preventDefault();

    // Check if Paystack script is loaded
    if (!(window as any).PaystackPop) {
      alert("Paystack is loading, please wait...");
      return;
    }
    
    if (isProcessing) return;
    setIsProcessing(true);
    
    const terminalId = settings.terminal_id || 'UNKNOWN';
    const savedReferralCode = settings.referral_code_used || 'NONE';

    // Accessing the key via standard Vite environment variable syntax
    const paystackKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY;

    // Debugging Logs for the owner
    console.log('Initializing Paystack with Key:', paystackKey);
    console.log('Terminal ID:', terminalId);
    console.log('Referral Code:', savedReferralCode);

    if (!paystackKey) {
      console.error("Paystack Public Key is missing in environment variables.");
      alert("System Configuration Error: Payment gateway key not found. Please contact support.");
      setIsProcessing(false);
      return;
    }

    try {
      const handler = (window as any).PaystackPop.setup({
        key: paystackKey,
        email: `${settings.admin_name.replace(/\s+/g, '.').toLowerCase()}@naijashop.pos`,
        amount: 1000000, // ₦10,000.00 (Standardized in Kobo: 10000 * 100)
        currency: 'NGN',
        ref: 'NS-' + Math.floor((Math.random() * 1000000000) + 1),
        metadata: {
          terminal_id: terminalId,
          referrer_code: savedReferralCode,
          custom_fields: [
            { display_name: "Terminal ID", variable_name: "terminal_id", value: terminalId },
            { display_name: "Referrer", variable_name: "referrer", value: savedReferralCode }
          ]
        },
        callback: (response: any) => {
          setIsProcessing(false);
          // Redirect to the activation page with the payment reference
          // Note: App routing uses '/activation'
          window.location.href = '/activation?session=' + response.reference;
        },
        onClose: () => {
          setIsProcessing(false);
          console.log("Payment window closed by user.");
        }
      });
      
      handler.openIframe();
    } catch (err) {
      console.error("Paystack Initialization Error:", err);
      alert("Could not load payment gateway. Please check your internet connection.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-2xl ${isLicensed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isLicensed ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">License Subscription</h3>
          <div className="flex items-center gap-2 mt-1">
             <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isLicensed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
               {isLicensed ? '🟢 Active' : '🔴 Unlicensed'}
             </span>
             {isLicensed && <span className="text-[10px] font-bold text-slate-400">Expires: {expiryDate}</span>}
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-500 font-medium leading-relaxed">
        Professional features require an active terminal license. Standard licensing is <b>₦10,000 per year</b> per terminal device.
      </p>

      <div className="space-y-4">
        <button 
          onClick={handlePaystackPayment}
          disabled={isProcessing}
          className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 active:scale-[0.98]"
        >
          {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
          {isLicensed ? 'Extend License (₦10,000/Yr)' : 'Activate Terminal (₦10,000/Yr)'}
        </button>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Lock size={12} />
            <span className="text-[10px] font-black uppercase tracking-widest">Secure Payment by Paystack</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
             <Calendar size={12} />
             Automated Yearly Verification
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager;