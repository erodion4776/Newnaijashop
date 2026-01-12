
import pako from 'pako';
import { db } from '../db/db';

export const exportFullDatabase = async (): Promise<string> => {
  const data = {
    products: await db.products.toArray(),
    sales: await db.sales.toArray(),
    debts: await db.debts.toArray(),
    settings: await db.settings.get('app_settings'),
    export_timestamp: Date.now(),
    version: '2.0.0'
  };

  const jsonString = JSON.stringify(data);
  const compressed = pako.gzip(jsonString);
  
  // Convert to Base64 for easy transport as string
  const binaryString = String.fromCharCode.apply(null, Array.from(compressed));
  return btoa(binaryString);
};

export const importDatabaseFromString = async (base64String: string) => {
  try {
    const binaryString = atob(base64String);
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    
    const decompressed = pako.ungzip(uint8Array, { to: 'string' });
    const data = JSON.parse(decompressed);

    // Clear and restore
    // Fix: transaction is correctly inherited and accessible after correcting the Dexie inheritance in db/db.ts.
    await db.transaction('rw', [db.products, db.sales, db.debts, db.settings], async () => {
      await db.products.clear();
      await db.sales.clear();
      await db.debts.clear();
      
      if (data.products) await db.products.bulkAdd(data.products);
      if (data.sales) await db.sales.bulkAdd(data.sales);
      if (data.debts) await db.debts.bulkAdd(data.debts);
      if (data.settings) await db.settings.put(data.settings);
    });

    return true;
  } catch (err) {
    console.error("Import failed", err);
    throw err;
  }
};

export const shareToWhatsApp = async (base64Backup: string) => {
  const shopSettings = await db.settings.get('app_settings');
  const shopName = shopSettings?.shop_name || 'NaijaShop';
  const date = new Date().toLocaleDateString();
  
  const text = `📦 NAIJASHOP BACKUP - ${shopName}\nDate: ${date}\n\nThis is a compressed terminal backup. Copy the text below to restore:\n\n${base64Backup}`;
  
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(whatsappUrl, '_blank');
};
