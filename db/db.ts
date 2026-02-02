
import { Dexie } from 'dexie';
import type { Table } from 'dexie';
import { Product, Sale, Debt, Settings, ParkedOrder, InventoryLog, Staff, Expense, AuditEntry, CustomerWallet, WalletTransaction, UsedReference, StockSnapshot } from '../types';

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
  wallets!: Table<CustomerWallet>;
  wallet_transactions!: Table<WalletTransaction>;
  used_references!: Table<UsedReference>;
  stock_snapshots!: Table<StockSnapshot>;

  constructor() {
    super('NaijaShopDB');
    
    (this as any).version(28).stores({
      products: '++id, name, category, barcode',
      sales: '++id, sale_id, timestamp, payment_method, staff_name',
      debts: '++id, customer_name, phone, status',
      staff: '++id, name, role, status',
      settings: 'id',
      parked_orders: '++id, customerName, timestamp',
      inventory_logs: '++id, product_id, product_name, type, timestamp',
      expenses: '++id, category, timestamp',
      audit_trail: '++id, action, staff_name, timestamp',
      wallets: '++id, phone, balance',
      wallet_transactions: '++id, phone, type, timestamp',
      used_references: '++id, &reference',
      stock_snapshots: '++id, date, product_id, [date+product_id]'
    });

    // REAL-TIME SNAPSHOT HOOKS
    this.sales.hook('creating', (primKey, obj, transaction) => {
      const today = new Date().toISOString().split('T')[0];
      obj.items.forEach(async (item) => {
        const snapshot = await this.stock_snapshots.where({ date: today, product_id: item.productId }).first();
        if (snapshot && snapshot.id) {
          await this.stock_snapshots.update(snapshot.id, { sold_qty: snapshot.sold_qty + item.quantity });
        }
      });
    });

    this.inventory_logs.hook('creating', (primKey, obj, transaction) => {
      if (obj.type === 'Restock' || (obj.type === 'Adjustment' && obj.quantity_changed > 0)) {
        const today = new Date().toISOString().split('T')[0];
        this.stock_snapshots.where({ date: today, product_id: obj.product_id }).first().then(snapshot => {
          if (snapshot && snapshot.id) {
            this.stock_snapshots.update(snapshot.id, { added_qty: snapshot.added_qty + Math.abs(obj.quantity_changed) });
          }
        });
      }
    });
  }
}

export const db: NaijaShopDB = new NaijaShopDB();

/**
 * Ensures today's stock records are prepared.
 * Run during Admin login or app init.
 */
export const initializeDailyStock = async () => {
  const today = new Date().toISOString().split('T')[0];
  const existing = await db.stock_snapshots.where('date').equals(today).first();
  
  if (!existing) {
    const allProducts = await db.products.toArray();
    const snapshots: StockSnapshot[] = allProducts.map(p => ({
      date: today,
      product_id: p.id!,
      product_name: p.name,
      starting_qty: p.stock_qty,
      added_qty: 0,
      sold_qty: 0
    }));
    await db.stock_snapshots.bulkAdd(snapshots);
    console.log(`[SNAPSHOT] Initialized ${snapshots.length} stock records for ${today}`);
  }
};

export const initSettings = async () => {
  const settings = await db.settings.get('app_settings');
  if (!settings) {
    await db.settings.add({
      id: 'app_settings',
      shop_name: '',
      admin_name: '',
      admin_pin: '',
      email: '',
      is_setup_complete: false,
      bank_name: 'Access Bank',
      account_number: '0123456789',
      account_name: 'NAIJA RETAIL STORE',
      last_used_timestamp: Date.now(),
      shop_address: '123 Business Way, Lagos',
      receipt_footer: 'Thanks for your patronage! No refund after payment.'
    });
  }
  // Trigger daily stock initialization
  await initializeDailyStock();
};
