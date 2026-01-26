// ============================================
// NigerianNLP.ts - Nigerian Language Processing
// ============================================

export interface ProcessedInput {
  original: string;
  processed: string;
  keywords: string[];
  language: 'pidgin' | 'formal' | 'mixed';
}

// ============================================
// SECTION 1: Expanded Pidgin-to-English Mapping (60+ entries)
// ============================================

export const PIDGIN_MAP: Record<string, string[]> = {
  // ─────────────────────────────────────────
  // PRICING & MONEY
  // ─────────────────────────────────────────
  "how much": [
    "how much", "hm", "hm be that", "wetin be price", "give me bill", 
    "bill am", "price am", "e cost how much", "how much be", 
    "money reach how much", "wetin be the cost", "how much you dey sell"
  ],
  "money": [
    "money", "cash", "funds", "ego", "owo", "kudi", "moni", 
    "naira", "kobo", "₦", "change", "balance"
  ],
  "price": [
    "price", "cost", "rate", "how much", "amount", "total", "billing"
  ],

  // ─────────────────────────────────────────
  // AFFIRMATIVES & NEGATIVES
  // ─────────────────────────────────────────
  "yes": [
    "yes", "yea", "yh", "yeah", "sure", "ok", "okay", "ehen", 
    "na so", "correct", "true", "sha", "abeg", "make we", "oya", 
    "confirm", "sharp sharp", "alright", "go ahead", "proceed",
    "i want", "show me", "tell me", "i need"
  ],
  "no": [
    "no", "nah", "nope", "i no wan", "forget", "leave am", 
    "no need", "e no concern me", "abeg no", "no go do", "mbah",
    "not now", "later", "maybe", "not really", "i no sure"
  ],

  // ─────────────────────────────────────────
  // PRODUCTS
  // ─────────────────────────────────────────
  "cement": [
    "cement", "dangote", "bua cement", "lafarge", "simenti", 
    "block cement", "bag of cement", "bags of cement"
  ],
  "provisions": [
    "provisions", "provision", "provi", "supermarket", "grocery", 
    "shop things", "daily needs", "items", "foodstuff", "food items"
  ],
  "sugar": [
    "sugar", "dangote sugar", "st louis", "sweet", "sugar cube"
  ],

  // ─────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────
  "buy": [
    "buy", "cop", "collect", "take", "get", "purchase", 
    "order", "want am", "i wan buy", "i want to buy"
  ],
  "sell": [
    "sell", "sale", "push", "market", "move", "supply", 
    "trade", "dey sell", "selling"
  ],
  "help me": [
    "help me", "help", "abeg help", "assist me", "i need", 
    "show me road", "carry me reach", "direct me"
  ],
  "show me": [
    "show me", "show", "let me see", "make i see", 
    "display", "bring am out", "open am"
  ],
  "tell me": [
    "tell me", "tell", "gist me", "inform me", "let me know", 
    "make i know", "explain", "break am down"
  ],

  // ─────────────────────────────────────────
  // BUSINESS
  // ─────────────────────────────────────────
  "business": [
    "business", "trade", "hustle", "work", "shop", "store", 
    "enterprise", "company", "outlet"
  ],
  "customer": [
    "customer", "buyer", "oga", "madam", "patron", "client", 
    "person wey wan buy", "customers"
  ],
  "staff": [
    "staff", "worker", "employee", "sales girl", "sales boy", 
    "attendant", "manager", "person wey dey work"
  ],

  // ─────────────────────────────────────────
  // TIME
  // ─────────────────────────────────────────
  "now": [
    "now", "sharp sharp", "immediately", "asap", "quick", 
    "fast fast", "fast", "right now", "this moment", "now now"
  ],
  "later": [
    "later", "after", "soon", "next time", "tomorrow", 
    "another day", "wait", "not now", "some other time"
  ],

  // ─────────────────────────────────────────
  // SIZE / QUANTITY
  // ─────────────────────────────────────────
  "small": [
    "small", "pikin", "little", "smol", "not much", "few", 
    "half", "tiny", "minor"
  ],
  "big": [
    "big", "large", "plenty", "much", "many", "bulk", 
    "wholesale", "heavy", "major", "serious"
  ],

  // ─────────────────────────────────────────
  // FEATURES & CONCERNS
  // ─────────────────────────────────────────
  "theft": [
    "steal", "thief", "cheat", "cut", "missing", "security", 
    "monitor", "magomago", "fraud", "staff", "stealing", 
    "shortchange", "419", "scam", "audit"
  ],
  "data": [
    "data", "internet", "online", "offline", "network", 
    "connection", "wifi", "megabyte", "mb", "gb", "no network"
  ],
  "reports": [
    "report", "profit", "calculation", "math", "account", 
    "balance", "total", "analytics", "summary", "daily report"
  ],
  "inventory": [
    "inventory", "stock", "goods", "products", "items", 
    "warehouse", "store room", "what i have"
  ],

  // ─────────────────────────────────────────
  // NAIJASHOP SPECIFIC
  // ─────────────────────────────────────────
  "printer": [
    "printer", "receipt", "paper", "print", "thermal", 
    "bluetooth printer", "pos printer"
  ],
  "license": [
    "license", "pay", "subscribe", "activation", "key", 
    "access", "code", "subscription", "renew"
  ],
  "trial": [
    "trial", "free", "try", "testing", "check am", "30 days", 
    "free trial", "demo", "test it"
  ],
  "setup": [
    "setup", "start", "begin", "create", "register", 
    "install", "how to start", "get started"
  ],
  "features": [
    "features", "function", "what can", "can it", "does it", 
    "capability", "able to", "support", "do it"
  ],
  "whatsapp": [
    "whatsapp", "backup", "sync", "cloud", "save", 
    "restore", "wa", "watsapp", "whatsap"
  ],

  // ─────────────────────────────────────────
  // EXPRESSIONS (NEW)
  // ─────────────────────────────────────────
  "greeting": [
    "hello", "hi", "hey", "good morning", "good afternoon", 
    "good evening", "how far", "how you dey", "wetin dey",
    "howdy", "good day"
  ],
  "thanks": [
    "thank", "thanks", "thank you", "appreciate", "grateful",
    "god bless", "well done", "nice one"
  ],
  "problem": [
    "problem", "issue", "wahala", "trouble", "palava", 
    "challenge", "difficult", "hard", "stress"
  ]
};

