
import LZString from 'lz-string';
import { db } from '../db/db';
import { Sale, Product } from '../types';

/**
 * Encrypts/Decrypts a string using a basic XOR cipher with the shop's sync key.
 * This provides a layer of security for WhatsApp data.
 */
const xorCipher = (text: string, key: string): string => {
  return text.split('').map((char, i) => 
    String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join('');
};

export const exportDataForWhatsApp = async (type: 'SALES' | 'STOCK', key: string) => {
  let dataToExport: any = {};
  
  if (type === 'SALES') {
    const pendingSales = await db.sales.where('sync_status').equals('pending').toArray();
    dataToExport = {
      type: 'SALES_REPORT',
      sales: pendingSales,
      timestamp: Date.now()
    };
  } else {
    const masterStock = await db.products.toArray();
    dataToExport = {
      type: 'STOCK_UPDATE',
      products: masterStock,
      timestamp: Date.now()
    };
  }

  const jsonString = JSON.stringify(dataToExport);
  const encrypted = xorCipher(jsonString, key);
  return LZString.compressToEncodedURIComponent(encrypted);
};

export const importWhatsAppBridgeData = async (compressedString: string, key: string) => {
  try {
    const encrypted = LZString.decompressFromEncodedURIComponent(compressedString);
    if (!encrypted) throw new Error("Could not decompress data.");
    
    const jsonString = xorCipher(encrypted, key);
    const payload = JSON.parse(jsonString);

    if (payload.type === 'SALES_REPORT') {
      let importedCount = 0;
      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        for (const sale of payload.sales) {
          const exists = await db.sales.where('timestamp').equals(sale.timestamp).first();
          if (!exists) {
            await db.sales.add({ ...sale, sync_status: 'synced' });
            // Deduct stock
            for (const item of sale.items) {
              const p = await db.products.get(item.productId);
              if (p) {
                const oldStock = p.stock_qty;
                const newStock = Math.max(0, p.stock_qty - item.quantity);
                await db.products.update(item.productId, { stock_qty: newStock });
                
                await db.inventory_logs.add({
                  product_id: item.productId,
                  product_name: item.name,
                  quantity_changed: -item.quantity,
                  old_stock: oldStock,
                  new_stock: newStock,
                  type: 'Sale',
                  timestamp: Date.now(),
                  performed_by: 'WhatsApp Bridge (' + (sale.staff_id || 'Staff') + ')'
                });
              }
            }
            importedCount++;
          }
        }
        // Mark sales as synced locally if it was the staff sending (but here we are on Admin)
      });
      return { success: true, type: 'SALES', count: importedCount };
    }

    if (payload.type === 'STOCK_UPDATE') {
      await (db as any).transaction('rw', [db.products], async () => {
        await db.products.clear();
        await db.products.bulkAdd(payload.products);
      });
      await db.settings.update('app_settings', { last_synced_timestamp: Date.now() });
      return { success: true, type: 'STOCK', count: payload.products.length };
    }

    throw new Error("Unknown payload type.");
  } catch (err: any) {
    console.error("Import Error:", err);
    throw new Error("Failed to decrypt or process data. Verify you have the correct Sync Key.");
  }
};
