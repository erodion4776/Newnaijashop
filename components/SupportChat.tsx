import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  Clock, 
  User,
  Bot,
  Trash2,
  Headphones,
  Loader2,
  CreditCard,
  Package
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { generateRequestCode } from '../utils/licensing';
import { getBestMatch, ShopData } from '../utils/SupportBotEngine';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: number;
  showOptions?: boolean;
  action?: 'RENEW_LICENSE' | 'VIEW_STOCK' | 'NONE';
}

const SupportChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "👋 Welcome to NaijaShop! I am your Assistant Guru. How can I help you manage your shop today?",
      timestamp: Date.now()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const sales = useLiveQuery(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return db.sales.where('timestamp').above(today).toArray();
  }) || [];

  // Calculate Real-time Shop Data
  const shopStats: ShopData = useMemo(() => {
    let todayTotal = 0;
    let interestTotal = 0;
    
    // Product map for interest calculation
    const pMap: Record<number, number> = {};
    products.forEach(p => { if(p.id) pMap[p.id] = p.cost_price; });

    sales.forEach(s => {
      todayTotal += s.total_amount;
      s.items.forEach(item => {
        const cost = pMap[item.productId] || (item.price * 0.85);
        interestTotal += (item.price - cost) * item.quantity;
      });
    });

    const lowCount = products.filter(p => p.stock_qty <= (p.low_stock_threshold || 5)).length;
    const expiry = settings?.license_expiry ? new Date(settings.license_expiry).toLocaleDateString() : 'Not Set';

    return {
      adminName: settings?.admin_name || 'Oga',
      shopName: settings?.shop_name || 'the shop',
      todaySales: `₦${todayTotal.toLocaleString()}`,
      lowStockCount: lowCount,
      licenseExpiryDate: expiry,
      totalInterest: `₦${interestTotal.toLocaleString()}`
    };
  }, [settings, products, sales]);

  const terminalId = generateRequestCode();
  const supportNumber = '2348184774884';

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isOpen]);

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;
    
    const userText = inputText.trim();
    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');

    setTimeout(() => {
      setIsTyping(true);
      const match = getBestMatch(userText, shopStats);
      const botMsgText = match?.answer || "I'm still learning! I couldn't find a direct answer for that. Let me connect you to a human expert who can help you better.";
      
      // 2-second realistic delay
      setTimeout(() => {
        setIsTyping(false);
        const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: botMsgText,
          timestamp: Date.now(),
          showOptions: true,
          action: match?.action || 'NONE'
        };
        setMessages(prev => [...prev, botMsg]);
      }, 2000);
    }, 500);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: `👋 Welcome back ${shopStats.adminName}! How can I help you today?`,
        timestamp: Date.now()
      }
    ]);
  };

  const connectToHuman = () => {
    const shopName = settings?.shop_name || 'NaijaShop Terminal';
    const lastUserMsg = messages.filter(m => m.sender === 'user').pop()?.text || 'Support Request';
    const autoContext = `[Shop: ${shopName} | ID: ${terminalId}]`;
    const fullMessage = `Hello, I need help with: ${lastUserMsg} ${autoContext}`;
    const whatsappUrl = `https://wa.me/${supportNumber}?text=${encodeURIComponent(fullMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleAction = (action: string) => {
    if (action === 'VIEW_STOCK') {
      // In a real app we might use a global state or custom event
      // For this implementation, we give the user visual feedback
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: "Please click 'Inventory' in the sidebar to see your low stock items.",
        timestamp: Date.now()
      }]);
    } else if (action === 'RENEW_LICENSE') {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: "Please go to 'Settings' and click the 'Activate Terminal' button to use Paystack.",
        timestamp: Date.now()
      }]);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[999] w-16 h-16 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all animate-in fade-in zoom-in duration-500"
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
        {!isOpen && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 border-2 border-white rounded-full"></span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[999] w-[380px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-10rem)] bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          
          <div className="bg-emerald-900 p-6 text-white relative overflow-hidden shrink-0">
            <div className="absolute right-[-20px] top-[-20px] opacity-10">
              <Bot size={120} />
            </div>
            
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight leading-none">Assistant Guru</h3>
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-1">NaijaShop Assistant</p>
                </div>
              </div>
              <button 
                onClick={clearChat}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-emerald-300"
                title="Clear Chat"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-50/50 scrollbar-hide"
          >
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 fade-in duration-500`}
              >
                <div className={`max-w-[85%] p-4 rounded-3xl text-sm font-medium leading-relaxed shadow-sm ${
                  msg.sender === 'user' 
                    ? 'bg-emerald-600 text-white rounded-tr-none' 
                    : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[8px] font-black text-slate-300 uppercase tracking-widest">
                  {msg.sender === 'user' ? <User size={8} /> : <Bot size={8} />}
                  {msg.sender === 'user' ? 'You' : 'Assistant Guru'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                {msg.sender === 'bot' && msg.showOptions && (
                  <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in duration-700">
                    {msg.action === 'RENEW_LICENSE' && (
                      <button 
                        onClick={() => handleAction('RENEW_LICENSE')}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg"
                      >
                        <CreditCard size={12} /> 💳 Renew License Now
                      </button>
                    )}
                    {msg.action === 'VIEW_STOCK' && (
                      <button 
                        onClick={() => handleAction('VIEW_STOCK')}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg"
                      >
                        <Package size={12} /> 📦 View Low Stock
                      </button>
                    )}
                    <button 
                      onClick={() => setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'bot', text: "No wahala, I am here if you need me!", timestamp: Date.now() }])}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-colors"
                    >
                      ✅ This helped
                    </button>
                    <button 
                      onClick={connectToHuman}
                      className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100 hover:bg-rose-100 transition-colors flex items-center gap-1 shadow-sm"
                    >
                      <Headphones size={12} /> Talk to Human
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex flex-col items-start animate-in slide-in-from-bottom-2 fade-in duration-500">
                <div className="bg-white border border-slate-100 p-4 rounded-3xl rounded-tl-none shadow-sm flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[8px] font-black text-slate-300 uppercase tracking-widest">
                  <Bot size={8} /> Assistant is thinking...
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-100 bg-white shrink-0">
            <div className="relative">
              <input 
                type="text"
                placeholder="Ask a question..."
                className="w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={handleSend}
                disabled={!inputText.trim() || isTyping}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-xl disabled:opacity-30 transition-all hover:bg-emerald-700 active:scale-90 shadow-lg shadow-emerald-200"
              >
                <Send size={18} />
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-slate-300 mt-4">
              <Clock size={12} />
              <span className="text-[9px] font-black uppercase tracking-widest">Offline Intelligence active</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportChat;