export interface BotResult {
  text: string;
  isFallback: boolean;
  intentName?: string;
}

interface Intent {
  name: string;
  keywords: string[];
  response: string;
  priority: 'specific' | 'general';
}

const BUSINESS_TYPES = [
  'cement', 'block', 'construction', 'building', 'water', 'factory', 'pharmacy', 
  'chemist', 'boutique', 'shop', 'store', 'supermarket', 'mart', 'provision', 
  'laundry', 'salon', 'barbing', 'poultry', 'farm', 'spare parts', 'gadget', 'phone'
];

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
    name: 'WhoIsThisFor',
    keywords: ['business', 'shop', 'store', 'who', 'use', 'type', 'kind', 'retail', 'trader', 'boutique', 'pharmacy', 'provision', 'cement', 'construction', 'blocks', 'building'],
    response: 'NaijaShop is for EVERY retail business in Nigeria! Whether you run a Pharmacy, Boutique, Supermarket, Provision Store, or Spare Parts shop, we have features for you. Which kind of business do you run?',
    priority: 'specific'
  },
  {
    name: 'Price',
    keywords: ['price', 'cost', 'pay', 'money', 'subscription', 'license', 'buy', 'naira', '₦', 'amount', 'fees', 'charges', 'monthly', 'installment', 'prais'],
    response: 'We have 3 plans: 1. 30-Day Free Trial (₦0), 2. Annual License (₦10,000/year), 3. Lifetime Access (₦25,000 once). No hidden charges! We don\'t offer monthly payments to keep things simple and cheap for you.',
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
    name: 'PhysicalScanner',
    keywords: ['physical scanner', 'usb', 'bluetooth scanner', 'barcode'],
    response: 'Yes, Oga! You can connect any USB or Bluetooth barcode scanner to your phone or tablet, and NaijaShop will recognize it instantly for super-fast sales.',
    priority: 'specific'
  },
  {
    name: 'PrintingA4',
    keywords: ['a4', 'big printer', 'office printer'],
    response: 'Yes! While we recommend small thermal printers for speed, you can also use the "Download PDF" feature to print full-size receipts on any office printer.',
    priority: 'specific'
  },
  {
    name: 'LaptopVsPhone',
    keywords: ['laptop', 'computer', 'desktop', 'pc'],
    response: 'A laptop is heavy, needs constant light, and is easy to steal. Your phone is always with you, works in the dark, and fits in your pocket!',
    priority: 'specific'
  },
  {
    name: 'BankLoan',
    keywords: ['loan', 'bank', 'statement', 'grant', 'growth', 'excel'],
    response: 'Yes! You can export your Sales and Profit reports to Excel. This serves as a professional "Business Statement" that you can show to banks or investors to prove your shop is making money.',
    priority: 'specific'
  }
];

export const getResponse = (userInput: string, lastIntent: string | null): BotResult => {
  const input = userInput.toLowerCase();
  
  // 1. Contextual Fix: If user previously asked "Who is this for" or "Type of business"
  if (lastIntent === 'WhoIsThisFor') {
    const mentionedBusiness = BUSINESS_TYPES.find(b => input.includes(b));
    if (mentionedBusiness) {
      if (['cement', 'block', 'construction', 'building'].includes(mentionedBusiness)) {
        return {
          text: 'For a Cement or Block industry, NaijaShop is a lifesaver. You can track every bag of cement and see your total warehouse value without using any data. It stops the boys at the yard from selling behind your back!',
          isFallback: false,
          intentName: 'BusinessContext_Cement'
        };
      }
      return {
        text: `Excellent! A ${mentionedBusiness} is a perfect fit for NaijaShop. You can track your ${mentionedBusiness} stock and see your profit daily. Would you like to see how our AI scanner handles your invoices?`,
        isFallback: false,
        intentName: 'BusinessContext_Generic'
      };
    }
  }

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

  // Debugging "Thinking" in console
  console.log('User Input:', userInput, 'Matched Intent:', winner?.name || 'NONE', 'Score:', maxScore, 'Last Intent:', lastIntent);

  // 2. The "I Don't Know" Guard (Threshold of 2)
  if (maxScore >= 2 && winner) {
    return {
      text: winner.response,
      isFallback: false,
      intentName: winner.name
    };
  }

  // 3. Fallback / Clarification
  return {
    text: "I want to make sure I give you the right info about that. Are you asking about how it works for your specific shop, or about our prices?",
    isFallback: true
  };
};