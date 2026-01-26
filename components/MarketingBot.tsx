import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles, MessageSquare, CheckCircle2, ThumbsUp, ThumbsDown, Zap, Award, Flame } from 'lucide-react';
import { getResponse, UserProfile, ChatTurn } from '../utils/MarketingBotEngine';
import { initializeCTAHooks } from '../hooks/LandingPageHooks';
import { useProactiveTriggers } from '../hooks/ProactiveEngagement';
import { preprocessNigerianInput } from '../utils/NigerianNLP';
import { triggerTryOnHighlight } from '../utils/CTAHighlighter';

const AVATAR_URL = "https://i.ibb.co/bfCDQ9G/Generated-Image-September-24-2025-3-37-AM.png";
const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

interface Message extends ChatTurn {
  id: string;
  timestamp: number;
  isFallback?: boolean;
  suggestedAction?: string | null;
  quickChoices?: string[];
  triggerId?: string;
}

const MarketingBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isWiggling, setIsWiggling] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastBotIntent, setLastBotIntent] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [hasEngaged, setHasEngaged] = useState(sessionStorage.getItem('hasEngaged') === 'true');
  
  // Phase 3 States
  const [userProfile, setUserProfile] = useState<UserProfile>({
    painPoints: [],
    engagementScore: 0
  });
  const [history, setHistory] = useState<ChatTurn[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioNotifRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioNotifRef.current = new Audio(NOTIF_SOUND);
    const visitCount = parseInt(localStorage.getItem('naijaShopVisitCount') || '0');
    localStorage.setItem('naijaShopVisitCount', (visitCount + 1).toString());

    setMessages([{
      id: 'welcome',
      sender: 'bot',
      text: 'Hello! I am the founder of NaijaShop. I built this to help you grow your business. How can I assist you with our Offline POS today?',
      timestamp: Date.now(),
      intentName: 'Greeting'
    }]);
  }, []);

  const triggerProactiveMessage = (message: string, id: string) => {
    if (audioNotifRef.current) audioNotifRef.current.play().catch(() => {});
    setIsWiggling(true);
    
    setTimeout(() => {
      setIsWiggling(false);
      setIsOpen(true);
      const msg: Message = {
        id: `proactive-${Date.now()}`,
        sender: 'bot',
        text: message,
        timestamp: Date.now(),
        triggerId: id,
        intentName: 'PROACTIVE_NUDGE'
      };
      setMessages(prev => [...prev, msg]);
    }, 2000);
  };

  useProactiveTriggers({ onTrigger: triggerProactiveMessage, isBotOpen: isOpen, hasEngaged });

  useEffect(() => {
    const cleanup = initializeCTAHooks((type, target) => {
      // Direct CTA interaction gives immediate engagement boost
      setUserProfile(prev => ({ ...prev, engagementScore: Math.min(100, prev.engagementScore + 20) }));
      setIsOpen(true);
      
      // If user clicked trial CTA, emphasize it
      if (type === 'FREE_TRIAL') {
        triggerTryOnHighlight('strong');
      }
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = (textOverride?: string) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim() || isTyping) return;

    if (!hasEngaged) {
      setHasEngaged(true);
      sessionStorage.setItem('hasEngaged', 'true');
    }

    const nlp = preprocessNigerianInput(textToSend);

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user' as const,
      text: textToSend.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textOverride) setInputText('');
    
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      
      // Multi-Turn Window: Keep last 5 turns
      const currentHistory = [...history, { sender: 'user' as const, text: userMsg.text }] as ChatTurn[];
      const recentHistory = currentHistory.slice(-5);

      // Bot Engine processes with memory and profiling
      const result = getResponse(textToSend, recentHistory, userProfile, lastBotIntent, pendingAction);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot' as const,
        text: result.text,
        timestamp: Date.now(),
        isFallback: result.isFallback,
        suggestedAction: result.suggestedAction || null,
        intentName: result.intentName
      };
      
      setMessages(prev => [...prev, botMsg]);
      setLastBotIntent(result.intentName || null);
      setPendingAction(result.suggestedAction || null);
      setUserProfile(result.updatedProfile);
      setHistory(prev => [...prev, 
        { sender: 'user' as const, text: userMsg.text }, 
        { sender: 'bot' as const, text: botMsg.text, intentName: botMsg.intentName }
      ].slice(-10));

      // Phase 5: High-Intent Visual Highlighting
      const isHighIntent = 
        nlp.keywords.includes('trial') || 
        nlp.keywords.includes('setup') || 
        nlp.keywords.includes('license') || 
        nlp.keywords.includes('buy') ||
        (nlp.processed.includes('link') && nlp.keywords.includes('yes'));

      if (isHighIntent) {
        triggerTryOnHighlight('strong');
      } else if (result.intentName === 'PricingDetails') {
        triggerTryOnHighlight('subtle');
      }
    }, 1200);
  };

  const toggleBot = () => {
    if (isOpen) {
      sessionStorage.setItem('ns_last_close_time', Date.now().toString());
    }
    setIsOpen(!isOpen);
  };

  const isHotLead = userProfile.engagementScore >= 80;

  return (
    <>
      <button 
        onClick={toggleBot}
        className={`fixed bottom-6 right-6 z-[1000] w-16 h-16 bg-emerald-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group border-4 border-white overflow-hidden ${isWiggling ? 'animate-wiggle' : ''}`}
      >
        {isOpen ? (
          <X className="text-white" size={28} />
        ) : (
          <div className="relative w-full h-full">
            <img src={AVATAR_URL} className="w-full h-full object-cover" alt="Founder" crossOrigin="anonymous" referrerPolicy="no-referrer" />
            {isHotLead ? (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 border-2 border-white rounded-full flex items-center justify-center animate-pulse">
                <Flame size={12} className="text-white fill-white" />
              </div>
            ) : (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full animate-pulse" />
            )}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[1000] w-[380px] max-w-[calc(100vw-3rem)] h-[600px] bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
          <div className="bg-emerald-600 p-6 text-white flex items-center gap-4 shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10"><Sparkles size={100} /></div>
            <div className="relative">
              <img src={AVATAR_URL} className="w-12 h-12 rounded-full border-2 border-white/30 object-cover bg-white" alt="Founder" crossOrigin="anonymous" referrerPolicy="no-referrer" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-emerald-600 rounded-full" />
            </div>
            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-black tracking-tight text-lg leading-none">NaijaShop Founder</h3>
                {isHotLead && <Award size={16} className="text-orange-300" />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                {isHotLead ? "VIP Priority Support" : "Support Online"}
              </span>
            </div>
            {isHotLead && (
              <div className="relative z-10 flex flex-col items-end">
                <div className="bg-orange-500/20 px-2 py-1 rounded-lg border border-white/20">
                  <span className="text-[8px] font-black uppercase">Hot Lead</span>
                </div>
              </div>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 scrollbar-hide">
            {messages.map((msg, index) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-medium shadow-sm ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}>
                  {msg.text}
                </div>
                <span className="mt-1.5 text-[8px] font-black text-slate-300 uppercase tracking-widest px-1">
                  {msg.sender === 'user' ? (userProfile.name || 'You') : 'Founder'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {isTyping && (
              <div className="flex flex-col items-start animate-in fade-in">
                <div className="bg-emerald-100 p-4 rounded-3xl rounded-tl-none flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-100 bg-white">
            <div className="relative">
              <input type="text" placeholder="Ask about price or security..." className="w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-medium" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
              <button onClick={() => handleSend()} disabled={!inputText.trim() || isTyping} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg disabled:opacity-30"><Send size={18} /></button>
            </div>
            {isHotLead && (
              <div className="mt-3 flex items-center justify-center gap-2 text-[9px] font-black text-orange-500 uppercase animate-pulse">
                <Flame size={10} /> Specialized Offer Detected
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(10deg) scale(1.1); }
          50% { transform: rotate(-10deg) scale(1.1); }
          75% { transform: rotate(10deg) scale(1.1); }
        }
        .animate-wiggle { animation: wiggle 0.5s ease-in-out infinite; }
      `}</style>
    </>
  );
};

export default MarketingBot;