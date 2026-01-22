
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getAIInsights, RateLimitError } from '../services/geminiService';
import { Sparkles, Loader2, Lightbulb, TrendingUp, AlertCircle, WifiOff, RefreshCw, Clock } from 'lucide-react';

interface Insight {
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
}

const AIInsights: React.FC = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [rateLimited, setRateLimited] = useState(false);
  
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchInsights = async () => {
    if (!isOnline || loading) return;
    setLoading(true);
    setRateLimited(false);
    try {
      const result = await getAIInsights(sales, products);
      if (result) setInsights(result);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setRateLimited(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sales.length >= 5 && isOnline && insights.length === 0) {
      fetchInsights();
    }
  }, [isOnline]);

  if (!isOnline) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-6">
        <div className="bg-amber-50 border border-amber-200 rounded-[3rem] p-12 text-center space-y-6 shadow-xl">
          <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <WifiOff size={48} />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Internet Required</h2>
            <p className="text-slate-600 font-medium max-w-sm mx-auto text-lg leading-relaxed">
              AI features require internet connection. Please turn on data to use the Business Hub and get smart insights.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full font-bold text-sm mb-4 border border-emerald-200 shadow-sm">
          <Sparkles size={16} />
          Powered by Gemini AI (Free Tier)
        </div>
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">Business Hub</h2>
        <p className="text-slate-500 mt-2 font-medium">Get smart analysis of your shop's performance and actionable tips.</p>
      </div>

      {rateLimited && (
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl flex items-center gap-4 text-rose-800 animate-in slide-in-from-top-4">
          <Clock size={24} className="shrink-0" />
          <p className="text-sm font-bold">AI is busy. Tier 1 (Free) limits reached. Please wait 60 seconds and try again.</p>
          <button onClick={fetchInsights} className="ml-auto px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest">Retry Now</button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="relative">
            <Loader2 size={64} className="animate-spin text-emerald-600" />
            <Sparkles size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-slate-800 font-black text-xl">Consulting NaijaShop Guru...</p>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Processing Data</p>
          </div>
        </div>
      ) : insights.length > 0 ? (
        <div className="grid gap-6">
          {insights.map((insight, idx) => (
            <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 relative overflow-hidden group transition-all hover:scale-[1.01]">
              <div className="flex items-start gap-6 relative z-10">
                <div className={`p-5 rounded-[2rem] shrink-0 shadow-inner ${
                  insight.priority === 'High' ? 'bg-rose-50 text-rose-600' :
                  insight.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
                  'bg-emerald-50 text-emerald-600'
                }`}>
                  {insight.priority === 'High' ? <AlertCircle size={32} /> : 
                   insight.priority === 'Medium' ? <Lightbulb size={32} /> : 
                   <TrendingUp size={32} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                      insight.priority === 'High' ? 'bg-rose-600 text-white border-rose-700' :
                      insight.priority === 'Medium' ? 'bg-amber-500 text-white border-amber-600' :
                      'bg-emerald-600 text-white border-emerald-700'
                    }`}>
                      {insight.priority}
                    </span>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">{insight.title}</h3>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-lg font-medium">
                    {insight.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          <div className="pt-6 flex justify-center">
            <button 
              onClick={fetchInsights}
              disabled={loading}
              className="flex items-center gap-3 px-8 py-4 bg-slate-100 hover:bg-emerald-50 text-emerald-700 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border border-slate-200 hover:border-emerald-200 disabled:opacity-50"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} /> Refresh Analysis
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-24 bg-white rounded-[3rem] border border-slate-200 border-dashed space-y-6">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
             <TrendingUp size={40} />
          </div>
          <div className="space-y-2">
            <p className="text-slate-500 font-bold text-lg">Guru needs at least 5 sales records.</p>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">Record more sales to unlock smart business analysis.</p>
          </div>
          <button onClick={fetchInsights} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest">Try Analysis Now</button>
        </div>
      )}
    </div>
  );
};

export default AIInsights;
