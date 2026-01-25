
import React, { useState } from 'react';
import { 
  Users, 
  Target, 
  Award, 
  Share2, 
  CheckCircle2, 
  Copy, 
  CreditCard,
  UserPlus,
  ShieldCheck,
  Smartphone,
  Landmark
} from 'lucide-react';
import { generateRequestCode } from '../utils/licensing';

const AffiliatePortal: React.FC = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const marketerCode = generateRequestCode().replace('NS-', 'MARK-');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Do not call e.preventDefault() immediately to allow standard form submission to target iframe
    setIsSubmitting(true);
    console.log("Submitting affiliate registration to Netlify via hidden iframe...");
    
    // Show success UI after a brief delay to simulate network turnaround
    setTimeout(() => {
      setIsRegistered(true);
      setIsSubmitting(false);
    }, 600);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(marketerCode);
    alert("Referral Code Copied!");
  };

  if (isRegistered) {
    return (
      <div className="max-w-md mx-auto py-12 animate-in fade-in zoom-in duration-500">
        <div className="bg-white rounded-[3rem] shadow-2xl border border-emerald-100 overflow-hidden">
          <div className="bg-emerald-600 p-8 text-white text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
              <Award size={40} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tight">Verified Marketer</h3>
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">Official NaijaShop Partner</p>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="text-center space-y-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Your Unique Referral Code</p>
               <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">{marketerCode}</span>
                  <button onClick={copyCode} className="p-2 bg-slate-100 rounded-xl text-slate-400 hover:text-emerald-600 transition-colors">
                    <Copy size={20} />
                  </button>
               </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
               <div className="flex items-start gap-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600"><Target size={18} /></div>
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase">Earning Potential</p>
                    <p className="text-sm text-slate-500 font-medium">Earn ₦2,000 for every shop that uses your code to activate their terminal.</p>
                  </div>
               </div>
            </div>

            <button 
              onClick={() => {
                const text = `Oga, stop using manual notebooks! Use NaijaShop POS for your store. Use my code ${marketerCode} to get a discount. Download here: ${window.location.origin}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-700 transition-all active:scale-[0.98]"
            >
              <Share2 size={24} /> Share to WhatsApp
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-indigo-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <Users size={180} />
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black tracking-tight">Affiliate Portal</h2>
          <p className="text-indigo-300 font-bold uppercase tracking-widest text-[10px] mt-1">Earn rewards for growing the community</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-2xl font-black text-slate-800">Become a Partner</h3>
          <p className="text-slate-500 font-medium leading-relaxed">
            Are you a marketer, consultant, or business enthusiast? Help Nigerian retailers digitize their shops and earn <b>₦2,000 commission</b> on every successful terminal activation.
          </p>
          
          <div className="space-y-4">
             {[
               { icon: CheckCircle2, text: "Instant referral code generation" },
               { icon: CreditCard, text: "Weekly payouts to your bank account" },
               { icon: Smartphone, text: "Track your earnings 100% offline" },
               { icon: ShieldCheck, text: "Official NaijaShop Partner verification" }
             ].map((item, i) => (
               <div key={i} className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                  <item.icon size={18} className="text-emerald-500" />
                  <span>{item.text}</span>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl relative">
          <form 
            name="affiliate-registration" 
            method="POST" 
            action="/"
            target="hidden_iframe"
            data-netlify="true" 
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <input type="hidden" name="form-name" value="affiliate-registration" />

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Full Name</label>
              <input 
                required 
                name="marketer-name"
                type="text" 
                placeholder="Okafor Chinedu" 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">WhatsApp Phone Number</label>
              <input 
                required 
                name="phone-number"
                type="tel" 
                placeholder="080..." 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Bank Name</label>
                <div className="relative">
                  <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    required 
                    name="bank-name"
                    type="text" 
                    placeholder="e.g. OPay" 
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Account Number</label>
                <input 
                  required 
                  name="account-number"
                  type="text" 
                  inputMode="numeric"
                  placeholder="0123456789" 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Registering...
                </>
              ) : (
                <>
                  <UserPlus size={24} /> Register Now
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AffiliatePortal;
