import React from 'react';
import { Download, CheckCircle, Zap, ShieldCheck, X, Share, PlusSquare, ArrowUp, Smartphone } from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface InstallModalProps {
  onInstall: () => void;
  onClose: () => void;
  isAfterSetup?: boolean;
}

const InstallModal: React.FC<InstallModalProps> = ({ onInstall, onClose, isAfterSetup }) => {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-emerald-950/98 backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="bg-white rounded-[3.5rem] w-full max-w-xl shadow-[0_32px_100px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in duration-700 relative flex flex-col">
        
        {/* Registration Success Banner */}
        {isAfterSetup && (
          <div className="bg-emerald-600 py-6 px-10 text-white flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <CheckCircle size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight leading-none uppercase">Registration Successful!</h3>
              <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mt-1">Terminal Initialized Successfully</p>
            </div>
          </div>
        )}

        <div className="p-10 text-center space-y-8 flex-1 overflow-y-auto scrollbar-hide">
          <div className="w-32 h-32 bg-slate-50 border border-slate-100 rounded-[3rem] p-6 flex items-center justify-center mx-auto shadow-inner animate-pulse-soft">
            <img src={LOGO_URL} className="w-full h-full object-contain" alt="NaijaShop Logo" />
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-[1.1]">Oga, your shop is ready!</h2>
            <p className="text-slate-500 font-medium text-lg leading-relaxed">Now, install NaijaShop on your home screen to use it 100% Offline without using any data.</p>
          </div>

          {isIOS ? (
            <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] p-8 space-y-6 text-left animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-3">
                <Smartphone className="text-indigo-600" size={24} />
                <h4 className="font-black text-indigo-900 uppercase text-xs tracking-widest">How to Install on iPhone</h4>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-indigo-600 font-black">1</div>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">Tap the Share button <span className="p-1.5 bg-white rounded-lg shadow-sm"><Share size={16}/></span> in Safari</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-indigo-600 font-black">2</div>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">Select <span className="font-black">'Add to Home Screen'</span> <PlusSquare size={16}/></p>
                </div>
              </div>

              <div className="pt-2 border-t border-indigo-100 mt-4 flex items-center justify-center gap-2 text-indigo-400">
                <ArrowUp className="animate-bounce" size={20} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Look for the button below</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 text-left">
              <div className="flex items-center gap-4 p-5 bg-emerald-50 rounded-3xl border border-emerald-100">
                <div className="p-2.5 bg-white text-emerald-600 rounded-2xl shadow-sm"><ShieldCheck size={24} /></div>
                <div>
                  <p className="text-sm font-black text-emerald-900 uppercase tracking-wide leading-none mb-1">Zero Data Usage</p>
                  <p className="text-xs font-medium text-emerald-700 opacity-80">Works perfectly without an active plan.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-5 bg-indigo-50 rounded-3xl border border-indigo-100">
                <div className="p-2.5 bg-white text-indigo-600 rounded-2xl shadow-sm"><Zap size={24} /></div>
                <div>
                  <p className="text-sm font-black text-indigo-900 uppercase tracking-wide leading-none mb-1">Instant Loading</p>
                  <p className="text-xs font-medium text-indigo-700 opacity-80">Faster than opening a web browser.</p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 space-y-4">
            {!isIOS && (
              <button 
                onClick={onInstall}
                className="w-full py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black text-xl shadow-[0_20px_40px_rgba(5,150,105,0.3)] hover:bg-emerald-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Download size={24} />
                Install to My Phone
              </button>
            )}
            
            <button 
              onClick={onClose}
              className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
            >
              Not Now, Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallModal;