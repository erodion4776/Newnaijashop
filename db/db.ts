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
    
    // CRITICAL: Database version bumped to 55 for WhatsApp Automation relocation
    (this as any).version(55).stores({
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

        const type = diff < 0 ? 'Sale' : 'Restock';
        const activeUserName = localStorage.getItem('last_active_user') || 'System Auto-Audit';

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
  }
}

export const db: NaijaShopDB = new NaijaShopDB();

export const reconcileStock = async (productId: number) => {
  const product = await db.products.get(productId);
  if (!product) return { match: true };
  const logs = await db.inventory_logs.where('product_id').equals(productId).toArray();
  const initialLog = logs.find(l => l.type === 'Initial Stock');
  const startingQty = initialLog ? Number(initialLog.new_stock) : 0;
  const movements = logs.filter(l => l.type !== 'Initial Stock').reduce((sum, log) => sum + Number(log.quantity_changed), 0);
  const calculatedStock = startingQty + movements;
  const actualStock = Number(product.stock_qty);
  return { match: calculatedStock === actualStock, calculated: calculatedStock, actual: actualStock, discrepancy: actualStock - calculatedStock };
};

export const initializeDailyStock = async () => {
  const today = getLocalDateString();
  const existingCount = await db.stock_snapshots.where('date').equals(today).count();
  if (existingCount === 0) {
    const allProducts = await db.products.toArray();
    if (allProducts.length === 0) return 0;
    const snapshots: StockSnapshot[] = allProducts.map(p => ({
      date: today, product_id: p.id!, product_name: p.name, starting_qty: p.stock_qty, added_qty: 0, sold_qty: 0, closing_qty: undefined
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
      receipt_footer: 'Thanks for your patronage! No refund after payment.',
      admin_whatsapp_number: '',
      whatsapp_group_link: ''
    });
  } else {
    // Ensure new fields exist even on legacy installations
    const updates: any = {};
    if (settings.admin_whatsapp_number === undefined) updates.admin_whatsapp_number = '';
    if (settings.whatsapp_group_link === undefined) updates.whatsapp_group_link = '';
    if (Object.keys(updates).length > 0) {
      await db.settings.update('app_settings', updates);
    }
  }
  await initializeDailyStock();
};