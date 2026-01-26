import { preprocessNigerianInput, RESPONSE_VARIANTS } from './NigerianNLP';
import { triggerTryOnHighlight } from './CTAHighlighter'; // ADD THIS IMPORT

// ============================================
// INTERFACES
// ============================================

export interface UserProfile {
  name?: string;
  businessType?: string;
  businessTypeLabel?: string; // NEW: Human-readable label
  painPoints: string[];
  engagementScore: number;
  language: 'pidgin' | 'formal' | 'mixed'; // NEW: Track user's language preference
}

export interface ChatTurn {
  sender: 'user' | 'bot';
  text: string;
  intentName?: string;
  timestamp: number; // NEW: For session tracking
}

export interface BotResult {
  text: string;
  isFallback: boolean;
  intentName?: string;
  suggestedAction?: string;
  updatedProfile: UserProfile;
  shouldHighlightCTA?: boolean; // NEW: Signal to UI
  ctaIntensity?: 'subtle' | 'strong' | 'urgent'; // NEW: How aggressive
}

// FIXED: Added currentBoost to a separate scored interface
interface Intent {
  name: string;
  keywords: string[];
  response: string;
  responsePidgin?: string; // NEW: Direct pidgin version
  priority: 'specific' | 'general' | 'conversational';
  suggests?: string;
  triggersCTA?: boolean; // NEW: Does this intent signal buying interest?
}

interface ScoredIntent extends Intent {
  currentBoost: number; // NOW TypeScript won't complain
}

// ============================================
// CONSTANTS
// ============================================

// FIXED: Added labels for proper grammar
const BUSINESS_TYPES: Record<string, string> = {
  'cement': 'cement business',
  'block': 'block industry',
  'construction': 'construction business',
  'building': 'building materials shop',
  'water': 'pure water factory',
  'factory': 'factory',
  'pharmacy': 'pharmacy',
  'chemist': 'chemist shop',
  'boutique': 'boutique',
  'shop': 'shop',
  'store': 'store',
  'supermarket': 'supermarket',
  'mart': 'mini mart',
  'provision': 'provision store',
  'laundry': 'laundry business',
  'salon': 'salon',
  'barbing': 'barbing salon',
  'poultry': 'poultry farm',
  'farm': 'farm',
  'spare parts': 'spare parts shop',
  'gadget': 'gadget store',
  'phone': 'phone accessories shop',
  'sand': 'sand business',
  'quarry': 'quarry',
  'yard': 'building materials yard'
};

const BUSINESS_KEYWORDS = Object.keys(BUSINESS_TYPES);

const NAME_INTRO_MARKERS = [
  "my name is", 
  "i am", 
  "i'm", 
  "call me", 
  "name na", 
  "na me be",
  "this is",
  "i be"  // NEW: Pidgin addition
];

// NEW: Words that should NOT be treated as names
const NAME_BLACKLIST = [
  ...BUSINESS_KEYWORDS,
  'interested', 'looking', 'want', 'need', 'asking', 'here', 'new', 'old',
  'customer', 'trader', 'seller', 'buyer', 'business', 'owner', 'manager'
];

// ============================================
// PROFILE EXTRACTION (IMPROVED)
// ============================================

