
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
  Loader2
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
  Lightbulb
};

const BusinessHub: React.FC = () => {
  const [insights, setInsights] = useState<LocalInsight[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadInsights = async () => {
    setIsRefreshing(true);
    try {
      const data = await LocalInsightsEngine.generateInsights();
      setInsights(data);
    } catch (e) {
      console.error("Failed to load insights", e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-emerald-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <Lightbulb size={180} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-800/50 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 border border-white/10">
              <Sparkles size={12} className="text-emerald-400" />
              Intelligence Center
            </div>
            <h2 className="text-4xl font-black tracking-tight">Business Hub</h2>
            <p className="text-emerald-400 font-bold text-sm mt-1">Local insights generated from your shop records</p>
          </div>
          <button 
            onClick={loadInsights}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 bg-white text-emerald-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-50 transition-all active:scale-95 disabled:opacity-50"
          >
            {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh Insights
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {insights.map((insight, idx) => {
          const Icon = ICON_MAP[insight.icon] || Lightbulb;
          const styles = {
            success: "bg-emerald-50 border-emerald-100 text-emerald-800 icon-bg-emerald-100 icon-color-emerald-600",
            warning: "bg-amber-50 border-amber-100 text-amber-800 icon-bg-amber-100 icon-color-amber-600",
            danger: "bg-rose-50 border-rose-100 text-rose-800 icon-bg-rose-100 icon-color-rose-600",
            info: "bg-blue-50 border-blue-100 text-blue-800 icon-bg-blue-100 icon-color-blue-600"
          }[insight.type];

          const iconClass = insight.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                           insight.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                           insight.type === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600';

          return (
            <div 
              key={idx} 
              className={`p-8 rounded-[2.5rem] border shadow-sm transition-all hover:shadow-md animate-in slide-in-from-bottom-4 duration-500 delay-${idx * 100} ${styles.split(' icon-')[0]}`}
            >
              <div className="flex items-start gap-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${iconClass}`}>
                  <Icon size={28} />
                </div>
                <div className="space-y-2">
                  <h4 className="font-black text-lg tracking-tight">{insight.title}</h4>
                  <p className="text-sm font-medium leading-relaxed opacity-80">
                    {insight.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {insights.length > 0 && (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 text-center space-y-4 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">About Local Insights</p>
          <p className="text-sm text-slate-500 font-medium max-w-lg mx-auto">
            These cards are generated instantly using your phone's processing power. We analyze your sales patterns and stock levels to help you make better business decisions without using any internet data.
          </p>
        </div>
      )}
    </div>
  );
};

export default BusinessHub;
