
import { preprocessNigerianInput, RESPONSE_VARIANTS } from './NigerianNLP';
import SemanticEngine from './SemanticEngine';

export interface UserProfile {
  name?: string;
  businessType?: string;
  painPoints: string[];
  engagementScore: number;
}

export interface ChatTurn {
  sender: 'user' | 'bot';
  text: string;
  intentName?: string;
}

export interface BotResult {
  text: string;
  isFallback: boolean;
  intentName?: string;
  suggestedAction?: string;
  updatedProfile: UserProfile;
}

interface Intent {
  name: string;
  keywords: string[];
  response: string;
  priority: 'specific' | 'general' | 'conversational';
  suggests?: string;
}

const BUSINESS_TYPES = [
  'cement', 'block', 'construction', 'building', 'water', 'factory', 'pharmacy', 
  'chemist', 'boutique', 'shop', 'store', 'supermarket', 'mart', 'provision', 
  'laundry', 'salon', 'barbing', 'poultry', 'farm', 'spare parts', 'gadget', 'phone',
  'sand', 'quarry', 'yard'
];

const NAME_INTRO_MARKERS = ["my name is", "i am", "i'm", "call me", "name na", "na me be"];

/**
 * Extraction logic to pull user info from the text
 */
const updateProfile = (input: string, currentProfile: UserProfile, keywords: string[]): UserProfile => {
  const newProfile = { ...currentProfile };
  const lowerInput = input.toLowerCase();

  // 1. Name Extraction
  for (const marker of NAME_INTRO_MARKERS) {
    if (lowerInput.includes(marker)) {
      const parts = lowerInput.split(marker);
      if (parts.length > 1) {
        const potentialName = parts[1].trim().split(/\s+/)[0];
        if (potentialName && potentialName.length > 2 && !BUSINESS_TYPES.includes(potentialName)) {
          newProfile.name = potentialName.charAt(0).toUpperCase() + potentialName.slice(1);
        }
      }
    }
  }

  // 2. Business Type Extraction
  const foundBiz = BUSINESS_TYPES.find(biz => lowerInput.includes(biz) || keywords.includes(biz));
  if (foundBiz) {
    newProfile.businessType = foundBiz;
  }

  // 3. Pain Point Extraction
  if (keywords.includes('theft') || lowerInput.includes('steal')) newProfile.painPoints.push('theft');
  if (keywords.includes('data') || lowerInput.includes('internet')) newProfile.painPoints.push('data_cost');
  if (lowerInput.includes('math') || lowerInput.includes('calc')) newProfile.painPoints.push('accounting');
  
  newProfile.painPoints = [...new Set(newProfile.painPoints)];

  // 4. Engagement Score (Cap at 100)
  newProfile.engagementScore = Math.min(100, newProfile.engagementScore + 10);

  return newProfile;
};

const INTENTS: Intent[] = [
  {
    name: 'Greeting',
    keywords: ['hi', 'hello', 'hey', 'morning', 'afternoon', 'evening', 'how far', 'howdy'],
    response: '', // Handled by variants
    priority: 'general'
  },
  {
    name: 'PricingDetails',
    keywords: ['price', 'cost', 'pay', 'money', 'subscription', 'license', 'buy', 'naira', '₦', 'amount', 'fees', 'charges', 'how much'],
    response: 'We have 3 plans: 1. 30-Day Free Trial (₦0), 2. Annual License (₦10,000/year), and 3. Lifetime Access (₦25,000). Which one works best for your budget?',
    priority: 'specific'
  },
  {
    name: 'Theft',
    keywords: ['steal', 'theft', 'staff', 'security', 'monitor', 'delete', 'change', 'fraud', 'cheat', 'audit log'],
    response: "Our Fortress system stops staff theft. They can't see your profits, and if they delete a sale, the app records it in a secret Audit Log.",
    priority: 'specific'
  },
  {
    name: 'Data',
    keywords: ['data', 'internet', 'offline', 'network', 'connection', 'wifi', 'data cost'],
    response: 'Oga, you need ZERO data to sell! It works 100% offline. You only need internet for 1 minute for your nightly WhatsApp backup.',
    priority: 'specific'
  },
  {
    name: 'Scanner',
    keywords: ['scanner', 'camera', 'notebook', 'ledger', 'import', 'handwriting', 'ocr'],
    response: 'Our AI Scanner helps you snap your notebook so you dont need to type products. Go to Inventory and click "Scan Ledger" to try it.',
    priority: 'specific'
  }
];

