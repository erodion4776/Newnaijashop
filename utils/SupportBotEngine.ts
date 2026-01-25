
export interface SupportEntry {
  keywords: string[];
  answer: string;
}

const SUPPORT_DATABASE: SupportEntry[] = [
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
    keywords: ['change price', 'edit price', 'manual price', 'discount'],
    answer: "To change a price during a sale, tap on the price of the item inside the cart. A small box will appear where you can type the new price. Note: Prices are rounded to the nearest ₦50."
  },
  {
    keywords: ['park order', 'save order', 'hold sale', 'customer waiting'],
    answer: "If a customer says 'wait let me pick one more thing', just click the 'Park' button in the cart. Give the order a name (like 'Mamma Chinedu'), and you can continue selling to others. You'll find it later in the 'Parked' list."
  },
  {
    keywords: ['resume order', 'get parked sale', 'find parked'],
    answer: "Click the 'Parked' button next to the search bar in the POS. You will see all the orders you saved. Click 'Resume' to bring those items back to the cart."
  },

  // INVENTORY CATEGORY
  {
    keywords: ['add stock', 'new product', 'create item', 'add item'],
    answer: "Go to the 'Inventory' tab and click the 'New Item' button. Enter the name, price, and how many you have in stock. Don't forget to set a 'Low Stock Threshold' so the app can alert you when it's finishing."
  },
  {
    keywords: ['low stock', 'stock finishing', 'alert', 'red alert'],
    answer: "The app shows a Red Alert when your stock reaches the threshold you set. You can see all finishing items by clicking the 'Low Stock' filter in the Inventory tab."
  },
  {
    keywords: ['bulk update', 'update prices', 'inflation', 'price increase'],
    answer: "If prices in the market go up, use the 'Update Prices' button in Inventory. You can increase prices for all items or just one category by a percentage (like 10%) or a fixed amount (like ₦100)."
  },
  {
    keywords: ['expiry date', 'expired items', 'spoilt'],
    answer: "When adding or editing a product in Inventory, you can record the expiry date. The app will help you monitor items that are close to expiring."
  },
  {
    keywords: ['scan ledger', 'camera inventory', 'ai scan', 'notebook'],
    answer: "Use the 'Scan Ledger' button in Inventory to take a photo of your handwritten shop notebook. Our AI Guru will try to read the names and prices automatically to save you typing time!"
  },

  // PAYMENTS CATEGORY
  {
    keywords: ['transfer verification', 'bank transfer', 'confirm alert', 'fake alert'],
    answer: "When a customer pays by transfer, select 'Transfer' at checkout. The app will move to the 'Transfer Station'. NEVER click 'Confirm' until you see the alert on your bank app or receive a valid SMS from your bank."
  },
  {
    keywords: ['cash payment', 'change', 'calculate change'],
    answer: "For cash sales, enter the amount the customer gave you in the 'Cash Received' box. The app will instantly calculate the 'Change Due' for you."
  },
  {
    keywords: ['split pay', 'half cash', 'part payment'],
    answer: "If a customer wants to pay some in cash and some by transfer, select 'Split' at checkout. Enter the cash amount, and the rest will be logged as the other payment type."
  },
  {
    keywords: ['debt tracker', 'owe money', 'debtor', 'credit'],
    answer: "Use the 'Debt Tracker' to record customers who owe you. You can even send them a friendly reminder directly to their WhatsApp from the app!"
  },

  // SECURITY CATEGORY
  {
    keywords: ['change pin', 'admin pin', 'security code', 'password'],
    answer: "You can change your Admin PIN in the 'Manage Staff' section or initial setup. Choose a 4-digit number that you can remember but others cannot guess."
  },
  {
    keywords: ['staff mode', 'lock terminal', 'oga mode', 'hide profit'],
    answer: "When you leave the shop for your staff, click 'Switch to Staff' in the sidebar. This locks the 'Oga' features (profits, settings, delete) behind your Admin PIN."
  },
  {
    keywords: ['lockout', 'forgot pin', 'recovery'],
    answer: "If you forget your PIN, use the 'Recovery Options' on the login screen. You can use the Master PIN '9999' for emergency Admin access."
  },

  // TECHNICAL CATEGORY
  {
    keywords: ['offline mode', 'no internet', 'data cost', 'internet'],
    answer: "NaijaShop is 100% offline-first. You don't need data to sell, check stock, or view profits. You only need internet for AI scanning and WhatsApp features."
  },
  {
    keywords: ['backup to whatsapp', 'save data', 'phone loss', 'security backup'],
    answer: "Always use 'Security & Backups' to send a backup code to your WhatsApp. If you lose your phone, you can use that code to restore all your records on a new device."
  },
  {
    keywords: ['restore data', 'recovery code', 'import backup'],
    answer: "To restore, go to 'Security & Backups', paste your backup code into the 'Restore' box, and click 'Process Recovery'. The app will reload with all your old data."
  },
  {
    keywords: ['license', 'activation', 'renew', 'subscription'],
    answer: "A license costs ₦10,000 per year. You can renew in Settings using Paystack. This keeps your terminal active and supports future updates."
  },
  {
    keywords: ['terminal id', 'request code', 'device id'],
    answer: "Your Terminal ID (e.g., NS-A1B2C3D4) is unique to this device. You can find it on the Login screen or the Activation page."
  }
];

export const getBestMatch = (query: string): string | null => {
  const words = query.toLowerCase().split(/\s+/);
  let bestMatch: SupportEntry | null = null;
  let highestScore = 0;

  SUPPORT_DATABASE.forEach(entry => {
    let score = 0;
    entry.keywords.forEach(keyword => {
      // Check if keyword is in query
      if (query.toLowerCase().includes(keyword.toLowerCase())) {
        score += 3; // Direct phrase match
      }
      // Check for individual word overlaps
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

  // Threshold: at least some relevance
  return highestScore >= 2 ? (bestMatch?.answer || null) : null;
};
