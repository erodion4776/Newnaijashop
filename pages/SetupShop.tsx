import React, { useState } from 'react';
import { db } from '../db/db';
import { generateRequestCode } from '../utils/licensing';
import { 
  Store, 
  User, 
  Lock, 
  Rocket, 
  Loader2, 
  CheckCircle2, 
  Ticket
} from 'lucide-react';

interface SetupShopProps {
  onComplete: (adminId: number) => void;
}

const encode = (data: any) => {
  return Object.keys(data)
    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
    .join("&");
}

const SetupShop: React.FC<SetupShopProps> = ({ onComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    shopName: '',
    adminName: '',
    adminPin: '',
    referralCode: ''
  });

  const terminalId = generateRequestCode();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // 1. Submit to Netlify Tracking (AJAX Background)
    try {
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode({ 
          "form-name": "shop-registration",
          "shop-name": formData.shopName,
          "admin-name": formData.adminName,
          "terminal-id": terminalId,
          "referral-code-used": formData.referralCode || "NONE"
        }),
      })
      .then(() => console.log("Netlify Tracking Success"))
      .catch((error) => console.error("Netlify Tracking Error:", error));
    } catch (err) {
      console.error("Netlify POST catch", err);
    }

    // 2. Perform Local DB Setup (Guaranteed regardless of network)
    try {
      await (db as any).transaction('rw', [db.settings, db.staff], async () => {
        const now = Date.now();
        await db.settings.update('app_settings', {
          shop_name: formData.shopName,
          admin_name: formData.adminName,
          admin_pin: formData.adminPin,
          is_setup_complete: true,
          // Trial Initialization & Security
          installationDate: now,
          isTrialActive: true,
          isSubscribed: false,
          last_used_timestamp: now
        } as any);

        const adminId = await db.staff.add({
          name: formData.adminName,
          role: 'Admin',
          password: formData.adminPin,
          status: 'Active',
          created_at: now
        });

        // 3. Finalize
        setTimeout(() => {
          onComplete(adminId as number);
        }, 1000);
      });
    } catch (err) {
      alert("Critical DB Error: " + err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Onboarding</h2>
          <p className="text-slate-500 font-medium">Initialize your shop terminal</p>
        </div>

        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-emerald-600">
            <Store size={120} />
          </div>

          <form onSubmit={handleSetup} className="space-y-6 relative z-10">
            <input type="hidden" name="form-name" value="shop-registration" />
            
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Store Name</label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  required 
                  name="shop-name"
                  type="text" 
                  placeholder="e.g. Alaba Provisions Store" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={formData.shopName}
                  onChange={e => setFormData({...formData, shopName: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Business Owner Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  required 
                  name="admin-name"
                  type="text" 
                  placeholder="Your Full Name" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={formData.adminName}
                  onChange={e => setFormData({...formData, adminName: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Admin PIN</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    required 
                    type="password" 
                    maxLength={4} 
                    placeholder="••••" 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl text-center outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={formData.adminPin}
                    onChange={e => setFormData({...formData, adminPin: e.target.value.replace(/\D/g, '')})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Promo Code</label>
                <div className="relative">
                  <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    name="referral-code-used"
                    placeholder="Optional" 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={formData.referralCode}
                    onChange={e => setFormData({...formData, referralCode: e.target.value.toUpperCase()})}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={isProcessing}
                className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-700 shadow-xl shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    Registering Terminal...
                  </>
                ) : (
                  <>
                    <Rocket size={24} />
                    Complete Setup
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Hardware ID: {terminalId}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupShop;