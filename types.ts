
export interface Product {
  id?: number;
  name: string;
  price: number;
  cost_price: number;
  stock_qty: number;
  category: string;
  expiry_date?: string;
  barcode?: string;
  low_stock_threshold: number; // New field for alerts
}

export interface InventoryLog {
  id?: number;
  product_id: number;
  product_name: string;
  quantity_changed: number;
  old_stock: number;
  new_stock: number;
  type: 'Restock' | 'Adjustment' | 'Sale' | 'Return' | 'Initial Stock';
  timestamp: number;
  performed_by: string;
}

export interface SaleItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id?: number;
  sale_id: string; // Unique UUID for deduplication
  items: SaleItem[];
  total_amount: number;
  payment_method: 'cash' | 'transfer' | 'pos' | 'split' | 'Bank Transfer';
  cash_amount?: number;
  debt_amount?: number;
  staff_id: string;
  staff_name: string; // Name of staff for the activity log
  timestamp: number;
  sync_status: 'pending' | 'synced' | 'verified';
  confirmed_by?: string;
  verification_timestamp?: number;
}

export interface ParkedOrder {
  id?: number;
  customerName: string;
  items: SaleItem[];
  total: number;
  staffId: string;
  timestamp: number;
}

export interface Debt {
  id?: number;
  customer_name: string;
  phone: string;
  amount: number;
  status: 'pending' | 'paid';
  timestamp: number;
}

export interface Staff {
  id?: number;
  name: string;
  role: 'Sales' | 'Manager' | 'Admin';
  password: string;
  status: 'Active' | 'Inactive';
  created_at: number;
}

export interface Settings {
  id: string; // 'app_settings'
  license_key: string;
  shop_name: string;
  admin_name: string;
  admin_pin: string;
  sync_key: string; // Used for encrypting WhatsApp data bridge strings
  is_setup_complete: boolean;
  bank_name: string;
  account_number: string;
  account_name: string;
  last_used_timestamp: number;
  last_synced_timestamp: number;
}

export type View = 'dashboard' | 'pos' | 'inventory' | 'inventory-ledger' | 'debts' | 'settings' | 'ai-insights' | 'transfer-station' | 'sync' | 'staff-management' | 'activity-log';

export type SyncStatus = 'offline' | 'connecting' | 'live' | 'reconnecting' | 'failed';

export interface SyncSession {
  id: string;
  initiator: boolean;
  timestamp: number;
}