const updateProfile = (
  input: string, 
  currentProfile: UserProfile, 
  keywords: string[],
  detectedLanguage: 'pidgin' | 'formal' | 'mixed'
): UserProfile => {
  const newProfile = { ...currentProfile };
  const lowerInput = input.toLowerCase();

  // Update language preference (weighted average towards recent)
  newProfile.language = detectedLanguage;

  // ─────────────────────────────────────────
  // 1. NAME EXTRACTION (IMPROVED)
  // ─────────────────────────────────────────
  if (!newProfile.name) { // Only extract if we don't have a name yet
    for (const marker of NAME_INTRO_MARKERS) {
      const markerIndex = lowerInput.indexOf(marker);
      if (markerIndex !== -1) {
        const afterMarker = lowerInput.slice(markerIndex + marker.length).trim();
        // Get first word, remove punctuation
        const potentialName = afterMarker.split(/[\s,\.!?]+/)[0].replace(/[^a-zA-Z]/g, '');
        
        if (
          potentialName && 
          potentialName.length >= 2 && 
          potentialName.length <= 15 && // Names aren't usually super long
          !NAME_BLACKLIST.includes(potentialName)
        ) {
          newProfile.name = potentialName.charAt(0).toUpperCase() + potentialName.slice(1).toLowerCase();
          break; // Stop after first valid name found
        }
      }
    }
  }

  // ─────────────────────────────────────────
  // 2. BUSINESS TYPE EXTRACTION (IMPROVED)
  // ─────────────────────────────────────────
  if (!newProfile.businessType) { // Only extract if not already known
    for (const bizKey of BUSINESS_KEYWORDS) {
      if (lowerInput.includes(bizKey) || keywords.includes(bizKey)) {
        newProfile.businessType = bizKey;
        newProfile.businessTypeLabel = BUSINESS_TYPES[bizKey]; // FIXED: Proper label
        break;
      }
    }
  }

  // ─────────────────────────────────────────
  // 3. PAIN POINT EXTRACTION (FIXED - Check before push)
  // ─────────────────────────────────────────
  const addPainPoint = (point: string) => {
    if (!newProfile.painPoints.includes(point)) {
      newProfile.painPoints.push(point);
    }
  };

  if (keywords.includes('theft') || lowerInput.includes('steal') || lowerInput.includes('thief')) {
    addPainPoint('theft');
  }
  if (keywords.includes('data') || lowerInput.includes('internet') || lowerInput.includes('network')) {
    addPainPoint('data_cost');
  }
  if (lowerInput.includes('math') || lowerInput.includes('calc') || lowerInput.includes('account')) {
    addPainPoint('accounting');
  }
  if (lowerInput.includes('stock') || lowerInput.includes('inventory') || lowerInput.includes('count')) {
    addPainPoint('inventory');
  }
  if (lowerInput.includes('time') || lowerInput.includes('slow') || lowerInput.includes('fast')) {
    addPainPoint('time_saving');
  }

  // ─────────────────────────────────────────
  // 4. ENGAGEMENT SCORE (Cap at 100)
  // ─────────────────────────────────────────
  newProfile.engagementScore = Math.min(100, newProfile.engagementScore + 10);

  return newProfile;
};

// ============================================
// INTENTS DATABASE (EXPANDED)
// ============================================

const INTENTS: Intent[] = [
  // ─────────────────────────────────────────
  // GREETINGS
  // ─────────────────────────────────────────
  {
    name: 'Greeting',
    keywords: ['hi', 'hello', 'hey', 'morning', 'afternoon', 'evening', 'how far', 'howdy', 'good day'],
    response: "Hello! Welcome to NaijaShop. I'm here to help you manage your business better. What would you like to know?",
    responsePidgin: "How far! Welcome to NaijaShop. I dey here to help you run your business well well. Wetin you wan know?",
    priority: 'general'
  },

  // ─────────────────────────────────────────
  // PRICING (HIGH INTENT)
  // ─────────────────────────────────────────
  {
    name: 'PricingDetails',
    keywords: ['price', 'cost', 'pay', 'money', 'subscription', 'license', 'buy', 'naira', '₦', 'amount', 'fees', 'charges', 'how much', 'pricing'],
    response: "Great question! We have 3 simple plans:\n\n1️⃣ **30-Day Free Trial** — ₦0 (test everything!)\n2️⃣ **Annual License** — ₦10,000/year\n3️⃣ **Lifetime Access** — ₦25,000 (one-time)\n\nWhich one fits your budget? Want me to help you choose?",
    responsePidgin: "Good question! We get 3 plans:\n\n1️⃣ **30-Day Free Trial** — ₦0 (test everything!)\n2️⃣ **Yearly License** — ₦10,000/year\n3️⃣ **Lifetime** — ₦25,000 (pay once, use forever!)\n\nWhich one dey work for you? Make I help you pick?",
    priority: 'specific',
    suggests: 'show_trial_button',
    triggersCTA: true
  },

  // ─────────────────────────────────────────
  // SECURITY / THEFT
  // ─────────────────────────────────────────
  {
    name: 'Theft',
    keywords: ['steal', 'theft', 'staff', 'security', 'monitor', 'delete', 'change', 'fraud', 'cheat', 'audit log', 'trust', 'thief', 'stealing'],
    response: "This is a big issue for Nigerian businesses! Our **Fortress Security** system:\n\n🔒 Staff can't see your profit margins\n📝 Secret Audit Log tracks ALL deletions\n👁️ You see everything, they see only what they need\n\nWant to see how it works?",
    responsePidgin: "Ehen! This one na serious matter. Our **Fortress Security** go help you:\n\n🔒 Staff no go fit see your profit\n📝 Secret Audit Log dey record if dem delete anything\n👁️ You see everything, dem see only wetin you allow\n\nYou wan see how e dey work?",
    priority: 'specific',
    suggests: 'show_demo'
  },

  // ─────────────────────────────────────────
  // DATA / OFFLINE
  // ─────────────────────────────────────────
  {
    name: 'DataOffline',
    keywords: ['data', 'internet', 'offline', 'network', 'connection', 'wifi', 'data cost', 'no network', 'mb', 'gb'],
    response: "**ZERO data needed to sell!** 📴\n\nNaijaShop works 100% offline. You only need 1 minute of internet for your nightly WhatsApp backup.\n\nPerfect for areas with poor network. Want to try it?",
    responsePidgin: "**ZERO data to sell!** 📴\n\nNaijaShop dey work 100% offline. Na only 1 minute internet you need for night WhatsApp backup.\n\nE good for area wey network no dey. You wan try am?",
    priority: 'specific',
    suggests: 'show_trial_button',
    triggersCTA: true
  },

  // ─────────────────────────────────────────
  // FREE TRIAL (HIGH INTENT)
  // ─────────────────────────────────────────
  {
    name: 'FreeTrial',
    keywords: ['free', 'trial', 'test', 'try', 'demo', 'sample', 'free trial', 'try am', 'try it'],
    response: "Yes! You get **30 days completely FREE** — no card needed, no commitment.\n\nYou can add products, make sales, and see reports. If you like it, you upgrade. If not, no wahala!\n\n👇 Click below to start now!",
    responsePidgin: "Yes o! You go get **30 days FREE** — no card, no commitment.\n\nYou fit add products, sell, see reports. If e sweet you, you upgrade. If no, no wahala!\n\n👇 Click below make you start now!",
    priority: 'specific',
    suggests: 'trigger_trial_cta',
    triggersCTA: true
  },

  // ─────────────────────────────────────────
  // FEATURES
  // ─────────────────────────────────────────
  {
    name: 'Features',
    keywords: ['features', 'what can', 'can it', 'does it', 'function', 'capability', 'do', 'able', 'support'],
    response: "NaijaShop can help you with:\n\n📦 **Inventory** — Track stock levels automatically\n💰 **Sales** — Record sales in seconds\n📊 **Reports** — See daily/weekly profits\n🔒 **Security** — Protect against staff theft\n📱 **WhatsApp Backup** — Never lose your data\n\nWhich feature interests you most?",
    responsePidgin: "NaijaShop fit help you with:\n\n📦 **Inventory** — Track your stock automatically\n💰 **Sales** — Record sale for seconds\n📊 **Reports** — See daily/weekly profit\n🔒 **Security** — Stop staff theft\n📱 **WhatsApp Backup** — You no go lose data\n\nWhich one you wan hear more about?",
    priority: 'specific'
  },

  // ─────────────────────────────────────────
  // HOW IT WORKS
  // ─────────────────────────────────────────
  {
    name: 'HowItWorks',
    keywords: ['how', 'work', 'use', 'setup', 'install', 'start', 'begin', 'step', 'process'],
    response: "It's super simple! 3 steps:\n\n1️⃣ **Sign up** (2 minutes)\n2️⃣ **Add your products** (we help you import)\n3️⃣ **Start selling!**\n\nNo training needed. If you can use WhatsApp, you can use NaijaShop!\n\nReady to start your free trial?",
    responsePidgin: "E easy gan! Na 3 steps:\n\n1️⃣ **Sign up** (2 minutes)\n2️⃣ **Add your products** (we go help you)\n3️⃣ **Start to sell!**\n\nNo training. If you sabi use WhatsApp, you sabi use NaijaShop!\n\nYou ready to start free trial?",
    priority: 'specific',
    suggests: 'trigger_trial_cta',
    triggersCTA: true
  },

  // ─────────────────────────────────────────
  // AFFIRMATIVE (YES)
  // ─────────────────────────────────────────
  {
    name: 'Affirmative',
    keywords: ['yes', 'yea', 'yeah', 'sure', 'okay', 'ok', 'ehen', 'alright', 'proceed', 'continue', 'go ahead', 'show me', 'tell me', 'i want'],
    response: '', // Handled contextually
    priority: 'conversational'
  },

  // ─────────────────────────────────────────
  // NEGATIVE (NO) — NEW
  // ─────────────────────────────────────────
  {
    name: 'Negative',
    keywords: ['no', 'nah', 'nope', 'not now', 'later', 'maybe', 'not interested', 'not really', 'no need'],
    response: '', // Handled contextually
    priority: 'conversational'
  },

  // ─────────────────────────────────────────
  // THANK YOU
  // ─────────────────────────────────────────
  {
    name: 'Thanks',
    keywords: ['thank', 'thanks', 'appreciate', 'helpful', 'great', 'awesome', 'nice'],
    response: "You're welcome! 😊 If you have more questions, I'm here. Ready to start your free trial whenever you are!",
    responsePidgin: "You're welcome! 😊 If you get more question, I dey here. When you ready for free trial, just tell me!",
    priority: 'general',
    triggersCTA: true
  },

  // ─────────────────────────────────────────
  // GOODBYE
  // ─────────────────────────────────────────
  {
    name: 'Goodbye',
    keywords: ['bye', 'goodbye', 'later', 'see you', 'take care', 'gotta go'],
    response: "Goodbye! Remember, your 30-day free trial is waiting whenever you're ready. Take care! 👋",
    responsePidgin: "Bye bye! Remember, your 30-day free trial dey wait for you. Take care! 👋",
    priority: 'general'
  }
];

