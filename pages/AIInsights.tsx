
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getAIInsights } from '../services/geminiService';
import { Sparkles, Loader2, Lightbulb, TrendingUp, AlertCircle } from 'lucide-react';

interface Insight {
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
}

const AIInsights: React.FC = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];

  const fetchInsights = async () => {
    setLoading(true);
    const result = await getAIInsights(sales, products);
    if (result) setInsights(result);
    setLoading(false);
  };

  useEffect(() => {
    if (sales.length > 0) fetchInsights();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full font-bold text-sm mb-4">
          <Sparkles size={16} />
          Powered by Gemini AI
        </div>
        <h2 className="text-4xl font-black text-slate-800">Business Hub</h2>
        <p className="text-slate-500 mt-2">Get smart analysis of your shop's performance and actionable tips.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={48} className="animate-spin text-emerald-600" />
          <p className="text-slate-500 font-medium">Gemini is analyzing your store data...</p>
        </div>
      ) : insights.length > 0 ? (
        <div className="grid gap-6">
          {insights.map((insight, idx) => (
            <div key={idx} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 relative overflow-hidden group transition-all hover:scale-[1.01]">
              <div className="flex items-start gap-6 relative z-10">
                <div className={`p-4 rounded-2xl shrink-0 ${
                  insight.priority === 'High' ? 'bg-rose-50 text-rose-600' :
                  insight.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
                  'bg-emerald-50 text-emerald-600'
                }`}>
                  {insight.priority === 'High' ? <AlertCircle size={32} /> : 
                   insight.priority === 'Medium' ? <Lightbulb size={32} /> : 
                   <TrendingUp size={32} />}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                      insight.priority === 'High' ? 'bg-rose-600 text-white' :
                      insight.priority === 'Medium' ? 'bg-amber-600 text-white' :
                      'bg-emerald-600 text-white'
                    }`}>
                      {insight.priority} Priority
                    </span>
                    <h3 className="text-xl font-bold text-slate-800">{insight.title}</h3>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    {insight.description}
                  </p>
                </div>
              </div>
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles size={80} />
              </div>
            </div>
          ))}
          <button 
            onClick={fetchInsights}
            className="mt-4 flex items-center justify-center gap-2 py-4 text-emerald-600 font-bold hover:bg-emerald-50 rounded-2xl transition-all"
          >
            <Sparkles size={20} />
            Refresh Analysis
          </button>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
          <p className="text-slate-400 mb-6">Need more sales data to provide meaningful insights.</p>
          <button 
            onClick={fetchInsights}
            className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg"
          >
            Force Run Analysis
          </button>
        </div>
      )}
    </div>
  );
};

export default AIInsights;
