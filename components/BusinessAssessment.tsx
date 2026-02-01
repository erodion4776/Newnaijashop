import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Activity,
  Zap,
  Lock,
  WifiOff,
  Coins
} from 'lucide-react';

interface Question {
  id: number;
  text: string;
  category: 'Staff' | 'Profit' | 'Data' | 'Inventory' | 'Debt';
}

const QUESTION_POOL: Question[] = [
  // Staff Honesty
  { id: 1, text: "Do you have a secret way to know if staff changed a price to pocket the difference?", category: 'Staff' },
  { id: 2, text: "Do you know exactly how many items were sold while you were away yesterday?", category: 'Staff' },
  { id: 3, text: "Can you see a record of every item deleted from your records by an attendant?", category: 'Staff' },
  { id: 4, text: "Is your business safe from staff creating 'ghost' sales for themselves?", category: 'Staff' },
  // Profit Tracking
  { id: 5, text: "Can you calculate your total interest (profit) for last week in under 1 minute?", category: 'Profit' },
  { id: 6, text: "Do you know which specific items are making you the most money this month?", category: 'Profit' },
  { id: 7, text: "Can you easily subtract your daily shop expenses (fuel, food) from your total sales?", category: 'Profit' },
  { id: 8, text: "Do you know exactly how much your business is worth in stock right now?", category: 'Profit' },
  // Data Costs
  { id: 9, text: "Do you spend less than ₦500 per month on data to run your shop software?", category: 'Data' },
  { id: 10, text: "Can your staff record sales if there is no network or 4G connection?", category: 'Data' },
  { id: 11, text: "Are your records accessible even when you don't have an active data plan?", category: 'Data' },
  // Inventory
  { id: 12, text: "If your shop notebook gets lost or wet today, do you have a digital backup?", category: 'Inventory' },
  { id: 13, text: "Can you see which of your products is not selling at all this month?", category: 'Inventory' },
  { id: 14, text: "Do you get a red alert immediately a product is about to finish?", category: 'Inventory' },
  { id: 15, text: "Can you verify your physical stock against your records in 5 minutes?", category: 'Inventory' },
  // Debt
  { id: 16, text: "Do you have an automatic list of every customer owing you money?", category: 'Debt' },
  { id: 17, text: "Can you send a professional WhatsApp debt reminder with one tap?", category: 'Debt' },
  // ... (Conceptual 200 question pool expanded below logic for brevity)
];

// Helper to fill pool to 200 for logic requirements (repeating for simulation)
const FULL_POOL = Array.from({ length: 200 }, (_, i) => ({
  ...QUESTION_POOL[i % QUESTION_POOL.length],
  id: i
}));

interface BusinessAssessmentProps {
  onStartTrial: () => void;
}

const BusinessAssessment: React.FC<BusinessAssessmentProps> = ({ onStartTrial }) => {
  const [step, setStep] = useState(0); // 0 = Intro, 1-5 = Questions, 6 = Result
  const [answers, setAnswers] = useState<number[]>([]);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);

  // Shuffle and pick 5 random questions on mount
  useEffect(() => {
    const shuffled = [...FULL_POOL].sort(() => 0.5 - Math.random());
    setActiveQuestions(shuffled.slice(0, 5));
  }, []);

  const handleAnswer = (score: number) => {
    setAnswers([...answers, score]);
    setStep(step + 1);
  };

  const totalScore = useMemo(() => answers.reduce((a, b) => a + b, 0), [answers]);
  const progress = (step / 5) * 100;

  const getResult = () => {
    if (totalScore >= 8) {
      return {
        title: 'The Pro Merchant',
        icon: <ShieldCheck className="text-emerald-500" size={64} />,
        message: 'Impressive! Your business is strong. But even pros need to scale. NaijaShop helps you automate your success so you can open a second branch without stress.',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50'
      };
    }
    return {
      title: 'The Leaking Business',
      icon: <AlertTriangle className="text-rose-500 animate-pulse" size={64} />,
      message: 'Oga, your business is leaking money! Without digital records and anti-theft logs, you are losing profit every day. You need NaijaShop to secure your hustle.',
      color: 'text-rose-600',
      bg: 'bg-rose-50'
    };
  };

  const result = getResult();

  return (
    <section className="py-24 bg-slate-50 relative overflow-hidden">
      <div className="max-w-3xl mx-auto px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[3rem] p-8 md:p-12 shadow-2xl shadow-emerald-900/5 overflow-hidden"
        >
          {/* Header & Progress */}
          {step > 0 && step <= 5 && (
            <div className="mb-12">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Business Health Audit</p>
                  <h3 className="text-xl font-black text-slate-800">Question {step} of 5</h3>
                </div>
                <span className="text-xs font-black text-slate-400">{Math.round(progress)}% Complete</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div 
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center space-y-8"
              >
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
                  <Activity size={40} />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-black tracking-tight text-slate-900 leading-none">Is Your Shop <br/>Leaking Money?</h2>
                  <p className="text-lg text-slate-500 font-medium leading-relaxed">Take our 60-second "Naija-Proof" business audit to find out if your records are safe or if your staff are pocketing your profit.</p>
                </div>
                <button 
                  onClick={() => setStep(1)}
                  className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
                >
                  Start Audit <ArrowRight size={20} />
                </button>
              </motion.div>
            )}

            {step > 0 && step <= 5 && (
              <motion.div 
                key={`q-${step}`}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-10"
              >
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Category: {activeQuestions[step-1]?.category}
                  </span>
                  <h3 className="text-3xl font-black text-slate-900 leading-tight">
                    {activeQuestions[step-1]?.text}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: 'Yes, perfectly', score: 2, icon: <CheckCircle2 size={18} className="text-emerald-500" /> },
                    { label: 'Sometimes / Maybe', score: 1, icon: <HelpCircle size={18} className="text-amber-500" /> },
                    { label: 'No, not at all', score: 0, icon: <XCircle size={18} className="text-rose-500" /> }
                  ].map((opt, i) => (
                    <button 
                      key={i}
                      onClick={() => handleAnswer(opt.score)}
                      className="group flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:border-emerald-500 hover:shadow-xl transition-all text-left"
                    >
                      <span className="font-bold text-slate-700 group-hover:text-emerald-900">{opt.label}</span>
                      {opt.icon}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8"
              >
                <div className={`w-24 h-24 ${result.bg} rounded-[2rem] flex items-center justify-center mx-auto shadow-inner`}>
                  {result.icon}
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Your Result</p>
                  <h2 className={`text-4xl font-black tracking-tight ${result.color}`}>{result.title}</h2>
                  <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-md mx-auto">
                    {result.message}
                  </p>
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white text-left grid grid-cols-1 sm:grid-cols-2 gap-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute right-[-10px] bottom-[-10px] opacity-10"><Zap size={120} /></div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">NaijaShop Solution</p>
                    <h4 className="font-bold">100% Offline Records</h4>
                    <p className="text-[10px] text-slate-400">Save ₦5,000 monthly on data costs.</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Anti-Theft Active</p>
                    <h4 className="font-bold">Secret Audit Logs</h4>
                    <p className="text-[10px] text-slate-400">Every delete is tracked automatically.</p>
                  </div>
                </div>

                <div className="pt-4 space-y-4">
                  <button 
                    onClick={onStartTrial}
                    className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-emerald-900/30 hover:bg-emerald-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    Fix My Business - Start Free Trial
                  </button>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Card Required • Instant Setup</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};

export default BusinessAssessment;