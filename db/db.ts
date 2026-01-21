
import { Dexie } from 'dexie';
import type { Table } from 'dexie';
import { Product, Sale, Debt, Settings, ParkedOrder, InventoryLog, Staff } from '../types';
import { generateSyncKey } from '../services/syncService';

export class NaijaShopDB extends Dexie {
  products!: Table<Product>;
  sales!: Table<Sale>;
  debts!: Table<Debt>;
  staff!: Table<Staff>;
  settings!: Table<Settings>;
  parked_orders!: Table<ParkedOrder>;
  inventory_logs!: Table<InventoryLog>;

  constructor() {
    super('NaijaShopDB');
    
    (this as any).version(10).stores({
      products: '++id, name, category, barcode',
      sales: '++id, sale_id, timestamp, sync_status, payment_method, staff_name',
      debts: '++id, customer_name, status',
      staff: '++id, name, role, status',
      settings: 'id',
      parked_orders: '++id, customerName, staffId, timestamp',
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
  }
};
