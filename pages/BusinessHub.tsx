import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  PiggyBank, 
  Zap, 
  PackageSearch,
  ChevronRight,
  Lightbulb,
  Loader2,
  Package,
  Target
} from 'lucide-react';
import LocalInsightsEngine, { LocalInsight } from '../utils/LocalInsightsEngine';

const ICON_MAP: Record<string, any> = {
  TrendingUp,
  AlertCircle,
  Clock,
  ShieldCheck,
  PiggyBank,
  Zap,
  PackageSearch,
  Lightbulb,
  Package,
  Target
};

const BusinessHub: React.FC = () => {
  const [insights, setInsights] = useState<LocalInsight[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadInsights = async () => {
    setIsRefreshing(true);
    try {
      // Logic: Runs purely local analytics using IndexedDB data
      const data = await LocalInsightsEngine.generateInsights();
      setInsights(data);
    } catch (e) {
      console.error("Local Analytics Failure", e);
    } finally {
      // Small delay for Oga to see the "processing" feel
      setTimeout(() => setIsRefreshing(false), 1200);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Intelligence Jumbotron */}
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <Lightbulb size={180} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 bg-emerald-800/50 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 border border-white/10">
              <Sparkles size={12} className="text-emerald-400" />
              Intelligence Center
            </div>
            <h2 className="text-4xl font-black tracking-tight leading-none">Oga's Business Dashboard</h2>
            <p className="text-emerald-400 font-bold text-sm mt-3 leading-relaxed">Smart insights generated directly from your local terminal records. No internet data required.</p>
          </div>
          <button 
            onClick={loadInsights}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-3 bg-white text-emerald-900 px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-50 transition-all active:scale-95 disabled:opacity-50"
          >
            {isRefreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Analyze Business
          </button>
        </div>
      </div>

      {/* Insight Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isRefreshing ? (
          <div className="col-span-full py-32 flex flex-col items-center gap-6">
             <div className="relative">
                <Loader2 size={80} className="text-emerald-600 animate-spin" />
                <Sparkles size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400" />
             </div>
             <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Scanning Ledger Data...</p>
          </div>
        ) : insights.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-white border border-dashed border-slate-300 rounded-[3rem] space-y-4">
             <Target size={48} className="mx-auto text-slate-100" />
             <h4 className="font-black text-slate-800 tracking-tight">Need More Sales Data</h4>
             <p className="text-slate-400 font-medium max-w-xs mx-auto">Please record more sales transactions for the Intelligence Center to generate meaningful insights for you.</p>
          </div>
        ) : (
          insights.map((insight, idx) => {
            const Icon = ICON_MAP[insight.icon] || Lightbulb;
            
            const variantStyles = {
              success: "bg-emerald-50 border-emerald-200 text-emerald-800",
              warning: "bg-amber-50 border-amber-200 text-amber-900",
              danger: "bg-rose-50 border-rose-200 text-rose-900 animate-pulse-soft",
              info: "bg-indigo-50 border-indigo-200 text-indigo-900"
            }[insight.type];

            const iconStyles = {
              success: "bg-emerald-100 text-emerald-600",
              warning: "bg-amber-100 text-amber-600",
              danger: "bg-rose-600 text-white",
              info: "bg-indigo-100 text-indigo-600"
            }[insight.type];

            return (
              <div 
                key={idx} 
                className={`p-8 rounded-[3rem] border-2 shadow-xl transition-all hover:scale-[1.02] animate-in slide-in-from-bottom-6 duration-700 delay-${idx * 150} ${variantStyles}`}
              >
                <div className="flex items-start gap-6">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-inner ${iconStyles}`}>
                    <Icon size={32} />
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-black text-xl tracking-tight leading-none uppercase">{insight.title}</h4>
                    <p className="text-sm font-bold leading-relaxed opacity-75">
                      {insight.description}
                    </p>
                    <div className="pt-2">
                       <button className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest hover:translate-x-1 transition-transform">
                         Take Action <ChevronRight size={12} />
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {insights.length > 0 && (
        <div className="bg-slate-900 p-12 rounded-[4rem] text-white flex flex-col md:flex-row items-center gap-10 shadow-2xl relative overflow-hidden">
           <div className="absolute left-0 bottom-0 p-8 opacity-5"><Zap size={200} /></div>
           <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center shrink-0 border border-white/20">
              <ShieldCheck size={48} className="text-emerald-400" />
           </div>
           <div className="space-y-4 text-center md:text-left">
              <h3 className="text-3xl font-black tracking-tight leading-none uppercase">Privacy Guaranteed</h3>
              <p className="text-slate-400 font-medium leading-relaxed max-w-xl">
                NaijaShop insights are generated instantly using your device's internal processor. We never send your sensitive business data to any server. Your trade secrets stay on your phone.
              </p>
           </div>
        </div>
      )}

    </div>
  );
};

export default BusinessHub;