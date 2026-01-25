import React from 'react';
import { 
  CheckCircle2, 
  Smartphone, 
  ShieldCheck, 
  WifiOff, 
  ArrowRight, 
  MessageCircle, 
  Zap,
  Globe,
  Users,
  ShieldAlert
} from 'lucide-react';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

interface LandingPageProps {
  onStartTrial: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartTrial }) => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl p-1.5 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 uppercase">NaijaShop</span>
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
                Stop staff theft, track your interest, and manage your shop from your phone—even without internet. Built specifically for Nigerian SMEs.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <button 
                  onClick={onStartTrial}
                  className="w-full sm:w-auto bg-emerald-600 text-white px-10 py-6 rounded-[2rem] font-black text-lg shadow-2xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
                >
                  Start 30-Day Free Trial
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="flex -space-x-3 items-center">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-slate-200 overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?u=user${i}`} alt="user" />
                     </div>
                   ))}
                   <p className="ml-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">+500 Shops Onboarded</p>
                </div>
              </div>
            </div>

            <div className="flex-1 relative animate-in fade-in zoom-in duration-1000">
               <div className="relative z-20 transform hover:scale-105 transition-transform duration-700">
                  <div className="absolute -inset-4 bg-emerald-500/20 blur-[100px] rounded-full" />
                  <img 
                    src="https://i.ibb.co/W4XQSpqw/IMG-20260125-230934.png" 
                    alt="NaijaShop App Mockup" 
                    className="w-full max-w-lg mx-auto drop-shadow-[0_40px_80px_rgba(0,0,0,0.2)] rounded-[3rem]"
                  />
               </div>
               
               {/* Floating Badges */}
               <div className="absolute -top-10 -right-4 lg:-right-10 bg-white p-6 rounded-[2rem] shadow-2xl animate-bounce-soft z-30 border border-slate-100 hidden sm:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Value</p>
                  <p className="text-2xl font-black text-emerald-600">₦4,250,000</p>
               </div>
               <div className="absolute bottom-10 -left-4 lg:-left-10 bg-slate-900 p-6 rounded-[2rem] shadow-2xl z-30 animate-pulse hidden sm:block">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white"><ShieldAlert size={20} /></div>
                     <div>
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Alert</p>
                        <p className="text-sm font-black text-white">Stock Level Low!</p>
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
             <h2 className="text-4xl font-black tracking-tighter text-slate-900">The 'Naija-Proof' System</h2>
             <p className="text-lg text-slate-500 font-medium">Everything you need to grow your business, built to survive the Alaba and Onitsha market reality.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Feature 1: AI Scanner */}
            <div className="group space-y-6">
               <div className="aspect-[16/10] bg-indigo-50 rounded-[3rem] overflow-hidden border border-indigo-100 p-8 flex items-center justify-center relative">
                  <img 
                    src="https://i.ibb.co/My2hF9Sy/IMG-20260125-231246.png" 
                    alt="AI Notebook Scanner" 
                    className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-1000"
                  />
                  <div className="absolute top-8 left-8 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-indigo-100 shadow-xl flex items-center gap-2">
                     <Zap size={14} className="text-indigo-600 fill-indigo-600" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">Local AI Core</span>
                  </div>
               </div>
               <div className="px-4">
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Digitize Your Notebook</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    Snap your old paper records and turn them into digital stock instantly with our local scanner. No typing needed, just click and stock!
                  </p>
               </div>
            </div>

            {/* Feature 2: Audit Trail */}
            <div className="group space-y-6">
               <div className="aspect-[16/10] bg-rose-50 rounded-[3rem] overflow-hidden border border-rose-100 p-8 flex items-center justify-center relative">
                  <img 
                    src="https://i.ibb.co/JWxHN3jM/IMG-20260125-231456.png" 
                    alt="Audit Trail Logs" 
                    className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-1000"
                  />
                  <div className="absolute top-8 left-8 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-rose-100 shadow-xl flex items-center gap-2">
                     <ShieldCheck size={14} className="text-rose-600" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-rose-900">Security Guard</span>
                  </div>
               </div>
               <div className="px-4">
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Stop Staff Theft</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    Track every kobo with a detailed activity log that matches your physical records. If money is missing, the terminal will tell you who and when.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Inventory Management Section */}
      <section className="py-24 bg-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1 space-y-10">
               <div className="space-y-6">
                  <h2 className="text-4xl lg:text-5xl font-black tracking-tighter leading-tight">Manage 1,000+ Products <br className="hidden lg:block"/> Fully Offline.</h2>
                  <p className="text-xl text-slate-400 font-medium leading-relaxed">
                    Check stock levels, update prices across your entire shop, and see your total shop value without spending 1kb on data. NaijaShop runs locally on your device storage.
                  </p>
               </div>
               
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-inner">
                        <CheckCircle2 size={24} />
                     </div>
                     <h4 className="font-black text-sm uppercase tracking-widest">Low Stock Alerts</h4>
                     <p className="text-xs text-slate-500 font-medium">Automatic red labels when products finish.</p>
                  </div>
                  <div className="space-y-2">
                     <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-inner">
                        <CheckCircle2 size={24} />
                     </div>
                     <h4 className="font-black text-sm uppercase tracking-widest">Bulk Price Update</h4>
                     <p className="text-xs text-slate-500 font-medium">Increase prices for inflation in one click.</p>
                  </div>
               </div>

               <button 
                  onClick={onStartTrial}
                  className="bg-white text-slate-900 px-10 py-6 rounded-[2rem] font-black text-lg hover:bg-emerald-50 transition-all flex items-center justify-center gap-3"
               >
                 Try it Now <ArrowRight />
               </button>
            </div>
            
            <div className="flex-1 relative">
               <img 
                 src="https://i.ibb.co/5gkwgcFj/IMG-20260125-231701.png" 
                 alt="Inventory Screen" 
                 className="w-full max-w-md mx-auto transform lg:translate-x-10 rounded-[3rem] shadow-[0_0_100px_rgba(16,185,129,0.15)]"
               />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-emerald-50">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-12">
           <div className="w-24 h-24 rounded-full overflow-hidden mx-auto border-4 border-white shadow-2xl">
              <img src="https://i.ibb.co/Z6rXhfGv/IMG-20260125-231857.png" alt="Amaka" className="w-full h-full object-cover" />
           </div>
           <blockquote className="text-3xl lg:text-4xl font-black italic text-slate-900 tracking-tight leading-tight">
             "NaijaShop changed my business. I can finally see my real profit every day without arguing with my sales girl!"
           </blockquote>
           <div>
              <p className="text-xl font-black text-emerald-700">Amaka O.</p>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Boutique Owner, Lagos</p>
           </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
           <div className="text-center mb-20 space-y-4">
              <h2 className="text-4xl font-black tracking-tighter">Start Selling in 2 Minutes</h2>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="text-center space-y-6">
                 <div className="aspect-[4/3] rounded-[3rem] bg-slate-50 border border-slate-100 overflow-hidden p-6 flex items-center justify-center shadow-inner relative group">
                    <img src="https://i.ibb.co/CKvkDCGN/IMG-20260125-232116.png" alt="Step 1" className="w-full h-full object-contain transform group-hover:scale-105 transition-transform" />
                    <div className="absolute top-4 left-4 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black">1</div>
                 </div>
                 <p className="text-lg font-black text-slate-800">Install the app and launch your secure terminal.</p>
              </div>
              <div className="text-center space-y-6">
                 <div className="aspect-[4/3] rounded-[3rem] bg-slate-50 border border-slate-100 flex flex-col items-center justify-center shadow-inner relative">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-emerald-600 mb-4 animate-bounce-soft"><Smartphone size={40} /></div>
                    <div className="absolute top-4 left-4 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black">2</div>
                 </div>
                 <p className="text-lg font-black text-slate-800">Setup your shop name and Admin PIN.</p>
              </div>
              <div className="text-center space-y-6">
                 <div className="aspect-[4/3] rounded-[3rem] bg-emerald-600 flex flex-col items-center justify-center shadow-2xl relative">
                    <CheckCircle2 size={80} className="text-white animate-pulse" />
                    <div className="absolute top-4 left-4 w-10 h-10 bg-white text-emerald-600 rounded-full flex items-center justify-center font-black">3</div>
                 </div>
                 <p className="text-lg font-black text-slate-800">Start selling and tracking your interest!</p>
              </div>
           </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tighter">Choose Your Access</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Card 1 */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col hover:border-emerald-500 transition-all group">
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kickstart</p>
                <h3 className="text-2xl font-black text-slate-900 mb-6">Free Trial</h3>
                <div className="mb-8">
                   <span className="text-5xl font-black text-slate-900">₦0</span>
                   <span className="text-slate-400 font-bold ml-2">/ 30 Days</span>
                </div>
                <ul className="space-y-4">
                  {[ "All Pro Features included", "Offline Inventory", "AI Scanner (Limit 5)", "Detailed Sales History" ].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-500">
                      <CheckCircle2 size={16} className="text-emerald-500" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={onStartTrial} className="mt-10 w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest group-hover:bg-emerald-600 group-hover:text-white transition-all active:scale-95">Get Started</button>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-10 rounded-[3rem] border-4 border-emerald-600 shadow-2xl flex flex-col relative scale-105 z-10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">Most Popular</div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Sustainable</p>
                <h3 className="text-2xl font-black text-slate-900 mb-6">Annual License</h3>
                <div className="mb-8">
                   <span className="text-5xl font-black text-slate-900">₦10,000</span>
                   <span className="text-slate-400 font-bold ml-2">/ Year</span>
                </div>
                <ul className="space-y-4">
                  {[ "Priority WhatsApp Support", "Unlimited AI Scans", "Advanced Local Insights", "Unlimited Inventory items" ].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-black text-slate-700">
                      <CheckCircle2 size={16} className="text-emerald-500" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={onStartTrial} className="mt-10 w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all active:scale-95">Subscribe Now</button>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col hover:border-indigo-500 transition-all group">
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Permanent</p>
                <h3 className="text-2xl font-black text-slate-900 mb-6">Lifetime Access</h3>
                <div className="mb-8">
                   <span className="text-5xl font-black text-slate-900">₦25,000</span>
                   <span className="text-slate-400 font-bold ml-2">One-time</span>
                </div>
                <ul className="space-y-4">
                  {[ "Never pay for license again", "All future updates free", "Transfer to new phone", "Custom Shop Branding" ].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-500">
                      <CheckCircle2 size={16} className="text-indigo-500" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={onStartTrial} className="mt-10 w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white transition-all active:scale-95">Go Unlimited</button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
             <div className="col-span-2 space-y-6">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-600 rounded-xl p-1.5 flex items-center justify-center">
                      <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
                   </div>
                   <span className="text-xl font-black tracking-tighter text-slate-900 uppercase">NaijaShop</span>
                </div>
                <p className="text-slate-500 font-medium max-w-sm">Empowering Nigerian retailers with offline intelligence. The market standard for inventory and sales tracking.</p>
             </div>
             <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Company</h4>
                <ul className="space-y-4">
                   <li><button onClick={() => window.location.href = '/affiliate'} className="text-sm font-bold text-slate-700 hover:text-emerald-600 flex items-center gap-2"><Users size={16}/> Become a Marketer</button></li>
                   <li><button className="text-sm font-bold text-slate-700 hover:text-emerald-600 flex items-center gap-2"><Globe size={16}/> Terms of Service</button></li>
                </ul>
             </div>
             <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Contact Oga</h4>
                <ul className="space-y-4">
                   <li><button className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2"><MessageCircle size={16}/> WhatsApp: 08184774884</button></li>
                   <li className="text-xs text-slate-400 font-medium">Lagos, Nigeria</li>
                </ul>
             </div>
          </div>
          <div className="pt-8 border-t border-slate-50 text-center">
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">&copy; {new Date().getFullYear()} NaijaShop Logistics Hub. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;