// ============================================
// CONTEXT-AWARE RESPONSE HANDLERS — NEW
// ============================================

const handleAffirmativeResponse = (
  lastIntent: string | null,
  profile: UserProfile,
  lang: 'pidgin' | 'formal' | 'mixed'
): BotResult | null => {
  
  const usePidgin = lang === 'pidgin' || lang === 'mixed';
  const name = profile.name ? `${profile.name}, ` : '';

  // Map last intent to appropriate follow-up
  const followUps: Record<string, { text: string; textPidgin: string; nextIntent: string; triggersCTA: boolean }> = {
    'Greeting': {
      text: `${name}Great! What would you like to know about NaijaShop? I can tell you about pricing, features, or how it helps with staff theft.`,
      textPidgin: `${name}Nice one! Wetin you wan know about NaijaShop? I fit tell you about price, features, or how e dey stop staff theft.`,
      nextIntent: 'AwaitingTopic',
      triggersCTA: false
    },
    'PricingDetails': {
      text: `${name}Excellent choice! Click the "Start Free Trial" button below and you'll be set up in 2 minutes. No payment needed!`,
      textPidgin: `${name}Correct! Click "Start Free Trial" button below, you go set up for 2 minutes. No payment needed!`,
      nextIntent: 'TrialRedirect',
      triggersCTA: true
    },
    'Theft': {
      text: `${name}Let me show you. In NaijaShop, every action is logged. Even if staff deletes a sale, you'll see it in your secret Audit Log. Want to try it free for 30 days?`,
      textPidgin: `${name}Make I show you. For NaijaShop, every action dey logged. Even if staff delete sale, you go see am for your secret Audit Log. You wan try am free for 30 days?`,
      nextIntent: 'TheftDemo',
      triggersCTA: true
    },
    'DataOffline': {
      text: `${name}Perfect! The free trial works offline too. You can test it even without internet. Click below to start!`,
      textPidgin: `${name}Perfect! The free trial dey work offline too. You fit test am even without internet. Click below to start!`,
      nextIntent: 'TrialRedirect',
      triggersCTA: true
    },
    'Features': {
      text: `${name}Which feature would you like to know more about? Inventory tracking, sales recording, reports, or security?`,
      textPidgin: `${name}Which feature you wan hear more about? Inventory, sales, reports, or security?`,
      nextIntent: 'FeatureDeepDive',
      triggersCTA: false
    },
    'HowItWorks': {
      text: `${name}Awesome! Let's get you started. Click the "Start Free Trial" button and I'll guide you through!`,
      textPidgin: `${name}Oya na! Make we start. Click "Start Free Trial" button, I go guide you!`,
      nextIntent: 'TrialRedirect',
      triggersCTA: true
    },
    'FreeTrial': {
      text: `${name}You're making a great decision! Click the button below to start. Setup takes just 2 minutes! 🚀`,
      textPidgin: `${name}You dey make correct decision! Click the button below. Setup na just 2 minutes! 🚀`,
      nextIntent: 'TrialRedirect',
      triggersCTA: true
    }
  };

  const followUp = followUps[lastIntent || ''];
  
  if (followUp) {
    return {
      text: usePidgin ? followUp.textPidgin : followUp.text,
      isFallback: false,
      intentName: followUp.nextIntent,
      shouldHighlightCTA: followUp.triggersCTA,
      ctaIntensity: followUp.triggersCTA ? 'strong' : undefined,
      updatedProfile: profile
    };
  }

  return null;
};

