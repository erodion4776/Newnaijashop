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
import MarketingBot from '../components/MarketingBot';

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
                The POS That Operates Without Data.
              </h1>
              <p className="text-xl text-slate-500 font-medium leading-relaxed">
                Prevent staff theft, track your profit margins, and manage your inventory from your mobile device—even without an internet connection. Professional software for Nigerian SMEs.
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
                  <div className="overflow-hidden rounded-[3rem] shadow-2xl bg-white">
                    <img 
                      src="https://i.ibb.co/W4XQSpqw/IMG-20260125-230934.png" 
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
            {/* Feature 1: AI Scanner */}
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

            {/* Feature 2: Audit Trail */}
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

      {/* Inventory Management Section */}
      <section className="py-24 bg-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="flex-1 space-y-10">
               <div className="space-y-6">
                  <h2 className="text-4xl lg:text-5xl font-black tracking-tighter leading-tight">Scale Your Inventory <br className="hidden lg:block"/> Fully Offline.</h2>
                  <p className="text-xl text-slate-400 font-medium leading-relaxed">
                    Monitor stock levels, execute bulk price updates, and access real-time valuation reports without external connectivity. NaijaShop is engineered for local device performance.
                  </p>
               </div>
               
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <div className="w-12 h-12 bg-emerald-50/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-inner">
                        <CheckCircle2 size={24} />
                     </div>
                     <h4 className="font-black text-sm uppercase tracking-widest">Threshold Alerts</h4>
                     <p className="text-xs text-slate-500 font-medium">Automatic visual warnings for low inventory.</p>
                  </div>
                  <div className="space-y-2">
                     <div className="w-12 h-12 bg-emerald-50/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-inner">
                        <CheckCircle2 size={24} />
                     </div>
                     <h4 className="font-black text-sm uppercase tracking-widest">Inflation Adjuster</h4>
                     <p className="text-xs text-slate-500 font-medium">Adjust prices by percentage in seconds.</p>
                  </div>
               </div>

               <button 
                  onClick={onStartTrial}
                  className="bg-white text-slate-900 px-10 py-6 rounded-[2rem] font-black text-lg hover:bg-emerald-50 transition-all flex items-center justify-center gap-3"
               >
                 Try the Terminal <ArrowRight />
               </button>
            </div>
            
            <div className="flex-1 relative">
               <div className="overflow-hidden rounded-[2.5rem] shadow-2xl border-4 border-slate-800 bg-white">
                <img 
                  src="https://i.ibb.co/5gkwgcFj/IMG-20260125-231701.png" 
                  alt="Inventory Screen" 
                  className="w-full max-w-md mx-auto transform lg:translate-x-10 object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-emerald-50">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-12">
           <div className="w-24 h-24 rounded-full overflow-hidden mx-auto border-4 border-white shadow-2xl">
              <img 
                src="https://i.ibb.co/Z6rXhfGv/IMG-20260125-231857.png" 
                alt="Professional Business Owner" 
                className="w-full h-full object-cover" 
                loading="lazy"
                referrerPolicy="no-referrer"
              />
           </div>
           <blockquote className="text-3xl lg:text-4xl font-black italic text-slate-900 tracking-tight leading-tight">
             "NaijaShop has revolutionized our operations. I can finally access accurate financial data and manage my retail location with complete confidence."
           </blockquote>
           <div>
              <p className="text-xl font-black text-emerald-700">Amaka O.</p>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Retail Consultant, Lagos</p>
           </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
           <div className="text-center mb-20 space-y-4">
              <h2 className="text-4xl font-black tracking-tighter">Fast Implementation</h2>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="text-center space-y-6">
                 <div className="aspect-[4/3] rounded-[2rem] bg-slate-50 border border-slate-100 overflow-hidden relative shadow-inner group">
                    <img 
                      src="https://i.ibb.co/dsT5CKqR/IMG-20260126-084914.png" 
                      alt="Secure Launch" 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform" 
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black">1</div>
                 </div>
                 <p className="text-lg font-black text-slate-800">Install the PWA and initialize your terminal.</p>
              </div>
              <div className="text-center space-y-6">
                 <div className="aspect-[4/3] rounded-[2rem] bg-slate-50 border border-slate-100 overflow-hidden relative shadow-inner group">
                    <img 
                      src="https://i.ibb.co/5gR2G9jp/IMG-20260126-084953.png" 
                      alt="Shop Setup" 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform" 
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black">2</div>
                 </div>
                 <p className="text-lg font-black text-slate-800">Configure your store profile and Admin PIN.</p>
              </div>
              <div className="text-center space-y-6">
                 <div className="aspect-[4/3] rounded-[2rem] bg-emerald-600 border border-emerald-500 overflow-hidden relative shadow-2xl group">
                    <img 
                      src="https://i.ibb.co/kstpyhwp/IMG-20260126-084931.png" 
                      alt="Start Selling" 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform" 
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 w-10 h-10 bg-white text-emerald-600 rounded-full flex items-center justify-center font-black">3</div>
                 </div>
                 <p className="text-lg font-black text-slate-800">Begin processing sales and tracking growth.</p>
              </div>
           </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing-section" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tighter">Choose Your License</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Card 1 */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col hover:border-emerald-500 transition-all group">
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Introduction</p>
                <h3 className="text-2xl font-black text-slate-900 mb-6">Standard Trial</h3>
                <div className="mb-8">
                   <span className="text-5xl font-black text-slate-900">₦0</span>
                   <span className="text-slate-400 font-bold ml-2">/ 30 Days</span>
                </div>
                <ul className="space-y-4">
                  {[ "Professional Core Features", "Offline Inventory Engine", "On-Device AI Scanner", "Financial Reporting" ].map((f, i) => (
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
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">Recommended</div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Business Growth</p>
                <h3 className="text-2xl font-black text-slate-900 mb-6">Annual License</h3>
                <div className="mb-8">
                   <span className="text-5xl font-black text-slate-900">₦10,000</span>
                   <span className="text-slate-400 font-bold ml-2">/ Year</span>
                </div>
                <ul className="space-y-4">
                  {[ "Priority Technical Support", "Unlimited AI Operations", "Advanced Business Analytics", "Scalable Product Registry" ].map((f, i) => (
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Enterprise</p>
                <h3 className="text-2xl font-black text-slate-900 mb-6">Lifetime Access</h3>
                <div className="mb-8">
                   <span className="text-5xl font-black text-slate-900">₦25,000</span>
                   <span className="text-slate-400 font-bold ml-2">One-time</span>
                </div>
                <ul className="space-y-4">
                  {[ "Perpetual License Access", "Future Infrastructure Updates", "Mobile Device Portability", "Custom Terminal Branding" ].map((f, i) => (
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
                <div className="w-16 h-16 bg-white border border-slate-100 rounded-xl p-2 flex items-center justify-center shadow-md overflow-hidden">
                   <img 
                    src={LOGO_URL} 
                    alt="NaijaShop Logo" 
                    className="w-full h-full object-contain" 
                    loading="lazy"
                    referrerPolicy="no-referrer"
                   />
                </div>
                <div>
                   <h3 className="text-xl font-black tracking-tighter text-emerald-600 uppercase">NaijaShop</h3>
                   <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">Enterprise Solutions for Nigeria</p>
                </div>
                <p className="text-slate-500 font-medium max-w-sm leading-relaxed">Empowering African retailers with offline business intelligence. The industry standard for digital inventory management.</p>
             </div>
             <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Resources</h4>
                <ul className="space-y-4">
                   <li><button onClick={() => window.location.href = '/affiliate'} className="text-sm font-bold text-slate-700 hover:text-emerald-600 flex items-center gap-2"><Users size={16}/> Partner Program</button></li>
                   <li><button className="text-sm font-bold text-slate-700 hover:text-emerald-600 flex items-center gap-2"><Globe size={16}/> Documentation</button></li>
                </ul>
             </div>
             <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Contact</h4>
                <ul className="space-y-4">
                   <li><button className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2"><MessageCircle size={16}/> Professional Support</button></li>
                   <li className="text-xs text-slate-400 font-medium">Lagos HQ, Nigeria</li>
                </ul>
             </div>
          </div>
          <div className="pt-8 border-t border-slate-50 text-center">
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">&copy; {new Date().getFullYear()} NaijaShop Infrastructure. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

      {/* Floating Marketing Bot */}
      <MarketingBot />
    </div>
  );
};

export default LandingPage;