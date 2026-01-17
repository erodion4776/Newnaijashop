import pako from 'pako';
import LZString from 'lz-string';
import { db } from '../db/db';
import { Product, Sale, Debt, Staff, ParkedSale, InventoryLog, Settings } from '../types';

// ============ TYPES ============

export interface BackupData {
  version: string;
  appName: string;
  shopName: string;
  exportTimestamp: number;
  exportedBy: string;
  tables: {
    products: Product[];
    sales: Sale[];
    debts: Debt[];
    staff: Staff[];
    parkedSales: ParkedSale[];
    inventoryLogs: InventoryLog[];
    settings: Settings | null;
  };
  stats: {
    products: number;
    sales: number;
    debts: number;
    staff: number;
    inventoryLogs: number;
  };
}

export interface ImportResult {
  success: boolean;
  stats: {
    products: number;
    sales: number;
    debts: number;
    staff: number;
    inventoryLogs: number;
  };
  errors: string[];
  warnings: string[];
}

export interface ImportOptions {
  products?: boolean;
  sales?: boolean;
  debts?: boolean;
  staff?: boolean;
  inventoryLogs?: boolean;
  settings?: boolean;
  clearExisting?: boolean;
}

export type CompressionType = 'pako' | 'lzstring' | 'none';

export interface ExportOptions {
  compression?: CompressionType;
  includeInventoryLogs?: boolean;
  includeSales?: boolean;
  exportedBy?: string;
}

// ============ CONSTANTS ============

const BACKUP_VERSION = '2.1.0';
const APP_NAME = 'NaijaShop';
const MAX_WHATSAPP_LENGTH = 65000; // WhatsApp has ~65KB limit

// ============ HELPER FUNCTIONS ============

/**
 * Convert Uint8Array to Base64 without stack overflow
 */
const uint8ArrayToBase64 = (uint8Array: Uint8Array): string => {
  let binary = '';
  const chunkSize = 8192; // Process in chunks to avoid stack overflow
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
};

/**
 * Convert Base64 to Uint8Array
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const uint8Array = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }
  
  return uint8Array;
};

/**
 * Validate backup data structure
 */
const validateBackupData = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data) {
    errors.push('Backup data is empty');
    return { valid: false, errors };
  }

  if (!data.version) {
    errors.push('Missing version information');
  }

  if (!data.tables) {
    errors.push('Missing tables data');
    return { valid: false, errors };
  }

  // Validate arrays
  const arrayFields = ['products', 'sales', 'debts', 'staff', 'parkedSales', 'inventoryLogs'];
  for (const field of arrayFields) {
    if (data.tables[field] && !Array.isArray(data.tables[field])) {
      errors.push(`Invalid ${field} data: expected array`);
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Strip IDs from records for fresh import
 */
const stripIds = <T extends { id?: number }>(records: T[]): Omit<T, 'id'>[] => {
  return records.map(record => {
    const { id, ...rest } = record;
    return rest as Omit<T, 'id'>;
  });
};

// ============ EXPORT FUNCTIONS ============

/**
 * Export full database to compressed string
 */
export const exportFullDatabase = async (
  options: ExportOptions = {}
): Promise<{ data: string; format: CompressionType; size: number }> => {
  const {
    compression = 'pako',
    includeInventoryLogs = true,
    includeSales = true,
    exportedBy = 'Admin'
  } = options;

  try {
    // Fetch all data
    const [products, sales, debts, staff, parkedSales, inventoryLogs, settings] = await Promise.all([
      db.products.toArray(),
      includeSales ? db.sales.toArray() : Promise.resolve([]),
      db.debts.toArray(),
      db.staff.toArray(),
      db.parked_sales.toArray(),
      includeInventoryLogs ? db.inventory_logs.toArray() : Promise.resolve([]),
      db.settings.get('app_settings')
    ]);

    const backupData: BackupData = {
      version: BACKUP_VERSION,
      appName: APP_NAME,
      shopName: settings?.shop_name || 'Unknown Shop',
      exportTimestamp: Date.now(),
      exportedBy,
      tables: {
        products,
        sales,
        debts,
        staff,
        parkedSales,
        inventoryLogs,
        settings: settings || null
      },
      stats: {
        products: products.length,
        sales: sales.length,
        debts: debts.length,
        staff: staff.length,
        inventoryLogs: inventoryLogs.length
      }
    };

    const jsonString = JSON.stringify(backupData);
    let result: string;

    switch (compression) {
      case 'pako': {
        const compressed = pako.gzip(jsonString, { level: 9 });
        result = uint8ArrayToBase64(compressed);
        break;
      }
      case 'lzstring': {
        result = LZString.compressToEncodedURIComponent(jsonString);
        break;
      }
      case 'none':
      default: {
        result = btoa(encodeURIComponent(jsonString));
        break;
      }
    }

    console.log(`[EXPORT] Backup created: ${result.length} chars (${compression})`);

    return {
      data: result,
      format: compression,
      size: result.length
    };
  } catch (error) {
    console.error('[EXPORT] Failed:', error);
    throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Export to downloadable file
 */
export const exportToFile = async (options: ExportOptions = {}): Promise<void> => {
  try {
    const { data, format } = await exportFullDatabase(options);
    const settings = await db.settings.get('app_settings');
    
    const filename = `${settings?.shop_name || 'naijashop'}_backup_${
      new Date().toISOString().split('T')[0]
    }.${format === 'pako' ? 'nsb' : 'json'}`;

    // Create blob and download
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`[EXPORT] File downloaded: ${filename}`);
  } catch (error) {
    console.error('[EXPORT] File export failed:', error);
    throw error;
  }
};

// ============ IMPORT FUNCTIONS ============

/**
 * Detect compression format
 */
const detectFormat = (data: string): CompressionType => {
  // LZString encoded URI starts with certain patterns
  if (/^[A-Za-z0-9+/\-_]+$/.test(data) && data.length > 100) {
    try {
      const test = LZString.decompressFromEncodedURIComponent(data);
      if (test && test.startsWith('{')) return 'lzstring';
    } catch (e) {}
  }

  // Try base64/pako
  try {
    const decoded = atob(data);
    if (decoded.charCodeAt(0) === 0x1f && decoded.charCodeAt(1) === 0x8b) {
      return 'pako'; // gzip magic number
    }
    return 'none';
  } catch (e) {
    return 'lzstring'; // Fallback to try lzstring
  }
};

/**
 * Decompress backup string
 */
const decompressBackup = (data: string, format?: CompressionType): any => {
  const detectedFormat = format || detectFormat(data);

  try {
    switch (detectedFormat) {
      case 'pako': {
        const uint8Array = base64ToUint8Array(data);
        const decompressed = pako.ungzip(uint8Array, { to: 'string' });
        return JSON.parse(decompressed);
      }
      case 'lzstring': {
        const decompressed = LZString.decompressFromEncodedURIComponent(data);
        if (!decompressed) throw new Error('LZString decompression returned null');
        return JSON.parse(decompressed);
      }
      case 'none':
      default: {
        const decoded = decodeURIComponent(atob(data));
        return JSON.parse(decoded);
      }
    }
  } catch (error) {
    // Try all formats as fallback
    const formats: CompressionType[] = ['pako', 'lzstring', 'none'];
    
    for (const fmt of formats) {
      if (fmt === detectedFormat) continue;
      try {
        return decompressBackup(data, fmt);
      } catch (e) {
        continue;
      }
    }
    
    throw new Error('Could not decompress backup data with any known format');
  }
};

/**
 * Import database from compressed string
 */
export const importDatabaseFromString = async (
  backupString: string,
  options: ImportOptions = {}
): Promise<ImportResult> => {
  const {
    products = true,
    sales = true,
    debts = true,
    staff = true,
    inventoryLogs = true,
    settings = false, // Don't overwrite settings by default
    clearExisting = true
  } = options;

  const result: ImportResult = {
    success: false,
    stats: { products: 0, sales: 0, debts: 0, staff: 0, inventoryLogs: 0 },
    errors: [],
    warnings: []
  };

  try {
    // Decompress and parse
    const data = decompressBackup(backupString.trim());

    // Handle legacy format
    const backupData = normalizeBackupFormat(data);

    // Validate
    const validation = validateBackupData(backupData);
    if (!validation.valid) {
      result.errors = validation.errors;
      return result;
    }

    // Version warning
    if (backupData.version !== BACKUP_VERSION) {
      result.warnings.push(`Backup version (${backupData.version}) differs from current (${BACKUP_VERSION})`);
    }

    // Perform import
    await db.transaction('rw', 
      [db.products, db.sales, db.debts, db.staff, db.parked_sales, db.inventory_logs, db.settings],
      async () => {
        // Clear existing data if requested
        if (clearExisting) {
          if (products) await db.products.clear();
          if (sales) await db.sales.clear();
          if (debts) await db.debts.clear();
          if (staff) await db.staff.clear();
          if (inventoryLogs) await db.inventory_logs.clear();
          await db.parked_sales.clear();
        }

        // Import products
        if (products && backupData.tables.products?.length) {
          const cleanProducts = stripIds(backupData.tables.products);
          await db.products.bulkAdd(cleanProducts as Product[]);
          result.stats.products = cleanProducts.length;
        }

        // Import sales
        if (sales && backupData.tables.sales?.length) {
          const cleanSales = stripIds(backupData.tables.sales);
          await db.sales.bulkAdd(cleanSales as Sale[]);
          result.stats.sales = cleanSales.length;
        }

        // Import debts
        if (debts && backupData.tables.debts?.length) {
          const cleanDebts = stripIds(backupData.tables.debts);
          await db.debts.bulkAdd(cleanDebts as Debt[]);
          result.stats.debts = cleanDebts.length;
        }

        // Import staff
        if (staff && backupData.tables.staff?.length) {
          const cleanStaff = stripIds(backupData.tables.staff);
          await db.staff.bulkAdd(cleanStaff as Staff[]);
          result.stats.staff = cleanStaff.length;
        }

        // Import inventory logs
        if (inventoryLogs && backupData.tables.inventoryLogs?.length) {
          const cleanLogs = stripIds(backupData.tables.inventoryLogs);
          await db.inventory_logs.bulkAdd(cleanLogs as InventoryLog[]);
          result.stats.inventoryLogs = cleanLogs.length;
        }

        // Import parked sales
        if (backupData.tables.parkedSales?.length) {
          const cleanParked = stripIds(backupData.tables.parkedSales);
          await db.parked_sales.bulkAdd(cleanParked as ParkedSale[]);
        }

        // Import settings (merge, don't replace)
        if (settings && backupData.tables.settings) {
          const existingSettings = await db.settings.get('app_settings');
          if (existingSettings) {
            // Only update non-sensitive fields
            await db.settings.update('app_settings', {
              shop_name: backupData.tables.settings.shop_name,
              bank_name: backupData.tables.settings.bank_name,
              account_number: backupData.tables.settings.account_number,
              account_name: backupData.tables.settings.account_name,
              currency: backupData.tables.settings.currency,
              currency_symbol: backupData.tables.settings.currency_symbol,
              low_stock_threshold: backupData.tables.settings.low_stock_threshold,
              last_synced_timestamp: Date.now()
            });
          }
        }
      }
    );

    result.success = true;
    console.log('[IMPORT] Success:', result.stats);
    return result;
  } catch (error) {
    console.error('[IMPORT] Failed:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
};

/**
 * Normalize legacy backup formats to current format
 */
const normalizeBackupFormat = (data: any): BackupData => {
  // Already in new format
  if (data.tables) {
    return data as BackupData;
  }

  // Legacy format (v1.x)
  return {
    version: data.version || '1.0.0',
    appName: APP_NAME,
    shopName: data.settings?.shop_name || 'Unknown',
    exportTimestamp: data.export_timestamp || Date.now(),
    exportedBy: 'Legacy Import',
    tables: {
      products: data.products || [],
      sales: data.sales || [],
      debts: data.debts || [],
      staff: data.staff || [],
      parkedSales: data.parked_sales || data.parkedSales || [],
      inventoryLogs: data.inventory_logs || data.inventoryLogs || [],
      settings: data.settings || null
    },
    stats: {
      products: data.products?.length || 0,
      sales: data.sales?.length || 0,
      debts: data.debts?.length || 0,
      staff: data.staff?.length || 0,
      inventoryLogs: data.inventory_logs?.length || data.inventoryLogs?.length || 0
    }
  };
};

/**
 * Import from file
 */
export const importFromFile = (file: File): Promise<ImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const result = await importDatabaseFromString(content);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// ============ SHARING FUNCTIONS ============

/**
 * Share backup via WhatsApp
 */
export const shareToWhatsApp = async (options: ExportOptions = {}): Promise<void> => {
  try {
    const { data, size } = await exportFullDatabase({
      ...options,
      compression: 'lzstring' // LZString is more URL-safe
    });

    const settings = await db.settings.get('app_settings');
    const shopName = settings?.shop_name || APP_NAME;
    const date = new Date().toLocaleDateString();

    // Check size
    if (size > MAX_WHATSAPP_LENGTH) {
      throw new Error(
        `Backup too large for WhatsApp (${Math.round(size / 1024)}KB). ` +
        `Please use file download instead.`
      );
    }

    const message = 
      `📦 *${shopName} BACKUP*\n` +
      `📅 Date: ${date}\n` +
      `📊 Size: ${Math.round(size / 1024)}KB\n\n` +
      `⚠️ Copy ALL text below to restore:\n\n` +
      `---BEGIN BACKUP---\n${data}\n---END BACKUP---`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  } catch (error) {
    console.error('[SHARE] WhatsApp share failed:', error);
    throw error;
  }
};

/**
 * Share via Web Share API (if available)
 */
export const shareNative = async (options: ExportOptions = {}): Promise<boolean> => {
  if (!navigator.share) {
    console.warn('[SHARE] Web Share API not available');
    return false;
  }

  try {
    const { data } = await exportFullDatabase(options);
    const settings = await db.settings.get('app_settings');
    const shopName = settings?.shop_name || APP_NAME;

    await navigator.share({
      title: `${shopName} Backup`,
      text: `Backup from ${new Date().toLocaleDateString()}`,
      files: [
        new File([data], `${shopName}_backup.nsb`, { type: 'application/octet-stream' })
      ]
    });

    return true;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // User cancelled
      return false;
    }
    throw error;
  }
};

/**
 * Copy backup to clipboard
 */
export const copyToClipboard = async (options: ExportOptions = {}): Promise<void> => {
  try {
    const { data } = await exportFullDatabase({
      ...options,
      compression: 'lzstring'
    });

    await navigator.clipboard.writeText(data);
    console.log('[SHARE] Backup copied to clipboard');
  } catch (error) {
    console.error('[SHARE] Clipboard copy failed:', error);
    throw new Error('Failed to copy to clipboard. Please try again.');
  }
};

// ============ QUICK EXPORT HELPERS ============

/**
 * Export only products (for sharing catalog)
 */
export const exportProductsCatalog = async (): Promise<string> => {
  const products = await db.products.toArray();
  const settings = await db.settings.get('app_settings');

  const data = {
    type: 'CATALOG_EXPORT',
    shopName: settings?.shop_name,
    timestamp: Date.now(),
    products
  };

  return LZString.compressToEncodedURIComponent(JSON.stringify(data));
};

/**
 * Export today's sales (for daily report)
 */
export const exportTodaysSales = async (): Promise<string> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sales = await db.sales
    .where('timestamp')
    .aboveOrEqual(today.getTime())
    .toArray();

  const settings = await db.settings.get('app_settings');

  const data = {
    type: 'DAILY_SALES_EXPORT',
    shopName: settings?.shop_name,
    date: today.toISOString(),
    timestamp: Date.now(),
    sales,
    summary: {
      count: sales.length,
      total: sales.reduce((sum, s) => sum + s.total_amount, 0),
      byPaymentMethod: {
        cash: sales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + s.total_amount, 0),
        transfer: sales.filter(s => s.payment_method === 'transfer').reduce((sum, s) => sum + s.total_amount, 0),
        pos: sales.filter(s => s.payment_method === 'pos').reduce((sum, s) => sum + s.total_amount, 0)
      }
    }
  };

  return LZString.compressToEncodedURIComponent(JSON.stringify(data));
};

// ============ EXPORT DEFAULT ============

export default {
  exportFullDatabase,
  exportToFile,
  importDatabaseFromString,
  importFromFile,
  shareToWhatsApp,
  shareNative,
  copyToClipboard,
  exportProductsCatalog,
  exportTodaysSales
};
