export interface ProcessedInput {
  original: string;
  processed: string;
  keywords: string[];
  language: 'pidgin' | 'formal' | 'mixed';
}

/**
 * Section 1: Expanded Pidgin-to-English Mapping (50+ entries)
 */
export const PIDGIN_MAP: Record<string, string[]> = {
  "how much": ["how much", "hm", "hm be that", "wetin be price", "give me bill", "bill am", "price am", "e cost how much", "how much be", "money reach how much"],
  "yes": ["yes", "yea", "yh", "yeah", "sure", "ok", "okay", "ehen", "na so", "correct", "true", "sha", "abeg", "make we", "oya", "confirm", "sharp sharp"],
  "no": ["no", "nah", "nope", "i no wan", "forget", "leave am", "no need", "e no concern me", "abeg no", "no go do", "mbah"],
  "cement": ["cement", "dangote", "bua cement", "lafarge", "simenti", "block cement", "bag of cement"],
  "provisions": ["provisions", "provision", "provi", "supermarket", "grocery", "shop things", "daily needs", "items"],
  "sugar": ["sugar", "dangote sugar", "st louis", "sweet", "sugar cube"],
  "buy": ["buy", "cop", "collect", "take", "get", "purchase", "order", "want am"],
  "sell": ["sell", "sale", "push", "market", "move", "supply", "trade"],
  "business": ["business", "trade", "hustle", "work", "shop", "store", "enterprise", "hustle"],
  "customer": ["customer", "buyer", "oga", "madam", "patron", "client", "person wey wan buy"],
  "money": ["money", "cash", "funds", "ego", "owo", "kudi", "moni", "naira", "kobo"],
  "help me": ["help me", "help", "abeg help", "assist me", "i need", "show me road", "carry me reach"],
  "show me": ["show me", "show", "let me see", "make i see", "display", "bring am out"],
  "tell me": ["tell me", "tell", "gist me", "inform me", "let me know", "make i know", "explain"],
  "now": ["now", "sharp sharp", "immediately", "asap", "quick", "fast fast", "fast"],
  "later": ["later", "after", "soon", "next time", "tomorrow", "another day", "wait"],
  "small": ["small", "pikin", "little", "smol", "not much", "few", "half"],
  "big": ["big", "large", "plenty", "much", "many", "bulk", "wholesale", "heavy"],
  "theft": ["steal", "thief", "cheat", "cut", "missing", "security", "monitor", "magomago", "fraud", "staff"],
  "printer": ["printer", "receipt", "paper", "print", "thermal", "bluetooth printer"],
  "license": ["license", "pay", "subscribe", "activation", "key", "access", "code"],
  "trial": ["trial", "free", "try", "testing", "check am", "30 days"],
  "data": ["data", "internet", "online", "offline", "network", "connection", "wifi", "megabyte"],
  "reports": ["report", "profit", "calculation", "math", "account", "balance", "total"],
  "setup": ["setup", "start", "begin", "create", "register", "install"]
};

/**
 * Section 2: Nigerian Typos and Shorthand (30+ entries)
 */
export const TYPO_CORRECTIONS: Record<string, string> = {
  "pls": "please", "plz": "please", "hw": "how", "wt": "what", "abt": "about",
  "ur": "your", "u": "you", "d": "the", "ds": "this", "dat": "that",
  "nt": "not", "dnt": "don't", "cnt": "can't", "shd": "should", "wd": "would",
  "wld": "would", "prais": "price", "prise": "price", "busness": "business", "bussiness": "business",
  "customar": "customer", "receit": "receipt", "inventori": "inventory", "sement": "cement", "provition": "provisions",
  "suger": "sugar", "mony": "money", "expence": "expense", "expences": "expenses", "manager": "manager",
  "manageer": "manager", "staffe": "staff", "subcription": "subscription", "liscence": "license", "licence": "license",
  "shope": "shop", "securiti": "security", "thiefs": "thieves", "profitability": "profit", "accout": "account"
};

