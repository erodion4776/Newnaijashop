import React, { useState } from 'react';
import { 
  ArrowRight, 
  WifiOff, 
  ShieldCheck, 
  CheckCircle2, 
  Users, 
  Zap, 
  MessageSquare,
  Globe,
  MessageCircle,
  ShieldAlert
} from 'lucide-react';
import MarketingBot from '../components/MarketingBot';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

const encode = (data: any) => {
  return Object.keys(data)
    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
    .join("&");
}

interface LandingPageProps {
  onStartTrial: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartTrial }) => {
  const [formState, setFormState] = useState({ name: '', phone: '', business: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encode({ "form-name": "enquiry-form", ...formState })
    })
    .then(() => {
      setIsSubmitted(true);
      setIsSubmitting(false);
    })
    .catch(error => {
      console.error(error);
      setIsSubmitting(false);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-slate-100 rounded-lg p-1 flex items-center justify-center shadow-sm overflow-hidden">
              <img 
                src={LOGO_URL} 
                alt="NaijaShop Logo" 
                className="w-full h-full object-contain" 
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="text-xl font-black tracking-tighter text-emerald-600 uppercase">NaijaShop</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={onStartTrial} className="hidden md:block text-sm font-black text-slate-500 uppercase tracking-widest hover:text-emerald-600 transition-colors">Login</button>
            <button 
              onClick={onStartTrial}
              className="bg-emerald-600 text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-40 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://i.ibb.co/qFD5Jyn9/IMG-20260125-230827.png" 
            className="w-full h-full object-cover opacity-[0.07] scale-110 blur-sm"
            alt="Market Background"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-transparent to-slate-50" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 text-center lg:text-left space-y-8 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest animate-in fade-in slide-in-from-bottom-4">
                <WifiOff size={14} /> 100% Offline POS
              </div>
              <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-slate-900 leading-[0.95]">
                The POS That Doesn't Ask for Data.
              </h1>
              <p className="text-xl text-slate-500 font-medium leading-relaxed">
                Prevent staff theft, track your profit margins, and manage your inventory from your mobile device—even without an internet connection. Professional software for Nigerian SMEs.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <button 
                  onClick={onStartTrial}
                  data-cta="primary"
                  className="hero-cta w-full sm:w-auto bg-emerald-600 text-white px-10 py-6 rounded-[2rem] font-black text-lg shadow-2xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                >
                  Start 30-Day Free Trial
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="flex -space-x-3 items-center">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-slate-200 overflow-hidden">
                        <img 
                          src={`https://i.pravatar.cc/100?u=user${i}`} 
                          alt="user" 
                          className="w-full h-full object-cover" 
                          loading="lazy"
                        />
                     </div>
                   ))}
                   <p className="ml-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">+500 Active Terminals</p>
                </div>
              </div>
            </div>

            <div className="flex-1 relative animate-in fade-in zoom-in duration-1000">
               <div className="relative z-20 transform hover:scale-105 transition-transform duration-700">
                  <div className="absolute -inset-4 bg-emerald-500/20 blur-[100px] rounded-full" />
                  <div className="overflow-hidden rounded-[3rem] shadow-2xl bg-white border-4 border-slate-100">
                    <img 
                      src="https://i.ibb.co/G49dWgYg/20260207-062946-0000.png" 
                      alt="NaijaShop App Mockup" 
                      className="w-full max-w-lg mx-auto object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
               </div>
               
               {/* Floating Badges */}
               <div className="absolute -top-10 -right-4 lg:-right-10 bg-white p-6 rounded-[2rem] shadow-2xl animate-bounce-soft z-30 border border-slate-100 hidden sm:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inventory Value</p>
                  <p className="text-2xl font-black text-emerald-600">₦4,250,000</p>
               </div>
               <div className="absolute bottom-10 -left-4 lg:-left-10 bg-slate-900 p-6 rounded-[2rem] shadow-2xl z-30 animate-pulse hidden sm:block">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-white"><ShieldAlert size={20} /></div>
                     <div>
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Security</p>
                        <p className="text-sm font-black text-white">Audit Log Alert!</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
             <h2 className="text-4xl font-black tracking-tighter text-slate-900">Enterprise-Grade Security</h2>
             <p className="text-lg text-slate-500 font-medium">Professional tools designed to empower local businesses and secure their daily revenue.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Feature 1 */}
            <div className="group space-y-6">
               <div className="aspect-[16/10] bg-indigo-50 rounded-[3rem] overflow-hidden border border-indigo-100 relative shadow-xl">
                  <img 
                    src="https://i.ibb.co/4RBY8YpG/IMG-20260126-091840.png" 
                    alt="AI Notebook Scanner" 
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-1000"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-8 left-8 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-indigo-100 shadow-xl flex items-center gap-2">
                     <Zap size={14} className="text-indigo-600 fill-indigo-600" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">On-Device AI</span>
                  </div>
               </div>
               <div className="px-4">
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Automated Inventory Import</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    Convert your handwritten ledger into a digital inventory instantly using our advanced on-device scanner. No manual data entry required.
                  </p>
               </div>
            </div>

            {/* Feature 2 */}
            <div className="group space-y-6">
               <div className="aspect-[16/10] bg-rose-50 rounded-[3rem] overflow-hidden border border-rose-100 relative shadow-xl">
                  <img 
                    src="https://i.ibb.co/dF24xCd/IMG-20260126-091902.png" 
                    alt="Audit Trail Logs" 
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-1000"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-8 left-8 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-rose-100 shadow-xl flex items-center gap-2">
                     <ShieldCheck size={14} className="text-rose-600" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-rose-900">Fortress Security</span>
                  </div>
               </div>
               <div className="px-4">
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Advanced Staff Monitoring</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    Account for every transaction with comprehensive activity logs. Our system provides real-time transparency into terminal operations and overrides.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enquiry Form */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl font-black tracking-tight">Questions? <br/>Let's Talk Business.</h2>
              <p className="text-slate-400 font-medium text-lg leading-relaxed">
                Fill the form to reach our dedicated support team. We help Nigerian businesses set up digital structures for growth.
              </p>
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center">
                    <MessageSquare size={24} />
                 </div>
                 <div>
                    <p className="font-black text-lg">Instant WhatsApp Support</p>
                    <p className="text-emerald-400 font-bold">0818 477 4884</p>
                 </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] text-slate-900">
              {isSubmitted ? (
                <div className="text-center py-20 space-y-4">
                   <CheckCircle2 size={64} className="text-emerald-600 mx-auto" />
                   <h3 className="text-2xl font-black">Message Sent!</h3>
                   <p className="text-slate-500 font-medium">We will contact you shortly.</p>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <input type="hidden" name="form-name" value="enquiry-form" />
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                    <input required name="full-name" value={formState.name} onChange={e => setFormState({...formState, name: e.target.value})} type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</label>
                    <input required name="phone-number" value={formState.phone} onChange={e => setFormState({...formState, phone: e.target.value})} type="tel" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Business Type</label>
                    <input required name="business-type" value={formState.business} onChange={e => setFormState({...formState, business: e.target.value})} type="text" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Message</label>
                    <textarea name="message" value={formState.message} onChange={e => setFormState({...formState, message: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 h-32 resize-none"></textarea>
                  </div>
                  <button disabled={isSubmitting} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl disabled:opacity-50">
                    {isSubmitting ? 'Sending...' : 'Send Enquiry'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-20 border-t border-slate-100 text-center">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center space-y-8">
           <img src={LOGO_URL} className="w-16 h-16 object-contain" alt="Logo" />
           <p className="text-slate-400 text-sm font-medium">&copy; {new Date().getFullYear()} NaijaShop. Built for African SMEs.</p>
        </div>
      </footer>

      {/* Floating Marketing Bot */}
      <MarketingBot />
    </div>
  );
};

export default LandingPage;