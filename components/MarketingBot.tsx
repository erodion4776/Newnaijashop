// ============================================
// MarketingBot.tsx - NaijaShop Sales Chatbot
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Award, 
  Flame,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  RotateCcw
} from 'lucide-react';
import { 
  getResponse, 
  UserProfile, 
  ChatTurn, 
  BotResult,
  createInitialProfile 
} from '../utils/MarketingBotEngine';
import { initializeCTAHooks, CTAInteraction } from '../hooks/LandingPageHooks';
import { useProactiveTriggers, ProactiveTriggerType } from '../hooks/ProactiveEngagement';
import { preprocessNigerianInput } from '../utils/NigerianNLP';
import { triggerTryOnHighlight, stopHighlight } from '../utils/CTAHighlighter';

// ============================================
// CONSTANTS
// ============================================

const AVATAR_URL = "https://i.ibb.co/bfCDQ9G/Generated-Image-September-24-2025-3-37-AM.png";
const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const STORAGE_KEYS = {
  VISIT_COUNT: 'naijaShopVisitCount',
  HAS_ENGAGED: 'hasEngaged',
  LAST_CLOSE_TIME: 'ns_last_close_time',
  CONVERSATION: 'ns_conversation',
  USER_PROFILE: 'ns_user_profile'
} as const;

// Quick reply suggestions based on context
const QUICK_REPLIES: Record<string, string[]> = {
  Greeting: ['Tell me about pricing', 'How does it work?', 'What features do you have?'],
  PricingDetails: ['Start Free Trial', 'Tell me about security', 'How do I set it up?'],
  Theft: ['Start Free Trial', 'How does it work offline?', 'Show me pricing'],
  DataOffline: ['Start Free Trial', 'What about security?', 'Tell me pricing'],
  Features: ['Tell me about security', 'How much does it cost?', 'Start Free Trial'],
  HowItWorks: ['Start Free Trial', 'What's the pricing?', 'Tell me about features'],
  FreeTrial: ['Yes, start now!', 'Tell me more first', 'What's included?'],
  Clarification: ['I sell provisions', 'I sell building materials', 'Tell me about pricing'],
  default: ['Tell me about pricing', 'What features do you have?', 'Start Free Trial']
};

// ============================================
// INTERFACES
// ============================================

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: number;
  intentName?: string;
  isFallback?: boolean;
  suggestedAction?: string | null;
  quickReplies?: string[];
  triggerId?: string;
  feedbackGiven?: 'up' | 'down' | null;
}

interface ConversationState {
  messages: Message[];
  history: ChatTurn[];
  userProfile: UserProfile;
  lastBotIntent: string | null;
  pendingAction: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate typing delay based on response length
 * Longer responses = longer "thinking" time
 */
function calculateTypingDelay(responseLength: number): number {
  const baseDelay = 800;
  const perCharDelay = 5;
  const maxDelay = 2500;
  const minDelay = 600;
  
  const calculated = baseDelay + Math.min(responseLength * perCharDelay, maxDelay - baseDelay);
  return Math.max(minDelay, Math.min(calculated, maxDelay));
}

/**
 * Get quick replies based on intent
 */
function getQuickReplies(intentName?: string): string[] {
  if (!intentName) return QUICK_REPLIES.default;
  return QUICK_REPLIES[intentName] || QUICK_REPLIES.default;
}

/**
 * Load conversation from session storage
 */
function loadConversation(): ConversationState | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEYS.CONVERSATION);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('[MarketingBot] Failed to load conversation:', e);
  }
  return null;
}

/**
 * Save conversation to session storage
 */
