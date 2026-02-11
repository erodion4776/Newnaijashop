export interface Product {
  id?: number;
  name: string;
  price: number;
  cost_price: number;
  stock_qty: number;
  category: string;
  expiry_date?: string;
  barcode?: string;
  low_stock_threshold: number;
}

export interface InventoryLog {
  id?: number;
  product_id: number;
  product_name: string;
  quantity_changed: number;
  old_stock: number;
  new_stock: number;
  type: 'Restock' | 'Adjustment' | 'Sale' | 'Return' | 'Initial Stock' | 'Sync' | 'Manual';
  timestamp: number;
  performed_by: string;
}

export interface StockSnapshot {
  id?: number;
  date: string; // YYYY-MM-DD
  product_id: number;
  product_name: string;
  starting_qty: number;
  added_qty: number;
  sold_qty: number;
  closing_qty?: number;
}

export interface AuditEntry {
  id?: number;
  action: string;
  details: string;
  staff_name: string;
  timestamp: number;
}

export interface SaleItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  isStockAlreadyDeducted?: boolean;
}

export interface Sale {
  id?: number;
  sale_id: string;
  items: SaleItem[];
  total_amount: number;
  subtotal?: number;
  discount_amount: number;
  tax?: number;
  payment_method: 'cash' | 'transfer' | 'pos' | 'split' | 'Bank Transfer';
  cash_amount?: number;
  debt_amount?: number;
  wallet_amount_used?: number;
  wallet_amount_credited?: number;
  customer_phone?: string;
  staff_id: string;
  staff_name: string;
  timestamp: number;
  confirmed_by?: string;
  verification_timestamp?: number;
  sync_status?: 'pending' | 'synced' | 'verified';
}

export interface CustomerWallet {
  id?: number;
  phone: string;
  name?: string;
  balance: number;
  last_updated: number;
}

export interface WalletTransaction {
  id?: number;
  phone: string;
  amount: number;
  type: 'Credit' | 'Debit';
  timestamp: number;
  details?: string;
}

export interface Expense {
  id?: number;
  category: 'Fuel' | 'Rent' | 'Salary' | 'Others';
  amount: number;
  description: string;
  timestamp: number;
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

export interface UsedReference {
  id?: number;
  reference: string;
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
  terminal_id?: string;
  referral_code_used?: string;
  shop_name: string;
  admin_name: string;
  admin_pin: string;
  email: string;
  is_setup_complete: boolean;
  bank_name: string;
  account_number: string;
  account_name: string;
  last_used_timestamp: number;
  shop_address?: string;
  receipt_footer?: string;
  sync_key?: string;
  last_synced_timestamp?: number;
  license_key?: string;
  license_expiry?: number;
  installationDate?: number;
  isSubscribed?: boolean;
  // Fix: Added missing WhatsApp automation fields to resolve property missing errors in SecurityBackups.tsx
  admin_whatsapp_number?: string;
  whatsapp_group_link?: string;
}

export type View = 'landing' | 'setup' | 'dashboard' | 'pos' | 'inventory' | 'inventory-ledger' | 'debts' | 'settings' | 'staff-management' | 'activity-log' | 'security-backups' | 'transfer-station' | 'expense-tracker' | 'audit-trail' | 'customer-wallets' | 'business-hub' | 'activation' | 'stock-audit';

export type SyncStatus = 'offline' | 'connecting' | 'live' | 'reconnecting' | 'failed';