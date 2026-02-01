import React, { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  PackagePlus, 
  Camera, 
  X, 
  AlertTriangle,
  Package,
  Trash,
  ShieldAlert,
  ChevronRight,
  Eye,
  EyeOff,
  TrendingUp,
  Banknote,
  Wallet,
  Coins,
  ArrowUp,
  ArrowDown,
  Layers,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Sparkles,
  Loader2,
  FileUp
} from 'lucide-react';
import { Product, View, Staff } from '../types';
import StockScanner from '../components/StockScanner';

interface InventoryProps {
  setView?: (view: View) => void;
  currentUser?: Staff | null;
  isStaffLock?: boolean;
}

const CATEGORIES = ['General', 'Electronics', 'Food & Drinks', 'Clothing', 'Health', 'Beauty', 'Home', 'Office', 'Other'];

const Inventory: React.FC<InventoryProps> = ({ setView, currentUser, isStaffLock = false }) => {
  const canEdit = currentUser?.role === 'Admin' || (currentUser?.role === 'Manager' && !isStaffLock);
  const isStaff = currentUser?.role === 'Sales';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showValuation, setShowValuation] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'low'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isLocalScannerOpen, setIsLocalScannerOpen] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<number>(0);
  const [restockType, setRestockType] = useState<'add' | 'remove' | 'set'>('add');
  
  const [bulkTarget, setBulkTarget] = useState<'all' | 'category'>('all');
  const [bulkCategory, setBulkCategory] = useState('General');
  const [bulkType, setBulkType] = useState<'percent' | 'fixed'>('percent');
  const [bulkValue, setBulkValue] = useState<number>(0);
  const [bulkDirection, setBulkDirection] = useState<'increase' | 'decrease'>('increase');
  const [isProcessing, setIsProcessing] = useState(false);

  const allProducts = useLiveQuery(() => db.products.toArray()) || [];
  const parkedOrders = useLiveQuery(() => db.parked_orders.toArray()) || [];

  const reservedMap = useMemo(() => {
    const map: Record<number, number> = {};
    parkedOrders.forEach(order => {
      order.items.forEach(item => {
        map[item.productId] = (map[item.productId] || 0) + item.quantity;
      });
    });
    return map;
  }, [parkedOrders]);

  const products = useMemo(() => {
    let base = stockFilter === 'low' ? allProducts.filter(p => p.stock_qty <= (p.low_stock_threshold || 5)) : allProducts;
    if (!searchTerm.trim()) return base;
    const term = searchTerm.toLowerCase();
    return base.filter(p => p.name.toLowerCase().includes(term) || p.barcode?.includes(term));
  }, [allProducts, searchTerm, stockFilter]);

  const valuation = useMemo(() => {
    const totals = { totalCost: 0, totalSelling: 0, expectedProfit: 0 };
    allProducts.forEach(p => {
      const totalQty = (p.stock_qty || 0) + (reservedMap[p.id!] || 0);
      totals.totalCost += (p.cost_price * totalQty);
      totals.totalSelling += (p.price * totalQty);
    });
    totals.expectedProfit = totals.totalSelling - totals.totalCost;
    return totals;
  }, [allProducts, reservedMap]);

  const formatCurrency = (val: number, sensitive: boolean = true) => {
    if (sensitive && !showValuation) return "₦ ****";
    return `₦${Math.floor(val).toLocaleString()}`;
  };

  const [formData, setFormData] = useState<Product>({
    name: '', price: 0, cost_price: 0, stock_qty: 0, category: 'General', low_stock_threshold: 5
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct?.id) {
      await db.products.update(editingProduct.id, { ...formData });
    } else {
      await db.products.add({ ...formData });
    }
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Stock Inventory</h3>
          <p className="text-sm text-slate-500 font-medium">Manage and monitor your shop products</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {!isStaff && (
            <button onClick={() => setShowValuation(!showValuation)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all font-black text-xs uppercase tracking-widest ${showValuation ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>
              {showValuation ? <EyeOff size={18} /> : <Eye size={18} />}
              {showValuation ? 'Hide Valuation' : 'Show Valuation'}
            </button>
          )}
          {canEdit && (
            <button onClick={() => { setEditingProduct(null); setFormData({ name: '', price: 0, cost_price: 0, stock_qty: 0, category: 'General', low_stock_threshold: 5 }); setIsModalOpen(true); }} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl">
              <Plus size={20} className="inline mr-1" /> New Item
            </button>
          )}
        </div>
      </div>

      {!isStaff && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"><Wallet size={24} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Stock Cost</p>
              <p className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(valuation.totalCost)}</p>
            </div>
          </div>
          <div className="bg-emerald-600 p-6 rounded-[2.5rem] shadow-lg flex items-center gap-5">
            <div className="w-14 h-14 bg-white/20 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg"><TrendingUp size={24} /></div>
            <div>
              <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">Total Stock Value</p>
              <p className="text-xl font-black text-white tracking-tight">{formatCurrency(valuation.totalSelling)}</p>
            </div>
          </div>
          <div className="bg-amber-500 p-6 rounded-[2.5rem] shadow-lg flex items-center gap-5">
            <div className="w-14 h-14 bg-white/20 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg"><Sparkles size={24} /></div>
            <div>
              <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">Expected Profit</p>
              <p className="text-xl font-black text-white tracking-tight">{formatCurrency(valuation.expectedProfit)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex shrink-0">
           <button onClick={() => setStockFilter('all')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${stockFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}><Layers size={14} /> All Products</button>
           <button onClick={() => setStockFilter('low')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${stockFilter === 'low' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}><AlertTriangle size={14} /> Low Stock</button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder="Search by name or barcode..." className="w-full pl-12 pr-4 h-14 bg-white border border-slate-200 rounded-2xl outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200"><ShoppingBag size={48} className="mx-auto text-slate-100" /></div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:border-emerald-200 transition-all">
              <div>
                <span className="text-[9px] font-black px-2.5 py-1 bg-slate-100 rounded-full text-slate-500 uppercase tracking-widest">{product.category}</span>
                <h4 className="font-black text-slate-800 line-clamp-2 leading-tight min-h-[2.5rem] mt-4">{product.name}</h4>
                <div className="mt-4">
                  <p className="text-2xl font-black text-slate-900 tracking-tighter">₦{product.price.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock: <span className="text-emerald-600 font-black">{product.stock_qty} Units</span></p>
                </div>
              </div>
              {canEdit && (
                <div className="mt-6 pt-6 border-t border-slate-100 flex gap-2">
                  <button onClick={() => { setEditingProduct(product); setFormData(product); setIsModalOpen(true); }} className="flex-1 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] uppercase">Edit</button>
                  <button onClick={async () => { if(confirm("Delete item?")) await db.products.delete(product.id!); }} className="p-2.5 text-slate-400 hover:text-rose-600"><Trash2 size={18} /></button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl p-8 animate-in zoom-in">
            <h3 className="text-xl font-black text-slate-900 mb-6">{editingProduct ? 'Edit Product' : 'Add New Inventory'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required type="text" placeholder="Product Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input required type="number" placeholder="Selling Price (₦)" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                <input required type="number" placeholder="Cost Price (₦)" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" value={formData.cost_price || ''} onChange={e => setFormData({...formData, cost_price: Number(e.target.value)})} />
              </div>
              <input required type="number" placeholder="Stock Level" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" value={formData.stock_qty || ''} onChange={e => setFormData({...formData, stock_qty: Number(e.target.value)})} />
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg">Save Product</button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-2 text-slate-400 font-bold uppercase text-[10px]">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {isLocalScannerOpen && <StockScanner onClose={() => setIsLocalScannerOpen(false)} onConfirm={(p) => { db.products.bulkAdd(p); setIsLocalScannerOpen(false); }} />}
    </div>
  );
};

export default Inventory;