// NEW: Handle "No" responses gracefully
const handleNegativeResponse = (
  lastIntent: string | null,
  profile: UserProfile,
  lang: 'pidgin' | 'formal' | 'mixed'
): BotResult | null => {
  
  const usePidgin = lang === 'pidgin' || lang === 'mixed';
  const name = profile.name ? `${profile.name}, ` : '';

  const responses: Record<string, { text: string; textPidgin: string }> = {
    'PricingDetails': {
      text: `${name}No problem! Is there something specific holding you back? Maybe I can help address your concerns.`,
      textPidgin: `${name}No wahala! Something dey hold you back? Maybe I fit help.`
    },
    'FreeTrial': {
      text: `${name}That's okay! Would you like to know more about the features first? Or maybe see how other businesses like yours use NaijaShop?`,
      textPidgin: `${name}E correct! You wan know more about the features first? Or see how other business like your own dey use NaijaShop?`
    },
    'default': {
      text: `${name}No problem! Is there something else you'd like to know about NaijaShop?`,
      textPidgin: `${name}No wahala! Anything else you wan know about NaijaShop?`
    }
  };

  const response = responses[lastIntent || ''] || responses['default'];

  return {
    text: usePidgin ? response.textPidgin : response.text,
    isFallback: false,
    intentName: 'HandlingObjection',
    updatedProfile: profile
  };
};

// ============================================
// PERSONALIZATION HELPERS (FIXED)
// ============================================

