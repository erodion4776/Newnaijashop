import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot,
  Trash2,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Package,
  ShoppingCart,
  TrendingUp,
  Clock,
  Zap,
  Mic,
  MicOff
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Product, Sale, Staff, SaleItem } from '../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: number;
  action?: {
    type: 'VIEW_PRODUCT' | 'CLEAR_CART' | 'PARK_ORDER' | 'SHOW_SALES' | 'RESTOCK_ALERT' | 'NAVIGATE' | 'ADD_TO_CART';
    data?: any;
    label?: string;
  };
  isExecuting?: boolean;
}

interface SmartChatProps {
  currentUser: Staff | null;
  cart?: SaleItem[];
  onClearCart?: () => void;
  onParkOrder?: () => void;
  onNavigate?: (view: any) => void;
  onAddToCart?: (product: Product, quantity: number) => void;
}

// ==================== AI INTELLIGENCE ENGINE ====================

interface Intent {
  name: string;
  patterns: string[];
  action?: 'QUERY' | 'COMMAND' | 'NAVIGATION';
  confidence: number;
}

class SmartBotEngine {
  private products: Product[] = [];
  private sales: Sale[] = [];
  private currentUser: Staff | null = null;

  constructor(products: Product[], sales: Sale[], user: Staff | null) {
    this.products = products;
    this.sales = sales;
    this.currentUser = user;
  }

  detectIntent(userInput: string): Intent | null {
    const input = userInput.toLowerCase().trim();
    
    const intents: Intent[] = [
      { name: 'CHECK_STOCK', patterns: ['how many', 'stock of', 'do i have', 'quantity of', 'how much', 'check stock'], action: 'QUERY', confidence: 0 },
      { name: 'LOW_STOCK', patterns: ['low stock', 'running out', 'finishing', 'almost done', 'restock'], action: 'QUERY', confidence: 0 },
      { name: 'SEARCH_PRODUCT', patterns: ['find', 'search for', 'locate', 'where is', 'show me'], action: 'QUERY', confidence: 0 },
      { name: 'TODAY_SALES', patterns: ['sales today', 'how much today', 'today\'s sales', 'revenue today'], action: 'QUERY', confidence: 0 },
      { name: 'PROFIT_CHECK', patterns: ['profit', 'gain', 'interest', 'margin'], action: 'QUERY', confidence: 0 },
      { name: 'CLEAR_CART', patterns: ['clear cart', 'empty cart', 'remove all', 'delete cart', 'reset cart'], action: 'COMMAND', confidence: 0 },
      { name: 'PARK_ORDER', patterns: ['park', 'save order', 'hold', 'keep order'], action: 'COMMAND', confidence: 0 },
      { name: 'ADD_TO_CART', patterns: ['add', 'sell', 'put in cart', 'i want to sell'], action: 'COMMAND', confidence: 0 },
      { name: 'NAVIGATE_INVENTORY', patterns: ['go to inventory', 'open inventory', 'show inventory', 'stock page'], action: 'NAVIGATION', confidence: 0 },
      { name: 'NAVIGATE_POS', patterns: ['go to pos', 'open pos', 'sell', 'sales page'], action: 'NAVIGATION', confidence: 0 },
      { name: 'NAVIGATE_DASHBOARD', patterns: ['dashboard', 'home', 'overview'], action: 'NAVIGATION', confidence: 0 },
      { name: 'GENERAL_HELP', patterns: ['help', 'what can you do', 'features', 'assist'], action: 'QUERY', confidence: 0 }
    ];

    intents.forEach(intent => {
      intent.patterns.forEach(pattern => {
        if (input.includes(pattern)) {
          intent.confidence += 10;
        }
        const patternWords = pattern.split(' ');
        const inputWords = input.split(' ');
        const matches = patternWords.filter(pw => inputWords.some(iw => iw.includes(pw) || pw.includes(iw)));
        intent.confidence += matches.length * 2;
      });
    });

    const sorted = intents.sort((a, b) => b.confidence - a.confidence);
    return sorted[0].confidence >= 5 ? sorted[0] : null;
  }

  extractProductName(input: string): string | null {
    const cleaned = input.toLowerCase()
      .replace(/how many|how much|do i have|stock of|quantity of|check|find|search|add|sell/gi, '')
      .trim();
    
    const exactMatch = this.products.find(p => 
      cleaned.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleaned)
    );
    if (exactMatch) return exactMatch.name;
    
