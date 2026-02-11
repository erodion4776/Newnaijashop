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
  X,
  CheckCircle2,
  Clock,
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
  ShieldAlert,
  Send,
  RefreshCw,
  Edit2
} from 'lucide-react';
import { Product, SaleItem, Staff, View, ParkedOrder } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import CheckoutModal from '../components/CheckoutModal';
import SmartSupportChat from '../components/SupportChat';
import { exportDataForWhatsApp } from '../services/syncService';
import WhatsAppService from '../services/WhatsAppService';

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
  const [showCheckoutModal, setShowCheckoutModal] = useState(false); // FIXED: Named as requested
  const [showParkedOrders, setShowParkedOrders] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showSyncRequired, setShowSyncRequired] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [parkingCustomerName, setParkingCustomerName] = useState('');
  const [showParkModal, setShowParkModal] = useState(false);
  const [activeParkedId, setActiveParkedId] = useState<number | null>(null);
  const [editingParkedOrder, setEditingParkedOrder] = useState<ParkedOrder | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const products = useLiveQuery(() => db.products.toArray()) || [];
  const parkedOrders = useLiveQuery(() => db.parked_orders.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('app_settings'));

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const isSales = currentUser?.role === 'Sales';

  useEffect(() => {
    if (parkTrigger && parkTrigger > 0 && cart.length > 0) setShowParkModal(true);
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
    return filtered;
  }, [products, selectedCategory, searchTerm]);

  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return { subtotal, total: subtotal, itemCount: cart.reduce((sum, item) => sum + item.quantity, 0) };
  }, [cart]);

  const { total } = cartSummary; // Helper for modal props

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) addToCart(product, 1); else alert('Product not found');
  };

  const handleParkOrder = () => { if (cart.length > 0) setShowParkModal(true); else alert('Cart is empty'); };

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
      setCart([]); setParkingCustomerName(''); setShowParkModal(false); setShowMobileCart(false); setActiveParkedId(null);
      alert('Order parked!');
    } catch (err: any) { alert(`Failed: ${err instanceof Error ? err.message : 'Error'}`); }
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    const existing = cart.find(item => item.productId === product.id);
    const newQty = existing ? existing.quantity + quantity : quantity;
    if (newQty > product.stock_qty) { alert(`Only ${product.stock_qty} units available`); return; }
    if (existing) {
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: newQty } : item));
    } else {
      setCart([...cart, { productId: product.id!, name: product.name, price: product.price, quantity }]);
    }
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handlePushUpdate = async () => {
    if (!settings?.sync_key) { alert("Security Key missing."); return; }
    setIsPushing(true);
    try {
      const result = await exportDataForWhatsApp('STOCK', settings.sync_key, currentUser?.name);
      if (result.raw !== "FILE_DOWNLOADED") {
        const text = result.summary.replace('[CompressedJSON]', result.raw);
        await WhatsAppService.send(text, settings, 'GROUP_UPDATE');
      }
    } finally { setIsPushing(false); }
  };

  const handleUrgentSync = async () => {
    if (!settings?.sync_key) return;
    const result = await exportDataForWhatsApp('URGENT_SYNC', settings.sync_key, currentUser?.name);
    if (result.raw !== "FILE_DOWNLOADED") {
      const text = result.summary.replace('[CompressedJSON]', result.raw);
      await WhatsAppService.send(text, settings, 'DIRECT_REPORT');
      setShowSyncRequired(false);
    }
  };

  const onCompleteSale = async (sale: any, lowItems: string[]) => { // FIXED: Renamed for instruction match
    setCart([]);
    setShowCheckoutModal(false);
    setShowMobileCart(false);
    if (lowItems.length > 0) setShowSyncRequired(true);
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) { setCart(cart.filter(i => i.productId !== productId)); return; }
    const p = products.find(p => p.id === productId);
    if (p && newQuantity > p.stock_qty) { alert(`Only ${p.stock_qty} available`); return; }
    setCart(cart.map(i => i.productId === productId ? { ...i, quantity: newQuantity } : i));
  };

  const loadParkedOrder = (order: ParkedOrder) => {
    if (cart.length > 0 && !confirm('Current cart will be replaced. Continue?')) return;
    setCart([...order.items]);
    setActiveParkedId(order.id || null);
    setShowParkedOrders(false);
    setShowMobileCart(true);
  };

  const handleUpdateParkedQty = async (productId: number, delta: number) => {
    if (!editingParkedOrder) return;
    
    const product = await db.products.get(productId);
    if (!product) return;

    // IF increased: subtract from products table
    // IF decreased: add back to products table
    if (delta > 0 && product.stock_qty <= 0) {
      alert(`No more ${product.name} in main stock!`);
      return;
    }

    try {
      await db.products.update(productId, { stock_qty: product.stock_qty - delta });
      
      setEditingParkedOrder(prev => {
        if (!prev) return null;
        const updatedItems = prev.items.map(item => {
          if (item.productId === productId) {
            return { ...item, quantity: item.quantity + delta };
          }
          return item;
        }).filter(item => item.quantity > 0);

        return {
          ...prev,
          items: updatedItems,
          total: updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0)
        };
      });
    } catch (err) {
      alert("Failed to update stock records.");
    }
  };

  const saveEditedParkedOrder = async () => {
    if (!editingParkedOrder || !editingParkedOrder.id) return;
    try {
      await db.parked_orders.update(editingParkedOrder.id, {
        items: editingParkedOrder.items,
        total: editingParkedOrder.total
      });
      
      await db.inventory_logs.add({
        product_id: 0,
        product_name: `Parked Order: ${editingParkedOrder.customerName}`,
        quantity_changed: 0,
        old_stock: 0,
        new_stock: 0,
        type: 'Adjustment',
        timestamp: Date.now(),
        performed_by: `Parked Order Adjusted: ${currentUser?.name || 'Staff'}`
      });

      setEditingParkedOrder(null);
      alert("Parked order updated!");
    } catch (err) {
      alert("Failed to save changes.");
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden relative">
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input ref={searchInputRef} type="text" placeholder="Search products..." className="w-full pl-10 pr-4 h-14 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => setShowParkedOrders(true)} className={`relative h-14 w-14 flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm ${parkedOrders.length === 0 ? 'opacity-40' : ''}`}>
            <History size={24} className="text-slate-600" />
            {parkedOrders.length > 0 && <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-600 text-white text-[11px] font-black rounded-full flex items-center justify-center border-2 border-white">{parkedOrders.length}</span>}
          </button>
          <button onClick={() => setShowScanner(true)} className="h-14 w-14 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-lg"><Camera size={24} /></button>
        </div>
        {isAdmin && (
          <button onClick={handlePushUpdate} disabled={isPushing} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
            {isPushing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Push Stock Update
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 pb-32 scrollbar-hide">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map(product => {
              const isLowStock = product.stock_qty > 0 && product.stock_qty <= 5;
              const isOutOfStock = product.stock_qty <= 0;
              
              return (
                <button 
                  key={product.id} 
                  onClick={() => !isOutOfStock && addToCart(product, 1)} 
                  disabled={isOutOfStock}
                  className={`group bg-white border border-slate-200 rounded-2xl p-4 text-left transition-all flex flex-col h-full ${isOutOfStock ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:border-emerald-500 hover:shadow-lg active:scale-95'}`}
                >
                  <span className="text-[10px] font-black px-2 py-1 bg-slate-100 rounded-lg text-slate-500 uppercase self-start mb-3">{product.category}</span>
                  <h4 className="font-bold text-sm text-slate-800 line-clamp-2 mb-2 flex-1">{product.name}</h4>
                  <div className="mt-auto pt-2">
                    <div className={`text-[10px] mb-1 font-bold ${isOutOfStock ? 'text-rose-600 font-black' : isLowStock ? 'text-amber-600 font-black' : 'text-slate-400'}`}>
                      {isOutOfStock ? 'OUT OF STOCK' : isLowStock ? `⚠️ Only ${product.stock_qty} Left` : `${product.stock_qty} Units Available`}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-lg font-black ${isOutOfStock ? 'text-slate-400' : 'text-emerald-600'}`}>
                        ₦{product.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`lg:w-[400px] bg-white border-l border-slate-200 flex flex-col h-full lg:h-auto ${showMobileCart ? 'fixed inset-0 z-[150]' : 'hidden lg:flex'}`}>
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-black">Current Sale</h3>
            <button onClick={() => setShowMobileCart(false)} className="lg:hidden"><X size={24}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
            {cart.map(item => (
              <div key={item.productId} className="bg-slate-50 rounded-2xl p-3 flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-3"><h4 className="font-bold text-sm truncate">{item.name}</h4><p className="text-xs text-slate-500">₦{item.price.toLocaleString()} x {item.quantity}</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center"><Minus size={14}/></button>
                  <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center"><Plus size={14}/></button>
                </div>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="p-4 border-t space-y-4">
              <div className="flex justify-between items-center"><span className="text-slate-500 uppercase text-xs font-black">Total Payable</span><span className="text-2xl font-black text-emerald-600">₦{cartSummary.total.toLocaleString()}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleParkOrder} className="py-4 bg-amber-50 text-amber-700 rounded-2xl font-black text-sm">Park</button>
                <button onClick={() => setShowCheckoutModal(true)} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-200">Checkout</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {cart.length > 0 && !showMobileCart && (
        <div className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-[140] w-[90%]">
          <button onClick={() => setShowMobileCart(true)} className="w-full bg-emerald-600 text-white py-5 rounded-[2rem] font-black text-lg shadow-2xl flex items-center justify-center gap-3 active:scale-95 border-4 border-white/20">
            <ShoppingCart size={24} /> View Cart (₦{cartSummary.total.toLocaleString()})
          </button>
        </div>
      )}

      {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
      
      {showSyncRequired && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 text-center space-y-8 shadow-2xl border-4 border-amber-500/20">
            <div className="w-24 h-24 bg-amber-50 text-amber-600 rounded-[2.5rem] flex items-center justify-center mx-auto animate-bounce"><ShieldAlert size={48} /></div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic leading-none">Sync Required!</h2>
              <p className="text-slate-500 font-bold leading-relaxed">⚠️ Stock is Low! To ensure accuracy across all staff phones, you must send a report to the Boss now.</p>
            </div>
            <div className="space-y-3">
              <button onClick={handleUrgentSync} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-200 active:scale-95 transition-all">
                <MessageSquare size={20} /> Send Report & Request Update
              </button>
            </div>
          </div>
        </div>
      )}

      {showParkModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in">
            <div className="text-center"><h3 className="text-2xl font-black">Park Order</h3></div>
            <input autoFocus type="text" placeholder="Customer Name" className="w-full px-4 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={parkingCustomerName} onChange={e => setParkingCustomerName(e.target.value)} />
            <button onClick={confirmParkOrder} className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black shadow-lg">Confirm Park</button>
            <button onClick={() => setShowParkModal(false)} className="w-full text-slate-400 font-bold uppercase text-xs">Cancel</button>
          </div>
        </div>
      )}

      {showParkedOrders && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-right">
          <div className="p-6 border-b flex items-center justify-between"><div><h3 className="text-2xl font-black">Parked Orders</h3></div><button onClick={() => setShowParkedOrders(false)}><X size={24} /></button></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {parkedOrders.map(order => (
              <div key={order.id} className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex-1">
                  <h4 className="font-black">{order.customerName}</h4>
                  <p className="text-xs text-slate-400">₦{order.total.toLocaleString()} • {new Date(order.timestamp).toLocaleTimeString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingParkedOrder(order)} className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"><Edit2 size={18} /></button>
                  <button onClick={() => loadParkedOrder(order)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs">Resume</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingParkedOrder && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black">Edit Saved Order</h3>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{editingParkedOrder.customerName}</p>
              </div>
              <button onClick={() => setEditingParkedOrder(null)} className="p-2 hover:bg-slate-50 rounded-full"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
              {editingParkedOrder.items.map(item => (
                <div key={item.productId} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="min-w-0 flex-1 mr-4">
                    <h4 className="font-bold text-sm truncate">{item.name}</h4>
                    <p className="text-xs text-emerald-600 font-black">₦{item.price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleUpdateParkedQty(item.productId, -1)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-rose-500 shadow-sm active:scale-90"><Minus size={16}/></button>
                    <span className="w-8 text-center font-black text-lg tabular-nums">{item.quantity}</span>
                    <button onClick={() => handleUpdateParkedQty(item.productId, 1)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm active:scale-90"><Plus size={16}/></button>
                  </div>
                </div>
              ))}
              {editingParkedOrder.items.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-slate-400 italic">No items left in this order.</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-slate-50/50 space-y-4">
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black uppercase text-slate-400">Revised Total</span>
                <span className="text-2xl font-black text-slate-900">₦{editingParkedOrder.total.toLocaleString()}</span>
              </div>
              <button 
                onClick={saveEditedParkedOrder} 
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 active:scale-95"
              >
                Update Saved Order
              </button>
            </div>
          </div>
        </div>
      )}

      <CheckoutModal 
        isOpen={showCheckoutModal} 
        onClose={() => setShowCheckoutModal(false)} 
        cart={cart} 
        total={total} 
        currentUser={currentUser} 
        onComplete={onCompleteSale} 
      />
    </div>
  );
};

export default POS;