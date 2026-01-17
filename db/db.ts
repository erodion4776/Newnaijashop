import Dexie, { Table } from 'dexie';
import { 
  Product, 
  Sale, 
  Debt, 
  Settings, 
  ParkedSale, 
  InventoryLog, 
  Staff 
} from '../types';

// ============ DATABASE VERSION ============
const DB_VERSION = 7;

// ============ DEFAULT VALUES ============
const DEFAULT_SETTINGS: Settings = {
  id: 'app_settings',
  license_key: '',
  shop_name: '',
  admin_name: '',
  admin_pin: '',
  is_setup_complete: false,
  bank_name: '',
  account_number: '',
  account_name: '',
  last_used_timestamp: Date.now(),
  last_synced_timestamp: 0,
  currency: 'NGN',
  currency_symbol: '₦',
  low_stock_threshold: 10,
  theme: 'light'
};

// ============ DATABASE CLASS ============

export class NaijaShopDB extends Dexie {
  // Table declarations
  products!: Table<Product, number>;
  sales!: Table<Sale, number>;
  debts!: Table<Debt, number>;
  staff!: Table<Staff, number>;
  settings!: Table<Settings, string>;
  parked_sales!: Table<ParkedSale, number>;
  inventory_logs!: Table<InventoryLog, number>;

  constructor() {
    super('NaijaShopDB');
    
    // Version 1: Initial schema
    this.version(1).stores({
      products: '++id, name, category',
      sales: '++id, timestamp',
      debts: '++id, customer_name',
      settings: 'id'
    });

    // Version 2: Added barcode to products
    this.version(2).stores({
      products: '++id, name, category, barcode',
      sales: '++id, timestamp',
      debts: '++id, customer_name',
      settings: 'id'
    });

    // Version 3: Added staff table
    this.version(3).stores({
      products: '++id, name, category, barcode',
      sales: '++id, timestamp',
      debts: '++id, customer_name',
      staff: '++id, name, role',
      settings: 'id'
    });

    // Version 4: Added parked_sales
    this.version(4).stores({
      products: '++id, name, category, barcode',
      sales: '++id, timestamp',
      debts: '++id, customer_name',
      staff: '++id, name, role',
      settings: 'id',
      parked_sales: '++id, timestamp'
    });

    // Version 5: Added inventory_logs
    this.version(5).stores({
      products: '++id, name, category, barcode',
      sales: '++id, timestamp, sync_status',
      debts: '++id, customer_name, status',
      staff: '++id, name, role, status',
      settings: 'id',
      parked_sales: '++id, timestamp',
      inventory_logs: '++id, product_id, timestamp, type'
    });

    // Version 6: Added payment_method index to sales
    this.version(6).stores({
      products: '++id, name, category, barcode',
      sales: '++id, timestamp, sync_status, payment_method',
      debts: '++id, customer_name, status',
      staff: '++id, name, role, status',
      settings: 'id',
      parked_sales: '++id, timestamp',
      inventory_logs: '++id, product_id, timestamp, type'
    });

    // Version 7: Added staff_id index to sales, product_name to logs
    this.version(7).stores({
      products: '++id, name, category, barcode, price',
      sales: '++id, timestamp, sync_status, payment_method, staff_id',
      debts: '++id, customer_name, phone, status, timestamp',
      staff: '++id, name, role, status',
      settings: 'id',
      parked_sales: '++id, timestamp, customer_name',
      inventory_logs: '++id, product_id, product_name, timestamp, type, performed_by'
    }).upgrade(async tx => {
      // Migration: Add any missing fields to existing records
      console.log('[DB] Running v7 migration...');
      
      // Update sales with missing staff_id
      await tx.table('sales').toCollection().modify(sale => {
        if (!sale.staff_id) {
          sale.staff_id = 'Legacy';
        }
        if (!sale.sync_status) {
          sale.sync_status = 'synced';
        }
      });

      // Update debts with missing fields
      await tx.table('debts').toCollection().modify(debt => {
        if (!debt.timestamp) {
          debt.timestamp = Date.now();
        }
      });

      console.log('[DB] v7 migration complete');
    });

    // ============ HOOKS ============

    // Auto-set timestamps on creation
    this.sales.hook('creating', (primKey, obj) => {
      if (!obj.timestamp) obj.timestamp = Date.now();
      if (!obj.sync_status) obj.sync_status = 'pending';
      return undefined;
    });

    this.debts.hook('creating', (primKey, obj) => {
      if (!obj.timestamp) obj.timestamp = Date.now();
      if (!obj.status) obj.status = 'pending';
      return undefined;
    });

    this.inventory_logs.hook('creating', (primKey, obj) => {
      if (!obj.timestamp) obj.timestamp = Date.now();
      return undefined;
    });

    this.parked_sales.hook('creating', (primKey, obj) => {
      if (!obj.timestamp) obj.timestamp = Date.now();
      return undefined;
    });

    this.staff.hook('creating', (primKey, obj) => {
      if (!obj.created_at) obj.created_at = Date.now();
      if (!obj.status) obj.status = 'Active';
      return undefined;
    });
  }
}