    const words = cleaned.split(' ').filter(w => w.length > 2);
    for (const product of this.products) {
      const productWords = product.name.toLowerCase().split(' ');
      const matchCount = words.filter(w => productWords.some(pw => pw.includes(w) || w.includes(pw))).length;
      if (matchCount >= 1 && words.length <= 3) return product.name;
      if (matchCount >= 2) return product.name;
    }
    return null;
  }

  extractQuantity(input: string): number {
    const match = input.match(/(\d+)/);
    return match ? parseInt(match[1]) : 1;
  }

  async generateResponse(input: string, cart: SaleItem[]): Promise<{ text: string; action?: any }> {
    const intent = this.detectIntent(input);
    if (!intent) {
      return { 
        text: `Oga ${this.currentUser?.name || 'Boss'}, I didn't quite catch that. You can ask me about stock, sales, or tell me to manage your cart!` 
      };
    }

    switch (intent.name) {
      case 'CHECK_STOCK': {
        const productName = this.extractProductName(input);
        if (!productName) return { text: "Which product? Mention the name." };
        const product = this.products.find(p => p.name.toLowerCase() === productName.toLowerCase());
        if (!product) return { text: `I can't find "${productName}" in inventory.` };
        const status = product.stock_qty <= product.low_stock_threshold ? '⚠️ Low stock!' : '✅ Good stock';
        return {
          text: `You have **${product.stock_qty} units** of ${product.name}. ${status}\nPrice: ₦${product.price.toLocaleString()}`,
          action: { type: 'NAVIGATE', data: 'inventory', label: 'View Stock' }
        };
      }
      case 'LOW_STOCK': {
        const lowStock = this.products.filter(p => p.stock_qty <= p.low_stock_threshold);
        if (lowStock.length === 0) return { text: "Market is full! All items are well stocked." };
        const list = lowStock.slice(0, 5).map(p => `• ${p.name}: ${p.stock_qty} left`).join('\n');
        return {
          text: `Oga, ${lowStock.length} items are finishing:\n\n${list}`,
          action: { type: 'NAVIGATE', data: 'inventory', label: 'Restock Now' }
        };
      }
      case 'TODAY_SALES': {
        const today = new Date().setHours(0, 0, 0, 0);
        const todaySales = this.sales.filter(s => s.timestamp >= today);
        const total = todaySales.reduce((sum, s) => sum + s.total_amount, 0);
        return {
          text: `Today's Sales: **₦${total.toLocaleString()}**\nTransactions: ${todaySales.length}\n\nYou're doing well!`,
          action: { type: 'NAVIGATE', data: 'activity-log', label: 'View History' }
        };
      }
      case 'PROFIT_CHECK': {
        let profit = 0;
        const pMap: any = {};
        this.products.forEach(p => { if (p.id) pMap[p.id] = p; });
        this.sales.forEach(s => s.items.forEach(i => {
          const p = pMap[i.productId];
          if (p) profit += (i.price - p.cost_price) * i.quantity;
        }));
        return { text: `Total Estimated Profit: **₦${profit.toLocaleString()}** (Selling Price - Cost Price)` };
      }
      case 'CLEAR_CART': {
        if (!cart.length) return { text: "Cart is already empty." };
        return { text: `Clear ${cart.length} item(s) from cart?`, action: { type: 'CLEAR_CART', label: 'Confirm Clear' } };
      }
      case 'PARK_ORDER': {
        if (!cart.length) return { text: "Nothing in cart to park." };
        return { text: "Ready to park this order?", action: { type: 'PARK_ORDER', label: 'Park Now' } };
      }
      case 'ADD_TO_CART': {
        const productName = this.extractProductName(input);
        if (!productName) return { text: "What should I add? (e.g., 'add 2 Milo')" };
        const product = this.products.find(p => p.name.toLowerCase() === productName.toLowerCase());
        if (!product) return { text: `"${productName}" not found.` };
        const qty = this.extractQuantity(input);
        if (product.stock_qty < qty) return { text: `Only ${product.stock_qty} left in stock.` };
        return {
          text: `Add ${qty} x ${product.name} (₦${(product.price * qty).toLocaleString()}) to cart?`,
          action: { type: 'ADD_TO_CART', data: { product, quantity: qty }, label: 'Add to Cart' }
        };
      }
      case 'NAVIGATE_INVENTORY': return { text: "Opening Inventory...", action: { type: 'NAVIGATE', data: 'inventory', label: 'Go to Inventory' } };
      case 'NAVIGATE_POS': return { text: "Opening POS...", action: { type: 'NAVIGATE', data: 'pos', label: 'Go to POS' } };
      case 'NAVIGATE_DASHBOARD': return { text: "Opening Dashboard...", action: { type: 'NAVIGATE', data: 'dashboard', label: 'Go to Dashboard' } };
      case 'GENERAL_HELP': return {
        text: "I can help with:\n📦 Stock: 'How many Milo left?'\n💰 Sales: 'How much did we make today?'\n🛒 Cart: 'Clear cart' or 'Add 2 Coke'\n🧭 Pages: 'Go to inventory'"
      };
      default: return { text: "I'm here to help! What do you need?" };
    }
  }
}

