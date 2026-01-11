
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Landmark, Timer, CheckCircle, ShieldCheck, User, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import { View } from '../types';

interface TransferStationProps {
  setView: (view: View) => void;
}

const TransferStation: React.FC<TransferStationProps> = ({ setView }) => {
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [staffId, setStaffId] = useState('Admin');

  useEffect(() => {
    if (timeLeft > 0 && isTimerRunning) {
      const timerId = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timerId);
    }
  }, [timeLeft, isTimerRunning]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const handleConfirm = async () => {
    if (!staffId.trim()) {
      alert("Please enter the Attending Staff name for accountability.");
      return;
    }

    setIsVerifying(true);
    setIsTimerRunning(false); // Stop timer immediately

    try {
      // Find the most recent unconfirmed transfer transaction
      const pendingSale = await db.sales
        .where('payment_method')
        .equals('transfer')
        .filter(s => s.sync_status === 'pending')
        .last();

      if (pendingSale) {
        const verificationTime = Date.now();
        await db.sales.update(pendingSale.id!, {
          payment_method: 'Bank Transfer',
          confirmed_by: staffId,
          verification_timestamp: verificationTime,
          sync_status: 'verified',
          // Explicitly update timestamp to the confirmation time for logging
          timestamp: verificationTime 
        });

        setIsSuccess(true);
        
        // Anti-Fraud Log Feedback
        console.info(`[ANTI-FRAUD] Transaction ${pendingSale.id} verified by ${staffId} at ${new Date(verificationTime).toISOString()}`);

        // Automatically redirect back to POS after 2 seconds
        setTimeout(() => {
          setView('pos');
        }, 2500);
      } else {
        alert("No pending transfer transaction found to verify. Returning to POS.");
        setView('pos');
      }
    } catch (err) {
      console.error("Verification error:", err);
      alert("Verification failed. Please check the transaction log.");
      setIsTimerRunning(true); // Restart timer if it failed
    } finally {
      setIsVerifying(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-emerald-950/95 backdrop-blur-xl">
        <div className="text-center space-y-8 animate-in zoom-in duration-500">
          <div className="w-32 h-32 bg-white text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-[0_0_100px_rgba(255,255,255,0.2)]">
            <CheckCircle size={80} className="animate-bounce" />
          </div>
          <div className="space-y-3">
            <h2 className="text-5xl font-black text-white tracking-tighter">Payment Verified</h2>
            <p className="text-emerald-300 font-bold text-xl">Sale Logged & Confirmed by {staffId}</p>
          </div>
          <div className="inline-flex items-center gap-2 bg-white/10 px-6 py-3 rounded-2xl text-white font-black text-sm uppercase tracking-widest border border-white/10">
            <Loader2 size={16} className="animate-spin" /> Redirecting to POS Terminal...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-indigo-900 to-emerald-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Landmark size={120} />
        </div>
        
        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
              <Landmark size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black">Bank Details</h2>
              <p className="text-emerald-300 font-bold uppercase tracking-widest text-xs">Customer Transfer Mode</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/50 uppercase">Bank Name</p>
              <p className="text-2xl font-black">{settings?.bank_name || 'NOT CONFIGURED'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/50 uppercase">Account Number</p>
              <p className="text-4xl font-black tracking-tighter text-emerald-400">
                {settings?.account_number || '0000000000'}
              </p>
            </div>
            <div className="col-span-full space-y-1 border-t border-white/10 pt-4 text-center md:text-left">
              <p className="text-xs font-bold text-white/50 uppercase">Account Name</p>
              <p className="text-xl font-bold uppercase tracking-wide">{settings?.account_name || 'SET SHOP NAME IN SETTINGS'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${timeLeft < 60 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
            <Timer size={40} />
          </div>
          <h4 className="text-sm font-black text-slate-400 uppercase mb-2">Verification Window</h4>
          <div className={`text-5xl font-black tabular-nums transition-colors duration-300 ${timeLeft < 60 ? 'text-rose-600' : 'text-slate-800'}`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <p className="text-xs text-slate-400 mt-4 leading-relaxed px-4">
            Instruct customer to complete transfer within this window. Check your bank app for alert before confirming.
          </p>
          {timeLeft === 0 && (
             <div className="mt-4 flex items-center gap-2 text-rose-500 font-black text-[10px] uppercase">
                <XCircle size={14} /> Window Closed - Re-verify Alert Manually
             </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Attending Staff (Accountability)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  placeholder="Enter Staff Name"
                />
              </div>
            </div>

            <button 
              onClick={handleConfirm}
              disabled={isVerifying || isSuccess}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isVerifying ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  <CheckCircle size={24} className="group-hover:scale-110 transition-transform" />
                  Confirm Alert Received
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-emerald-600">
              <ShieldCheck size={16} />
              <span className="text-[10px] font-black uppercase tracking-wider">Anti-Fraud Protection Active</span>
            </div>
            <button 
              onClick={() => setView('pos')}
              className="text-slate-400 text-[10px] font-bold uppercase hover:text-rose-500 transition-colors flex items-center gap-1"
            >
              Cancel & Return to POS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferStation;
