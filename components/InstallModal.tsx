
import React from 'react';
import { Download, CheckCircle, Zap, ShieldCheck, X } from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface InstallModalProps {
  onInstall: () => void;
  onClose: () => void;
}

const InstallModal: React.FC<InstallModalProps> = ({ onInstall, onClose }) => {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-emerald-950/95 backdrop-blur-2xl">
      <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-[0_32px_100px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in duration-500 relative">
        <button onClick={onClose} className="absolute top-8 right-8 p-2 text-slate-300 hover:text-slate-500 transition-colors">
          <X size={24} />
        </button>

        <div className="p-10 text-center space-y-8">
          <div className="w-28 h-28 bg-slate-50 border border-slate-100 rounded-[2.5rem] p-5 flex items-center justify-center mx-auto shadow-xl animate-pulse-soft">
            <img src={LOGO_URL} className="w-full h-full object-contain" alt="NaijaShop Logo" />
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight">Install NaijaShop<br/>on your Device</h2>
            <p className="text-slate-500 font-medium">Install NaijaShop on your Home Screen for 100% Offline Access. No Data Required!</p>
          </div>

          <div className="grid grid-cols-1 gap-4 text-left">
            <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="p-2 bg-white text-emerald-600 rounded-xl shadow-sm"><ShieldCheck size={20} /></div>
              <p className="text-sm font-black text-emerald-900 uppercase tracking-wide">Works Without Internet</p>
            </div>
            <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <div className="p-2 bg-white text-indigo-600 rounded-xl shadow-sm"><Zap size={20} /></div>
              <p className="text-sm font-black text-indigo-900 uppercase tracking-wide">Faster Than Website</p>
            </div>
            <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <div className="p-2 bg-white text-amber-600 rounded-xl shadow-sm"><CheckCircle size={20} /></div>
              <p className="text-sm font-black text-amber-900 uppercase tracking-wide">Zero Data Tax (Offline)</p>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={onInstall}
              className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-[0_20px_40px_rgba(5,150,105,0.3)] hover:bg-emerald-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <Download size={24} />
              Install Now (Free)
            </button>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-6">Secure • Verified • Offline-First</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallModal;
