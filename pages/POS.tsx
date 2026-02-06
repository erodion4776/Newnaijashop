import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  Package,
  Camera,
  Grid3x3,
  List,
  X,
  CheckCircle2,
  Clock,
  Edit2,
  Save,
  ChevronRight,
  Calculator,
  Wallet,
  CreditCard,
  Building2,
  User,
  AlertCircle,
  Loader2,
  ParkingCircle,
  RotateCcw,
  Percent,
  TrendingDown,
  History
} from 'lucide-react';
import { Product, SaleItem, Staff, View, ParkedOrder } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import CheckoutModal from '../components/CheckoutModal';
import SmartSupportChat from '../components/SupportChat';

interface POSProps {
  setView: (view: View) => void;
  currentUser: Staff | null;
  cart: SaleItem[];
  setCart: React.Dispatch<React.SetStateAction<SaleItem[]>>;
  parkTrigger?: number;
}

const POS: React.FC<POSProps> = ({ setView, currentUser, cart, setCart, parkTrigger }) => {
  // ==================== STATE MANAGEMENT ====================
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showScanner, setShowScanner] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showParkedOrders, setShowParkedOrders] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  
  const [parkingCustomerName, setParkingCustomerName] = useState('');
  const [showParkModal, setShowParkModal] = useState(false);
  
  const [editingParkedOrder, setEditingParkedOrder] = useState<ParkedOrder | null>(null);
  const [editingCart, setEditingCart] = useState<SaleItem[]>([]);
  const [editSearchTerm, setEditSearchTerm] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ==================== DATA FETCHING ====================
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const parkedOrders = useLiveQuery(() => db.parked_orders.toArray()) || [];

  // ==================== SYNC WITH EXTERNAL TRIGGERS ====================
  useEffect(() => {
    if (parkTrigger && parkTrigger > 0 && cart.length > 0) {
      setShowParkModal(true);
    }
  }, [parkTrigger]);

  // ==================== COMPUTED VALUES ====================
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.barcode?.includes(term) ||
        p.category?.toLowerCase().includes(term)
      );
    }
    
    return filtered.filter(p => p.stock_qty > 0);
  }, [products, selectedCategory, searchTerm]);

  // DERIVED: Search for items INSIDE the edit modal
  const editModalSearchResults = useMemo(() => {
    if (!editSearchTerm.trim()) return [];
    const term = editSearchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.barcode?.includes(term)
    ).slice(0, 5); // Performance/UI limit
  }, [products, editSearchTerm]);

  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;
    
    if (discountValue > 0) {
      discount = discountType === 'percent' 
        ? (subtotal * discountValue / 100) 
        : discountValue;
    }
    
    const total = subtotal - discount;
    
    return {
      subtotal,
      discount,
      total: Math.max(0, total),
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0)
    };
  }, [cart, discountType, discountValue]);

  // ==================== CART ACTIONS ====================
  const addToCart = (product: Product, quantity: number = 1) => {
    const existing = cart.find(item => item.productId === product.id);
    
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.stock_qty) {
        alert(`Only ${product.stock_qty} units available in stock`);
        return;
      }
      
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: newQty }
          : item
      ));
    } else {
      if (quantity > product.stock_qty) {
        alert(`Only ${product.stock_qty} units available in stock`);
        return;
      }
      
      setCart([...cart, {
        productId: product.id!,
        name: product.name,
        price: product.price,
        quantity: quantity
      }]);
    }
    
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock_qty) {
      alert(`Only ${product.stock_qty} units available`);
      return;
    }
    
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm('Clear all items from cart?')) {
      setCart([]);
      setDiscountValue(0);
    }
  };

  const handleParkOrder = () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }
    setShowParkModal(true);
  };

  const confirmParkOrder = async () => {
    if (!parkingCustomerName.trim()) {
      alert('Please enter customer name');
      return;
    }
    
    try {
      await (db as any).transaction('rw', [db.products, db.inventory_logs, db.parked_orders], async () => {
        const itemsToSave: SaleItem[] = [];
        
        for (const item of cart) {
          const product = await db.products.get(item.productId);
          if (!product) continue;

          if (!item.isStockAlreadyDeducted) {
            const oldStock = Number(product.stock_qty || 0);
            const soldQty = Number(item.quantity || 0);
            if (oldStock < soldQty) throw new Error(`Insufficient stock for ${product.name}`);
            
            const newStock = Math.max(0, oldStock - soldQty);
            await db.products.update(item.productId, { stock_qty: newStock });
            
            await db.inventory_logs.add({
              product_id: item.productId,
              product_name: product.name,
              quantity_changed: -soldQty,
              old_stock: oldStock,
              new_stock: newStock,
              type: 'Adjustment',
              timestamp: Date.now(),
              performed_by: `Parking: ${currentUser?.name || 'Staff'}`
            });
            
            itemsToSave.push({ ...item, isStockAlreadyDeducted: true });
          } else {
            itemsToSave.push({ ...item });
          }
        }

        await db.parked_orders.add({
          customerName: parkingCustomerName,
          items: itemsToSave,
          total: cartSummary.total,
          staffId: currentUser?.id?.toString() || '0',
          timestamp: Date.now()
        });
      });
      
      setCart([]);
      setDiscountValue(0);
      setParkingCustomerName('');
      setShowParkModal(false);
      setShowMobileCart(false);
      alert('Order parked & stock secured!');
    } catch (err) {
      console.error("Park order error:", err);
      alert(`Failed to park order: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const loadParkedOrder = (order: ParkedOrder) => {
    if (cart.length > 0) {
      if (!confirm('Current cart will be replaced. Continue?')) return;
    }
    setCart([...order.items]);
    setShowParkedOrders(false);
    setShowMobileCart(true);
  };

  const editParkedOrder = (order: ParkedOrder) => {
    setEditingParkedOrder(order);
    setEditingCart([...order.items]);
    setEditSearchTerm('');
  };

  const deleteParkedOrder = async (orderId: number) => {
    if (!confirm('Delete this parked order?')) return;
    try {
      await db.parked_orders.delete(orderId);
      alert('Order deleted');
    } catch (err) {
      alert('Failed to delete order');
    }
  };

  /**
   * SMART STOCK ENGINE: Handles reconciliation of stock during modal edits
   */
  const saveEditedParkedOrder = async () => {
    if (!editingParkedOrder?.id) return;
    try {
      await (db as any).transaction('rw', [db.products, db.inventory_logs, db.parked_orders], async () => {
        const originalItems = editingParkedOrder.items;
        const newItems = editingCart;

        // 1. Create maps for easy diffing
        const originalMap: Record<number, number> = {};
        originalItems.forEach(i => originalMap[i.productId] = (originalMap[i.productId] || 0) + i.quantity);

        const newMap: Record<number, number> = {};
        // Fix: Use i.productId instead of undefined variable 'pid'
        newItems.forEach(i => newMap[i.productId] = (newMap[i.productId] || 0) + i.quantity);

        // 2. Identify all Product IDs involved
        const allProductIds = Array.from(new Set([
          ...originalItems.map(i => i.productId),
          ...newItems.map(i => i.productId)
        ]));

        // 3. Reconcile differences
        for (const pid of allProductIds) {
          const oldQty = originalMap[pid] || 0;
          const newQty = newMap[pid] || 0;
          const diff = newQty - oldQty; // Positive means we added items, negative means we removed items

          if (diff !== 0) {
            const product = await db.products.get(pid);
            if (!product) continue;

            const currentStock = Number(product.stock_qty || 0);
            const updatedStock = currentStock - diff;

            if (updatedStock < 0) {
              throw new Error(`Insufficient stock for ${product.name}. Available: ${currentStock}, Needs: ${diff}`);
            }

            await db.products.update(pid, { stock_qty: updatedStock });

            await db.inventory_logs.add({
              product_id: pid,
              product_name: product.name,
              quantity_changed: -diff,
              old_stock: currentStock,
              new_stock: updatedStock,
              type: 'Adjustment',
              timestamp: Date.now(),
              performed_by: `Parked Order Updated: ${currentUser?.name || 'Staff'}`
            });
          }
        }

        // 4. Update the actual parked order record
        const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        await db.parked_orders.update(editingParkedOrder.id!, {
          items: newItems.map(i => ({ ...i, isStockAlreadyDeducted: true })),
          total: newTotal
        });
      });

      setEditingParkedOrder(null);
      setEditingCart([]);
      setEditSearchTerm('');
      alert('Parked order and inventory updated!');
    } catch (err) {
      alert(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product, 1);
    } else {
      alert('Product not found');
    }
  };

  const handleCheckoutComplete = (sale: any, lowItems: string[]) => {
    setCart([]);
    setDiscountValue(0);
    setShowCheckout(false);
    setShowMobileCart(false);
    if (lowItems.length > 0) {
      alert(`Sale completed! ⚠️ Low stock: ${lowItems.join(', ')}`);
    } else {
      alert('Sale completed successfully! ✅');
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 overflow-hidden relative">
      {/* STICKY TOP BAR */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 h-14 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            onClick={() => setShowParkedOrders(true)}
            className={`relative h-14 w-14 flex items-center justify-center bg-white border border-slate-200 rounded-xl transition-all shadow-sm active:scale-95 ${parkedOrders.length === 0 ? 'opacity-40' : 'opacity-100'}`}
          >
            <History size={24} className="text-slate-600" />
            {parkedOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-600 text-white text-[11px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {parkedOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowScanner(true)}
            className="h-14 w-14 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
          >
            <Camera size={24} />
          </button>

          <div className="hidden sm:flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>
              <Grid3x3 size={18} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>
              <List size={18} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((cat: string) => (
            <button 
              key={cat} 
              onClick={() => setSelectedCategory(cat)} 
              className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* PRODUCT LIST */}
        <div className="flex-1 overflow-y-auto p-4 pb-32 lg:pb-4 scrollbar-hide">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <Package size={64} className="text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold">No products found</p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3' : 'space-y-2'}>
              {filteredProducts.map(product => (
                <button 
                  key={product.id} 
                  onClick={() => addToCart(product, 1)} 
                  className={`group bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all active:scale-95 flex flex-col ${viewMode === 'grid' ? 'p-4 text-left' : 'p-3 flex-row items-center gap-3'}`}
                >
                  {viewMode === 'grid' ? (
                    <>
                      <div className="flex items-start justify-between mb-3 w-full">
                        <span className="text-[10px] font-black px-2 py-1 bg-slate-100 rounded-lg text-slate-500 uppercase truncate max-w-[70%]">{product.category}</span>
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
                          <Plus size={20} />
                        </div>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 line-clamp-2 mb-2 min-h-[2.5rem]">{product.name}</h4>
                      <div className="flex items-center justify-between mt-auto w-full">
                        <span className="text-lg font-black text-emerald-600">₦{product.price.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{product.stock_qty} left</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 text-left">
                        <h4 className="font-bold text-sm text-slate-800">{product.name}</h4>
                        <p className="text-xs text-slate-400 font-medium">{product.category} • {product.stock_qty} units</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-lg font-black text-emerald-600">₦{product.price.toLocaleString()}</span>
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                          <Plus size={20} />
                        </div>
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CART (Desktop Sidebar & Mobile Drawer) */}
        <div className={`
          lg:w-[400px] bg-white lg:border-l border-slate-200 flex flex-col h-full lg:h-auto 
          ${showMobileCart 
            ? 'fixed inset-0 z-[150] w-full animate-in slide-in-from-bottom duration-300' 
            : 'hidden lg:flex'
          }
        `}>
          <div className="p-6 border-b border-slate-100 shrink-0 bg-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} className="text-slate-600" />
                <h3 className="font-black text-xl">Current Sale</h3>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => setShowParkedOrders(true)} className="relative p-3 text-amber-600 hover:bg-amber-50 rounded-xl transition-all">
                  <ParkingCircle size={24} />
                  {parkedOrders.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{parkedOrders.length}</span>}
                </button>
                <button onClick={clearCart} className="p-3 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={24} /></button>
                <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-3 text-slate-400 hover:bg-slate-100 rounded-full transition-all ml-2">
                  <X size={32} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-bold uppercase tracking-widest">{cartSummary.itemCount} Items In Cart</span>
              {discountValue > 0 && <span className="text-[10px] bg-rose-100 text-rose-700 px-3 py-1 rounded-full font-black uppercase tracking-widest">{discountType === 'percent' ? `${discountValue}%` : `₦${discountValue}`} Off</span>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-40">
                <ShoppingCart size={80} className="text-slate-200 mb-4" />
                <p className="text-slate-400 font-black uppercase tracking-widest">Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="bg-slate-50 rounded-3xl p-4 flex items-center gap-4 group hover:bg-slate-100 transition-all">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-slate-800 truncate">{item.name}</h4>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">₦{item.price.toLocaleString()} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm active:scale-90"><Minus size={18} /></button>
                    <span className="w-8 text-center font-black text-lg tabular-nums">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm active:scale-90"><Plus size={18} /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.productId)} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={20} /></button>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-6 border-t border-slate-100 space-y-4 shrink-0 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              <button onClick={() => setShowDiscount(!showDiscount)} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3"><TrendingDown size={18} className="text-amber-600" /><span className="text-sm font-black uppercase tracking-widest">Apply Discount</span></div>
                <ChevronRight size={18} className={`transition-transform duration-300 ${showDiscount ? 'rotate-90' : ''}`} />
              </button>
              
              {showDiscount && (
                <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-5 space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex gap-2">
                    <button onClick={() => setDiscountType('percent')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${discountType === 'percent' ? 'bg-amber-600 text-white shadow-lg shadow-amber-200' : 'bg-white text-amber-600'}`}>% Percent</button>
                    <button onClick={() => setDiscountType('fixed')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest ${discountType === 'fixed' ? 'bg-amber-600 text-white shadow-lg shadow-amber-200' : 'bg-white text-amber-600'}`}>₦ Fixed</button>
                  </div>
                  <input type="number" value={discountValue || ''} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} className="w-full px-6 py-4 text-center text-3xl font-black bg-white border border-amber-200 rounded-2xl outline-none focus:ring-4 focus:ring-amber-200" placeholder="0" />
                </div>
              )}
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-slate-500 font-bold uppercase text-[10px] tracking-widest"><span>Subtotal</span><span>₦{cartSummary.subtotal.toLocaleString()}</span></div>
                {cartSummary.discount > 0 && <div className="flex justify-between items-center text-rose-600 font-black uppercase text-[10px] tracking-widest"><span>Discount</span><span>-₦{cartSummary.discount.toLocaleString()}</span></div>}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
                  <span className="text-slate-900 font-black uppercase text-xs tracking-[0.2em]">Payable Total</span>
                  <span className="text-3xl font-black text-emerald-600 tracking-tighter">₦{cartSummary.total.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button onClick={handleParkOrder} className="py-5 bg-amber-50 text-amber-700 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-sm active:scale-95 transition-all">Park</button>
                <button onClick={() => setShowCheckout(true)} className="py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-200 active:scale-95 transition-all">Checkout</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE FLOATING CART BUTTON */}
      {cart.length > 0 && !showMobileCart && (
        <div className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-[140] w-[90%] max-w-sm px-4">
          <button 
            onClick={() => setShowMobileCart(true)}
            className="w-full bg-emerald-600 text-white py-6 rounded-[2.5rem] font-black text-lg shadow-[0_20px_50px_rgba(5,150,105,0.4)] flex items-center justify-center gap-3 active:scale-95 transition-all border-4 border-white/30 backdrop-blur-md"
          >
            <div className="relative">
              <ShoppingCart size={24} />
              <span className="absolute -top-3 -right-3 w-6 h-6 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {cartSummary.itemCount}
              </span>
            </div>
            <span className="ml-2 uppercase tracking-widest">View Cart</span>
            <span className="font-black text-emerald-100 ml-auto mr-2">₦{cartSummary.total.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* MODALS */}
      {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
      {showCheckout && <CheckoutModal isOpen={showCheckout} onClose={() => setShowCheckout(false)} cart={cart} total={cartSummary.total} currentUser={currentUser} onComplete={handleCheckoutComplete} />}
      
      {showParkModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in duration-300">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ParkingCircle size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Park Order</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Reserve current cart</p>
            </div>
            <input 
              autoFocus 
              type="text" 
              placeholder="Customer Name (e.g. Oga Chinedu)" 
              className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 focus:ring-amber-500" 
              value={parkingCustomerName} 
              onChange={e => setParkingCustomerName(e.target.value)} 
            />
            <button onClick={confirmParkOrder} className="w-full py-5 bg-amber-600 text-white rounded-[2rem] font-black shadow-xl shadow-amber-200 active:scale-95 transition-all">Secure Order</button>
            <button onClick={() => setShowParkModal(false)} className="w-full text-slate-400 font-black uppercase text-[10px] tracking-widest">Discard & Cancel</button>
          </div>
        </div>
      )}

      {showParkedOrders && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-right duration-300">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Parked Orders</h3>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1">Held transactions</p>
            </div>
            <button onClick={() => setShowParkedOrders(false)} className="p-4 bg-slate-50 rounded-full text-slate-400"><X size={32} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
            {parkedOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-30">
                <Clock size={80} className="text-slate-200 mb-4" />
                <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No parked orders found</p>
              </div>
            ) : (
              parkedOrders.map(order => (
                <div key={order.id} className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 shadow-sm hover:border-amber-200 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-black text-xl text-slate-800">{order.customerName}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(order.timestamp).toLocaleString()}</p>
                    </div>
                    <span className="font-black text-2xl text-amber-600 tracking-tighter">₦{order.total.toLocaleString()}</span>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => loadParkedOrder(order)} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">Load To Cart</button>
                    <button onClick={() => editParkedOrder(order)} className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all"><Edit2 size={20}/></button>
                    <button onClick={() => deleteParkedOrder(order.id!)} className="p-4 text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={20}/></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {editingParkedOrder && (
        <div className="fixed inset-0 z-[250] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Modify Saved Order</h3>
                <p className="text-xs text-amber-600 font-black uppercase tracking-widest mt-1">{editingParkedOrder.customerName}</p>
              </div>
              <button onClick={() => { setEditingParkedOrder(null); setEditingCart([]); setEditSearchTerm(''); }} className="p-4 bg-slate-50 rounded-full text-slate-400"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
              {/* CURRENT ITEMS SECTION */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Items In Order</h4>
                {editingCart.length === 0 ? (
                  <p className="text-center text-slate-400 font-black uppercase tracking-widest py-4 border border-dashed rounded-[2rem]">Order list is empty</p>
                ) : (
                  editingCart.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-[2rem] p-5 flex items-center gap-4 border border-slate-100 shadow-sm animate-in slide-in-from-left-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-slate-800 truncate">{item.name}</h4>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">₦{item.price.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { 
                          const u = [...editingCart]; 
                          if(u[idx].quantity > 1) {
                            u[idx].quantity--; 
                          } else {
                            u.splice(idx,1); 
                          }
                          setEditingCart(u); 
                        }} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-inner active:scale-90 transition-all"><Minus size={16}/></button>
                        <span className="w-6 text-center font-black text-lg">{item.quantity}</span>
                        <button onClick={() => { 
                          const product = products.find(p => p.id === item.productId);
                          if(product && product.stock_qty <= 0) { alert('No more stock available in inventory'); return; }
                          
                          const u = [...editingCart]; 
                          u[idx].quantity++; 
                          setEditingCart(u); 
                        }} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-inner active:scale-90 transition-all"><Plus size={16}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ADD MORE ITEMS SECTION */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Add more items to this order</h4>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search inventory..." 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                    value={editSearchTerm}
                    onChange={e => setEditSearchTerm(e.target.value)}
                  />
                </div>
                
                {editModalSearchResults.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                    {editModalSearchResults.map(product => (
                      <div key={product.id} className="bg-white p-3 rounded-xl flex items-center justify-between border border-slate-100 shadow-sm animate-in fade-in zoom-in duration-200">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-slate-800 truncate">{product.name}</p>
                          <p className="text-[10px] font-black text-emerald-600">₦{product.price.toLocaleString()} • {product.stock_qty} left</p>
                        </div>
                        <button 
                          onClick={() => {
                            if(product.stock_qty <= 0) { alert('Out of stock'); return; }
                            const existingIdx = editingCart.findIndex(i => i.productId === product.id);
                            if (existingIdx !== -1) {
                              const u = [...editingCart];
                              u[existingIdx].quantity++;
                              setEditingCart(u);
                            } else {
                              setEditingCart([...editingCart, {
                                productId: product.id!,
                                name: product.name,
                                price: product.price,
                                quantity: 1,
                                isStockAlreadyDeducted: true
                              }]);
                            }
                            setEditSearchTerm('');
                          }}
                          className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all ml-4"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-t bg-slate-50 shrink-0">
              <div className="flex justify-between items-center mb-6 px-2">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Order Total</span>
                 <span className="text-2xl font-black text-emerald-600 tracking-tighter">
                   ₦{editingCart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()}
                 </span>
              </div>
              <button onClick={async () => { if(editingCart.length === 0) await db.parked_orders.delete(editingParkedOrder.id!); else await saveEditedParkedOrder(); setEditingParkedOrder(null); }} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all">Update Stored Order</button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL SMART ASSISTANT OVERLAY */}
      <SmartSupportChat 
        currentUser={currentUser}
        cart={cart}
        onClearCart={clearCart}
        onParkOrder={handleParkOrder}
        onAddToCart={(product, quantity) => addToCart(product, quantity)}
        onNavigate={(view) => setView(view as any)}
      />
    </div>
  );
};

export default POS;