/**
 * Section 3: Number & Currency Normalization
 * Correctly handles '2k', '10k', '25k' inputs
 */
export function normalizeNigerianNumbers(input: string): string {
  let normalized = input.toLowerCase();
  
  // Handle K (thousands) notation e.g. 2k, 10k, 25k
  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*k\b/gi, (match, num) => {
    return String(parseFloat(num) * 1000);
  });
  
  // Handle M (millions) notation e.g. 1.5m
  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*m\b/gi, (match, num) => {
    return String(parseFloat(num) * 1000000);
  });
  
  // Currency standardization
  normalized = normalized.replace(/naira|#|N(?=\d)/gi, '₦');
  
  return normalized;
}

const PIDGIN_INDICATORS = [
  "wetin", "how far", "abeg", "oya", "na so", "ehen", "sha", "hustle", "jara", "wahala", 
  "fit", "dey", "un", "am", "wan", "cho", "pikin", "ego", "owo", "kudi", "moni", "hm", "sharp sharp"
];

function detectLanguage(input: string): 'pidgin' | 'formal' | 'mixed' {
  const words = input.toLowerCase().split(/\s+/);
  const pidginMatches = words.filter(word => PIDGIN_INDICATORS.includes(word)).length;
  
  if (pidginMatches >= 2) return 'pidgin';
  if (pidginMatches === 1) return 'mixed';
  return 'formal';
}

export function preprocessNigerianInput(rawInput: string): ProcessedInput {
  let processed = rawInput.toLowerCase().trim();
  
  // Step 1: Typos
  Object.entries(TYPO_CORRECTIONS).forEach(([typo, correct]) => {
    processed = processed.replace(new RegExp(`\\b${typo}\\b`, 'gi'), correct);
  });
  
  // Step 2: Numbers
  processed = normalizeNigerianNumbers(processed);
  
  // Step 3: Keywords
  let detectedKeywords: string[] = [];
  Object.entries(PIDGIN_MAP).forEach(([canonical, variants]) => {
    if (variants.some(variant => processed.includes(variant))) {
      detectedKeywords.push(canonical);
    }
  });
  
  return {
    original: rawInput,
    processed: processed,
    keywords: detectedKeywords,
    language: detectLanguage(rawInput)
  };
}

export const RESPONSE_VARIANTS = {
  greeting: {
    pidgin: "How far! Wetin I fit help you with today? I ready to gist you about how NaijaShop go help your business.",
    formal: "Hello! How can I assist you today? I would be happy to explain how NaijaShop can optimize your business operations.",
    mixed: "Hello! How far? I can assist you with any questions about your shop operations today."
  },
  pricing: {
    pidgin: "NaijaShop get free plan wey you fit start with. No kobo! After that, we get Yearly and Lifetime plans wey go save you money.",
    formal: "NaijaShop offers a 30-day free trial at no cost. Following that, we have Annual and Lifetime access plans designed to maximize your savings.",
    mixed: "NaijaShop has a free trial - you can start without paying anything today! We also have affordable yearly plans."
  },
  theft: {
    pidgin: "Abeg, no let thief catch you! NaijaShop help you monitor your staff and stock sharp sharp with secret audit logs.",
    formal: "Security is our top priority. NaijaShop provides detailed audit logs to monitor staff activities and secure your inventory from discrepancies.",
    mixed: "Don't let missing stock affect your business. Our security logs help you monitor your hustle effectively."
  },
  data: {
    pidgin: "Oga, you no need data to sell! It work 100% offline. You only need small data for WhatsApp backup.",
    formal: "NaijaShop operates entirely offline for all sales and inventory tasks. Internet connectivity is only required for periodic WhatsApp backups.",
    mixed: "You don't need an active data plan to record sales. The app works offline, only requiring sync when you want to backup."
  }
};