// ==================== MAIN COMPONENT ====================

const SmartSupportChat: React.FC<SmartChatProps> = ({ 
  currentUser, cart = [], onClearCart, onParkOrder, onNavigate, onAddToCart 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome', sender: 'bot', timestamp: Date.now(),
    text: `👋 Hello ${currentUser?.name || 'Boss'}! I'm your AI shop assistant. Ask me about stock, sales, or tell me to manage your cart!`
  }]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const engine = useMemo(() => new SmartBotEngine(products, sales, currentUser), [products, sales, currentUser]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping, isOpen]);

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Voice input not supported in this browser. Try using Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-NG'; // Nigerian locale for better accent matching
    
    recognition.onstart = () => {
      setIsListening(true);
      if (navigator.vibrate) navigator.vibrate(50);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech Recognition Error:', event.error);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Recognition already started');
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;
    const userText = inputText.trim();
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: userText, timestamp: Date.now() }]);
    setInputText('');
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    const response = await engine.generateResponse(userText, cart);
    setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: response.text, timestamp: Date.now(), action: response.action }]);
    setIsTyping(false);
  };

  const executeAction = (action: any, messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isExecuting: true } : m));
    setTimeout(() => {
      switch (action.type) {
        case 'CLEAR_CART': onClearCart?.(); break;
        case 'PARK_ORDER': onParkOrder?.(); break;
        case 'NAVIGATE': onNavigate?.(action.data); break;
        case 'ADD_TO_CART': onAddToCart?.(action.data.product, action.data.quantity); break;
      }
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, action: undefined, isExecuting: false } : m));
    }, 500);
  };

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-6 right-6 z-[999] w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group">
        {isOpen ? <X size={28} /> : <><Sparkles size={28} className="group-hover:rotate-12 transition-transform" /><span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center"><Zap size={12} className="text-white" /></span></>}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[999] w-[420px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-10rem)] bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white relative overflow-hidden shrink-0">
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center"><Bot size={24} /></div>
                <div>
                  <h3 className="text-xl font-black tracking-tight leading-none">AI Shop Assistant</h3>
                  <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest mt-1 flex items-center gap-1"><Zap size={10} /> Powered by Smart Engine</p>
                </div>
              </div>
              <button onClick={() => setMessages([messages[0]])} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-indigo-200"><Trash2 size={18} /></button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-50 scrollbar-hide">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                  {msg.text.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                </div>
                {msg.action && (
                  <button onClick={() => executeAction(msg.action, msg.id)} disabled={msg.isExecuting} className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm">
                    {msg.isExecuting ? <><Loader2 className="animate-spin" size={14} /> Executing...</> : <><CheckCircle2 size={14} /> {msg.action.label}</>}
                  </button>
                )}
              </div>
            ))}
            {isTyping && <div className="text-xs text-slate-400 font-medium px-2">AI thinking...</div>}
          </div>

          <div className="p-6 border-t border-slate-100 bg-white shrink-0">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder={isListening ? "Listening..." : "Ask about stock, sales..."}
                  className={`w-full pl-4 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition-all ${isListening ? 'border-rose-400 ring-2 ring-rose-200' : ''}`} 
                  value={inputText} 
                  onChange={e => setInputText(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleSend()} 
                />
                <button 
                  onClick={startVoiceInput}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:bg-slate-200'}`}
                  title="Voice Input"
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              </div>
              <button 
                onClick={handleSend} 
                disabled={!inputText.trim() || isTyping} 
                className="p-3 bg-indigo-600 text-white rounded-xl disabled:opacity-30 transition-all hover:bg-indigo-700 active:scale-90 shadow-lg shadow-indigo-200"
              >
                <Send size={20} />
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 text-slate-300 mt-3"><Sparkles size={12} /><span className="text-[9px] font-black uppercase tracking-widest">Smart AI • Offline-First</span></div>
          </div>
        </div>
      )}
    </>
  );
};

export default SmartSupportChat;