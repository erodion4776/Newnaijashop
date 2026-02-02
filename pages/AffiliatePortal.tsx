import React, { useState } from 'react';
import { motion } from 'framer-motion';
// Fix: Added Loader2 to imports from lucide-react
import { 
  Users, 
  Award, 
  Zap, 
  Target, 
  Coins, 
  Gift, 
  TrendingUp, 
  Smartphone, 
  CheckCircle2, 
  Share2, 
  Landmark,
  ArrowRight,
  ShieldCheck,
  Star,
  Banknote,
  Loader2
} from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

const encode = (data: any) => {
  return Object.keys(data)
    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
    .join("&");
}

const AffiliatePortal: React.FC = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    'marketer-name': '',
    'phone-number': '',
    'bank-name': '',
    'account-number': ''
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encode({ 
        "form-name": "affiliate-registration",
        ...formData 
      }),
    })
    .then(() => {
      console.log("Registration Success");
      setIsRegistered(true);
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    })
    .catch((error) => {
      console.error("Registration Error:", error);
      setIsSubmitting(false);
      alert("Submission failed. Please check your connection.");
    });
  };

  const handleShare = () => {
    const text = `Oga, stop using manual notebooks! Use NaijaShop POS for your store. It works 100% offline. Use my code ${formData['phone-number']} to get 1 Month EXTRA free. Download here: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
  };

  if (isRegistered) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md mx-auto bg-white rounded-[3.5rem] shadow-2xl border-4 border-amber-400 overflow-hidden"
        >
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-10 text-white text-center relative">
            <div className="absolute top-4 right-4 text-amber-400 animate-pulse">
              <Star size={24} fill="currentColor" />
            </div>
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
              <ShieldCheck size={48} className="text-emerald-600" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">
              Congratulations, <br/>{formData['marketer-name'].split(' ')[0]}!
            </h3>
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-2">
              Official NaijaShop Partner
            </p>
          </div>
          
          <div className="p-10 space-y-8">
            <div className="text-center space-y-3">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Your Referral Code</p>
               <div className="bg-slate-50 border-2 border-dashed border-emerald-200 py-4 rounded-2xl">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">
                    {formData['phone-number']}
                  </span>
               </div>
               <p className="text-[10px] text-emerald-600 font-bold uppercase">Ask shops to enter this as their "Promo Code"</p>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-amber-600"><Coins size={18} /></div>
                  <p className="text-xs font-bold text-amber-900">₦2,000 commission per activation</p>
               </div>
               <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600"><Gift size={18} /></div>
                  <p className="text-xs font-bold text-emerald-900">Your referrals get 1 Month FREE</p>
               </div>
            </div>

            <button 
              onClick={handleShare}
              className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(5,150,105,0.3)] hover:bg-emerald-700 transition-all active:scale-[0.98]"
            >
              <Share2 size={24} /> Share Invite on WhatsApp
            </button>
            
            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Payouts are processed every Friday
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-emerald-900 text-white">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-800 to-amber-900/40 opacity-90" />
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/></pattern></defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="flex-1 text-center lg:text-left space-y-8"
            >
              <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-400 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest border border-amber-400/30">
                <Star size={14} fill="currentColor" /> Joining the Army
              </div>
              <h1 className="text-5xl lg:text-7xl font-black tracking-tighter leading-[0.95]">
                Turn Your Network <br/>
                <span className="text-amber-400">into Income.</span>
              </h1>
              <p className="text-xl text-emerald-100/80 font-medium leading-relaxed max-w-xl">
                Join the NaijaShop Affiliate Army. Earn <span className="text-white font-black">₦2,000 Per Shop</span> you help go digital. No limit on earnings!
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <button 
                  onClick={() => document.getElementById('reg-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full sm:w-auto bg-amber-500 text-slate-900 px-10 py-6 rounded-[2rem] font-black text-lg shadow-2xl shadow-amber-900/40 hover:bg-amber-400 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  Register Now <ArrowRight />
                </button>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className="flex-1"
            >
              <div className="relative group">
                <div className="absolute -inset-10 bg-amber-500/20 blur-[100px] rounded-full animate-pulse" />
                <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[4rem] shadow-2xl">
                   <div className="flex items-center gap-6 mb-8">
                      <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center text-slate-900 shadow-xl">
                        <Award size={32} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black tracking-tight">Partner Status</h4>
                        <p className="text-amber-400 font-bold uppercase tracking-widest text-[10px]">Verified Marketer</p>
                      </div>
                   </div>
                   <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                        <span className="text-sm font-bold text-emerald-100">Commission Rate</span>
                        <span className="text-xl font-black text-amber-400">₦2,000 / Sale</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                        <span className="text-sm font-bold text-emerald-100">Payout Period</span>
                        <span className="text-xl font-black text-amber-400">Weekly (Fridays)</span>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Join Section */}
      <section className="py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeInUp} className="text-center mb-20 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter text-slate-900">Why Join the Army?</h2>
            <p className="text-slate-500 text-lg font-medium">Build a steady side-hustle helping businesses grow.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                icon: Banknote, 
                title: "Instant Payouts", 
                desc: "We pay your ₦2,000 commission within 24 hours of a shop's subscription. No long stories.", 
                color: "emerald" 
              },
              { 
                icon: Gift, 
                title: "Win-Win Offer", 
                desc: "The shops you refer get 1 Month Extra Free. It is easy to sell because you are giving them a gift!", 
                color: "amber" 
              },
              { 
                icon: TrendingUp, 
                title: "Track Your Growth", 
                desc: "Use your unique phone number as a code. We track every lead transparently in our Master Hub.", 
                color: "indigo" 
              }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all group"
              >
                <div className={`w-14 h-14 bg-${item.color}-50 text-${item.color}-600 rounded-2xl flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 transition-transform`}>
                  <item.icon size={28} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-4">{item.title}</h3>
                <p className="text-slate-500 font-medium leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Steps Section */}
      <section className="py-32 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div {...fadeInUp} className="text-center mb-20 space-y-4">
            <h2 className="text-4xl font-black tracking-tighter text-slate-900">3 Steps to Start Earning</h2>
          </motion.div>

          <div className="space-y-12">
            {[
              { step: "1", title: "Register Below", desc: "Fill in your details and bank account where you want to receive alerts.", icon: Landmark },
              { step: "2", title: "Share Your Code", desc: "Tell shop owners (Pharmacies, Boutiques, Supermarkets) about NaijaShop.", icon: Share2 },
              { step: "3", title: "Receive Alerts", desc: "Get ₦2,000 credited to your bank account for every paid license.", icon: Coins }
            ].map((item, i) => (
              <motion.div 
                key={i}
                {...fadeInUp}
                className="flex items-start gap-8"
              >
                <div className="w-16 h-16 bg-emerald-900 text-amber-400 rounded-2xl flex items-center justify-center shrink-0 font-black text-2xl shadow-xl">
                  {item.step}
                </div>
                <div className="pt-2">
                  <h4 className="text-2xl font-black text-slate-900 mb-2 flex items-center gap-3">
                    {item.title}
                    <item.icon size={20} className="text-emerald-600" />
                  </h4>
                  <p className="text-lg text-slate-500 font-medium">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section className="py-32 bg-slate-900 relative" id="reg-form">
        <div className="absolute inset-0 bg-emerald-900/20 opacity-50" />
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <motion.div 
            {...fadeInUp}
            className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-[4rem] p-12 lg:p-20 shadow-[0_50px_100px_rgba(0,0,0,0.3)]"
          >
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-4xl font-black tracking-tight text-slate-900">Join the Army</h2>
              <p className="text-slate-500 font-medium">Start your journey as a NaijaShop Partner today.</p>
            </div>

            <form 
              name="affiliate-registration" 
              method="POST" 
              data-netlify="true" 
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              <input type="hidden" name="form-name" value="affiliate-registration" />

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                <input 
                  required 
                  name="marketer-name"
                  type="text" 
                  placeholder="e.g. Chinedu Okafor" 
                  className="w-full bg-white border border-slate-200 rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all"
                  value={formData['marketer-name']}
                  onChange={e => setFormData({...formData, 'marketer-name': e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">WhatsApp Phone Number</label>
                <input 
                  required 
                  name="phone-number"
                  type="tel" 
                  placeholder="080..." 
                  className="w-full bg-white border border-slate-200 rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all"
                  value={formData['phone-number']}
                  onChange={e => setFormData({...formData, 'phone-number': e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bank Name</label>
                  <input 
                    required 
                    name="bank-name"
                    type="text" 
                    placeholder="e.g. OPay / Zenith" 
                    className="w-full bg-white border border-slate-200 rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all"
                    value={formData['bank-name']}
                    onChange={e => setFormData({...formData, 'bank-name': e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Account Number</label>
                  <input 
                    required 
                    name="account-number"
                    type="text" 
                    inputMode="numeric"
                    placeholder="0123456789" 
                    className="w-full bg-white border border-slate-200 rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all"
                    value={formData['account-number']}
                    onChange={e => setFormData({...formData, 'account-number': e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-6">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black text-xl shadow-2xl shadow-emerald-900/40 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <>Join the Army & Get My Code <Zap size={20} fill="currentColor" /></>
                  )}
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Safe & Secure Registration • Data Stays with NaijaShop
              </p>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-20 text-center border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center space-y-8">
           <img src={LOGO_URL} className="w-16 h-16 object-contain" alt="Logo" />
           <div className="flex gap-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <a href="/" className="hover:text-emerald-600 transition-colors">Back to Main Site</a>
              <a href="/terms" className="hover:text-emerald-600 transition-colors">Partner Terms</a>
              <a href="/support" className="hover:text-emerald-600 transition-colors">Marketer Support</a>
           </div>
           <p className="text-slate-400 text-xs font-medium">&copy; {new Date().getFullYear()} NaijaShop POS. Empowering the Hustle.</p>
        </div>
      </footer>
    </div>
  );
};

export default AffiliatePortal;