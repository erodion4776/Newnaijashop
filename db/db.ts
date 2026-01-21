// Use named import for Dexie to ensure proper prototype inheritance and access to instance methods like version, transaction, and delete in TypeScript.
import { Dexie } from 'dexie';
import type { Table } from 'dexie';
import { Product, Sale, Debt, Settings, ParkedSale, InventoryLog, Staff } from '../types';
import { generateSyncKey } from '../services/syncService';

/**
 * Main Database class for the application.
 * Extends Dexie to provide IndexedDB functionality with TypeScript support.
 */
export class NaijaShopDB extends Dexie {
  products!: Table<Product>;
  sales!: Table<Sale>;
  debts!: Table<Debt>;
  staff!: Table<Staff>;
  settings!: Table<Settings>;
  parked_sales!: Table<ParkedSale>;
  inventory_logs!: Table<InventoryLog>;

  constructor() {
    super('NaijaShopDB');
    
    // Fix: Explicitly casting 'this' to any to ensure 'version' is recognized if inheritance is not correctly picked up by the compiler.
    (this as any).version(6).stores({
      products: '++id, name, category, barcode',
      sales: '++id, timestamp, sync_status, payment_method',
      debts: '++id, customer_name, status',
      staff: '++id, name, role, status',
      settings: 'id',
      parked_sales: '++id, timestamp',
      inventory_logs: '++id, product_id, product_name, type, timestamp'
    });
  }
}

export const db: NaijaShopDB = new NaijaShopDB();

export const initSettings = async () => {
  const settings = await db.settings.get('app_settings');
  if (!settings) {
    await db.settings.add({
      id: 'app_settings',
      license_key: '',
      shop_name: '',
      admin_name: '',
      admin_pin: '',
      sync_key: generateSyncKey(),
      is_setup_complete: false,
      bank_name: 'Access Bank',
      account_number: '0123456789',
      account_name: 'NAIJA RETAIL STORE',
      last_used_timestamp: Date.now(),
      last_synced_timestamp: 0
    });
  } else if (!settings.sync_key) {
    // Migration for existing users who might be missing the key
    await db.settings.update('app_settings', { sync_key: generateSyncKey() });
  }
};