// ============ DATABASE INSTANCE ============

export const db = new NaijaShopDB();

// ============ INITIALIZATION ============

/**
 * Initialize database and settings
 * Should be called on app startup
 */
export const initDatabase = async (): Promise<boolean> => {
  try {
    // Open database
    await db.open();
    console.log('[DB] Database opened successfully');

    // Initialize settings
    await initSettings();

    // Update last used timestamp
    await db.settings.update('app_settings', {
      last_used_timestamp: Date.now()
    });

    return true;
  } catch (error) {
    console.error('[DB] Database initialization failed:', error);
    
    // Check for specific errors
    if (error instanceof Dexie.NoSuchDatabaseError) {
      console.log('[DB] Database does not exist, will be created');
    } else if (error instanceof Dexie.InvalidStateError) {
      console.error('[DB] Database is in invalid state. Try clearing browser data.');
    } else if (error instanceof Dexie.DatabaseClosedError) {
      console.error('[DB] Database was closed unexpectedly');
    }
    
    return false;
  }
};

/**
 * Initialize or update settings with defaults
 */
export const initSettings = async (): Promise<void> => {
  try {
    const existingSettings = await db.settings.get('app_settings');
    
    if (!existingSettings) {
      // First time - create with all defaults
      await db.settings.add(DEFAULT_SETTINGS);
      console.log('[DB] Settings initialized with defaults');
    } else {
      // Existing settings - merge with new default fields
      const updatedSettings: Partial<Settings> = {};
      let needsUpdate = false;

      // Check each default field
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (!(key in existingSettings)) {
          (updatedSettings as any)[key] = value;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await db.settings.update('app_settings', updatedSettings);
        console.log('[DB] Settings updated with new fields:', Object.keys(updatedSettings));
      }
    }
  } catch (error) {
    console.error('[DB] Settings initialization failed:', error);
    throw error;
  }
};

// ============ UTILITY FUNCTIONS ============

/**
 * Clear all data except settings
 * Useful for logging out or resetting
 */
export const clearUserData = async (): Promise<void> => {
  await db.transaction('rw', 
    [db.products, db.sales, db.debts, db.staff, db.parked_sales, db.inventory_logs], 
    async () => {
      await Promise.all([
        db.products.clear(),
        db.sales.clear(),
        db.debts.clear(),
        db.staff.clear(),
        db.parked_sales.clear(),
        db.inventory_logs.clear()
      ]);
    }
  );
  console.log('[DB] User data cleared');
};

/**
 * Complete database reset including settings
 * Use with caution!
 */
export const resetDatabase = async (): Promise<void> => {
  await db.delete();
  console.log('[DB] Database deleted');
  
  // Recreate
  const newDb = new NaijaShopDB();
  await newDb.open();
  await initSettings();
  console.log('[DB] Database recreated');
};

/**
 * Export all data for backup
 */
export const exportDatabase = async (): Promise<object> => {
  const [products, sales, debts, staff, settings, parkedSales, inventoryLogs] = await Promise.all([
    db.products.toArray(),
    db.sales.toArray(),
    db.debts.toArray(),
    db.staff.toArray(),
    db.settings.toArray(),
    db.parked_sales.toArray(),
    db.inventory_logs.toArray()
  ]);

  return {
    version: DB_VERSION,
    exportedAt: Date.now(),
    data: {
      products,
      sales,
      debts,
      staff,
      settings,
      parkedSales,
      inventoryLogs
    }
  };
};

/**
 * Import data from backup
 * @param backup The backup data object
 * @param merge If true, merges with existing data. If false, replaces all data.
 */
