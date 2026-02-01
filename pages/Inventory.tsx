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
import { ScannedProduct } from '../utils/LocalVisionService';

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
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allProductsData = useLiveQuery(() => db.products.toArray());
  const allProducts = allProductsData || [];
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

  const lowStockItems = useMemo(() => {
    return allProducts.filter(p => p.stock_qty <= (p.low_stock_threshold || 5));
  }, [allProducts]);

  const products = useMemo(() => {
    let baseProducts = stockFilter === 'low' ? lowStockItems : allProducts;
    
    if (!searchTerm.trim()) return baseProducts;
    const term = searchTerm.toLowerCase();
    return baseProducts.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term) ||
      p.barcode?.includes(term)
    );
  }, [allProducts, lowStockItems, searchTerm, stockFilter]);

  const valuation = useMemo(() => {
    const totals = {
      totalCost: 0,
      totalSelling: 0,
      expectedProfit: 0
    };

    allProducts.forEach(p => {
      const reserved = reservedMap[p.id!] || 0;
      const totalQty = Number(p.stock_qty || 0) + reserved;
      const cost = Number(p.cost_price || 0);
      const price = Number(p.price || 0);

      totals.totalCost += (cost * totalQty);
      totals.totalSelling += (price * totalQty);
    });

    totals.expectedProfit = totals.totalSelling - totals.totalCost;
    return totals;
  }, [allProducts, reservedMap]);

  const formatCurrency = (val: number, sensitive: boolean = true) => {
    if (sensitive && !showValuation) return "₦ ****";
    return `₦${Math.floor(val).toLocaleString()}`;
  };

  const initialFormState: Product = {
    name: '',
    price: 0,
    cost_price: 0,
    stock_qty: 0,
    category: 'General',
    barcode: '',
    expiry_date: '',
    low_stock_threshold: 5
  };

  const [formData, setFormData] = useState<Product>(initialFormState);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingImportFile(file);
      setIsLocalScannerOpen(true);
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    
    try {
      if (editingProduct?.id) {
        const oldProduct = await db.products.get(editingProduct.id);
        const oldStock = oldProduct?.stock_qty || 0;
        const newStock = Number(formData.stock_qty);
        
        await db.products.update(editingProduct.id, {
          ...formData,
          price: Number(formData.price),
          cost_price: Number(formData.cost_price),
          stock_qty: newStock,
          low_stock_threshold: Number(formData.low_stock_threshold)
        });

        if (oldStock !== newStock) {
          await db.audit_trail.add({
            action: 'Stock Manually Adjusted',
            details: `Updated '${formData.name}' stock level from ${oldStock} to ${newStock} via product edit.`,
            staff_name: currentUser?.name || 'User',
            timestamp: Date.now()
          });

          await db.inventory_logs.add({
            product_id: editingProduct.id,
            product_name: formData.name,
            quantity_changed: newStock - oldStock,
            old_stock: oldStock,
            new_stock: newStock,
            type: 'Adjustment',
            timestamp: Date.now(),
            performed_by: currentUser?.name || 'User'
          });
        }
      } else {
        await (db as any).transaction('rw', [db.products, db.inventory_logs], async () => {
          const newId = await db.products.add({
            ...formData,
            price: Number(formData.price),
            cost_price: Number(formData.cost_price),
            stock_qty: Number(formData.stock_qty),
            low_stock_threshold: Number(formData.low_stock_threshold)
          });

          await db.inventory_logs.add({
            product_id: newId as number,
            product_name: formData.name,
            quantity_changed: Number(formData.stock_qty),
            old_stock: 0,
            new_stock: Number(formData.stock_qty),
            type: 'Initial Stock',
            timestamp: Date.now(),
            performed_by: currentUser?.name || 'User'
          });
        });
      }
      
      setIsModalOpen(false);
      setFormData(initialFormState);
      setEditingProduct(null);
    } catch (err) {
      alert("Error saving product: " + err);
    }
  };

  const handleBulkUpdate = async () => {
    if (bulkValue <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    
    const targetProducts = bulkTarget === 'all' 
      ? allProducts 
      : allProducts.filter(p => p.category === bulkCategory);

    if (targetProducts.length === 0) {
      alert("No products found to update.");
      return;
    }

    const confirmed = confirm(`You are about to update prices for ${targetProducts.length} products. This cannot be undone. Proceed?`);
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const updatedProducts = targetProducts.map(p => {
        let adjustment = 0;
        if (bulkType === 'percent') {
          adjustment = p.price * (bulkValue / 100);
        } else {
          adjustment = bulkValue;
        }

        let newPrice = bulkDirection === 'increase' ? p.price + adjustment : p.price - adjustment;
        newPrice = Math.round(newPrice / 50) * 50;
        
        return { ...p, price: Math.max(0, newPrice) };
      });

      await db.audit_trail.add({
        action: 'Bulk Price Update',
        details: `Bulk adjusted prices for ${targetProducts.length} items in ${bulkTarget === 'all' ? 'All categories' : bulkCategory}. Direction: ${bulkDirection}.`,
        staff_name: currentUser?.name || 'Admin',
        timestamp: Date.now()
      });

      await db.products.bulkPut(updatedProducts);
      
      await db.inventory_logs.add({
        product_id: 0,
        product_name: `Bulk Price Update: ${bulkTarget === 'all' ? 'All' : bulkCategory}`,
        quantity_changed: 0,
        old_stock: 0,
        new_stock: 0,
        type: 'Adjustment',
        timestamp: Date.now(),
        performed_by: currentUser?.name || 'Admin'
      });

      setIsBulkModalOpen(false);
      setBulkValue(0);
      alert("Prices updated successfully across terminal!");
    } catch (err) {
      alert("Update failed: " + err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct || !restockProduct.id || !canEdit) return;

    try {
      const oldStock = Number(restockProduct.stock_qty);
      let newStock: number;
      let change: number;

      switch (restockType) {
        case 'add':
          change = Math.abs(Number(restockQty));
          newStock = oldStock + change;
          break;
        case 'remove':
          change = -Math.abs(Number(restockQty));
          newStock = Math.max(0, oldStock + change);
          break;
        case 'set':
          newStock = Math.max(0, Number(restockQty));
          change = newStock - oldStock;
          break;
        default:
          newStock = oldStock;
          change = 0;
      }

      await db.audit_trail.add({
        action: 'Stock Manually Adjusted',
        details: `Quick adjusted '${restockProduct.name}' stock level (${restockType}: ${change}). New total: ${newStock}.`,
        staff_name: currentUser?.name || 'User',
        timestamp: Date.now()
      });

      await (db as any).transaction('rw', [db.products, db.inventory_logs], async () => {
        await db.products.update(restockProduct.id!, { stock_qty: newStock });
        await db.inventory_logs.add({
          product_id: restockProduct.id!,
          product_name: restockProduct.name,
          quantity_changed: change,
          old_stock: oldStock,
          new_stock: newStock,
          type: 'Restock',
          timestamp: Date.now(),
          performed_by: currentUser?.name || 'User'
        });
      });

      setIsRestockModalOpen(false);
      setRestockProduct(null);
      setRestockQty(0);
    } catch (err) {
      alert("Restock failed: " + err);
    }
  };

  const handleLocalScanConfirm = async (products: ScannedProduct[]) => {
    try {
      const productsToAdd = products.map(p => ({
        ...p,
        cost_price: Math.round((p.price * 0.8) / 50) * 50, // Default 20% margin
        category: 'General',
        low_stock_threshold: 5
      }));
      
      await db.products.bulkAdd(productsToAdd as Product[]);
      setIsLocalScannerOpen(false);
      setPendingImportFile(null);
      alert(`${products.length} items added to inventory!`);
    } catch (err) {
      alert("Error saving items: " + err);
    }
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
            <button 
              onClick={() => setShowValuation(!showValuation)} 
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all shadow-sm font-black text-xs uppercase tracking-widest ${showValuation ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {showValuation ? <EyeOff size={18} /> : <Eye size={18} />}
              {showValuation ? 'Hide Valuation' : 'Show Valuation'}
            </button>
          )}
          {canEdit && (
            <button 
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm font-black text-xs uppercase tracking-widest"
            >
              <TrendingUp size={18} /> Update Prices
            </button>
          )}
          {canEdit ? (
            <>
              <button 
                onClick={() => { setEditingProduct(null); setFormData(initialFormState); setIsModalOpen(true); }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
              >
                <Plus size={20} /> New Item
              </button>
              <button 
                onClick={() => { setPendingImportFile(null); setIsLocalScannerOpen(true); }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-indigo-600/20 hover:bg-indigo-700"
              >
                <Camera size={20} /> 
                <span className="hidden sm:inline">Scan Ledger</span>
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-xl shadow-slate-900/20 hover:bg-black"
              >
                <FileUp size={20} /> 
                <span className="hidden sm:inline">Upload File</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx,.xls,.csv,.docx,image/*"
                onChange={handleFileUpload} 
              />
            </>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-full text-amber-600">
              <ShieldAlert size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">View Only Mode</span>
            </div>
          )}
        </div>
      </div>

      {!isStaff && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Stock Cost</p>
              <p className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(valuation.totalCost)}</p>
            </div>
          </div>
          
          <div className="bg-emerald-600 p-6 rounded-[2.5rem] shadow-lg relative overflow-hidden flex items-center gap-5">
            <div className="absolute right-[-10px] top-[-10px] opacity-10">
              <Banknote size={80} />
            </div>
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
              <TrendingUp size={24} />
            </div>
            <div className="relative z-10">
              <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">Total Stock Value</p>
              <p className="text-xl font-black text-white tracking-tight">{formatCurrency(valuation.totalSelling)}</p>
            </div>
          </div>

          <div className="bg-amber-500 p-6 rounded-[2.5rem] shadow-lg relative overflow-hidden flex items-center gap-5">
            <div className="absolute right-[-10px] top-[-10px] opacity-10">
              <Coins size={80} />
            </div>
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
              <Sparkles size={24} />
            </div>
            <div className="relative z-10">
              <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">Expected Profit</p>
              <p className="text-xl font-black text-white tracking-tight">{formatCurrency(valuation.expectedProfit)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex shrink-0 shadow-sm">
           <button 
             onClick={() => setStockFilter('all')}
             className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${stockFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             <Layers size={14} /> All Products
           </button>
           <button 
             onClick={() => setStockFilter('low')}
             className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all relative ${stockFilter === 'low' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             <AlertTriangle size={14} /> Low Stock
             {lowStockItems.length > 0 && (
               <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[8px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white">
                 {lowStockItems.length}
               </span>
             )}
           </button>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, category or barcode..." 
            className="w-full pl-12 pr-4 h-14 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200 space-y-4">
             <ShoppingBag size={48} className="mx-auto text-slate-100" />
             <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No products found in this view</p>
             {searchTerm && <button onClick={() => setSearchTerm('')} className="text-emerald-600 font-black text-[10px] uppercase">Clear Search</button>}
          </div>
        ) : (
          products.map((product) => {
            const reserved = reservedMap[product.id!] || 0;
            const isLowStock = product.stock_qty <= (product.low_stock_threshold || 5);
            const isSoldOut = product.stock_qty === 0;

            return (
              <div key={product.id} className={`bg-white p-6 rounded-[2.5rem] border ${isLowStock ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'} shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition-all`}>
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[9px] font-black px-2.5 py-1 bg-slate-100 rounded-full text-slate-500 uppercase tracking-widest border border-slate-200">{product.category}</span>
                    <div className="flex gap-1">
                      {reserved > 0 && (
                        <div className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 bg-amber-500 text-white rounded-full uppercase tracking-widest" title={`${reserved} units are currently held in parked orders.`}>
                          <Clock size={10} /> {reserved} Parked
                        </div>
                      )}
                      {isSoldOut ? (
                        <span className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 bg-slate-900 text-white rounded-full uppercase tracking-widest">
                          Sold Out
                        </span>
                      ) : isLowStock && (
                        <span className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 bg-rose-600 text-white rounded-full uppercase tracking-widest animate-pulse">
                          <AlertTriangle size={10} /> Low
                        </span>
                      )}
                    </div>
                  </div>
                  <h4 className="font-black text-slate-800 line-clamp-2 leading-tight min-h-[2.5rem]">{product.name}</h4>
                  <div className="mt-4 space-y-1">
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">₦{product.price.toLocaleString()}</p>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Stock Available</span>
                      <span className={`flex items-center gap-1 font-black ${isLowStock ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isLowStock && !isSoldOut && <AlertTriangle size={10} />}
                        {product.stock_qty} Units
                      </span>
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <div className="mt-6 pt-6 border-t border-slate-100 flex gap-2">
                    <button 
                      onClick={() => { setRestockProduct(product); setIsRestockModalOpen(true); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                      <PackagePlus size={14} /> Update
                    </button>
                    <button 
                      onClick={() => { setEditingProduct(product); setFormData(product); setIsModalOpen(true); }}
                      className="p-2.5 text-slate-400 hover:text-blue-600 transition-all"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => { setDeleteProduct(product); setIsDeleteModalOpen(true); }}
                      className="p-2.5 text-slate-400 hover:text-rose-600 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{editingProduct ? 'Edit Product Details' : 'Add New Inventory'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[80vh] scrollbar-hide">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Product Name</label>
                  <input required type="text" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Selling Price (₦)</label>
                  <input required type="number" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Cost Price (₦)</label>
                  <input required type="number" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.cost_price || ''} onChange={e => setFormData({...formData, cost_price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Initial Stock</label>
                  <input required type="number" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.stock_qty || ''} onChange={e => setFormData({...formData, stock_qty: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Category</label>
                  <select className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Low Stock Threshold</label>
                  <input required type="number" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.low_stock_threshold || ''} onChange={e => setFormData({...formData, low_stock_threshold: Number(e.target.value)})} />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl hover:bg-emerald-700 transition-all mt-4">Save Product Information</button>
            </form>
          </div>
        </div>
      )}

      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-md space-y-8 animate-in zoom-in duration-300">
            <div className="flex items-center justify-between">
               <h3 className="text-2xl font-black text-slate-900 tracking-tight">Bulk Price Adjuster</h3>
               <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setBulkTarget('all')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${bulkTarget === 'all' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                >
                  All Products
                </button>
                <button 
                  onClick={() => setBulkTarget('category')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${bulkTarget === 'category' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                >
                  By Category
                </button>
              </div>

              {bulkTarget === 'category' && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Target Category</label>
                  <select className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-400 font-bold" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl">
                 <button onClick={() => setBulkDirection('increase')} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${bulkDirection === 'increase' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}><ArrowUp size={14}/> Increase</button>
                 <button onClick={() => setBulkDirection('decrease')} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${bulkDirection === 'decrease' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}><ArrowDown size={14}/> Decrease</button>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjustment Value</label>
                  <div className="flex gap-2">
                    <button onClick={() => setBulkType('percent')} className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${bulkType === 'percent' ? 'bg-slate-200 text-slate-800' : 'text-slate-400'}`}>%</button>
                    <button onClick={() => setBulkType('fixed')} className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${bulkType === 'fixed' ? 'bg-slate-200 text-slate-800' : 'text-slate-400'}`}>₦</button>
                  </div>
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    className="w-full h-16 text-3xl font-black text-center bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-400 transition-all tabular-nums"
                    value={bulkValue || ''}
                    onChange={e => setBulkValue(Number(e.target.value))}
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">
                    {bulkType === 'percent' ? '%' : '₦'}
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase text-center mt-3 tracking-widest">Prices will be rounded to nearest ₦50</p>
              </div>
            </div>

            <button 
              onClick={handleBulkUpdate}
              disabled={isProcessing}
              className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
              Apply Bulk Changes
            </button>
          </div>
        </div>
      )}

      {isRestockModalOpen && restockProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm space-y-8 animate-in zoom-in duration-300">
            <div className="text-center space-y-2">
               <h3 className="text-2xl font-black text-slate-900 tracking-tight">Quick Update</h3>
               <p className="text-slate-500 font-medium text-sm">{restockProduct.name}</p>
            </div>
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
               {(['add', 'remove', 'set'] as const).map(type => (
                 <button key={type} onClick={() => setRestockType(type)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${restockType === type ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>{type}</button>
               ))}
            </div>
            <input 
              autoFocus
              type="number" 
              className="w-full h-24 text-5xl font-black text-center bg-slate-50 border-2 border-slate-200 rounded-[2.5rem] outline-none focus:border-emerald-500 transition-all tabular-nums"
              value={restockQty || ''}
              onChange={e => setRestockQty(Number(e.target.value))}
            />
            <button onClick={handleRestockSubmit} className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black shadow-xl">Apply Changes</button>
            <button onClick={() => setIsRestockModalOpen(false)} className="w-full py-2 text-slate-400 font-bold text-xs uppercase tracking-widest">Cancel</button>
          </div>
        </div>
      )}

      {isDeleteModalOpen && deleteProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
           <div className="bg-white p-10 rounded-[3rem] text-center space-y-8 w-full max-w-sm animate-in zoom-in">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto"><Trash size={40} /></div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Remove Item?</h3>
                <p className="text-slate-500 text-sm font-medium">Permanently delete <b>{deleteProduct.name}</b> from terminal?</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                <button onClick={async () => { await db.products.delete(deleteProduct.id!); setIsDeleteModalOpen(false); }} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Confirm</button>
              </div>
           </div>
        </div>
      )}

      {isLocalScannerOpen && (
        <StockScanner 
          initialFile={pendingImportFile}
          onConfirm={handleLocalScanConfirm} 
          onClose={() => { setIsLocalScannerOpen(false); setPendingImportFile(null); }} 
        />
      )}
    </div>
  );
};

export default Inventory;