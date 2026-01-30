
import { db } from '../db/db';
import { preprocessNigerianInput } from './NigerianNLP';

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

class ShopAuditor {
  static async process(text: string, shopData: ShopData): Promise<string | null> {
    const nlp = preprocessNigerianInput(text);
    const cleanText = nlp.processed.toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Intent: Sales Volume (Keywords: 'how many', 'sold', 'sales count')
    if (cleanText.includes('sold') || (cleanText.includes('how many') && cleanText.includes('sale'))) {
      const sales = await db.sales.where('timestamp').above(today.getTime()).toArray();
      let totalSold = 0;
      let targetProduct = '';

      // Entity Extraction (Simple heuristic: remove keywords)
      const removeWords = ['how', 'many', 'sold', 'today', 'units', 'of', 'did', 'i', 'sell'];
      let potentialProduct = cleanText;
      removeWords.forEach(w => potentialProduct = potentialProduct.replace(w, '').trim());
      
      // Basic fuzzy matching from user input to product name
      if (potentialProduct.length > 2) {
        // Iterate sales to find matches
        sales.forEach(sale => {
          sale.items.forEach(item => {
            if (item.name.toLowerCase().includes(potentialProduct)) {
              totalSold += item.quantity;
              targetProduct = item.name; // Keep formatted name
            }
          });
        });
        
        if (targetProduct) {
          return `Oga, you have sold ${totalSold} units of ${targetProduct} today.`;
        } else {
          return `Boss, I checked today's sales but I didn't see any record for "${potentialProduct}".`;
        }
      }
    }

    // Intent: Stock Level (Keywords: 'how many left', 'stock balance', 'remaining')
    if (cleanText.includes('left') || cleanText.includes('remain') || cleanText.includes('stock balance') || cleanText.includes('stock level')) {
      const removeWords = ['how', 'many', 'left', 'remaining', 'remain', 'stock', 'balance', 'units', 'of', 'have', 'do', 'i', 'in', 'shop'];
      let potentialProduct = cleanText;
      removeWords.forEach(w => potentialProduct = potentialProduct.replace(w, '').trim());

      if (potentialProduct.length > 2) {
        const products = await db.products.toArray();
        // Fuzzy match
        const match = products.find(p => p.name.toLowerCase().includes(potentialProduct));
        
        if (match) {
          return `You currently have ${match.stock_qty} units of ${match.name} remaining in your shop.`;
        } else {
          return `I couldn't find "${potentialProduct}" in your inventory list, Boss.`;
        }
      }
    }

    // Intent: Inventory Audit (Keywords: 'added', 'restock', 'inventory log')
    if (cleanText.includes('added') || cleanText.includes('restock') || cleanText.includes('inventory log')) {
      const logs = await db.inventory_logs
        .where('timestamp')
        .above(today.getTime())
        .filter(l => l.type === 'Restock' || l.type === 'Adjustment')
        .toArray();

      if (logs.length > 0) {
        // Find the most recent or relevant log
        const removeWords = ['how', 'many', 'added', 'restocked', 'today', 'units', 'of'];
        let potentialProduct = cleanText;
        removeWords.forEach(w => potentialProduct = potentialProduct.replace(w, '').trim());

        const targetLog = logs.find(l => l.product_name.toLowerCase().includes(potentialProduct));
        
        if (targetLog) {
          return `Boss, I checked the records. You added ${targetLog.quantity_changed} of ${targetLog.product_name} today. At the time of adding, you had ${targetLog.old_stock} left, bringing the new total to ${targetLog.new_stock}.`;
        } else if (potentialProduct.length < 3) {
           return `You have made ${logs.length} restock adjustments today. Mention a product name for details.`;
        }
      } else {
        return "You haven't added any new stock today, Oga.";
      }
    }

    // Intent: Parked Orders (Keywords: 'parked', 'held', 'pending orders')
    if (cleanText.includes('parked') || cleanText.includes('held') || cleanText.includes('pending order')) {
      const count = await db.parked_orders.count();
      if (count > 0) {
        return `There are ${count} parked orders currently waiting to be completed today.`;
      } else {
        return "Your parked order list is clean. No pending transactions.";
      }
    }

    return null;
  }
}

export const getBestMatch = async (query: string, data: ShopData): Promise<{ answer: string; action: 'RENEW_LICENSE' | 'VIEW_STOCK' | 'NONE' } | null> => {
  // 1. Check ShopAuditor for Data Questions
  const auditResponse = await ShopAuditor.process(query, data);
  if (auditResponse) {
    return {
      answer: auditResponse,
      action: 'NONE'
    };
  }

  // 2. Fallback to Static FAQ
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
