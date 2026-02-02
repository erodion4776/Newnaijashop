
import LZString from 'lz-string';
import { db } from '../db/db';

export const generateBackupData = async () => {
  const products = await db.products.toArray();
  const sales = await db.sales.toArray();
  const debts = await db.debts.toArray();
  const staff = await db.staff.toArray();
  const logs = await db.inventory_logs.toArray();
  const snapshots = await db.stock_snapshots.toArray();
  const settings = await db.settings.get('app_settings');

  const bundle = {
    products,
    sales,
    debts,
    staff,
    logs,
    snapshots,
    settings,
    timestamp: Date.now(),
    version: '3.1'
  };

  const jsonString = JSON.stringify(bundle);
  return LZString.compressToEncodedURIComponent(jsonString);
};

export const restoreFromBackup = async (compressedData: string) => {
  try {
    const jsonString = LZString.decompressFromEncodedURIComponent(compressedData);
    if (!jsonString) throw new Error("Invalid or corrupt backup data.");
    
    const data = JSON.parse(jsonString);

    await (db as any).transaction('rw', [db.products, db.sales, db.debts, db.staff, db.inventory_logs, db.settings, db.stock_snapshots], async () => {
      await db.products.clear();
      await db.sales.clear();
      await db.debts.clear();
      await db.staff.clear();
      await db.inventory_logs.clear();
      await db.settings.clear();
      await db.stock_snapshots.clear();

      if (data.products) await db.products.bulkAdd(data.products);
      if (data.sales) await db.sales.bulkAdd(data.sales);
      if (data.debts) await db.debts.bulkAdd(data.debts);
      if (data.staff) await db.staff.bulkAdd(data.staff);
      if (data.logs) await db.inventory_logs.bulkAdd(data.logs);
      if (data.snapshots) await db.stock_snapshots.bulkAdd(data.snapshots);
      if (data.settings) await db.settings.put(data.settings);
    });
    return true;
  } catch (err) {
    console.error("Restore error:", err);
    return false;
  }
};

export const performAutoSnapshot = async () => {
  const data = await generateBackupData();
  localStorage.setItem('naijashop_snapshot', data);
  localStorage.setItem('naijashop_snapshot_ts', Date.now().toString());
};

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
