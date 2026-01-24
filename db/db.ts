
// Fix: Use default import for Dexie to ensure inherited methods like version() are correctly typed on the class instance.
import Dexie, { type Table } from 'dexie';
import { Product, Sale, Debt, Settings, ParkedOrder, InventoryLog, Staff, Expense, AuditEntry, CustomerWallet, WalletTransaction } from '../types';

export class NaijaShopDB extends Dexie {
  products!: Table<Product>;
  sales!: Table<Sale>;
  debts!: Table<Debt>;
  staff!: Table<Staff>;
  settings!: Table<Settings>;
  parked_orders!: Table<ParkedOrder>;
  inventory_logs!: Table<InventoryLog>;
  expenses!: Table<Expense>;
  audit_trail!: Table<AuditEntry>;
  customer_wallets!: Table<CustomerWallet>; // Legacy table
  wallets!: Table<any>; // New wallets table: ++id, &phone, name, balance, lastUpdated
  wallet_transactions!: Table<WalletTransaction>;

  constructor() {
    super('NaijaShopDB');
    
    // Version 24 ensures all current and requested tables are active in a single block
    // Fix: Using the default import for Dexie helps TypeScript correctly resolve the prototype chain for inherited methods like version().
    this.version(24).stores({
      products: '++id, name, category, barcode',
      sales: '++id, sale_id, timestamp, payment_method, staff_name',
      debts: '++id, customer_name, status',
      staff: '++id, name, role, status',
      settings: 'id',
      parked_orders: '++id, customerName, timestamp',
      inventory_logs: '++id, product_id, product_name, type, timestamp',
      expenses: '++id, category, timestamp',
      audit_trail: '++id, action, staff_name, timestamp',
      customer_wallets: '++id, phone, balance',
      wallets: '++id, &phone, name, balance, lastUpdated',
      wallet_transactions: '++id, phone, timestamp'
    });
  }
}

export const db: NaijaShopDB = new NaijaShopDB();

export const initSettings = async () => {
  const settings = await db.settings.get('app_settings');
  if (!settings) {
    await db.settings.add({
      id: 'app_settings',
      shop_name: '',
      admin_name: '',
      admin_pin: '',
      is_setup_complete: false,
      bank_name: 'Access Bank',
      account_number: '0123456789',
      account_name: 'NAIJA RETAIL STORE',
      last_used_timestamp: Date.now(),
      shop_address: '123 Business Way, Lagos',
      receipt_footer: 'Thanks for your patronage! No refund after payment.'
    });
  }
};
