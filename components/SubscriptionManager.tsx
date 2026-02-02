import React, { useState, useEffect } from 'react';
import { CreditCard, ShieldCheck, ShieldAlert, Loader2, Calendar, Lock, AlertTriangle } from 'lucide-react';
import { Settings } from '../types';

interface SubscriptionManagerProps {
  settings: Settings;
  onSubscribe?: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ settings, onSubscribe }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paystackLoaded, setPaystackLoaded] = useState(false);
  
  const isLicensed = settings.license_expiry && settings.license_expiry > Date.now();
  const expiryDate = settings.license_expiry ? new Date(settings.license_expiry).toLocaleDateString() : 'N/A';
  const hasEmail = !!settings.email;

  // Check if Paystack script is loaded
  useEffect(() => {
    const checkPaystack = () => {
      if ((window as any).PaystackPop) {
        setPaystackLoaded(true);
      } else {
        setTimeout(checkPaystack, 100);
      }
    };
    checkPaystack();
  }, []);

  const handleAction = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!onSubscribe) return;
    
    setIsProcessing(true);
    try {
      await onSubscribe();
    } finally {
      // Small delay to prevent double-clicks during iframe launch
      setTimeout(() => setIsProcessing(false), 2000);
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
        {!hasEmail && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <p className="text-xs font-bold text-amber-800 leading-tight">
              Please save your email address above before activating. We need it to send your digital receipt.
            </p>
          </div>
        )}

        <button 
          onClick={handleAction}
          disabled={isProcessing || !paystackLoaded || !hasEmail}
          className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:grayscale active:scale-[0.98]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Opening Secure Terminal...
            </>
          ) : !paystackLoaded ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Loading Gateway...
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
    </div>
  );
};

export default SubscriptionManager;