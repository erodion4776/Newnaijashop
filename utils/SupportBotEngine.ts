export interface SupportEntry {
  keywords: string[];
  answer: string;
  action?: 'RENEW_LICENSE' | 'VIEW_STOCK' | 'NONE';
}

export interface ShopData {
  adminName: string;
  shopName: string;
  todaySales: string;
  lowStockCount: number;
  licenseExpiryDate: string;
  totalInterest: string;
}

const SUPPORT_DATABASE: SupportEntry[] = [
  // SMALL TALK / GREETINGS
  {
    keywords: ['hi', 'hello', 'hey', 'morning', 'afternoon', 'evening', 'how far'],
    answer: "Hello {{adminName}}! How is market today? I am ready to help you manage {{shopName}}. Just ask me about your sales or stock!"
  },
  {
    keywords: ['thank you', 'thanks', 'welldone', 'correct', 'nice'],
    answer: "You are welcome, Oga! I am happy to help. Is there any other 'jara' info you need?"
  },
  {
    keywords: ['bye', 'goodbye', 'close', 'done'],
    answer: "Goodbye {{adminName}}! Don't forget to backup your sales to WhatsApp before you close for the day. Secure your wealth!"
  },

  // DATA DRIVEN INSIGHTS
  {
    keywords: ['sales', 'money', 'today', 'how much', 'revenue'],
    answer: "Oga {{adminName}}, you have made {{todaySales}} so far today. Keep it up! Market is moving well."
  },
  {
    keywords: ['stock', 'inventory', 'finish', 'quantity', 'balance'],
    answer: "You have {{lowStockCount}} items running low in your shop. Don't let your customers meet empty shelves!",
    action: 'VIEW_STOCK'
  },
  {
    keywords: ['license', 'expire', 'subscription', 'pay', 'renew', 'active'],
    answer: "Your NaijaShop license expires on {{licenseExpiryDate}}. You can click the button below to renew and keep your shop running without interruption.",
    action: 'RENEW_LICENSE'
  },
  {
    keywords: ['profit', 'interest', 'gain', 'margin'],
    answer: "Your estimated profit for today is {{totalInterest}}. This is your real take-home after accounting for cost prices!"
  },

  // POS CATEGORY
  {
    keywords: ['how to sell', 'make sale', 'start pos', 'use pos'],
    answer: "Oga, to sell is easy! Just go to the 'Point of Sale' tab, tap on the products the customer wants, and they will enter the cart. When you are done, click the big green 'Checkout' button."
  },
  {
    keywords: ['delete item', 'remove item', 'remove from cart', 'clear item'],
    answer: "If you want to remove an item from the cart, just click the 'Minus' button until the quantity reaches zero, or use the 'Clear' button at the top of the cart to empty everything."
  },
  {
    keywords: ['park order', 'save order', 'hold sale', 'customer waiting'],
    answer: "If a customer says 'wait let me pick one more thing', just click the 'Park' button in the cart. Give the order a name, and you can continue selling to others."
  },

  // TECHNICAL CATEGORY
  {
    keywords: ['offline mode', 'no internet', 'data cost', 'internet'],
    answer: "NaijaShop is 100% offline-first. You don't need data to sell, check stock, or view profits. You only need data for WhatsApp features."
  },
  {
    keywords: ['backup', 'whatsapp', 'save data', 'phone loss'],
    answer: "Always use 'Security & Backups' to send a backup code to your WhatsApp. If you lose your phone, you can use that code to restore everything."
  }
];

export const getBestMatch = (query: string, data: ShopData): { answer: string; action: 'RENEW_LICENSE' | 'VIEW_STOCK' | 'NONE' } | null => {
  const words = query.toLowerCase().split(/\s+/);
  let bestMatch: SupportEntry | null = null;
  let highestScore = 0;

  SUPPORT_DATABASE.forEach(entry => {
    let score = 0;
    entry.keywords.forEach(keyword => {
      if (query.toLowerCase().includes(keyword.toLowerCase())) {
        score += 3;
      }
      const keywordWords = keyword.toLowerCase().split(/\s+/);
      keywordWords.forEach(kw => {
        if (words.includes(kw)) {
          score += 1;
        }
      });
    });

    if (score > highestScore) {
      highestScore = score;
      bestMatch = entry;
    }
  });

  if (highestScore >= 2 && bestMatch) {
    let finalAnswer = bestMatch.answer
      .replace(/{{adminName}}/g, data.adminName || 'Oga')
      .replace(/{{shopName}}/g, data.shopName || 'your shop')
      .replace(/{{todaySales}}/g, data.todaySales)
      .replace(/{{lowStockCount}}/g, data.lowStockCount.toString())
      .replace(/{{licenseExpiryDate}}/g, data.licenseExpiryDate)
      .replace(/{{totalInterest}}/g, data.totalInterest);

    return {
      answer: finalAnswer,
      action: bestMatch.action || 'NONE'
    };
  }

  return null;
};