export const getResponse = async (
  userInput: string, 
  history: ChatTurn[], 
  currentProfile: UserProfile,
  lastIntent: string | null, 
  pendingAction: string | null
): Promise<BotResult> => {
  const nlp = preprocessNigerianInput(userInput);
  const input = nlp.processed;
  const keywords = nlp.keywords;
  const lang = nlp.language;
  
  const updatedProfile = updateProfile(userInput, currentProfile, keywords);

  // Hybrid Step A: Semantic check (Local LLM Embeddings)
  const semanticResult = await SemanticEngine.detectIntent(userInput);
  let matchedIntentName = '';

  if (semanticResult && semanticResult.score > 0.7) {
    matchedIntentName = semanticResult.intent;
    console.log(`[SEMANTIC] Matched ${matchedIntentName} with score ${semanticResult.score}`);
  }

  // Pronoun Resolution & Multi-Turn context fallback
  const isGenericQuestion = input.includes('it') || input.includes('that one') || input.includes('am');
  let contextIntent = lastIntent;
  
  if (isGenericQuestion && history.length > 0) {
    const lastBotTurn = [...history].reverse().find(t => t.sender === 'bot');
    if (lastBotTurn?.intentName) contextIntent = lastBotTurn.intentName;
  }

  // 1. Handle Affirmative Context
  if (pendingAction && keywords.includes('yes')) {
    if (pendingAction === 'show_pricing') {
      return {
        text: lang === 'pidgin' ? RESPONSE_VARIANTS.pricing.pidgin : INTENTS.find(i => i.name === 'PricingDetails')!.response,
        isFallback: false,
        intentName: 'PricingDetails',
        updatedProfile
      };
    }
  }

  // 2. Personalization logic helpers
  const getName = () => updatedProfile.name ? `${updatedProfile.name}, ` : "";
  const getBizNote = () => updatedProfile.businessType ? `Since you manage a ${updatedProfile.businessType}, ` : "";

  // 3. Match Intents (Hybrid Selection)
  let winner: Intent | null = null;
  let maxScore = 0;

  // Use semantic match if available
  if (matchedIntentName) {
    winner = INTENTS.find(i => i.name === matchedIntentName) || null;
    maxScore = 10; // Explicit high score for semantic match
  }

  // Fallback to Rule-based Scoring if no strong semantic match
  if (!winner) {
    const intentList = INTENTS.map(i => {
      if (i.name === contextIntent && isGenericQuestion) {
        return { ...i, currentBoost: 10 };
      }
      return { ...i, currentBoost: 0 };
    });

    for (const intent of intentList) {
      let currentScore = intent.currentBoost;
      for (const keyword of intent.keywords) {
        if (input.includes(keyword) || keywords.includes(keyword)) {
          currentScore += intent.priority === 'specific' ? 5 : 2;
        }
      }
      if (currentScore > maxScore) {
        maxScore = currentScore;
        winner = intent;
      }
    }
  }

  if (winner) {
    let responseText = winner.response;
    
    // Map variants and add personalization
    if (winner.name === 'Greeting') {
      responseText = lang === 'pidgin' ? RESPONSE_VARIANTS.greeting.pidgin : RESPONSE_VARIANTS.greeting.formal;
    } else if (winner.name === 'PricingDetails') {
      responseText = lang === 'pidgin' ? RESPONSE_VARIANTS.pricing.pidgin : responseText;
    } else if (winner.name === 'Theft') {
      responseText = lang === 'pidgin' ? RESPONSE_VARIANTS.theft.pidgin : responseText;
    } else if (winner.name === 'Data') {
      responseText = lang === 'pidgin' ? RESPONSE_VARIANTS.data.pidgin : responseText;
    }

    // Wrap with personalization
    const finalResponse = `${getName()}${getBizNote()}${responseText}`;

    return {
      text: finalResponse,
      isFallback: false,
      intentName: winner.name,
      suggestedAction: winner.suggests,
      updatedProfile
    };
  }

  // Fallback
  const fallbackResponse = lang === 'pidgin' 
    ? `${getName()}Abeg, tell me more about your shop so I fit help you well.`
    : `${getName()}I want to make sure I give you the right info. Are you asking about prices, shop security, or how the scanner works?`;

  return {
    text: fallbackResponse,
    isFallback: true,
    intentName: 'CLARIFICATION',
    updatedProfile
  };
};
