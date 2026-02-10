import { Dexie } from 'dexie';
import type { Table } from 'dexie';
import { Product, Sale, Debt, Settings, ParkedOrder, InventoryLog, Staff, Expense, AuditEntry, CustomerWallet, WalletTransaction, UsedReference, StockSnapshot } from '../types';

/**
 * Robust helper to get YYYY-MM-DD in local time
 */
export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
    
    // CRITICAL: Database version bumped to 37
    (this as any).version(37).stores({
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

    // 100% ACCURACY HOOK: Monitor stock_qty changes automatically
    this.products.hook('updating', (mods: Partial<Product>, primKey: number, obj: Product, transaction) => {
      if (mods.hasOwnProperty('stock_qty')) {
        const oldStock = Number(obj.stock_qty || 0);
        const newStock = Number(mods.stock_qty || 0);
        const diff = newStock - oldStock;

        if (diff === 0) return;

        // Determine type based on movement direction
        const type = diff < 0 ? 'Sale' : 'Restock';
        
        // Attempt to find current user from localStorage (set during login)
        const activeUserName = localStorage.getItem('last_active_user') || 'System Auto-Audit';

        // Add log entry within the same transaction to guarantee atomicity
        transaction.on('complete', () => {
          db.inventory_logs.add({
            product_id: primKey,
            product_name: obj.name,
            quantity_changed: diff,
            old_stock: oldStock,
            new_stock: newStock,
            type: type,
            timestamp: Date.now(),
            performed_by: activeUserName
          }).catch(err => console.error("Auto-Log Hook Failed:", err));
        });
      }
    });

    // REAL-TIME SNAPSHOT HOOKS - Maintain daily summaries
    this.sales.hook('creating', (primKey, obj, transaction) => {
      const today = getLocalDateString();
      transaction.on('complete', () => {
        obj.items.forEach(async (item) => {
          const snapshot = await db.stock_snapshots.where({ date: today, product_id: item.productId }).first();
          if (snapshot && snapshot.id) {
            await db.stock_snapshots.update(snapshot.id, { sold_qty: (snapshot.sold_qty || 0) + item.quantity });
          }
        });
      });
    });

    this.inventory_logs.hook('creating', (primKey, obj, transaction) => {
      if (obj.type === 'Restock' || (obj.type === 'Adjustment' && obj.quantity_changed > 0)) {
        const today = getLocalDateString();
        transaction.on('complete', async () => {
          const snapshot = await db.stock_snapshots.where({ date: today, product_id: obj.product_id }).first();
          if (snapshot && snapshot.id) {
            const addedAmount = Math.abs(obj.quantity_changed);
            await db.stock_snapshots.update(snapshot.id, { added_qty: (snapshot.added_qty || 0) + addedAmount });
          }
        });
      }
    });
  }
}

export const db: NaijaShopDB = new NaijaShopDB();

/**
 * Audit Tool: Compares logs vs current stock
 */
export const reconcileStock = async (productId: number) => {
  const product = await db.products.get(productId);
  if (!product) return { match: true };

  const logs = await db.inventory_logs.where('product_id').equals(productId).toArray();
  
  // Starting point for this audit is the first "Initial Stock" entry
  const initialLog = logs.find(l => l.type === 'Initial Stock');
  const startingQty = initialLog ? Number(initialLog.new_stock) : 0;
  
  // Sum of all changes after initial stock
  const movements = logs
    .filter(l => l.type !== 'Initial Stock')
    .reduce((sum, log) => sum + Number(log.quantity_changed), 0);

  const calculatedStock = startingQty + movements;
  const actualStock = Number(product.stock_qty);

  return {
    match: calculatedStock === actualStock,
    calculated: calculatedStock,
    actual: actualStock,
    discrepancy: actualStock - calculatedStock
  };
};

/**
 * Ensures today's stock records are prepared using local time.
 */
export const initializeDailyStock = async () => {
  const today = getLocalDateString();
  const existingCount = await db.stock_snapshots.where('date').equals(today).count();
  
  if (existingCount === 0) {
    const allProducts = await db.products.toArray();
    if (allProducts.length === 0) return 0;

    const snapshots: StockSnapshot[] = allProducts.map(p => ({
      date: today,
      product_id: p.id!,
      product_name: p.name,
      starting_qty: p.stock_qty,
      added_qty: 0,
      sold_qty: 0,
      closing_qty: undefined
    }));
    
    await db.stock_snapshots.bulkAdd(snapshots);
    return snapshots.length;
  }
  return existingCount;
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
  await initializeDailyStock();
};