// ============================================
// SECTION 2: Nigerian Typos and Shorthand (40+ entries)
// ============================================

export const TYPO_CORRECTIONS: Record<string, string> = {
  // Common text shortcuts
  "pls": "please",
  "plz": "please",
  "hw": "how",
  "wt": "what",
  "abt": "about",
  "ur": "your",
  "u": "you",
  "d": "the",
  "ds": "this",
  "dat": "that",
  "nt": "not",
  "dnt": "don't",
  "cnt": "can't",
  "shd": "should",
  "wd": "would",
  "wld": "would",
  "nw": "now",
  "tho": "though",
  "thru": "through",
  "b4": "before",
  "2day": "today",
  "2moro": "tomorrow",
  "2morow": "tomorrow",
  "tmr": "tomorrow",
  "tmrw": "tomorrow",

  // Common misspellings
  "prais": "price",
  "prise": "price",
  "busness": "business",
  "bussiness": "business",
  "buisness": "business",
  "customar": "customer",
  "customor": "customer",
  "receit": "receipt",
  "reciept": "receipt",
  "inventori": "inventory",
  "inventary": "inventory",
  "sement": "cement",
  "ciment": "cement",
  "provition": "provisions",
  "provissions": "provisions",
  "suger": "sugar",
  "mony": "money",
  "monies": "money",
  "expence": "expense",
  "expences": "expenses",
  "manageer": "manager",
  "manger": "manager",
  "staffe": "staff",
  "staffs": "staff",
  "subcription": "subscription",
  "subscripton": "subscription",
  "liscence": "license",
  "licence": "license",
  "lisence": "license",
  "shope": "shop",
  "securiti": "security",
  "securtiy": "security",
  "thiefs": "thieves",
  "thefts": "theft",
  "profitability": "profit",
  "accout": "account",
  "acount": "account",
  "acct": "account",
  "featurs": "features",
  "fetures": "features"
};

