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
  History,
  MessageSquare,
  ShieldAlert
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
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showScanner, setShowScanner] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showParkedOrders, setShowParkedOrders] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showLowStockBlock, setShowLowStockBlock] = useState<{ product: Product } | null>(null);
  
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [parkingCustomerName, setParkingCustomerName] = useState('');
  const [showParkModal, setShowParkModal] = useState(false);
  const [editingParkedOrder, setEditingParkedOrder] = useState<ParkedOrder | null>(null);
  const [editingCart, setEditingCart] = useState<SaleItem[]>([]);
  const [activeParkedId, setActiveParkedId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const products = useLiveQuery(() => db.products.toArray()) || [];
  const parkedOrders = useLiveQuery(() => db.parked_orders.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('app_settings'));

  useEffect(() => {
    if (parkTrigger && parkTrigger > 0 && cart.length > 0) {
      setShowParkModal(true);
    }
  }, [parkTrigger]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory !== 'All') filtered = filtered.filter(p => p.category === selectedCategory);
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

  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;
    if (discountValue > 0) {
      discount = discountType === 'percent' ? (subtotal * discountValue / 100) : discountValue;
    }
    const total = subtotal - discount;
    return { subtotal, discount, total: Math.max(0, total), itemCount: cart.reduce((sum, item) => sum + item.quantity, 0) };
  }, [cart, discountType, discountValue]);

  // Fix: Added missing loadParkedOrder function
  const loadParkedOrder = (order: ParkedOrder) => {
    if (cart.length > 0) {
      if (!confirm('Current cart will be replaced. Continue?')) return;
    }
    setCart([...order.items]);
    setActiveParkedId(order.id || null);
    setShowParkedOrders(false);
    setShowMobileCart(true);
  };

  // Fix: Added missing deleteParkedOrder function
  const deleteParkedOrder = async (orderId: number) => {
    if (!confirm('Delete this parked order?')) return;
    try {
      await db.parked_orders.delete(orderId);
    } catch (err) {
      alert('Failed to delete order');
    }
  };

  // Fix: Added missing handleBarcodeScan function
  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product, 1);
    } else {
      alert('Product not found');
    }
  };

  // Fix: Added missing handleParkOrder function
  const handleParkOrder = () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }
    setShowParkModal(true);
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    // ROLE-BASED GUARD: Prevent Staff from selling low stock
    if (currentUser?.role === 'Sales' && product.stock_qty <= (product.low_stock_threshold || 5)) {
      setShowLowStockBlock({ product });
      return;
    }

    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.stock_qty && currentUser?.role === 'Sales') {
        alert(`Only ${product.stock_qty} units available`);
        return;
      }
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: newQty } : item));
    } else {
      setCart([...cart, { productId: product.id!, name: product.name, price: product.price, quantity: quantity }]);
    }
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const requestStockUpdate = () => {
    if (!showLowStockBlock) return;
    const shopName = settings?.shop_name || 'the shop';
    const message = `Hello Boss, I need a stock update for ${shopName}. My ${showLowStockBlock.product.name} is low (Current digital stock: ${showLowStockBlock.product.stock_qty}).`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) { removeFromCart(productId); return; }
    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock_qty && currentUser?.role === 'Sales') {
      alert(`Only ${product.stock_qty} units available`);
      return;
    }
    setCart(cart.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item));
  };

  const removeFromCart = (productId: number) => setCart(cart.filter(item => item.productId !== productId));
  const clearCart = () => { if (cart.length === 0) return; if (confirm('Clear cart?')) { setCart([]); setDiscountValue(0); setActiveParkedId(null); } };

  const confirmParkOrder = async () => {
    if (!parkingCustomerName.trim()) { alert('Enter customer name'); return; }
    try {
      await (db as any).transaction('rw', [db.products, db.inventory_logs, db.parked_orders], async () => {
        if (activeParkedId) await db.parked_orders.delete(activeParkedId);
        const itemsToSave: SaleItem[] = [];
        for (const item of cart) {
          const product = await db.products.get(item.productId);
          if (!product) continue;
          if (!item.isStockAlreadyDeducted) {
            const oldStock = Number(product.stock_qty);
            const soldQty = Number(item.quantity);
            if (oldStock < soldQty && currentUser?.role === 'Sales') throw new Error(`Insufficient stock for ${product.name}`);
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
      setCart([]); setDiscountValue(0); setParkingCustomerName(''); setShowParkModal(false); setShowMobileCart(false); setActiveParkedId(null);
      alert('Order parked!');
    } catch (err) { alert(`Failed: ${err instanceof Error ? err.message : 'Error'}`); }
  };

  const handleCheckoutComplete = async (sale: any, lowItems: string[]) => {
    if (activeParkedId) { try { await db.parked_orders.delete(activeParkedId); } catch (e) {} }
    setCart([]); setDiscountValue(0); setActiveParkedId(null); setShowCheckout(false); setShowMobileCart(false);
    if (lowItems.length > 0) alert(`Sale completed! ⚠️ Low stock: ${lowItems.join(', ')}`); else alert('Sale completed! ✅');
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden relative">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input ref={searchInputRef} type="text" placeholder="Search products..." className="w-full pl-10 pr-4 h-14 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => setShowParkedOrders(true)} className={`relative h-14 w-14 flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm ${parkedOrders.length === 0 ? 'opacity-40' : 'opacity-100'}`}>
            <History size={24} className="text-slate-600" />
            {parkedOrders.length > 0 && <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-600 text-white text-[11px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">{parkedOrders.length}</span>}
          </button>
          <button onClick={() => setShowScanner(true)} className="h-14 w-14 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-lg"><Camera size={24} /></button>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase whitespace-nowrap ${selectedCategory === cat ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 pb-32 lg:pb-4 scrollbar-hide">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20"><Package size={64} className="text-slate-200 mb-4" /><p className="text-slate-400 font-bold">No products found</p></div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3' : 'space-y-2'}>
              {filteredProducts.map(product => (
                <button key={product.id} onClick={() => addToCart(product, 1)} className={`group bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all active:scale-95 flex flex-col ${viewMode === 'grid' ? 'p-4 text-left' : 'p-3 flex-row items-center gap-3'}`}>
                  {viewMode === 'grid' ? (
                    <>
                      <div className="flex items-start justify-between mb-3 w-full">
                        <span className="text-[10px] font-black px-2 py-1 bg-slate-100 rounded-lg text-slate-500 uppercase truncate max-w-[70%]">{product.category}</span>
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner"><Plus size={20} /></div>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 line-clamp-2 mb-2 min-h-[2.5rem]">{product.name}</h4>
                      <div className="flex items-center justify-between mt-auto w-full">
                        <span className="text-lg font-black text-emerald-600">₦{product.price.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{product.stock_qty} left</span>
                      </div>
                    </>
                  ) : (
                    <><div className="flex-1 text-left"><h4 className="font-bold text-sm text-slate-800">{product.name}</h4><p className="text-xs text-slate-400 font-medium">{product.category} • {product.stock_qty} units</p></div><div className="flex items-center gap-4 shrink-0"><span className="text-lg font-black text-emerald-600">₦{product.price.toLocaleString()}</span><div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Plus size={20} /></div></div></>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`lg:w-[400px] bg-white lg:border-l border-slate-200 flex flex-col h-full lg:h-auto ${showMobileCart ? 'fixed inset-0 z-[150] w-full animate-in slide-in-from-bottom duration-300' : 'hidden lg:flex'}`}>
          <div className="p-6 border-b border-slate-100 shrink-0 bg-white">
            <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><ShoppingCart size={20} className="text-slate-600" /><h3 className="font-black text-xl">Current Sale</h3></div><div className="flex gap-2 items-center"><button onClick={() => setShowParkedOrders(true)} className="relative p-3 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"><ParkingCircle size={24} />{parkedOrders.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{parkedOrders.length}</span>}</button><button onClick={clearCart} className="p-3 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={24} /></button><button onClick={() => setShowMobileCart(false)} className="lg:hidden p-3 text-slate-400 hover:bg-slate-100 rounded-full transition-all ml-2"><X size={32} /></button></div></div>
            <div className="flex items-center gap-2"><span className="text-sm text-slate-500 font-bold uppercase tracking-widest">{cartSummary.itemCount} Items In Cart</span>{discountValue > 0 && <span className="text-[10px] bg-rose-100 text-rose-700 px-3 py-1 rounded-full font-black uppercase tracking-widest">{discountType === 'percent' ? `${discountValue}%` : `₦${discountValue}`} Off</span>}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-40"><ShoppingCart size={80} className="text-slate-200 mb-4" /><p className="text-slate-400 font-black uppercase tracking-widest">Cart is empty</p></div>
            ) : cart.map((item) => (
              <div key={item.productId} className="bg-slate-50 rounded-3xl p-4 flex items-center gap-4 group hover:bg-slate-100 transition-all"><div className="flex-1 min-w-0"><h4 className="font-bold text-sm text-slate-800 truncate">{item.name}</h4><p className="text-xs text-slate-500 font-bold uppercase tracking-tighter">₦{item.price.toLocaleString()} × {item.quantity}</p></div><div className="flex items-center gap-3 shrink-0"><button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm active:scale-90"><Minus size={18} /></button><span className="w-8 text-center font-black text-lg tabular-nums">{item.quantity}</span><button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm active:scale-90"><Plus size={18} /></button></div><button onClick={() => removeFromCart(item.productId)} className="p-3 text-slate-300 hover:text-rose-600"><Trash2 size={20} /></button></div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="p-6 border-t border-slate-100 space-y-4 shrink-0 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-slate-500 font-bold uppercase text-[10px] tracking-widest"><span>Subtotal</span><span>₦{cartSummary.subtotal.toLocaleString()}</span></div>
                {cartSummary.discount > 0 && <div className="flex justify-between items-center text-rose-600 font-black uppercase text-[10px] tracking-widest"><span>Discount</span><span>-₦{cartSummary.discount.toLocaleString()}</span></div>}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2"><span className="text-slate-900 font-black uppercase text-xs tracking-[0.2em]">Payable Total</span><span className="text-3xl font-black text-emerald-600 tracking-tighter">₦{cartSummary.total.toLocaleString()}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button onClick={handleParkOrder} className="py-5 bg-amber-50 text-amber-700 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-sm active:scale-95 transition-all">Park</button>
                <button onClick={() => setShowCheckout(true)} className="py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-200 active:scale-95 transition-all">Checkout</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {cart.length > 0 && !showMobileCart && (
        <div className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-[140] w-[90%] max-w-sm px-4">
          <button onClick={() => setShowMobileCart(true)} className="w-full bg-emerald-600 text-white py-6 rounded-[2.5rem] font-black text-lg shadow-[0_20px_50px_rgba(5,150,105,0.4)] flex items-center justify-center gap-3 active:scale-95 transition-all border-4 border-white/30 backdrop-blur-md">
            <div className="relative"><ShoppingCart size={24} /><span className="absolute -top-3 -right-3 w-6 h-6 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">{cartSummary.itemCount}</span></div>
            <span className="ml-2 uppercase tracking-widest">View Cart</span><span className="font-black text-emerald-100 ml-auto mr-2">₦{cartSummary.total.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* LOW STOCK BLOCK MODAL */}
      {showLowStockBlock && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 text-center space-y-8 shadow-2xl border-4 border-rose-500/20">
            <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center mx-auto animate-pulse">
              <ShieldAlert size={48} />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase italic">Stock Low!</h2>
              <p className="text-slate-500 font-bold leading-relaxed">
                Oga, you cannot sell <b>{showLowStockBlock.product.name}</b> until you update your stock from the Boss.
              </p>
              <div className="bg-rose-50 py-2 rounded-xl text-rose-600 font-black text-[10px] uppercase tracking-widest border border-rose-100">
                Digital Stock: {showLowStockBlock.product.stock_qty} Units
              </div>
            </div>
            <div className="space-y-3">
              <button 
                onClick={requestStockUpdate}
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-200 active:scale-95 transition-all"
              >
                <MessageSquare size={20} /> Request Update from Boss
              </button>
              <button 
                onClick={() => setShowLowStockBlock(null)}
                className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600"
              >
                Go Back to Selling
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
      {showCheckout && <CheckoutModal isOpen={showCheckout} onClose={() => setShowCheckout(false)} cart={cart} total={cartSummary.total} currentUser={currentUser} onComplete={handleCheckoutComplete} />}
      {showParkModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"><div className="bg-white rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in"><div className="text-center"><div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4"><ParkingCircle size={32} /></div><h3 className="text-2xl font-black text-slate-900 tracking-tight">Park Order</h3></div><input autoFocus type="text" placeholder="Customer Name" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800" value={parkingCustomerName} onChange={e => setParkingCustomerName(e.target.value)} /><button onClick={confirmParkOrder} className="w-full py-5 bg-amber-600 text-white rounded-[2rem] font-black shadow-xl">Secure Order</button><button onClick={() => setShowParkModal(false)} className="w-full text-slate-400 font-black uppercase text-[10px]">Cancel</button></div></div>
      )}
      {showParkedOrders && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-right"><div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0"><div><h3 className="text-3xl font-black text-slate-900 tracking-tight">Parked Orders</h3></div><button onClick={() => setShowParkedOrders(false)} className="p-4 bg-slate-50 rounded-full text-slate-400"><X size={32} /></button></div><div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">{parkedOrders.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-30"><Clock size={80} className="text-slate-200 mb-4" /><p className="text-slate-400 font-black uppercase tracking-widest text-sm">No parked orders found</p></div>) : parkedOrders.map(order => (<div key={order.id} className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 shadow-sm hover:border-amber-200 transition-all"><div className="flex justify-between items-start mb-4"><div><h4 className="font-black text-xl text-slate-800">{order.customerName}</h4><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(order.timestamp).toLocaleString()}</p></div><span className="font-black text-2xl text-amber-600 tracking-tighter">₦{order.total.toLocaleString()}</span></div><div className="flex gap-3"><button onClick={() => loadParkedOrder(order)} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">Load To Cart</button><button onClick={() => deleteParkedOrder(order.id!)} className="p-4 text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={20}/></button></div></div>))}</div></div>
      )}
    </div>
  );
};

export default POS;