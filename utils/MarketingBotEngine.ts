export interface BotResult {
  text: string;
  isFallback: boolean;
  intentName?: string;
  suggestedAction?: string;
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

const AFFIRMATIVE = ['yes', 'yeah', 'sure', 'ok', 'okay', 'yep', 'show me', 'abeg', 'tell me'];
const NEGATIVE = ['no', 'nah', 'later', 'stop', 'don\'t'];

/**
 * Helper: Simple Fuzzy Match logic
 */
const isMatch = (input: string, keyword: string): boolean => {
  const normalizedInput = input.toLowerCase().trim();
  const normalizedKeyword = keyword.toLowerCase().trim();
  
  if (normalizedInput.includes(normalizedKeyword)) return true;
  
  if (normalizedKeyword.length >= 5) {
    const prefix = normalizedKeyword.substring(0, 4);
    const inputWords = normalizedInput.split(/\s+/);
    return inputWords.some(word => word.startsWith(prefix));
  }
  
  return false;
};

const INTENTS: Intent[] = [
  {
    name: 'PricingDetails',
    keywords: ['price', 'cost', 'pay', 'money', 'subscription', 'license', 'buy', 'naira', '₦', 'amount', 'fees', 'charges'],
    response: 'Great! We have 3 plans: 1. 30-Day Free Trial (₦0), 2. Annual License (₦10,000/year), and 3. Lifetime Access (₦25,000). No hidden charges! Which one would you like to start with?',
    priority: 'specific'
  },
  {
    name: 'Theft',
    keywords: ['steal', 'theft', 'staff', 'security', 'monitor', 'delete', 'change', 'fraud', 'cheat', 'audit log'],
    response: "Our Fortress system stops staff theft. They can't see your profits, and if they delete a sale or change a price, the app records it in a secret Audit Log. Even if they uninstall, your WhatsApp backups keep your records safe!",
    priority: 'specific'
  },
  {
    name: 'Data',
    keywords: ['data', 'internet', 'offline', 'network', 'connection', 'wifi', 'data cost'],
    response: 'Oga, you need ZERO data to sell! It works 100% offline. You only need internet for 1 minute for setup and your nightly WhatsApp backup.',
    priority: 'specific'
  },
  {
    name: 'Scanner',
    keywords: ['scan', 'notebook', 'paper', 'photo', 'camera', 'ledger', 'handwriting', 'digitize'],
    response: 'Just snap a photo of your old shop notebook! Our local AI reads the handwriting and adds the products to your digital inventory instantly. No manual typing needed.',
    priority: 'specific'
  },
  {
    name: 'Cement_Blocks',
    keywords: ['cement', 'blocks', 'sand', 'quarry', 'yard', 'construction'],
    response: 'For a Cement or Block industry, NaijaShop is a lifesaver. You can track stock by the bag and see your total warehouse valuation without data. It stops the boys at the yard from selling behind your back! Want to see how we track Drivers?',
    priority: 'specific',
    suggests: 'show_driver_tracking'
  },
  {
    name: 'WhoIsThisFor',
    keywords: ['business', 'shop', 'store', 'who', 'use', 'type', 'kind', 'retail', 'trader'],
    response: 'NaijaShop is for EVERY retail business in Nigeria! Whether you run a Pharmacy, Boutique, Supermarket, or Cement yard, we have features for you. Which kind of business do you run?',
    priority: 'specific'
  }
];

export const getResponse = (userInput: string, lastIntent: string | null, pendingAction: string | null): BotResult => {
  const input = userInput.toLowerCase().trim();
  
  // 1. Handle Affirmative Context (The "Yes" Fix)
  if (pendingAction && AFFIRMATIVE.some(kw => input.includes(kw))) {
    if (pendingAction === 'show_pricing') {
      const pricing = INTENTS.find(i => i.name === 'PricingDetails')!;
      return {
        text: pricing.response,
        isFallback: false,
        intentName: pricing.name
      };
    }
    if (pendingAction === 'show_driver_tracking') {
      return {
        text: 'For driver tracking, the terminal records which driver took which load and how many bags. This stops "side sales" at the yard. Ready to see the price list now?',
        isFallback: false,
        intentName: 'Driver_Tracking_Details',
        suggestedAction: 'show_pricing'
      };
    }
  }

  // 2. Handle Negative/Dismissive context
  if (NEGATIVE.some(kw => input.includes(kw))) {
    return {
      text: 'No problem, Oga. What else would you like to know about our Offline POS?',
      isFallback: false,
      intentName: 'NEGATIVE_ACK'
    };
  }

  // 3. Contextual Business Detection
  if (lastIntent === 'WhoIsThisFor' || lastIntent === 'CLARIFICATION') {
    const mentionedBusiness = BUSINESS_TYPES.find(b => input.includes(b));
    if (mentionedBusiness) {
      if (['cement', 'block', 'construction', 'building', 'sand', 'quarry', 'yard'].includes(mentionedBusiness)) {
        return {
          text: 'For a Cement or Block industry, NaijaShop is a lifesaver. You can track stock by the bag and see your total warehouse valuation without using any data. Want to see how we track Drivers and Loaders?',
          isFallback: false,
          intentName: 'BusinessContext_Cement',
          suggestedAction: 'show_driver_tracking'
        };
      }
      return {
        text: `Excellent! A ${mentionedBusiness} is a perfect fit for NaijaShop. You can track your stock and see your profit daily. Want to see our simple pricing?`,
        isFallback: false,
        intentName: 'BusinessContext_Generic',
        suggestedAction: 'show_pricing'
      };
    }
  }

  // 4. General Intent Matching
  let winner: Intent | null = null;
  let maxScore = 0;

  for (const intent of INTENTS) {
    let currentScore = 0;
    for (const keyword of intent.keywords) {
      if (isMatch(input, keyword)) {
        currentScore += intent.priority === 'specific' ? 5 : 1;
      }
    }
    
    if (currentScore > maxScore) {
      maxScore = currentScore;
      winner = intent;
    }
  }

  if (maxScore >= 2 && winner) {
    return {
      text: winner.response,
      isFallback: false,
      intentName: winner.name,
      suggestedAction: winner.suggests
    };
  }

  // 5. Intelligent Fallback Loop Guard
  if (lastIntent === 'CLARIFICATION') {
    return {
      text: "I still didn't quite catch that. Would you like to chat with our founder on WhatsApp (08184774884) for faster help?",
      isFallback: true,
      intentName: 'SECOND_FALLBACK'
    };
  }

  return {
    text: "I want to make sure I give you the right info, Oga. Are you asking about how it works for your specific shop, or about our prices?",
    isFallback: true,
    intentName: 'CLARIFICATION'
  };
};