// ============================================
// SECTION 3: Number & Currency Normalization
// ============================================

export function normalizeNigerianNumbers(input: string): string {
  let normalized = input;
  
  // Handle K (thousands) notation e.g. 2k, 10k, 25k
  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*k\b/gi, (_, num) => {
    return String(parseFloat(num) * 1000);
  });
  
  // Handle M (millions) notation e.g. 1.5m
  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*m\b/gi, (_, num) => {
    return String(parseFloat(num) * 1000000);
  });
  
  // Currency standardization (multiple formats)
  normalized = normalized.replace(/naira|#|N(?=\d)/gi, '₦');
  
  // Handle comma-separated numbers (Nigerian style)
  // "1,000,000" stays as is for readability
  
  return normalized;
}

// ============================================
// SECTION 4: Repeated Letter Normalization (NEW)
// ============================================

/**
 * Handles excited/emphasized typing like "pleaseeee", "nooooo", "yesssss"
 */
function normalizeRepeatedLetters(input: string): string {
  // Reduce 3+ repeated letters to 2 (preserves "cool" but fixes "coooool")
  return input.replace(/(.)\1{2,}/g, '$1$1');
}

// ============================================
// SECTION 5: Punctuation Normalization (NEW)
// ============================================

/**
 * Strips excessive punctuation: "wetin???" → "wetin"
 */
function normalizePunctuation(input: string): string {
  // Remove multiple punctuation marks
  let normalized = input.replace(/[!?.,]{2,}/g, match => match[0]);
  
  // Keep punctuation for sentence structure but normalize
  return normalized;
}

// ============================================
// SECTION 6: Language Detection (IMPROVED)
// ============================================

// Single-word pidgin indicators
const PIDGIN_SINGLE_WORDS = [
  "wetin", "abeg", "oya", "ehen", "sha", "wahala", "jara", "pikin",
  "ego", "owo", "kudi", "moni", "sabi", "comot", "enter", "gist",
  "dey", "wan", "fit", "am", "na", "no", "don", "go", "come",
  "chop", "waka", "una", "dem", "dis", "dat", "sef", "shey",
  "koko", "ginger", "jand", "ajebo", "badt", "cruise", "flex"
];

// Multi-word pidgin phrases (check before splitting)
const PIDGIN_PHRASES = [
  "how far", "sharp sharp", "na so", "no wahala", "e be like", 
  "i wan", "you dey", "how you dey", "wetin dey", "na wa",
  "e don do", "make i", "make we", "i no", "e no", "dem no",
  "you no", "who no", "how e", "as e be", "e go", "na im",
  "e fit", "i fit", "you fit", "we fit", "dem fit"
];

/**
 * Detects if the input is Pidgin, Formal English, or Mixed
 */
export function detectLanguage(input: string): 'pidgin' | 'formal' | 'mixed' {
  const lowerInput = input.toLowerCase();
  
  // STEP 1: Check for multi-word phrases first (FIXED)
  let phraseMatches = 0;
  for (const phrase of PIDGIN_PHRASES) {
    if (lowerInput.includes(phrase)) {
      phraseMatches++;
    }
  }
  
  // STEP 2: Check for single-word matches
  // Clean input for word matching (remove punctuation)
  const cleanInput = lowerInput.replace(/[^\w\s]/g, '');
  const words = cleanInput.split(/\s+/);
  
  let wordMatches = 0;
  for (const word of words) {
    if (PIDGIN_SINGLE_WORDS.includes(word)) {
      wordMatches++;
    }
  }
  
  // STEP 3: Calculate total score
  const totalMatches = phraseMatches * 2 + wordMatches; // Phrases count double
  const wordCount = words.length;
  const pidginRatio = wordCount > 0 ? totalMatches / wordCount : 0;
  
  // STEP 4: Determine language
  if (totalMatches >= 3 || pidginRatio > 0.3) {
    return 'pidgin';
  } else if (totalMatches >= 1 || pidginRatio > 0.1) {
    return 'mixed';
  }
  
  return 'formal';
}

