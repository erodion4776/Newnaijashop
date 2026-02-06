import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  WifiOff, 
  ShieldCheck, 
  CheckCircle2, 
  Zap, 
  MessageSquare,
  ShieldAlert,
  X,
  Target,
  Minus,
  Check,
  Coins,
  Gift,
  UserPlus,
  Rocket,
  Award,
  CircleDollarSign
} from 'lucide-react';
import BusinessAssessment from '../components/BusinessAssessment';

const LOGO_URL = "https://i.ibb.co/BH8pgbJc/1767139026100-019b71b1-5718-7b92-9987-b4ed4c0e3c36.png";

const PHRASES = [
  "Stop Staff Theft.",
  "Track Your Real Interest.",
  "Manage Stock 100% Offline.",
  "Grow Your Business Faster."
];

const Typewriter = () => {
  const [index, setIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(100);

  useEffect(() => {
    const handleType = () => {
      const fullText = PHRASES[index % PHRASES.length];
      
      setDisplayText(prev => 
        isDeleting 
          ? fullText.substring(0, prev.length - 1)
          : fullText.substring(0, prev.length + 1)
      );

      if (!isDeleting && displayText === fullText) {
        setTimeout(() => setIsDeleting(true), 1500);
      } else if (isDeleting && displayText === "") {
        setIsDeleting(false);
        setIndex(prev => prev + 1);
        setTypingSpeed(100);
      } else {
        setTypingSpeed(isDeleting ? 50 : 100);
      }
    };

    const timer = setTimeout(handleType, typingSpeed);
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, index, typingSpeed]);

  return (
    <span className="text-emerald-600 block sm:inline-block min-w-[280px]">
      {displayText}
      <motion.span 
        animate={{ opacity: [0, 1, 0] }} 
        transition={{ repeat: Infinity, duration: 0.8 }}
        className="inline-block w-1 h-8 sm:h-12 bg-emerald-600 ml-1 align-middle"
      />
    </span>
  );
};

const encode = (data: any) => {
  return Object.keys(data)
    .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
    .join("&");
}

interface LandingPageProps {
  onStartTrial: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartTrial }) => {
  const navigate = useNavigate();
  const [formState, setFormState] = useState({ name: '', phone: '', business: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleMarketerClick = () => {
    window.scrollTo(0, 0);
    navigate('/affiliate');
  };

  const scrollToPricing = () => {
    const section = document.getElementById('pricing-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

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

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, ease: "easeOut" }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-[#0f172a] selection:bg-emerald-100">
      
      {/* Sticky Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-xl border-b border-slate-100 py-4 lg:py-5 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="NaijaShop Logo" className="w-10 h-10 lg:w-12 lg:h-12 object-contain" />
            <span className="text-xl lg:text-2xl font-black tracking-tighter text-emerald-600 uppercase">NaijaShop</span>
          </div>
          <div className="flex items-center gap-4 lg:gap-8">
            <button onClick={onStartTrial} className="hidden md:block text-sm font-black text-slate-500 uppercase tracking-widest hover:text-emerald-600 transition-colors">Login</button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStartTrial}
              className="bg-[#059669] text-white px-5 py-3 lg:px-8 lg:py-4 h-11 lg:h-14 rounded-full font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 flex items-center justify-center whitespace-nowrap"
            >
              Get Started
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-40 mt-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://i.ibb.co/qFD5Jyn9/IMG-20260125-230827.png" 
            className="w-full h-full object-cover opacity-[0.08] blur-sm scale-110"
            alt="Market Background"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-transparent to-slate-50" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="flex-1 text-center lg:text-left space-y-10"
            >
              <div className="mt-4 lg:mt-0">
                <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-5 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest mb-8 lg:mb-10">
                  <WifiOff size={14} /> 100% Offline Technology
                </div>
                <h1 className="text-4xl lg:text-7xl font-black tracking-tighter leading-tight lg:leading-[0.95] text-[#0f172a]">
                  The POS That Helps You... <br className="hidden lg:block" />
                  <Typewriter />
                </h1>
                <p className="text-lg lg:text-xl text-slate-500 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0 mt-8 lg:mt-10">
                  The only terminal built for Nigerian traders. Prevent staff theft, track real profit, and manage inventory without ever needing data.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                <motion.button 
                  whileHover={{ y: -5 }}
                  onClick={onStartTrial}
                  className="w-full sm:w-auto bg-[#059669] text-white px-10 py-6 rounded-[2rem] font-black text-lg shadow-2xl shadow-emerald-900/20 flex items-center justify-center gap-3"
                >
                  Start Free Trial <ArrowRight />
                </motion.button>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className="flex-1 relative w-full"
            >
              <motion.div 
                animate={{ y: [0, -20, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="relative z-20"
              >
                <div className="absolute -inset-10 bg-emerald-500/20 blur-[120px] rounded-full" />
                <img 
                  src="https://i.ibb.co/W4XQSpqw/IMG-20260125-230934.png" 
                  alt="3D Mockup" 
                  className="w-full max-w-lg mx-auto drop-shadow-[0_50px_50px_rgba(0,0,0,0.2)]"
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeInUp} className="text-center mb-20 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter">The 'Naija-Proof' System</h2>
            <p className="text-slate-500 text-lg font-medium">Engineered for the reality of the Nigerian market.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { img: "https://i.ibb.co/My2hF9Sy/IMG-20260125-231246.png", title: "Digitize Your Notebook", desc: "Scan handwritten ledgers into digital stock instantly." },
              { img: "https://i.ibb.co/JWxHN3jM/IMG-20260125-231456.png", title: "Stop Staff Theft", desc: "Secret audit logs track every delete and price change." },
              { img: "https://i.ibb.co/5gkwgcFj/IMG-20260125-231701.png", title: "100% Offline Control", desc: "Make sales and check profits without using 1kb of data." }
            ].map((card, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2, duration: 0.6 }}
                className="group bg-slate-50 rounded-[3rem] p-4 border border-slate-100 hover:shadow-2xl hover:bg-white transition-all"
              >
                <div className="aspect-square rounded-[2.5rem] overflow-hidden mb-8">
                  <img src={card.img} alt={card.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                </div>
                <div className="px-6 pb-6 space-y-2 text-center md:text-left">
                  <h3 className="text-2xl font-black tracking-tight">{card.title}</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Business Assessment Tool */}
      <BusinessAssessment onStartTrial={onStartTrial} />

      {/* Pricing Section */}
      <section className="py-32 bg-white" id="pricing-section">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div {...fadeInUp} className="text-center mb-20 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter">Simple, Transparent Pricing</h2>
            <p className="text-slate-500 text-lg font-medium">Choose the plan that fits your business scale.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Free Trial Card */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step One</span>
                  <h3 className="text-3xl font-black">Free Trial</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black">₦0</span>
                  <span className="text-slate-500 font-bold">/ 30 Days</span>
                </div>
                <ul className="space-y-4">
                  {["Full Access", "All Features", "No Credit Card Required"].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-600 font-medium">
                      <CheckCircle2 size={18} className="text-emerald-500" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onStartTrial}
                className="mt-10 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all"
              >
                Start Free Trial
              </motion.button>
            </motion.div>

            {/* Annual License Card */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-white p-10 rounded-[3rem] border-4 border-emerald-500 shadow-2xl relative flex flex-col justify-between"
            >
              <div className="absolute top-0 right-10 -translate-y-1/2 bg-emerald-500 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
                Most Popular
              </div>
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Growth Plan</span>
                  <h3 className="text-3xl font-black">Annual License</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black">₦10,000</span>
                  <span className="text-slate-500 font-bold">/ Year</span>
                </div>
                <ul className="space-y-4">
                  {["Unlimited Sales", "WhatsApp Backups", "AI Scanner", "Priority Support"].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-800 font-bold">
                      <CheckCircle2 size={18} className="text-emerald-500" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onStartTrial}
                className="mt-10 w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
              >
                Get Annual Access
              </motion.button>
            </motion.div>

            {/* Lifetime Access Card */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Final Step</span>
                  <h3 className="text-3xl font-black">Lifetime Access</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-emerald-400">₦25,000</span>
                  <span className="text-slate-400 font-bold">/ One-time</span>
                </div>
                <ul className="space-y-4">
                  {["Pay Once, Own Forever", "All Future Updates Free", "Custom Branding", "VIP Direct Support"].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-300 font-medium">
                      <CheckCircle2 size={18} className="text-emerald-400" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onStartTrial}
                className="mt-10 w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                Go Unlimited
              </motion.button>
            </motion.div>
          </div>

          <motion.div {...fadeInUp} className="mt-20 p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 text-center max-w-3xl mx-auto">
            <h4 className="text-xl font-black text-emerald-900 mb-2">Why pay ₦10,000?</h4>
            <p className="text-emerald-800 font-medium leading-relaxed italic">
              Because we stop staff theft that costs you ₦100,000+ every year. It is an investment, not a cost.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Refer & Earn Section */}
      <section className="py-32 bg-[#fffbeb] relative overflow-hidden">
        <div className="absolute right-[-10%] top-0 opacity-[0.03] rotate-12">
          <Coins size={600} className="text-amber-900" />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div {...fadeInUp} className="flex-1 space-y-8 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-amber-200 text-amber-900 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest">
                <CircleDollarSign size={14} /> Affiliate Army
              </div>
              <h2 className="text-4xl lg:text-6xl font-black tracking-tighter leading-none text-slate-900">
                Earn ₦2,000 for <br /> Every Referral
              </h2>
              <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
                You don't even need to own a shop to make money with NaijaShop. Join our affiliate army today and start earning weekly payouts.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 text-left">
                {[
                  { icon: <UserPlus className="text-amber-600" />, title: "Register", desc: "Go to our Affiliate Portal and get your unique code." },
                  { icon: <Zap className="text-amber-600" />, title: "Share", desc: "Tell shop owners about the POS that works without data." },
                  { icon: <Coins className="text-amber-600" />, title: "Get Paid", desc: "When they subscribe, we send ₦2,000 to your bank account instantly." }
                ].map((step, i) => (
                  <div key={i} className="space-y-3">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-900/5 mx-auto lg:mx-0">{step.icon}</div>
                    <h4 className="font-black text-slate-900 text-center lg:text-left">{step.title}</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed text-center lg:text-left">{step.desc}</p>
                  </div>
                ))}
              </div>

              <div className="pt-8">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleMarketerClick}
                  className="bg-amber-500 text-white px-10 py-6 rounded-[2rem] font-black text-lg shadow-2xl shadow-amber-900/20 hover:bg-amber-600 transition-all flex items-center gap-3 mx-auto lg:mx-0"
                >
                  Become a Marketer Now <ArrowRight />
                </motion.button>
                <p className="mt-4 flex items-center justify-center lg:justify-start gap-2 text-amber-800 font-black text-[10px] uppercase tracking-widest">
                  <Gift size={14} /> Plus, the shop you refer gets 1 Month Extra free!
                </p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="flex-1 w-full"
            >
              <div className="bg-white p-4 rounded-[4rem] shadow-[0_40px_100px_rgba(146,64,14,0.15)] border-8 border-[#fef3c7]">
                <img 
                  src="https://i.ibb.co/JWxHN3jM/IMG-20260125-231456.png" 
                  alt="Earnings" 
                  className="w-full rounded-[3rem]"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-32 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div {...fadeInUp} className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tighter">NaijaShop vs. Others</h2>
          </motion.div>

          <motion.div 
            {...fadeInUp}
            className="bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-8 font-black uppercase text-xs tracking-widest">Feature</th>
                    <th className="p-8 font-black uppercase text-xs tracking-widest opacity-50">Standard POS</th>
                    <th className="p-8 font-black uppercase text-xs tracking-widest text-emerald-400">NaijaShop</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { f: "Data Usage", o: "High Cost", n: "₦0 (100% Offline)" },
                    { f: "Profit Tracking", o: "Manual / None", n: "Automatic Interest" },
                    { f: "Staff Security", o: "Weak", n: "Secret Audit Logs" },
                    { f: "Pricing", o: "Monthly Fees", n: "One-time / Yearly" }
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="p-8 font-black text-slate-900">{row.f}</td>
                      <td className="p-8 text-slate-400 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0"><Minus size={12} /></div>
                          {row.o}
                        </div>
                      </td>
                      <td className="p-8 text-emerald-700 font-black">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shrink-0"><Check size={14} /></div>
                          {row.n}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 bg-emerald-900 text-white overflow-hidden relative">
        <div className="absolute right-[-10%] top-0 opacity-10"><Zap size={400} /></div>
        <div className="max-w-4xl mx-auto px-6 text-center space-y-12">
          <motion.div {...fadeInUp} className="w-32 h-32 rounded-full border-4 border-emerald-400 mx-auto overflow-hidden">
            <img src="https://i.ibb.co/Z6rXhfGv/IMG-20260125-231857.png" alt="Amaka" className="w-full h-full object-cover" />
          </motion.div>
          <motion.blockquote {...fadeInUp} className="text-3xl lg:text-4xl font-black italic leading-tight tracking-tight">
            "I can finally travel to the village and know exactly what is happening in my shop. No more missing money!"
          </motion.blockquote>
          <motion.div {...fadeInUp} className="space-y-1">
            <p className="text-xl font-black uppercase tracking-widest text-emerald-400">Amaka O.</p>
            <p className="text-emerald-200/60 font-bold uppercase text-xs tracking-widest">Boutique Owner, Lagos</p>
          </motion.div>
        </div>
      </section>

      {/* Enquiry Form */}
      <section className="py-32 relative">
        <div className="absolute inset-0 z-0">
           <div className="w-full h-full bg-[#0f172a]" />
           <div className="absolute top-0 left-0 w-full h-full bg-emerald-600/10 mix-blend-overlay" />
        </div>
        
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <motion.div 
            {...fadeInUp}
            className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[4rem] p-12 lg:p-20 shadow-2xl text-white"
          >
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-4xl font-black tracking-tight">Get in Touch</h2>
              <p className="text-emerald-200 font-medium">Let's set up your business for success.</p>
            </div>

            {isSubmitted ? (
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center py-20">
                <CheckCircle2 size={80} className="text-emerald-400 mx-auto mb-6" />
                <h3 className="text-3xl font-black">Enquiry Sent!</h3>
                <p className="text-emerald-200 mt-2">Our team will call you within 24 hours.</p>
              </motion.div>
            ) : (
              <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSubmit}>
                <input type="hidden" name="form-name" value="enquiry-form" />
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Full Name</label>
                  <input required name="full-name" value={formState.name} onChange={e => setFormState({...formState, name: e.target.value})} type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Chinedu Okafor" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">WhatsApp Number</label>
                  <input required name="phone-number" value={formState.phone} onChange={e => setFormState({...formState, phone: e.target.value})} type="tel" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-emerald-500" placeholder="080..." />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Business Type</label>
                  <input required name="business-type" value={formState.business} onChange={e => setFormState({...formState, business: e.target.value})} type="text" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Supermarket, Boutique, Pharmacy..." />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Your Message</label>
                  <textarea name="message" value={formState.message} onChange={e => setFormState({...formState, message: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-emerald-500 h-32 resize-none" placeholder="How can we help?"></textarea>
                </div>
                <div className="md:col-span-2">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-lg shadow-2xl shadow-emerald-900/40 disabled:opacity-50"
                  >
                    {isSubmitting ? "Sending..." : "Submit Enquiry"}
                  </motion.button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f172a] py-20 text-center border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center space-y-8">
           <img src={LOGO_URL} className="w-16 h-16 object-contain" alt="Logo" />
           <div className="flex flex-wrap justify-center gap-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
             <a href="/privacy" className="hover:text-emerald-400 transition-colors">Privacy</a>
             <a href="/terms" className="hover:text-emerald-400 transition-colors">Terms</a>
             <button 
               onClick={scrollToPricing}
               className="hover:text-emerald-400 transition-colors uppercase tracking-[0.2em]"
             >
               Pricing
             </button>
             <motion.button 
               whileHover={{ scale: 1.05 }}
               onClick={handleMarketerClick}
               className="hover:text-emerald-400 transition-colors uppercase tracking-[0.2em]"
             >
               Become a Marketer
             </motion.button>
           </div>
           <p className="text-slate-600 text-xs font-medium">&copy; {new Date().getFullYear()} NaijaShop POS. Built for the African Marketplace.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;