function saveConversation(state: ConversationState): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS.CONVERSATION, JSON.stringify(state));
  } catch (e) {
    console.warn('[MarketingBot] Failed to save conversation:', e);
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

const MarketingBot: React.FC = () => {
  // ─────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isWiggling, setIsWiggling] = useState(false);
  const [inputText, setInputText] = useState('');
  const [hasEngaged, setHasEngaged] = useState(
    sessionStorage.getItem(STORAGE_KEYS.HAS_ENGAGED) === 'true'
  );
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(createInitialProfile());
  const [lastBotIntent, setLastBotIntent] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // ─────────────────────────────────────────
  // REFS
  // ─────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioNotifRef = useRef<HTMLAudioElement | null>(null);

  // ─────────────────────────────────────────
  // DERIVED STATE
  // ─────────────────────────────────────────
  const isHotLead = userProfile.engagementScore >= 80;
  const isWarmLead = userProfile.engagementScore >= 50;

  // ─────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────
  useEffect(() => {
    // Initialize audio (will be enabled on first user interaction)
    audioNotifRef.current = new Audio(NOTIF_SOUND);
    audioNotifRef.current.volume = 0.5;

    // Track visit count
    const visitCount = parseInt(localStorage.getItem(STORAGE_KEYS.VISIT_COUNT) || '0');
    localStorage.setItem(STORAGE_KEYS.VISIT_COUNT, (visitCount + 1).toString());

    // Try to restore previous conversation
    const savedConversation = loadConversation();
    
    if (savedConversation && savedConversation.messages.length > 1) {
      // Restore previous session
      setMessages(savedConversation.messages);
      setHistory(savedConversation.history);
      setUserProfile(savedConversation.userProfile);
      setLastBotIntent(savedConversation.lastBotIntent);
      setPendingAction(savedConversation.pendingAction);
    } else {
      // Fresh start - add welcome message
      const welcomeMessage: Message = {
        id: 'welcome',
        sender: 'bot',
        text: visitCount > 0 
          ? `Welcome back! 👋 Good to see you again. Ready to start your free trial today, or do you have questions?`
          : `Hello! I'm the founder of NaijaShop. I built this to help traders like you grow. How can I help you today?`,
        timestamp: Date.now(),
        intentName: 'Greeting',
        quickReplies: getQuickReplies('Greeting')
      };
      setMessages([welcomeMessage]);
    }

    // Enable audio after first user interaction
    const enableAudio = () => {
      setAudioEnabled(true);
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
    document.addEventListener('click', enableAudio);
    document.addEventListener('touchstart', enableAudio);

    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
  }, []);

  // ─────────────────────────────────────────
  // SAVE CONVERSATION ON CHANGES
  // ─────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      saveConversation({
        messages,
        history,
        userProfile,
        lastBotIntent,
        pendingAction
      });
    }
  }, [messages, history, userProfile, lastBotIntent, pendingAction]);

  // ─────────────────────────────────────────
  // PROACTIVE TRIGGER HANDLER
  // ─────────────────────────────────────────
  const triggerProactiveMessage = useCallback((message: string, triggerId: string) => {
    // Play notification sound if enabled
    if (audioEnabled && audioNotifRef.current) {
      audioNotifRef.current.play().catch(() => {});
    }
    
    // Wiggle the button
    setIsWiggling(true);
    
    setTimeout(() => {
      setIsWiggling(false);
      setIsOpen(true);
      
      const proactiveMsg: Message = {
        id: `proactive-${Date.now()}`,
        sender: 'bot',
        text: message,
        timestamp: Date.now(),
        triggerId,
        intentName: 'ProactiveNudge',
        quickReplies: ['Tell me more', 'Show me pricing', 'Not interested']
      };
      
      setMessages(prev => [...prev, proactiveMsg]);
    }, 2000);
  }, [audioEnabled]);

  // Connect proactive triggers
  useProactiveTriggers({ 
    onTrigger: triggerProactiveMessage, 
    isBotOpen: isOpen, 
    hasEngaged 
  });

  // ─────────────────────────────────────────
  // CTA HOOKS HANDLER
  // ─────────────────────────────────────────
  useEffect(() => {
    const handleCTAInteraction = (interaction: CTAInteraction) => {
      // Boost engagement score for direct CTA interaction
      setUserProfile(prev => ({ 
        ...prev, 
        engagementScore: Math.min(100, prev.engagementScore + 20) 
      }));
      
      // Open the bot
      setIsOpen(true);
      
      // Add contextual message based on which CTA was clicked
      const ctaMessages: Record<string, { text: string; intent: string }> = {
        'FREE_TRIAL': {
          text: "Ehen! You're ready to start your 30-day free trial! 🎉 Let me quickly set you up. First, what type of business do you run?",
          intent: 'OnboardingStart'
        },
        'PRICING': {
          text: "Let me break down our pricing for you. We have 3 simple plans - which budget range works for you?",
          intent: 'PricingDetails'
        },
        'DEMO': {
          text: "Great! Instead of just showing you a video, let me personalize the demo for YOUR business. What do you sell?",
          intent: 'DemoPersonalized'
        }
      };
      
      const ctaConfig = ctaMessages[interaction.type] || ctaMessages['FREE_TRIAL'];
      
      const ctaMsg: Message = {
        id: `cta-${Date.now()}`,
        sender: 'bot',
        text: ctaConfig.text,
        timestamp: Date.now(),
        intentName: ctaConfig.intent,
        quickReplies: ['I sell provisions', 'Building materials', 'Something else']
      };
      
      setMessages(prev => [...prev, ctaMsg]);
      setLastBotIntent(ctaConfig.intent);
      
      // Highlight the CTA button
      if (interaction.type === 'FREE_TRIAL') {
        triggerTryOnHighlight('strong', { source: 'cta-click' });
      }
    };

    const cleanup = initializeCTAHooks(handleCTAInteraction);
    return cleanup;
  }, []);

  // ─────────────────────────────────────────
  // AUTO-SCROLL
  // ─────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ 
        top: scrollRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
    }
  }, [messages, isTyping, isOpen]);

  // ─────────────────────────────────────────
  // FOCUS INPUT WHEN OPENED
  // ─────────────────────────────────────────
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      // Delay to allow animation to complete
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, isMinimized]);

  // ─────────────────────────────────────────
  // SEND MESSAGE HANDLER
  // ─────────────────────────────────────────
  const handleSend = useCallback((textOverride?: string) => {
    const textToSend = (textOverride || inputText).trim();
    if (!textToSend || isTyping) return;

    // Mark as engaged
    if (!hasEngaged) {
      setHasEngaged(true);
      sessionStorage.setItem(STORAGE_KEYS.HAS_ENGAGED, 'true');
    }

    // Preprocess input for language detection
    const nlp = preprocessNigerianInput(textToSend);

    // Create user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textOverride) setInputText('');
    
    // Show typing indicator
    setIsTyping(true);

    // Build history for context (last 5 turns)
    const newUserTurn: ChatTurn = { 
      sender: 'user', 
      text: textToSend,
      timestamp: Date.now()
    };
    const currentHistory = [...history, newUserTurn].slice(-10);

    // Process with engine (wrapped in try-catch for safety)
    let result: BotResult;
    try {
      result = getResponse(
        textToSend, 
        currentHistory, 
        userProfile, 
        lastBotIntent, 
        pendingAction
      );
    } catch (error) {
      console.error('[MarketingBot] Engine error:', error);
      result = {
        text: "Oops! Something went wrong on my end. Please try asking again.",
        isFallback: true,
        intentName: 'Error',
        updatedProfile: userProfile
      };
    }

    // Calculate natural typing delay
    const typingDelay = calculateTypingDelay(result.text.length);

    setTimeout(() => {
      setIsTyping(false);
      
      // Create bot message
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: result.text,
        timestamp: Date.now(),
        isFallback: result.isFallback,
        suggestedAction: result.suggestedAction || null,
        intentName: result.intentName,
        quickReplies: getQuickReplies(result.intentName)
      };
      
      setMessages(prev => [...prev, botMsg]);
      setLastBotIntent(result.intentName || null);
      setPendingAction(result.suggestedAction || null);
      setUserProfile(result.updatedProfile);
      
      // Update history
      const newBotTurn: ChatTurn = { 
        sender: 'bot', 
        text: result.text, 
        intentName: result.intentName,
        timestamp: Date.now()
      };
      setHistory(prev => [...prev, newUserTurn, newBotTurn].slice(-10));

      // Handle CTA highlighting from engine result
      if (result.shouldHighlightCTA && result.ctaIntensity) {
        triggerTryOnHighlight(result.ctaIntensity, { 
          source: `intent-${result.intentName}` 
        });
      } else {
        // Fallback: Check keywords for high intent
        const highIntentKeywords = ['trial', 'setup', 'license', 'buy', 'start'];
        const isHighIntent = highIntentKeywords.some(kw => nlp.keywords.includes(kw));
        
        if (isHighIntent) {
          triggerTryOnHighlight('strong', { source: 'keyword-match' });
        } else if (result.intentName === 'PricingDetails') {
          triggerTryOnHighlight('subtle', { source: 'pricing-inquiry' });
        }
      }
    }, typingDelay);
  }, [inputText, isTyping, hasEngaged, history, userProfile, lastBotIntent, pendingAction]);

  // ─────────────────────────────────────────
  // QUICK REPLY HANDLER
  // ─────────────────────────────────────────
  const handleQuickReply = useCallback((reply: string) => {
    handleSend(reply);
  }, [handleSend]);

  // ─────────────────────────────────────────
  // FEEDBACK HANDLER
  // ─────────────────────────────────────────
  const handleFeedback = useCallback((messageId: string, feedback: 'up' | 'down') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, feedbackGiven: feedback }
        : msg
    ));
    
    // You could send this to analytics
    console.log('[Feedback]', { messageId, feedback });
  }, []);

  // ─────────────────────────────────────────
  // RESET CONVERSATION
  // ─────────────────────────────────────────
  const handleReset = useCallback(() => {
    const welcomeMessage: Message = {
      id: 'welcome-reset',
      sender: 'bot',
      text: "Conversation reset! 🔄 How can I help you today?",
      timestamp: Date.now(),
      intentName: 'Greeting',
      quickReplies: getQuickReplies('Greeting')
    };
    
    setMessages([welcomeMessage]);
    setHistory([]);
    setUserProfile(createInitialProfile());
    setLastBotIntent(null);
    setPendingAction(null);
    sessionStorage.removeItem(STORAGE_KEYS.CONVERSATION);
  }, []);

  // ─────────────────────────────────────────
  // TOGGLE HANDLERS
  // ─────────────────────────────────────────
  const toggleBot = useCallback(() => {
    if (isOpen) {
      sessionStorage.setItem(STORAGE_KEYS.LAST_CLOSE_TIME, Date.now().toString());
      stopHighlight(); // Stop any active CTA highlight
    }
    setIsOpen(!isOpen);
    setIsMinimized(false);
  }, [isOpen]);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(!isMinimized);
  }, [isMinimized]);

  // ─────────────────────────────────────────
  // RENDER: CHAT BUBBLE BUTTON
  // ─────────────────────────────────────────
  const renderChatBubble = () => (
    <button 
      onClick={toggleBot}
      aria-label={isOpen ? "Close chat" : "Open chat with NaijaShop"}
      className={`
        fixed bottom-6 right-6 z-[1000] 
        w-16 h-16 
        bg-emerald-600 
        rounded-full 
        shadow-2xl 
        flex items-center justify-center 
        hover:scale-110 active:scale-95 
        transition-all duration-200
        group 
        border-4 border-white 
        overflow-hidden 
        ${isWiggling ? 'animate-wiggle' : ''}
      `}
    >
      {isOpen ? (
        <X className="text-white" size={28} />
      ) : (
        <div className="relative w-full h-full">
          <img 
            src={AVATAR_URL} 
            className="w-full h-full object-cover" 
            alt="NaijaShop Founder" 
            crossOrigin="anonymous" 
            referrerPolicy="no-referrer"
            loading="lazy"
          />
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
  );

  // ─────────────────────────────────────────
  // RENDER: CHAT HEADER
  // ─────────────────────────────────────────
  const renderHeader = () => (
    <div className="bg-emerald-600 p-4 sm:p-6 text-white flex items-center gap-3 sm:gap-4 shrink-0 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 opacity-10">
        <Sparkles size={80} />
      </div>
      
      {/* Avatar */}
      <div className="relative shrink-0">
        <img 
          src={AVATAR_URL} 
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-white/30 object-cover bg-white" 
          alt="Founder" 
          crossOrigin="anonymous" 
          referrerPolicy="no-referrer"
        />
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-emerald-600 rounded-full" />
      </div>
      
      {/* Title & Status */}
      <div className="relative z-10 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-black tracking-tight text-base sm:text-lg leading-none truncate">
            NaijaShop Founder
          </h3>
          {isHotLead && <Award size={16} className="text-orange-300 shrink-0" />}
        </div>
        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-80">
          {isHotLead ? "VIP Priority Support" : isWarmLead ? "Support Active" : "Online Now"}
        </span>
      </div>
      
      {/* Hot Lead Badge */}
      {isHotLead && (
        <div className="relative z-10 shrink-0">
          <div className="bg-orange-500/20 px-2 py-1 rounded-lg border border-white/20">
            <span className="text-[8px] font-black uppercase">Hot Lead</span>
          </div>
        </div>
      )}
      
      {/* Minimize Button */}
      <button 
        onClick={toggleMinimize}
        className="relative z-10 p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
        aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
      >
        <ChevronDown 
          size={20} 
          className={`transition-transform duration-200 ${isMinimized ? 'rotate-180' : ''}`}
        />
      </button>
    </div>
  );

  // ─────────────────────────────────────────
  // RENDER: MESSAGE BUBBLE
  // ─────────────────────────────────────────
  const renderMessage = (msg: Message, index: number) => {
    const isUser = msg.sender === 'user';
    const isLastBotMessage = !isUser && index === messages.length - 1 && !isTyping;
    
    return (
      <div 
        key={msg.id} 
        className={`
          flex flex-col 
          ${isUser ? 'items-end' : 'items-start'} 
          animate-in fade-in slide-in-from-bottom-2 duration-300
        `}
      >
        {/* Message Bubble */}
        <div 
          className={`
            max-w-[85%] 
            p-3 sm:p-4 
            rounded-2xl sm:rounded-3xl 
            text-sm 
            font-medium 
            shadow-sm
            ${isUser 
              ? 'bg-emerald-600 text-white rounded-tr-sm sm:rounded-tr-none' 
              : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm sm:rounded-tl-none'
            }
          `}
        >
          {/* Message Text */}
          <div className="whitespace-pre-wrap">{msg.text}</div>
          
          {/* Feedback Buttons (for bot messages) */}
          {!isUser && msg.id !== 'welcome' && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
              {msg.feedbackGiven ? (
                <span className="text-xs text-slate-400">
                  Thanks for the feedback!
                </span>
              ) : (
                <>
                  <span className="text-xs text-slate-400">Helpful?</span>
                  <button 
                    onClick={() => handleFeedback(msg.id, 'up')}
                    className="p-1 hover:bg-emerald-50 rounded transition-colors"
                    aria-label="This was helpful"
                  >
                    <ThumbsUp size={12} className="text-slate-400 hover:text-emerald-600" />
                  </button>
                  <button 
                    onClick={() => handleFeedback(msg.id, 'down')}
                    className="p-1 hover:bg-red-50 rounded transition-colors"
                    aria-label="This was not helpful"
                  >
                    <ThumbsDown size={12} className="text-slate-400 hover:text-red-500" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <span className="mt-1 sm:mt-1.5 text-[8px] font-black text-slate-300 uppercase tracking-widest px-1">
          {isUser ? (userProfile.name || 'You') : 'Founder'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        
        {/* Quick Replies (only for last bot message) */}
        {isLastBotMessage && msg.quickReplies && msg.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 max-w-[95%]">
            {msg.quickReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickReply(reply)}
                className="
                  px-3 py-1.5 
                  text-xs 
                  font-semibold 
                  bg-emerald-50 
                  text-emerald-700 
                  border border-emerald-200 
                  rounded-full 
                  hover:bg-emerald-100 
                  hover:border-emerald-300
                  active:scale-95
                  transition-all
                "
              >
                {reply}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────
  // RENDER: TYPING INDICATOR
  // ─────────────────────────────────────────
  const renderTypingIndicator = () => (
    <div className="flex flex-col items-start animate-in fade-in">
      <div className="bg-emerald-100 p-3 sm:p-4 rounded-2xl sm:rounded-3xl rounded-tl-sm sm:rounded-tl-none flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
      </div>
    </div>
  );

  // ─────────────────────────────────────────
  // RENDER: INPUT AREA
  // ─────────────────────────────────────────
  const renderInputArea = () => (
    <div className="p-4 sm:p-6 border-t border-slate-100 bg-white shrink-0">
      {/* Input Field */}
      <div className="relative">
        <input 
          ref={inputRef}
          type="text" 
          placeholder="Ask about pricing, features, or security..." 
          className="
            w-full 
            p-3 sm:p-4 
            pr-12 
            bg-slate-50 
            border border-slate-200 
            rounded-xl sm:rounded-2xl 
            text-sm 
            outline-none 
            focus:ring-2 focus:ring-emerald-500 focus:border-transparent
            font-medium
            placeholder:text-slate-400
          " 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isTyping}
        />
        <button 
          onClick={() => handleSend()} 
          disabled={!inputText.trim() || isTyping} 
          className="
            absolute right-2 top-1/2 -translate-y-1/2 
            p-2 sm:p-2.5 
            bg-emerald-600 
            text-white 
            rounded-lg sm:rounded-xl 
            shadow-lg 
            disabled:opacity-30 
            disabled:cursor-not-allowed
            hover:bg-emerald-700
            active:scale-95
            transition-all
          "
          aria-label="Send message"
        >
          <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
        </button>
      </div>
      
      {/* Reset Button & Hot Lead Indicator */}
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RotateCcw size={10} />
          Reset Chat
        </button>
        
        {isHotLead && (
          <div className="flex items-center gap-1.5 text-[9px] font-black text-orange-500 uppercase animate-pulse">
            <Flame size={10} /> 
            Ready to Convert!
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────
  // RENDER: MAIN CHAT WINDOW
  // ─────────────────────────────────────────
  const renderChatWindow = () => (
    <div 
      className={`
        fixed 
        bottom-24 
        right-4 sm:right-6 
        z-[1000] 
        w-[calc(100vw-2rem)] sm:w-[380px] 
        max-w-[400px]
        bg-white 
        rounded-2xl sm:rounded-[2.5rem] 
        shadow-[0_20px_60px_rgba(0,0,0,0.3)] 
        border border-slate-100 
        flex flex-col 
        overflow-hidden 
        animate-in slide-in-from-bottom-10 duration-300
        ${isMinimized ? 'h-auto' : 'h-[500px] sm:h-[600px]'}
      `}
      role="dialog"
      aria-label="Chat with NaijaShop"
    >
      {/* Header */}
      {renderHeader()}

      {/* Chat Body (hidden when minimized) */}
      {!isMinimized && (
        <>
          {/* Messages Area */}
          <div 
            ref={scrollRef} 
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50/50 scrollbar-hide"
          >
            {messages.map((msg, index) => renderMessage(msg, index))}
            {isTyping && renderTypingIndicator()}
          </div>

          {/* Input Area */}
          {renderInputArea()}
        </>
      )}
    </div>
  );

  // ─────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────
  return (
    <>
      {/* Chat Bubble Button */}
      {renderChatBubble()}

      {/* Chat Window */}
      {isOpen && renderChatWindow()}

      {/* Global Styles */}
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(10deg) scale(1.1); }
          50% { transform: rotate(-10deg) scale(1.1); }
          75% { transform: rotate(10deg) scale(1.1); }
        }
        .animate-wiggle { 
          animation: wiggle 0.5s ease-in-out infinite; 
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
};

export default MarketingBot;