const personalizeResponse = (
  baseResponse: string, 
  profile: UserProfile
): string => {
  let response = baseResponse;
  
  // Add name naturally (not at the very start if it sounds awkward)
  if (profile.name && !response.startsWith(profile.name)) {
    // Insert name after first sentence or greeting word
    response = response.replace(
      /^(Great|Excellent|Perfect|Nice|Good|Awesome|Yes|Ehen|Oya|Okay)(!|,|\s)/i, 
      `$1$2 ${profile.name}, `
    );
  }

  // Add business context if relevant (FIXED grammar)
  if (profile.businessTypeLabel && response.includes('business')) {
    response = response.replace(
      /your business/gi, 
      `your ${profile.businessTypeLabel}`
    );
  }

  return response;
};

// ============================================
// MAIN RESPONSE FUNCTION
// ============================================

export const getResponse = (
  userInput: string, 
  history: ChatTurn[], 
  currentProfile: UserProfile,
  lastIntent: string | null, 
  pendingAction: string | null
): BotResult => {
  
  // ─────────────────────────────────────────
  // STEP 1: Preprocess Input
  // ─────────────────────────────────────────
  const nlp = preprocessNigerianInput(userInput);
  const input = nlp.processed;
  const keywords = nlp.keywords;
  const lang = nlp.language;
  
  // ─────────────────────────────────────────
  // STEP 2: Update User Profile
  // ─────────────────────────────────────────
  const updatedProfile = updateProfile(userInput, currentProfile, keywords, lang);

  // ─────────────────────────────────────────
  // STEP 3: Check for Pronoun Resolution
  // ─────────────────────────────────────────
  // Handle "it", "that one", "am" (but NOT "I am")
  const pronounPattern = /\b(it|that one|that|this)\b/i;
  const pidginItPattern = /\bam\b(?!\s+(?:a|an|the|is|was|interested|looking))/i; // "am" but not "I am interested"
  
  const hasProReference = pronounPattern.test(input) || pidginItPattern.test(input);
  
  let contextIntent = lastIntent;
  if (hasProReference && history.length > 0) {
    const lastBotTurn = [...history].reverse().find(t => t.sender === 'bot');
    if (lastBotTurn?.intentName) {
      contextIntent = lastBotTurn.intentName;
    }
  }

  // ─────────────────────────────────────────
  // STEP 4: Handle Affirmative ("Yes") Responses
  // ─────────────────────────────────────────
  const isAffirmative = keywords.includes('yes') || 
    ['yes', 'yea', 'yeah', 'sure', 'okay', 'ok', 'ehen', 'show me', 'tell me', 'i want', 'go ahead'].some(
      word => input.includes(word)
    );

  if (isAffirmative && lastIntent) {
    const affirmativeResult = handleAffirmativeResponse(lastIntent, updatedProfile, lang);
    if (affirmativeResult) {
      // Trigger CTA highlight if needed
      if (affirmativeResult.shouldHighlightCTA) {
        triggerTryOnHighlight(affirmativeResult.ctaIntensity || 'strong');
      }
      return affirmativeResult;
    }
  }

  // ─────────────────────────────────────────
  // STEP 5: Handle Negative ("No") Responses — NEW
  // ─────────────────────────────────────────
  const isNegative = keywords.includes('no') ||
    ['no', 'nah', 'nope', 'not now', 'later', 'maybe', 'not really'].some(
      word => input.includes(word)
    );

  if (isNegative && lastIntent && !isAffirmative) {
    const negativeResult = handleNegativeResponse(lastIntent, updatedProfile, lang);
    if (negativeResult) {
      return negativeResult;
    }
  }

  // ─────────────────────────────────────────
  // STEP 6: Handle Pending Actions (Legacy Support)
  // ─────────────────────────────────────────
  if (pendingAction && isAffirmative) {
    if (pendingAction === 'show_pricing') {
      const pricingIntent = INTENTS.find(i => i.name === 'PricingDetails')!;
      const response = lang === 'pidgin' && pricingIntent.responsePidgin 
        ? pricingIntent.responsePidgin 
        : pricingIntent.response;
      
      return {
        text: personalizeResponse(response, updatedProfile),
        isFallback: false,
        intentName: 'PricingDetails',
        shouldHighlightCTA: true,
        ctaIntensity: 'subtle',
        updatedProfile
      };
    }
  }

  // ─────────────────────────────────────────
  // STEP 7: Score and Match Intents
  // ─────────────────────────────────────────
  const scoredIntents: ScoredIntent[] = INTENTS.map(intent => {
    let boost = 0;
    
    // Boost if this matches contextual reference
    if (intent.name === contextIntent && hasProReference) {
      boost = 10;
    }
    
    return { ...intent, currentBoost: boost };
  });

  let winner: ScoredIntent | null = null;
  let maxScore = 0;

  for (const intent of scoredIntents) {
    let currentScore = intent.currentBoost;
    
    for (const keyword of intent.keywords) {
      // Check both processed input and extracted keywords
      if (input.includes(keyword) || keywords.includes(keyword)) {
        currentScore += intent.priority === 'specific' ? 5 : 2;
      }
    }
    
    // Skip conversational intents in direct matching (handled above)
    if (intent.priority === 'conversational') {
      continue;
    }
    
    if (currentScore > maxScore) {
      maxScore = currentScore;
      winner = intent;
    }
  }

  // ─────────────────────────────────────────
  // STEP 8: Generate Response
  // ─────────────────────────────────────────
  if (maxScore >= 2 && winner) {
    // Choose language-appropriate response
    let responseText = (lang === 'pidgin' || lang === 'mixed') && winner.responsePidgin
      ? winner.responsePidgin
      : winner.response;
    
    // Fallback to RESPONSE_VARIANTS if response is empty
    if (!responseText && winner.name === 'Greeting') {
      responseText = lang === 'pidgin' 
        ? RESPONSE_VARIANTS.greeting?.pidgin || "How far! Wetin I fit help you with?"
        : RESPONSE_VARIANTS.greeting?.formal || "Hello! How can I help you today?";
    }

    // Apply personalization
    const finalResponse = personalizeResponse(responseText, updatedProfile);

    // Check if we should highlight CTA
    const shouldHighlight = winner.triggersCTA || updatedProfile.engagementScore >= 70;
    let ctaIntensity: 'subtle' | 'strong' | 'urgent' = 'subtle';
    
    if (updatedProfile.engagementScore >= 90) {
      ctaIntensity = 'urgent';
    } else if (updatedProfile.engagementScore >= 70 || winner.triggersCTA) {
      ctaIntensity = 'strong';
    }

    // Trigger CTA highlight
    if (shouldHighlight) {
      triggerTryOnHighlight(ctaIntensity);
    }

    return {
      text: finalResponse,
      isFallback: false,
      intentName: winner.name,
      suggestedAction: winner.suggests,
      shouldHighlightCTA: shouldHighlight,
      ctaIntensity,
      updatedProfile
    };
  }

  // ─────────────────────────────────────────
  // STEP 9: Fallback Response
  // ─────────────────────────────────────────
  const name = updatedProfile.name ? `${updatedProfile.name}, ` : '';
  
  const fallbackResponse = lang === 'pidgin' || lang === 'mixed'
    ? `${name}Abeg, tell me small about your business so I fit help you well. You dey sell provisions, building materials, or something else?`
    : `${name}I want to make sure I help you correctly. Are you interested in pricing, features, or how NaijaShop prevents theft?`;

  return {
    text: fallbackResponse,
    isFallback: true,
    intentName: 'Clarification',
    updatedProfile
  };
};

// ============================================
// EXPORT: Create Fresh Profile
// ============================================

export const createInitialProfile = (): UserProfile => ({
  painPoints: [],
  engagementScore: 0,
  language: 'mixed'
});