// ============================================
// SECTION 7: Keyword Extraction (IMPROVED)
// ============================================

/**
 * Extracts canonical keywords from processed input
 * Uses word boundary checking to avoid false positives
 */
function extractKeywords(processed: string): string[] {
  const detectedKeywords: string[] = [];
  
  Object.entries(PIDGIN_MAP).forEach(([canonical, variants]) => {
    for (const variant of variants) {
      // Use word boundary regex to avoid partial matches
      // "examination" should NOT match "am"
      const regex = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'i');
      
      if (regex.test(processed)) {
        if (!detectedKeywords.includes(canonical)) {
          detectedKeywords.push(canonical);
        }
        break; // Found a match, no need to check other variants
      }
    }
  });
  
  return detectedKeywords;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// SECTION 8: Main Preprocessing Pipeline
// ============================================

export function preprocessNigerianInput(rawInput: string): ProcessedInput {
  // Preserve original
  const original = rawInput;
  
  // Start processing
  let processed = rawInput.toLowerCase().trim();
  
  // STEP 1: Normalize repeated letters ("pleaseeee" → "pleasee")
  processed = normalizeRepeatedLetters(processed);
  
  // STEP 2: Normalize punctuation ("wetin???" → "wetin?")
  processed = normalizePunctuation(processed);
  
  // STEP 3: Fix typos and shorthand
  Object.entries(TYPO_CORRECTIONS).forEach(([typo, correct]) => {
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    processed = processed.replace(regex, correct);
  });
  
  // STEP 4: Normalize numbers and currency
  processed = normalizeNigerianNumbers(processed);
  
  // STEP 5: Detect language (use original for accurate detection)
  const language = detectLanguage(original);
  
  // STEP 6: Extract keywords (use processed for matching)
  const keywords = extractKeywords(processed);
  
  return {
    original,
    processed,
    keywords,
    language
  };
}

// ============================================
// SECTION 9: Response Variants (EXPANDED)
// ============================================

interface ResponseVariant {
  pidgin: string;
  formal: string;
  mixed: string;
}

