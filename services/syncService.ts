import LZString from 'lz-string';
import { db } from '../db/db';
import { Sale, Product, StockSnapshot } from '../types';

const SYNC_HEADER = "NS_V2_";

export const generateSyncKey = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const part = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  return `NS-${part()}-${part()}-${part()}`;
};

const xorCipher = (text: string, key: string): string => {
  if (!key) return text;
  return text.split('').map((char, i) => 
    String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join('');
};

/**
 * Enhanced export function for Chain-Sync and Master Push
 */
export const exportDataForWhatsApp = async (type: 'SALES' | 'STOCK' | 'KEY_UPDATE' | 'URGENT_SYNC' | 'STAFF_INVITE', key: string, staffName: string = 'Staff') => {
  let dataToExport: any = {};
  let summary = "";
  
  if (type === 'SALES' || type === 'URGENT_SYNC') {
    const today = new Date().setHours(0,0,0,0);
    const pendingSales = await db.sales.where('timestamp').aboveOrEqual(today).toArray();
    const totalRevenue = pendingSales.reduce((acc, s) => acc + s.total_amount, 0);

    dataToExport = {
      type: 'SALES_REPORT',
      staff_name: staffName,
      sales: pendingSales,
      timestamp: Date.now()
    };

    if (type === 'URGENT_SYNC') {
      summary = `🚨 URGENT STOCK ALERT from ${staffName}. \nSome items are low. Here are my latest sales to update the Master Stock. \nCode: [CompressedJSON] \nPlease send back the Master Update!`;
    } else {
      summary = `🏁 Daily Sales Report from ${staffName} | Revenue: ₦${totalRevenue.toLocaleString()}`;
    }

  } else if (type === 'STOCK') {
    const masterStock = await db.products.toArray();
    
    // SECURITY: Only include name, price, category, stock_qty. EXCLUDE cost_price.
    const filteredProducts = masterStock.map(p => ({
      name: p.name,
      price: Number(p.price),
      category: p.category,
      stock_qty: Number(p.stock_qty)
    }));

    dataToExport = {
      type: 'STOCK_UPDATE',
      products: filteredProducts,
      timestamp: Date.now()
    };
    summary = `🚀 NAIJASHOP MASTER UPDATE: ${filteredProducts.length} Items. \nShare this in the Shop Group so all staff can click and update their phones! \nCode: [CompressedJSON]`;
  } else if (type === 'KEY_UPDATE') {
    dataToExport = { type: 'KEY_UPDATE', new_key: key, timestamp: Date.now() };
    summary = "🔐 Security Bridge Key Update";
  } else if (type === 'STAFF_INVITE') {
    const settings = await db.settings.get('app_settings');
    dataToExport = {
      type: 'STAFF_INVITE',
      shop_name: settings?.shop_name || 'NaijaShop',
      sync_key: settings?.sync_key || key,
      admin_whatsapp_number: settings?.admin_whatsapp_number || '',
      whatsapp_group_link: settings?.whatsapp_group_link || '',
      timestamp: Date.now()
    };
    summary = `👋 ${settings?.shop_name} Terminal Invite.\nUse this link to join the shop as staff and sync your records automatically.\n\nLink: [Link]`;
  }

  const jsonString = JSON.stringify(dataToExport);
  const encrypted = xorCipher(jsonString, key);
  const compressed = LZString.compressToEncodedURIComponent(encrypted);
  const finalString = SYNC_HEADER + compressed;

  // Fallback for large payloads (Download .nshop file)
  if (finalString.length > 1800 && type !== 'STAFF_INVITE') {
    const blob = new Blob([finalString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NaijaShop_Sync_${type}_${new Date().toISOString().split('T')[0]}.nshop`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return {
      raw: "FILE_DOWNLOADED",
      summary: `${summary}\n\n⚠️ Data too large for WhatsApp link. A file has been downloaded. Send this file to the other terminal.`
    };
  }
  
  return { raw: finalString, summary };
};

export const importWhatsAppBridgeData = async (rawString: string, localKey: string) => {
  try {
    if (!rawString.startsWith(SYNC_HEADER)) throw new Error("Invalid Data format.");

    const compressed = rawString.replace(SYNC_HEADER, "");
    const encrypted = LZString.decompressFromEncodedURIComponent(compressed);
    if (!encrypted) throw new Error("Corrupt data.");
    
    // We try to decrypt with the key. For invites, we might not have a local key yet, 
    // but the system usually has a default key or the key is passed.
    const jsonString = xorCipher(encrypted, localKey);
    let payload;
    try { payload = JSON.parse(jsonString); } catch (e) { throw new Error("Sync Key Mismatch."); }

    if (payload.type === 'SALES_REPORT') {
      let importedCount = 0;
      const todayStr = new Date().toISOString().split('T')[0];
      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs, db.stock_snapshots], async () => {
        for (const sale of payload.sales) {
          const exists = await db.sales.where('sale_id').equals(sale.sale_id).first();
          if (!exists) {
            await db.sales.add({ ...sale, sync_status: 'synced' });
            for (const item of sale.items) {
              const product = await db.products.get(item.productId);
              if (product) {
                const oldStock = Number(product.stock_qty);
                const newStock = Math.max(0, oldStock - Number(item.quantity));
                await db.products.update(item.productId, { stock_qty: newStock });
                await db.inventory_logs.add({
                  product_id: item.productId,
                  product_name: item.name,
                  quantity_changed: -item.quantity,
                  old_stock: oldStock,
                  new_stock: newStock,
                  type: 'Sale',
                  timestamp: Date.now(),
                  performed_by: `Sync Bridge (${payload.staff_name})`
                });
                const snap = await db.stock_snapshots.where({ date: todayStr, product_id: item.productId }).first();
                if (snap && snap.id) await db.stock_snapshots.update(snap.id, { sold_qty: (snap.sold_qty || 0) + item.quantity });
              }
            }
            importedCount++;
          }
        }
      });
      return { success: true, type: 'SALES', count: importedCount };
    }

    if (payload.type === 'STOCK_UPDATE') {
      await (db as any).transaction('rw', [db.products, db.inventory_logs], async () => {
        // We only overwrite name, price, category, stock_qty. We try to preserve local IDs if matching by name.
        for (const p of payload.products) {
          const existing = await db.products.where('name').equals(p.name).first();
          if (existing) {
            await db.products.update(existing.id!, { 
              price: Number(p.price), 
              stock_qty: Number(p.stock_qty), 
              category: p.category 
            });
          } else {
            await db.products.add({ ...p, cost_price: Math.round(p.price * 0.8 / 50) * 50, low_stock_threshold: 5 });
          }
        }
      });
      // Chain-Sync Resume: Reset the 1-hour cooldown timer
      localStorage.setItem('last_force_sync', Date.now().toString());
      return { success: true, type: 'STOCK', count: payload.products.length };
    }

    if (payload.type === 'STAFF_INVITE') {
      await db.settings.update('app_settings', {
        shop_name: payload.shop_name,
        sync_key: payload.sync_key,
        admin_whatsapp_number: payload.admin_whatsapp_number,
        whatsapp_group_link: payload.whatsapp_group_link
      });
      return { success: true, type: 'STAFF_INVITE', shop_name: payload.shop_name };
    }

    return { success: true, type: payload.type };
  } catch (err: any) { throw err; }
};
