import React, { useState, useEffect } from 'react';
import { CreditCard, ShieldCheck, ShieldAlert, Loader2, Calendar, Lock } from 'lucide-react';
import { Settings } from '../types';

interface SubscriptionManagerProps {
  settings: Settings;
  onSuccess: (reference: string) => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ settings, onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paystackLoaded, setPaystackLoaded] = useState(false);
  
  const isLicensed = settings.license_expiry && settings.license_expiry > Date.now();
  const expiryDate = settings.license_expiry ? new Date(settings.license_expiry).toLocaleDateString() : 'N/A';

  // Check if Paystack script is loaded
  useEffect(() => {
    const checkPaystack = () => {
      if ((window as any).PaystackPop) {
        setPaystackLoaded(true);
        console.log('Paystack script loaded successfully');
      } else {
        console.log('Waiting for Paystack script...');
        setTimeout(checkPaystack, 100);
      }
    };
    checkPaystack();
  }, []);

  const handlePaystackPayment = (e?: React.MouseEvent) => {
    // Stop form refresh if button is inside a form
    if (e) e.preventDefault();

    // Check if Paystack script is loaded
    if (!paystackLoaded || !(window as any).PaystackPop) {
      alert("Paystack is still loading, please wait a moment and try again...");
      return;
    }
    
    if (isProcessing) return;
    setIsProcessing(true);
    
    const terminalId = settings.terminal_id || 'UNKNOWN';
    const savedReferralCode = settings.referral_code_used || 'NONE';

    // Fix: Correct Vite environment variable access by casting import.meta to any to avoid "Property 'env' does not exist on type 'ImportMeta'"
    const paystackKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY as string;

    // Debugging Logs
    console.log('=== PAYSTACK INITIALIZATION ===');
    console.log('Paystack Key exists:', !!paystackKey);
    console.log('Key length:', paystackKey?.length || 0);
    console.log('Terminal ID:', terminalId);
    console.log('Referral Code:', savedReferralCode);
    console.log('PaystackPop available:', !!(window as any).PaystackPop);
    console.log('================================');

    if (!paystackKey) {
      console.error("Paystack Public Key is missing in environment variables.");
      // Fix: Cast import.meta to any to resolve "Property 'env' does not exist on type 'ImportMeta'"
      console.error("Available env vars:", Object.keys((import.meta as any).env));
      alert("System Configuration Error: Payment gateway key not found. Please ensure VITE_PAYSTACK_PUBLIC_KEY is set in your Netlify environment variables.");
      setIsProcessing(false);
      return;
    }

    try {
      console.log('Creating Paystack handler...');
      const handler = (window as any).PaystackPop.setup({
        key: paystackKey,
        email: `${settings.admin_name.replace(/\s+/g, '.').toLowerCase()}@naijashop.pos`,
        amount: 1000000, // ₦10,000.00 in kobo
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
          console.log('Payment successful:', response);
          setIsProcessing(false);
          // Redirect to the activation page with the payment reference
          window.location.href = '/activation?session=' + response.reference;
        },
        onClose: () => {
          console.log("Payment window closed by user.");
          setIsProcessing(false);
        }
      });
      
      console.log('Opening Paystack iframe...');
      handler.openIframe();
    } catch (err) {
      console.error("Paystack Initialization Error:", err);
      alert("Could not load payment gateway. Please check your internet connection and try again.");
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
          disabled={isProcessing || !paystackLoaded}
          className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 active:scale-[0.98]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Processing...
            </>
          ) : !paystackLoaded ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Loading Payment Gateway...
            </>
          ) : (
            <>
              <CreditCard size={20} />
              {isLicensed ? 'Extend License (₦10,000/Yr)' : 'Activate Terminal (₦10,000/Yr)'}
            </>
          )}
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

      {/* Debug info - remove in production */}
      {!paystackLoaded && (
        <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg">
          <p className="font-bold mb-1">Debug Info:</p>
          <p>Paystack Loaded: {paystackLoaded ? 'Yes' : 'No'}</p>
          {/* Fix: Cast import.meta to any to resolve "Property 'env' does not exist on type 'ImportMeta'" */}
          <p>Env Key Set: {(import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;