export const importDatabase = async (backup: any, merge: boolean = false): Promise<{
  products: number;
  sales: number;
  debts: number;
  staff: number;
}> => {
  const stats = { products: 0, sales: 0, debts: 0, staff: 0 };

  if (!backup?.data) {
    throw new Error('Invalid backup format');
  }

  await db.transaction('rw', 
    [db.products, db.sales, db.debts, db.staff, db.settings, db.parked_sales, db.inventory_logs],
    async () => {
      // Clear existing data if not merging
      if (!merge) {
        await Promise.all([
          db.products.clear(),
          db.sales.clear(),
          db.debts.clear(),
          db.staff.clear(),
          db.parked_sales.clear(),
          db.inventory_logs.clear()
        ]);
      }

      // Import products
      if (backup.data.products?.length) {
        // Remove IDs for fresh insert when not merging
        const products = merge 
          ? backup.data.products 
          : backup.data.products.map((p: Product) => ({ ...p, id: undefined }));
        await db.products.bulkPut(products);
        stats.products = backup.data.products.length;
      }

      // Import sales
      if (backup.data.sales?.length) {
        const sales = merge 
          ? backup.data.sales 
          : backup.data.sales.map((s: Sale) => ({ ...s, id: undefined }));
        await db.sales.bulkPut(sales);
        stats.sales = backup.data.sales.length;
      }

      // Import debts
      if (backup.data.debts?.length) {
        const debts = merge 
          ? backup.data.debts 
          : backup.data.debts.map((d: Debt) => ({ ...d, id: undefined }));
        await db.debts.bulkPut(debts);
        stats.debts = backup.data.debts.length;
      }

      // Import staff
      if (backup.data.staff?.length) {
        const staff = merge 
          ? backup.data.staff 
          : backup.data.staff.map((s: Staff) => ({ ...s, id: undefined }));
        await db.staff.bulkPut(staff);
        stats.staff = backup.data.staff.length;
      }

      // Import inventory logs
      if (backup.data.inventoryLogs?.length) {
        const logs = merge 
          ? backup.data.inventoryLogs 
          : backup.data.inventoryLogs.map((l: InventoryLog) => ({ ...l, id: undefined }));
        await db.inventory_logs.bulkPut(logs);
      }

      // Import parked sales
      if (backup.data.parkedSales?.length) {
        const parked = merge 
          ? backup.data.parkedSales 
          : backup.data.parkedSales.map((p: ParkedSale) => ({ ...p, id: undefined }));
        await db.parked_sales.bulkPut(parked);
      }

      // Merge settings (don't replace completely)
      if (backup.data.settings?.length) {
        const backupSettings = backup.data.settings[0];
        if (backupSettings) {
          await db.settings.update('app_settings', {
            shop_name: backupSettings.shop_name,
            bank_name: backupSettings.bank_name,
            account_number: backupSettings.account_number,
            account_name: backupSettings.account_name,
            currency: backupSettings.currency,
            currency_symbol: backupSettings.currency_symbol,
            low_stock_threshold: backupSettings.low_stock_threshold
          });
        }
      }
    }
  );

  console.log('[DB] Import complete:', stats);
  return stats;
};

/**
 * Get database statistics
 */
export const getDatabaseStats = async (): Promise<{
  products: number;
  sales: number;
  debts: number;
  staff: number;
  inventoryLogs: number;
  storageEstimate: number | null;
}> => {
  const [products, sales, debts, staff, inventoryLogs] = await Promise.all([
    db.products.count(),
    db.sales.count(),
    db.debts.count(),
    db.staff.count(),
    db.inventory_logs.count()
  ]);

  // Try to get storage estimate
  let storageEstimate: number | null = null;
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      storageEstimate = estimate.usage || null;
    } catch (e) {
      // Storage API not available
    }
  }

  return {
    products,
    sales,
    debts,
    staff,
    inventoryLogs,
    storageEstimate
  };
};

/**
 * Clean up old data
 * @param daysToKeep Number of days of data to retain
 */
export const cleanupOldData = async (daysToKeep: number = 90): Promise<{
  salesRemoved: number;
  logsRemoved: number;
}> => {
  const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  
  const [salesRemoved, logsRemoved] = await Promise.all([
    // Don't delete unsynced sales
    db.sales
      .where('timestamp')
      .below(cutoffDate)
      .filter(s => s.sync_status === 'synced')
      .delete(),
    
    db.inventory_logs
      .where('timestamp')
      .below(cutoffDate)
      .delete()
  ]);

  console.log('[DB] Cleanup complete:', { salesRemoved, logsRemoved });
  return { salesRemoved, logsRemoved };
};

// ============ QUERY HELPERS ============

/**
 * Get sales for a specific date range
 */
export const getSalesByDateRange = async (
  startDate: Date, 
  endDate: Date
): Promise<Sale[]> => {
  const startTs = startDate.setHours(0, 0, 0, 0);
  const endTs = endDate.setHours(23, 59, 59, 999);
  
  return db.sales
    .where('timestamp')
    .between(startTs, endTs, true, true)
    .toArray();
};

/**
 * Get sales by staff member
 */
export const getSalesByStaff = async (staffId: string): Promise<Sale[]> => {
  return db.sales
    .where('staff_id')
    .equals(staffId)
    .toArray();
};

/**
 * Get pending (unsynced) sales
 */
export const getPendingSales = async (): Promise<Sale[]> => {
  return db.sales
    .where('sync_status')
    .equals('pending')
    .toArray();
};

/**
 * Get low stock products
 */
export const getLowStockProducts = async (threshold: number = 10): Promise<Product[]> => {
  return db.products
    .filter(p => p.stock_qty <= threshold)
    .toArray();
};

/**
 * Get pending debts
 */
export const getPendingDebts = async (): Promise<Debt[]> => {
  return db.debts
    .where('status')
    .equals('pending')
    .toArray();
};

/**
 * Get inventory logs for a product
 */
export const getProductLogs = async (productId: number): Promise<InventoryLog[]> => {
  return db.inventory_logs
    .where('product_id')
    .equals(productId)
    .reverse()
    .toArray();
};

// ============ EXPORT ============

export default db;
