import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles, MessageSquare, CheckCircle2, ThumbsUp, ThumbsDown, Package, ShieldCheck, Zap } from 'lucide-react';
import { getResponse } from '../utils/MarketingBotEngine';
import { initializeCTAHooks } from '../hooks/LandingPageHooks';
import { useProactiveTriggers } from '../hooks/useProactiveTriggers';

const AVATAR_URL = "https://i.ibb.co/bfCDQ9G/Generated-Image-September-24-2025-3-37-AM.png";
const WHATSAPP_URL = "https://wa.me/2348184774884";
const POP_SOUND = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";
const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

type FlowType = 'NONE' | 'FREE_TRIAL' | 'PRICING' | 'DEMO';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: number;
  isFallback?: boolean;
  suggestedAction?: string | null;
  quickChoices?: string[];
  triggerId?: string;
}

const MarketingBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isNudging, setIsNudging] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastBotIntent, setLastBotIntent] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [hasEngaged, setHasEngaged] = useState(sessionStorage.getItem('ns_engaged') === 'true');
  
  // Guided Flow States
  const [currentFlow, setCurrentFlow] = useState<FlowType>('NONE');
  const [flowStep, setFlowStep] = useState(0);
  const [originalTarget, setOriginalTarget] = useState('/setup');

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const audioPopRef = useRef<HTMLAudioElement | null>(null);
  const audioNotifRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio
  useEffect(() => {
    audioPopRef.current = new Audio(POP_SOUND);
    audioNotifRef.current = new Audio(NOTIF_SOUND);
  }, []);

  const playPop = () => {
    if (audioPopRef.current) {
      audioPopRef.current.currentTime = 0;
      audioPopRef.current.play().catch(() => {});
    }
  };

  const playNotif = () => {
    if (audioNotifRef.current) {
      audioNotifRef.current.currentTime = 0;
      audioNotifRef.current.play().catch(() => {});
    }
  };

  // Initial greeting
  useEffect(() => {
    if (!hasInitialized.current) {
      const greeting: Message = {
        id: 'initial-greeting',
        sender: 'bot',
        text: 'Hello! I am the founder of NaijaShop. I created this solution to help your business grow. How can I assist you with our Offline Point of Sale today?',
        timestamp: Date.now()
      };
      setMessages([greeting]);
      hasInitialized.current = true;
    }
  }, []);

  // Proactive Trigger Handler
  const handleProactiveTrigger = (message: string, triggerId: string) => {
    console.log(`Converted via: ${triggerId}`);
    
    if (triggerId === 'SCROLL_DEPTH') {
      setIsNudging(true);
      playNotif();
      setTimeout(() => {
        setIsNudging(false);
        openWithMessage(message, triggerId);
      }, 3000);
    } else {
      openWithMessage(message, triggerId);
    }
  };

  const openWithMessage = (text: string, id: string) => {
    setIsOpen(true);
    playPop();
    const proactiveMsg: Message = {
      id: `proactive-${Date.now()}`,
      sender: 'bot',
      text: text,
      timestamp: Date.now(),
      triggerId: id
    };
    setMessages(prev => [...prev, proactiveMsg]);
  };

  // Hook Registrations
  useProactiveTriggers({ onTrigger: handleProactiveTrigger, isBotOpen: isOpen, hasEngaged });

  useEffect(() => {
    const cleanup = initializeCTAHooks((type, target) => {
      setOriginalTarget(target);
      startGuidedFlow(type as FlowType);
    });
    return cleanup;
  }, []);

  const startGuidedFlow = (type: FlowType) => {
    setCurrentFlow(type);
    setFlowStep(1);
    setIsOpen(true);
    playPop();

    let welcomeText = "";
    let q1 = "";
    let choices: string[] = [];

    if (type === 'FREE_TRIAL') {
      welcomeText = "Excellent choice! You are starting your 30-day free trial. 🎉 Allow me to ask two quick questions to set up the terminal correctly for your shop.";
      q1 = "First: What industry is your business in? Provisions? Building materials? Or another category?";
      choices = ["Provisions", "Building Materials", "Other"];
    } else if (type === 'PRICING') {
      welcomeText = "Would you like to review our pricing? I am happy to help! First, let me understand your business scale so I can recommend the most cost-effective plan.";
      q1 = "How many products do you currently manage? A small collection (under 50) or a larger inventory (over 50)?";
      choices = ["Under 50", "Over 50"];
    } else if (type === 'DEMO') {
      welcomeText = "It is time for your demo! 🚀 I will show you exactly how NaijaShop functions for your specific business type.";
      q1 = "Which category best describes your shop? Provisions, electronics, or building materials?";
      choices = ["Provisions", "Electronics", "Building Materials"];
    }

    setMessages(prev => [
      ...prev,
      { id: `flow-welcome-${Date.now()}`, sender: 'bot', text: welcomeText, timestamp: Date.now() },
      { id: `flow-q1-${Date.now()}`, sender: 'bot', text: q1, timestamp: Date.now(), quickChoices: choices }
    ]);
  };

  const handleFlowStep = (userAnswer: string) => {
    const nextStep = flowStep + 1;
    setFlowStep(nextStep);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let botResponse = "";
      let choices: string[] = [];

      if (currentFlow === 'FREE_TRIAL') {
        if (nextStep === 2) {
          botResponse = "Understood. Will you have a staff member assisting you with the Point of Sale?";
          choices = ["Yes, I have staff", "No, I manage it personally"];
        } else if (nextStep === 3) {
          botResponse = "Perfect. Your terminal configuration is ready. I am redirecting you to the setup page now to finalize your trial.";
          completeFlowAndRedirect();
        }
      } else if (currentFlow === 'PRICING') {
        if (nextStep === 2) {
          botResponse = "Thank you. Are you interested in an annual license or a one-time lifetime access payment?";
          choices = ["Annual License", "Lifetime Access"];
        } else if (nextStep === 3) {
          botResponse = "Excellent. I am directing you to our secure checkout page to view the plans tailored for your business scale.";
          completeFlowAndRedirect();
        }
      } else if (currentFlow === 'DEMO') {
        if (nextStep === 2) {
          botResponse = "Great! Would you prefer to see our AI inventory scanner in action or view our detailed profit reports?";
          choices = ["AI Scanner", "Profit Reports"];
        } else if (nextStep === 3) {
          botResponse = "Your demo environment is prepared. Taking you there now...";
          completeFlowAndRedirect();
        }
      }

      if (botResponse) {
        setMessages(prev => [...prev, {
          id: `flow-step-${nextStep}-${Date.now()}`,
          sender: 'bot',
          text: botResponse,
          timestamp: Date.now(),
          quickChoices: choices.length > 0 ? choices : undefined
        }]);
      }
    }, 1500);
  };

  const completeFlowAndRedirect = () => {
    setTimeout(() => {
      window.location.href = originalTarget;
    }, 2500);
  };

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

    // Set engagement flag to disable proactive triggers
    if (!hasEngaged) {
      setHasEngaged(true);
      sessionStorage.setItem('ns_engaged', 'true');
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textOverride) setInputText('');

    if (currentFlow !== 'NONE') {
      handleFlowStep(textToSend);
      return;
    }
    
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const result = getResponse(textToSend, lastBotIntent, pendingAction);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: result.text,
        timestamp: Date.now(),
        isFallback: result.isFallback,
        suggestedAction: result.suggestedAction || null
      };
      
      setMessages(prev => [...prev, botMsg]);
      setLastBotIntent(result.intentName || null);
      setPendingAction(result.suggestedAction || null);
    }, 1200);
  };

  const handleManualClose = () => {
    setIsOpen(false);
    sessionStorage.setItem('ns_last_close_time', Date.now().toString());
  };

  const handleWhatsAppClick = () => {
    window.open(WHATSAPP_URL, '_blank');
  };

  return (
    <>
      <button 
        onClick={() => isOpen ? handleManualClose() : setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-[1000] w-16 h-16 bg-emerald-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group border-4 border-white overflow-hidden ${isNudging ? 'animate-nudge' : ''}`}
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
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full animate-pulse" />
          </div>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[1000] w-[380px] max-w-[calc(100vw-3rem)] h-[600px] bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
          
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
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-emerald-600 rounded-full" />
            </div>
            <div className="relative z-10">
              <h3 className="font-black tracking-tight text-lg leading-none">NaijaShop Founder</h3>
              <div className="flex items-center gap-1.5 mt-1 opacity-80">
                <div className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Support Expert</span>
              </div>
            </div>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 scrollbar-hide"
          >
            {messages.map((msg, index) => (
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

                  {/* Flow Quick Choices */}
                  {msg.sender === 'bot' && msg.quickChoices && index === messages.length - 1 && (
                    <div className="mt-4 grid grid-cols-1 gap-2 animate-in slide-in-from-top-2 duration-500">
                      {msg.quickChoices.map(choice => (
                        <button 
                          key={choice}
                          onClick={() => handleSend(choice)}
                          className="w-full py-2.5 bg-white/20 hover:bg-white/40 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-white/20"
                        >
                           {choice}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Legacy Quick Action Buttons */}
                  {msg.sender === 'bot' && msg.suggestedAction && !msg.quickChoices && index === messages.length - 1 && (
                    <div className="mt-4 flex gap-2 animate-in slide-in-from-top-2 duration-500">
                      <button 
                        onClick={() => handleSend("Yes")}
                        className="flex-1 py-2 bg-white/20 hover:bg-white/40 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border border-white/20"
                      >
                        <ThumbsUp size={12} /> Yes
                      </button>
                      <button 
                        onClick={() => handleSend("No")}
                        className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border border-white/10"
                      >
                        <ThumbsDown size={12} /> No
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-1.5 flex items-center gap-1 px-1">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                    {msg.sender === 'user' ? 'You' : 'Founder'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {msg.sender === 'bot' && msg.isFallback && (
                  <button 
                    onClick={handleWhatsAppClick}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-sm"
                  >
                    <MessageSquare size={14} /> WhatsApp Support
                  </button>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex flex-col items-start animate-in fade-in">
                <div className="bg-emerald-100 p-4 rounded-3xl rounded-tl-none flex items-center gap-1.5 shadow-inner">
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-100 bg-white shrink-0">
            <div className="relative">
              <input 
                type="text"
                placeholder="How can I assist your business?"
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
              <CheckCircle2 size={10} className="text-emerald-400" /> Standard Professional POS
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes nudge {
          0%, 100% { transform: rotate(0deg) scale(1); }
          20% { transform: rotate(-12deg) scale(1.1); }
          40% { transform: rotate(12deg) scale(1.1); }
          60% { transform: rotate(-8deg) scale(1.05); }
          80% { transform: rotate(8deg) scale(1.05); }
        }
        .animate-nudge {
          animation: nudge 0.6s ease-in-out infinite;
        }
      `}</style>
    </>
  );
};

export default MarketingBot;