export const RESPONSE_VARIANTS: Record<string, ResponseVariant> = {
  // ─────────────────────────────────────────
  // GREETING
  // ─────────────────────────────────────────
  greeting: {
    pidgin: "How far! Wetin I fit help you with today? I ready to gist you about how NaijaShop go help your business. 🛒",
    formal: "Hello! How can I assist you today? I'd be happy to explain how NaijaShop can optimize your business operations.",
    mixed: "Hello! How far? I can help you with any questions about your shop operations today. 😊"
  },

  // ─────────────────────────────────────────
  // PRICING
  // ─────────────────────────────────────────
  pricing: {
    pidgin: "NaijaShop get free plan wey you fit start with — no kobo at all! After that, we get Yearly (₦10k) and Lifetime (₦25k) plans wey go save you money. Which one you wan hear about?",
    formal: "NaijaShop offers a 30-day free trial at absolutely no cost. Following that, we have Annual (₦10,000/year) and Lifetime (₦25,000 one-time) access plans designed to maximize your value.",
    mixed: "NaijaShop has a free trial - you can start without paying anything today! We also have affordable yearly plans. Want me to break down the options?"
  },

  // ─────────────────────────────────────────
  // THEFT / SECURITY
  // ─────────────────────────────────────────
  theft: {
    pidgin: "Abeg, no let thief catch you! NaijaShop go help you monitor your staff and stock sharp sharp. We get secret audit log wey record everything — even if dem delete sale, you go know! 🔒",
    formal: "Security is our top priority. NaijaShop provides detailed audit logs to monitor all staff activities. Every action is recorded — deletions, modifications, and access attempts — giving you complete visibility.",
    mixed: "Don't let missing stock affect your hustle. Our security logs track everything your staff does, and they can't even see your profits!"
  },

  // ─────────────────────────────────────────
  // DATA / OFFLINE
  // ─────────────────────────────────────────
  data: {
    pidgin: "Oga/Madam, you no need data to sell at all! NaijaShop dey work 100% offline. Na only small connection you need for night WhatsApp backup — like 1 minute. Perfect for area wey network no dey! 📴",
    formal: "NaijaShop operates entirely offline for all sales and inventory operations. Internet connectivity is only required briefly for periodic WhatsApp backups — approximately 1 minute of connection.",
    mixed: "You don't need an active data plan to record sales. The app works offline, only requiring a quick sync when you want to backup to WhatsApp."
  },

  // ─────────────────────────────────────────
  // FEATURES (NEW)
  // ─────────────────────────────────────────
  features: {
    pidgin: "NaijaShop fit help you with plenty things:\n\n📦 **Inventory** — Track your stock automatically\n💰 **Sales** — Record sale for seconds\n📊 **Reports** — See daily/weekly profit\n🔒 **Security** — Stop staff magomago\n📱 **WhatsApp Backup** — You no go lose data\n\nWhich one you wan hear more about?",
    formal: "NaijaShop offers comprehensive business management:\n\n📦 **Inventory Management** — Automatic stock tracking\n💰 **Sales Recording** — Quick transaction logging\n📊 **Reports & Analytics** — Daily/weekly profit insights\n🔒 **Security** — Staff activity monitoring\n📱 **WhatsApp Backup** — Secure data protection\n\nWhich feature interests you most?",
    mixed: "NaijaShop helps you manage everything:\n\n📦 Inventory tracking\n💰 Quick sales recording\n📊 Profit reports\n🔒 Staff monitoring\n📱 WhatsApp backup\n\nWhat would you like to know more about?"
  },

  // ─────────────────────────────────────────
  // HOW IT WORKS (NEW)
  // ─────────────────────────────────────────
  howItWorks: {
    pidgin: "E easy gan! Na just 3 steps:\n\n1️⃣ **Sign up** — 2 minutes\n2️⃣ **Add your products** — We go help you\n3️⃣ **Start to sell!**\n\nNo training needed. If you sabi use WhatsApp, you sabi use NaijaShop! 🚀",
    formal: "The setup process is straightforward:\n\n1️⃣ **Register** — Takes approximately 2 minutes\n2️⃣ **Import Products** — We assist with bulk import\n3️⃣ **Begin Operations**\n\nNo specialized training required. The interface is as intuitive as WhatsApp.",
    mixed: "It's super simple — just 3 steps:\n\n1️⃣ Sign up (2 minutes)\n2️⃣ Add your products\n3️⃣ Start selling!\n\nIf you can use WhatsApp, you can use NaijaShop!"
  },

  // ─────────────────────────────────────────
  // FREE TRIAL (NEW)
  // ─────────────────────────────────────────
  freeTrial: {
    pidgin: "Yes o! You go get **30 days FREE** — no card needed, no commitment. You fit add products, sell, see reports — everything! If e sweet you, upgrade. If no, no wahala at all! 🎉\n\n👇 Click below make you start now!",
    formal: "Absolutely! You receive **30 days completely free** — no credit card required, no commitment. Full access to all features: products, sales, reports, everything. Upgrade only if satisfied.\n\n👇 Click below to begin!",
    mixed: "Yes! You get **30 days FREE** — no card, no commitment. Test all features — if you like it, upgrade. If not, no problem!\n\n👇 Click below to start!"
  },

  // ─────────────────────────────────────────
  // THANKS (NEW)
  // ─────────────────────────────────────────
  thanks: {
    pidgin: "You're welcome! 😊 If you get any other question, I dey here. When you ready to start your free trial, just holla! 🚀",
    formal: "You're most welcome! 😊 If you have any further questions, I'm here to help. Your free trial awaits whenever you're ready.",
    mixed: "You're welcome! 😊 I'm here if you have more questions. Ready to start your free trial whenever you are!"
  },

  // ─────────────────────────────────────────
  // GOODBYE (NEW)
  // ─────────────────────────────────────────
  goodbye: {
    pidgin: "Oya, bye bye! 👋 Remember say your 30-day free trial dey wait for you. Take care of yourself and your hustle!",
    formal: "Goodbye! 👋 Remember, your 30-day free trial is available whenever you're ready. Take care and best of luck with your business!",
    mixed: "Bye! 👋 Don't forget your 30-day free trial is waiting. Take care!"
  },

  // ─────────────────────────────────────────
  // FALLBACK / CLARIFICATION (NEW)
  // ─────────────────────────────────────────
  fallback: {
    pidgin: "Abeg, tell me small about your business so I fit help you well. You dey sell provisions, building materials, or something else?",
    formal: "I want to ensure I provide the right information. Could you tell me more about your business? Are you in retail, construction, or another sector?",
    mixed: "I want to help you properly. What type of business do you run? Provisions, building materials, or something else?"
  },

  // ─────────────────────────────────────────
  // INVENTORY (NEW)
  // ─────────────────────────────────────────
  inventory: {
    pidgin: "NaijaShop go help you track your stock without wahala! You go know wetin dey finish, wetin dey sell well, and wetin dey waste. No more counting by hand! 📦",
    formal: "NaijaShop provides real-time inventory tracking. You'll always know stock levels, best-selling items, and slow-moving products. Eliminate manual stock counts entirely.",
    mixed: "Track your stock automatically! Know what's selling, what's running low, and what needs reorder. No more manual counting!"
  },

  // ─────────────────────────────────────────
  // REPORTS (NEW)
  // ─────────────────────────────────────────
  reports: {
    pidgin: "You wan know how your money dey move? NaijaShop go show you daily/weekly/monthly profit, wetin sell pass, and where your money dey go. No more guessing! 📊",
    formal: "Access comprehensive reports: daily/weekly/monthly profits, best-selling products, expense tracking, and revenue trends. Make data-driven decisions for your business.",
    mixed: "See exactly how your business is doing! Daily profits, top products, expense tracking — all in easy-to-read reports. 📊"
  },

  // ─────────────────────────────────────────
  // WHATSAPP BACKUP (NEW)
  // ─────────────────────────────────────────
  whatsappBackup: {
    pidgin: "Your data dey safe well well! Every night, NaijaShop fit send backup to your WhatsApp. Even if phone spoil or thief collect am, your business data no go lost! 📱💪",
    formal: "Your data is securely protected through daily WhatsApp backups. Even in cases of device loss or damage, your complete business records remain safe and recoverable.",
    mixed: "Your data stays safe with WhatsApp backup! Even if you lose your phone, your business info is protected. 📱"
  }
};

// ============================================
// SECTION 10: Helper Function to Get Response (NEW)
// ============================================

/**
 * Gets the appropriate response variant based on detected language
 */
export function getVariant(
  key: keyof typeof RESPONSE_VARIANTS, 
  language: 'pidgin' | 'formal' | 'mixed'
): string {
  const variant = RESPONSE_VARIANTS[key];
  if (!variant) {
    console.warn(`Missing response variant for key: ${key}`);
    return RESPONSE_VARIANTS.fallback[language];
  }
  return variant[language];
}
