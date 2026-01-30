import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, User, Award, ShieldCheck, Zap } from 'lucide-react';

const AVATAR_URL = "https://i.ibb.co/bfCDQ9G/Generated-Image-September-24-2025-3-37-AM.png";

interface Message {
  id: string;
  text: string;
  sender: 'bot' | 'user';
  timestamp: number;
}

const MarketingBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Hello! I am the founder of NaijaShop. How can I help you understand our Offline POS today?",
      sender: 'bot',
      timestamp: Date.now()
    }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const getBotResponse = (input: string): string => {
    const lower = input.toLowerCase();
    
    if (lower.includes('price') || lower.includes('cost') || lower.includes('pay') || lower.includes('money') || lower.includes('subscription')) {
      return "We have 3 simple plans: \n1. 30-Day Free Trial (₦0)\n2. Annual License (₦10,000/year)\n3. Lifetime Access (₦25,000 one-time).";
    }
    
    if (lower.includes('offline') || lower.includes('data') || lower.includes('internet') || lower.includes('network')) {
      return "NaijaShop works 100% offline using your phone's local memory (IndexedDB). You don't need data to sell or check stock. You only need data for WhatsApp backups.";
    }
    
    if (lower.includes('theft') || lower.includes('steal') || lower.includes('staff') || lower.includes('security')) {
      return "Our 'Fortress' system records secret Audit Logs whenever a staff deletes a sale or changes a price. They can't see these logs, but you can!";
    }

    if (lower.includes('hello') || lower.includes('hi')) {
      return "Hello! Are you looking to improve your shop management?";
    }

    return "I want to make sure I understand. Are you asking about Pricing, Offline Mode, or Security? If you need human help, click the WhatsApp button below.";
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), text: inputText, sender: 'user', timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const response = getBotResponse(userMsg.text);
      const botMsg: Message = { id: (Date.now()+1).toString(), text: response, sender: 'bot', timestamp: Date.now() };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1000);
  };

  const openWhatsApp = () => {
    window.open("https://wa.me/2348184774884", "_blank");
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[1000] w-16 h-16 bg-emerald-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all border-4 border-white overflow-hidden"
      >
        {isOpen ? <X className="text-white" /> : <img src={AVATAR_URL} className="w-full h-full object-cover" alt="Bot" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[1000] w-[350px] max-w-[calc(100vw-2rem)] h-[500px] bg-white rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
          <div className="bg-emerald-600 p-4 text-white flex items-center gap-3">
            <img src={AVATAR_URL} className="w-10 h-10 rounded-full border-2 border-white object-cover" alt="Bot" />
            <div>
              <h3 className="font-black text-sm">NaijaShop Founder</h3>
              <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-widest">Support Online</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm font-medium ${msg.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none flex gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100 space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
               {['Pricing', 'Offline?', 'Security'].map(q => (
                 <button key={q} onClick={() => { setInputText(q); setTimeout(handleSend, 100); }} className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600 whitespace-nowrap hover:bg-emerald-50 hover:text-emerald-600 transition-colors">{q}</button>
               ))}
            </div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Ask me anything..." 
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button onClick={handleSend} disabled={!inputText.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
            <button onClick={openWhatsApp} className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors">
              Chat on WhatsApp
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default MarketingBot;