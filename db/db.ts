
// Fix: Use named import for Dexie to ensure proper prototype inheritance and type resolution in TypeScript
import { Dexie, type Table } from 'dexie';
import { Product, Sale, Debt, Settings, ParkedSale, InventoryLog, Staff } from '../types';

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
    
    // Fix: Using this.version is now correctly recognized by switching to the named import of the Dexie class.
    this.version(6).stores({
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

export const db = new NaijaShopDB();

export const initSettings = async () => {
  const settings = await db.settings.get('app_settings');
  if (!settings) {
    await db.settings.add({
      id: 'app_settings',
      license_key: '',
      shop_name: '',
      admin_name: '',
      admin_pin: '',
      is_setup_complete: false,
      bank_name: 'Access Bank',
      account_number: '0123456789',
      account_name: 'NAIJA RETAIL STORE',
      last_used_timestamp: Date.now()
    });
  }
};
