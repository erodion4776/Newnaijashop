import LZString from 'lz-string';
import { db } from '../db/db';

/**
 * Packs all shop data into a compressed string for backup/sharing.
 */
export const generateBackupData = async () => {
  const products = await db.products.toArray();
  const sales = await db.sales.toArray();
  const debts = await db.debts.toArray();
  const staff = await db.staff.toArray();
  const logs = await db.inventory_logs.toArray();
  const snapshots = await db.stock_snapshots.toArray();
  const settings = await db.settings.get('app_settings');
  const expenses = await db.expenses.toArray();
  const audit = await db.audit_trail.toArray();
  const wallets = await db.wallets.toArray();
  const wallet_tx = await db.wallet_transactions.toArray();
  const refs = await db.used_references.toArray();

  const bundle = {
    products,
    sales,
    debts,
    staff,
    logs,
    snapshots,
    settings,
    expenses,
    audit,
    wallets,
    wallet_tx,
    refs,
    timestamp: Date.now(),
    version: '3.3'
  };

  const jsonString = JSON.stringify(bundle);
  return LZString.compressToEncodedURIComponent(jsonString);
};

/**
 * ATOMIC RECOVERY ENGINE
 * Wipes current terminal and injects backup data.
 */
export const restoreFromBackup = async (compressedData: string): Promise<boolean> => {
  try {
    const jsonString = LZString.decompressFromEncodedURIComponent(compressedData);
    if (!jsonString) return false;
    
    const data = JSON.parse(jsonString);

    // Run within a transaction for absolute safety
    await (db as any).transaction('rw', [
      db.products, db.sales, db.debts, db.staff, 
      db.inventory_logs, db.settings, db.stock_snapshots,
      db.wallets, db.wallet_transactions, db.used_references,
      db.parked_orders, db.expenses, db.audit_trail
    ], async () => {
      // STEP 1: WIPE CURRENT STATE
      await Promise.all([
        db.products.clear(),
        db.sales.clear(),
        db.debts.clear(),
        db.staff.clear(),
        db.inventory_logs.clear(),
        db.settings.clear(),
        db.stock_snapshots.clear(),
        db.wallets.clear(),
        db.wallet_transactions.clear(),
        db.used_references.clear(),
        db.parked_orders.clear(),
        db.expenses.clear(),
        db.audit_trail.clear()
      ]);

      // STEP 2: INJECT BACKUP DATA
      if (data.products?.length) await db.products.bulkAdd(data.products);
      if (data.sales?.length) await db.sales.bulkAdd(data.sales);
      if (data.debts?.length) await db.debts.bulkAdd(data.debts);
      if (data.staff?.length) await db.staff.bulkAdd(data.staff);
      if (data.logs?.length) await db.inventory_logs.bulkAdd(data.logs);
      if (data.snapshots?.length) await db.stock_snapshots.bulkAdd(data.snapshots);
      if (data.settings) await db.settings.put(data.settings);
      
      // Handle optional/newer tables for backwards compatibility
      if (data.wallets?.length) await db.wallets.bulkAdd(data.wallets);
      if (data.wallet_tx?.length) await db.wallet_transactions.bulkAdd(data.wallet_tx);
      if (data.refs?.length) await db.used_references.bulkAdd(data.refs);
      if (data.expenses?.length) await db.expenses.bulkAdd(data.expenses);
      if (data.audit?.length) await db.audit_trail.bulkAdd(data.audit);
    });

    return true;
  } catch (err) {
    console.error("Critical Restore Failure:", err);
    return false;
  }
};

/**
 * Captures a local snapshot to localStorage for quick recovery
 */
export const performAutoSnapshot = async () => {
  const data = await generateBackupData();
  localStorage.setItem('naijashop_snapshot', data);
  localStorage.setItem('naijashop_snapshot_ts', Date.now().toString());
};

/**
 * Triggers a browser download of the .nshop backup file
 */
export const downloadBackupFile = async (shopName: string) => {
  const data = await generateBackupData();
  const blob = new Blob([data], { type: 'application/nshop' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NaijaShop_Backup_${shopName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.nshop`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};