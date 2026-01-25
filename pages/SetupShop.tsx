
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

    // 1. Submit to Netlify Tracking (AJAX) using URLSearchParams for reliability
    // We use the encode helper provided in instructions for consistency
    const netlifyData = { 
      "form-name": "shop-registration",
      "shop-name": formData.shopName,
      "admin-name": formData.adminName,
      "terminal-id": terminalId,
      "referral-code-used": formData.referralCode || "NONE"
    };

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encode(netlifyData),
    })
    .then(() => console.log("Netlify Form Tracking Success"))
    .catch((error) => console.error("Netlify Form Tracking Error:", error));

    // 2. Perform Local DB Setup (Guaranteed regardless of network)
    try {
      await (db as any).transaction('rw', [db.settings, db.staff], async () => {
        await db.settings.update('app_settings', {
          shop_name: formData.shopName,
          admin_name: formData.adminName,
          admin_pin: formData.adminPin,
          is_setup_complete: true
        });

        const adminId = await db.staff.add({
          name: formData.adminName,
          role: 'Admin',
          password: formData.adminPin,
          status: 'Active',
          created_at: Date.now()
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

          <form 
            name="shop-registration"
            method="POST"
            action="/"
            target="hidden_iframe"
            data-netlify="true"
            onSubmit={handleSetup} 
            className="space-y-6 relative z-10"
          >
            <input type="hidden" name="form-name" value="shop-registration" />
            <input type="hidden" name="terminal-id" value={terminalId} />

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
              <label className="block text-[10px] font-