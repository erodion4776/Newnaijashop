import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles, MessageSquare, Bot, User, CheckCircle2 } from 'lucide-react';
import { getResponse } from '../utils/MarketingBotEngine';

const AVATAR_URL = "https://i.ibb.co/bfCDQ9G/Generated-Image-September-24-2025-3-37-AM.png";
const WHATSAPP_URL = "https://wa.me/2348184774884";

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: number;
  isFallback?: boolean;
}

const MarketingBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastBotIntent, setLastBotIntent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Initial greeting - only once on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      const greeting: Message = {
        id: 'initial-greeting',
        sender: 'bot',
        text: 'Hello! I am the founder of NaijaShop. I built this to help you grow your business. What can I tell you about our No-Data POS?',
        timestamp: Date.now()
      };
      setMessages([greeting]);
      hasInitialized.current = true;
    }
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = (textOverride?: string) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textOverride) setInputText('');
    
    // 1.5 seconds typing simulation
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const result = getResponse(textToSend, lastBotIntent);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: result.text,
        timestamp: Date.now(),
        isFallback: result.isFallback
      };
      
      setMessages(prev => [...prev, botMsg]);
      // Track context for next turn
      setLastBotIntent(result.intentName || null);
    }, 1500);
  };

  const handleWhatsAppClick = () => {
    window.open(WHATSAPP_URL, '_blank');
  };

  return (
    <>
      {/* Floating Bubble */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[1000] w-16 h-16 bg-emerald-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group border-4 border-white overflow-hidden"
      >
        {isOpen ? (
          <X className="text-white" size={28} />
        ) : (
          <div className="relative w-full h-full">
            <img 
              src={AVATAR_URL} 
              className="w-full h-full object-cover" 
              alt="Founder" 
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full animate-pulse" />
          </div>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[1000] w-[380px] max-w-[calc(100vw-3rem)] h-[600px] bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
          
          {/* Header */}
          <div className="bg-emerald-600 p-6 text-white flex items-center gap-4 shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10">
                <Sparkles size={100} />
            </div>
            <div className="relative">
              <img 
                src={AVATAR_URL} 
                className="w-12 h-12 rounded-full border-2 border-white/30 object-cover bg-white" 
                alt="Founder" 
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-emerald-600 rounded-full" />
            </div>
            <div className="relative z-10">
              <h3 className="font-black tracking-tight text-lg leading-none">NaijaShop Founder</h3>
              <div className="flex items-center gap-1.5 mt-1 opacity-80">
                <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Expert Support</span>
              </div>
            </div>
          </div>

          {/* Messages Container */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 scrollbar-hide"
          >
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}
              >
                <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-medium leading-relaxed shadow-sm ${
                  msg.sender === 'user' 
                    ? 'bg-slate-200 text-slate-800 rounded-tr-none' 
                    : 'bg-emerald-600 text-white rounded-tl-none shadow-emerald-900/10'
                }`}>
                  {msg.text}
                </div>
                <div className="mt-1.5 flex items-center gap-1 px-1">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                    {msg.sender === 'user' ? 'You' : 'Founder'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Conditional WhatsApp Button for Fallbacks */}
                {msg.sender === 'bot' && msg.isFallback && (
                  <button 
                    onClick={handleWhatsAppClick}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-sm animate-in slide-in-from-left-4 duration-700"
                  >
                    <MessageSquare size={14} /> Talk to Founder on WhatsApp
                  </button>
                )}
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex flex-col items-start animate-in fade-in">
                <div className="bg-emerald-100 p-4 rounded-3xl rounded-tl-none flex items-center gap-1.5 shadow-inner">
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
                </div>
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1.5 ml-1">Founder is thinking...</span>
              </div>
            )}
          </div>

          {/* Footer Input Area */}
          <div className="p-6 border-t border-slate-100 bg-white shrink-0">
            <div className="relative">
              <input 
                type="text"
                placeholder="Ask about theft, price, or data..."
                className="w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={() => handleSend()}
                disabled={!inputText.trim() || isTyping}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-emerald-600 text-white rounded-xl disabled:opacity-30 hover:bg-emerald-700 transition-all active:scale-90 shadow-lg"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
              <CheckCircle2 size={10} className="text-emerald-400" /> Trusted by 500+ Shops
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MarketingBot;