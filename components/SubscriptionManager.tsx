
import React, { useState } from 'react';
import { CreditCard, ShieldCheck, ShieldAlert, Loader2, Calendar } from 'lucide-react';
import { Settings } from '../types';

interface SubscriptionManagerProps {
  settings: Settings;
  onSuccess: (reference: string) => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ settings, onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const isLicensed = settings.license_expiry && settings.license_expiry > Date.now();
  const expiryDate = settings.license_expiry ? new Date(settings.license_expiry).toLocaleDateString() : 'N/A';

  const handlePaystackPayment = () => {
    setIsProcessing(true);
    
    const handler = (window as any).PaystackPop.setup({
      key: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Replace with your actual Paystack public key
      email: 'customer@naijashop.pos',
      amount: 1000000, // ₦10,000.00 (in kobo)
      currency: 'NGN',
      ref: 'NS-' + Math.floor((Math.random() * 1000000000) + 1),
      callback: (response: any) => {
        setIsProcessing(false);
        onSuccess(response.reference);
      },
      onClose: () => {
        setIsProcessing(false);
      }
    });
    
    handler.openIframe();
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

      <p className="text-sm text-slate-500 font-medium">
        Professional features require an active license. Licenses are ₦10,000 per year per terminal.
      </p>

      <button 
        onClick={handlePaystackPayment}
        disabled={isProcessing}
        className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
      >
        {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
        {isLicensed ? 'Extend License (₦10,000/Yr)' : 'Activate Terminal (₦10,000/Yr)'}
      </button>

      <div className="flex items-center justify-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
         <Calendar size={12} />
         Secure Yearly Renewals
      </div>
    </div>
  );
};

export default SubscriptionManager;
