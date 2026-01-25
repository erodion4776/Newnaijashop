
import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { generateRequestCode } from '../utils/licensing';
import { CheckCircle, ArrowRight, Zap, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { View } from '../types';

interface ActivationPageProps {
  sessionRef: string;
  onActivated: () => void;
}

const SECRET_SALT = "9JA_SECURE_SALT_001";

const ActivationPage: React.FC<ActivationPageProps> = ({ sessionRef, onActivated }) => {
  const [requestCode, setRequestCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAlreadyUsed, setIsAlreadyUsed] = useState(false);

  useEffect(() => {
    const checkRef = async () => {
      const used = await db.used_references.where('reference').equals(sessionRef).first();
      if (used) {
        setIsAlreadyUsed(true);
      }
    };
    checkRef();
    setRequestCode(generateRequestCode());
  }, [sessionRef]);

  const handleActivate = async () => {
    if (!requestCode.trim() || isProcessing) return;
    setIsProcessing(true);
    setError(null);

    try {
      // 1. Double check reference hasn't been used while page was open
      const used = await db.used_references.where('reference').equals(sessionRef).first();
      if (used) {
        throw new Error('This payment has already been used to activate a device.');
      }

      // 2. Generate Activation Key
      // Logic: Simple but secure hashing-like Base64 mix
      const currentYear = new Date().getFullYear();
      const rawKey = `${requestCode}:${SECRET_SALT}:${currentYear}`;
      const activationKey = btoa(rawKey).substring(0, 20).toUpperCase();
      
      const oneYearFromNow = Date.now() + (365 * 24 * 60 * 60 * 1000);

      // 3. Save to DB
      await (db as any).transaction('rw', [db.settings, db.used_references], async () => {
        await db.settings.update('app_settings', {
          license_key: activationKey,
          license_expiry: oneYearFromNow
        });
        await db.used_references.add({
          reference: sessionRef,
          timestamp: Date.now()
        });
      });

      // 4. Success
      onActivated();
    } catch (err: any) {
      setError(err.message || "Activation failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isAlreadyUsed) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center shadow-inner">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Link Expired</h2>
        <p className="text-slate-500 max-w-sm">This payment reference ({sessionRef}) has already been used to activate a terminal.</p>
        <button onClick={onActivated} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest">Return to Terminal</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-12 animate-in fade-in zoom-in duration-500">
      <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-emerald-100 text-center space-y-8">
        <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto animate-bounce-soft">
          <CheckCircle size={56} />
        </div>

        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Payment Received!</h2>
          <p className="text-emerald-600 font-bold uppercase tracking-widest text-[10px]">Reference: {sessionRef}</p>
        </div>

        <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-6 text-left">
           <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terminal ID (Request Code)</label>
              <input 
                type="text" 
                readOnly
                className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-black text-emerald-700 tracking-widest outline-none"
                value={requestCode}
              />
              <p className="text-[10px] text-slate-400 font-medium italic mt-1">* ID detected automatically from this browser.</p>
           </div>

           <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-600">
                 <ShieldCheck size={18} className="text-emerald-500" />
                 <span className="text-sm font-bold">12 Months Full License</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                 <Zap size={18} className="text-amber-500" />
                 <span className="text-sm font-bold">Instant Activation</span>
              </div>
           </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3">
             <AlertCircle size={18} /> {error}
          </div>
        )}

        <button 
          onClick={handleActivate}
          disabled={isProcessing}
          className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} />}
          Activate Terminal App
        </button>
      </div>
    </div>
  );
};

export default ActivationPage;
