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
  Bluetooth,
  MessageSquare,
  FileText,
  Printer
} from 'lucide-react';
import { Product, SaleItem, Staff, View, ParkedOrder, Sale } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import CheckoutModal from '../components/CheckoutModal';
import SmartSupportChat from '../components/SupportChat';
import BluetoothPrintService from '../services/BluetoothPrintService';

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
  
  // Post-Sale Success UI
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [btPrintStatus, setBtPrintStatus] = useState<'idle' | 'connecting' | 'printing'>('idle');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ==================== DATA FETCHING ====================
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const parkedOrders = useLiveQuery(() => db.parked_orders.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('app_settings'));

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
    if (selectedCategory !== 'All') filtered = filtered.filter(p => p.category === selectedCategory);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(term) || p.barcode?.includes(term) || p.category?.toLowerCase().includes(term));
    }
    return filtered.filter(p => p.stock_qty > 0);
  }, [products, selectedCategory, searchTerm]);

  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;
    if (discountValue > 0) discount = discountType === 'percent' ? (subtotal * discountValue / 100) : discountValue;
    const total = subtotal - discount;
    return { subtotal, discount, total: Math.max(0, total), itemCount: cart.reduce((sum, item) => sum + item.quantity, 0) };
  }, [cart, discountType, discountValue]);

  // ==================== CART ACTIONS ====================
  const addToCart = (product: Product, quantity: number = 1) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.stock_qty) { alert(`Only ${product.stock_qty} units available`); return; }
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: newQty } : item));
    } else {
      if (quantity > product.stock_qty) { alert(`Only ${product.stock_qty} units available`); return; }
      setCart([...cart, { productId: product.id!, name: product.name, price: product.price, quantity }]);
    }
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) { removeFromCart(productId); return; }
    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock_qty) { alert(`Only ${product.stock_qty} available`); return; }
    setCart(cart.map(item => item.productId === productId ? { ...item, quantity: newQuantity } : item));
  };

  const removeFromCart = (productId: number) => setCart(cart.filter(item => item.productId !== productId));
  const clearCart = () => { if (cart.length > 0 && confirm('Clear cart?')) { setCart([]); setDiscountValue(0); } };

  const handleParkOrder = () => cart.length > 0 ? setShowParkModal(true) : alert('Cart is empty');

  const confirmParkOrder = async () => {
    if (!parkingCustomerName.trim()) { alert('Enter customer name'); return; }
    try {
      await (db as any).transaction('rw', [db.products, db.inventory_logs, db.parked_orders], async () => {
        const itemsToSave: SaleItem[] = [];
        for (const item of cart) {
          const product = await db.products.get(item.productId);
          if (!product) continue;
          if (!item.isStockAlreadyDeducted) {
            const oldStock = Number(product.stock_qty || 0);
            const soldQty = Number(item.quantity || 0);
            if (oldStock < soldQty) throw new Error(`Low stock for ${product.name}`);
            const newStock = oldStock - soldQty;
            await db.products.update(item.productId, { stock_qty: newStock });
            await db.inventory_logs.add({ product_id: item.productId, product_name: product.name, quantity_changed: -soldQty, old_stock: oldStock, new_stock: newStock, type: 'Adjustment', timestamp: Date.now(), performed_by: `Parking: ${currentUser?.name || 'Staff'}` });
            itemsToSave.push({ ...item, isStockAlreadyDeducted: true });
          } else itemsToSave.push({ ...item });
        }
        await db.parked_orders.add({ customerName: parkingCustomerName, items: itemsToSave, total: cartSummary.total, staffId: currentUser?.id?.toString() || '0', timestamp: Date.now() });
      });
      setCart([]); setDiscountValue(0); setParkingCustomerName(''); setShowParkModal(false); setShowMobileCart(false); alert('Order parked & stock secured!');
    } catch (err) { alert(`Park failed: ${err instanceof Error ? err.message : 'Error'}`); }
  };

  const loadParkedOrder = (order: ParkedOrder) => {
    if (cart.length > 0 && !confirm('Replace current cart?')) return;
    setCart([...order.items]); setShowParkedOrders(false); setShowMobileCart(true);
  };

  const editParkedOrder = (order: ParkedOrder) => {
    setEditingParkedOrder(order);
    setEditingCart([...order.items]);
  };

  const deleteParkedOrder = async (orderId: number) => {
    if (!confirm('Delete this parked order?')) return;
    try {
      await db.parked_orders.delete(orderId);
    } catch (err) {
      alert('Failed to delete order');
    }
  };

  const saveEditedParkedOrder = async () => {
    if (!editingParkedOrder?.id) return;
    const newTotal = editingCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    await db.parked_orders.update(editingParkedOrder.id, { items: editingCart, total: newTotal });
    setEditingParkedOrder(null); setEditingCart([]); alert('Updated!');
  };

  const handleBarcodeScan = (barcode: string) => {
    const p = products.find(p => p.barcode === barcode);
    if (p) addToCart(p, 1); else alert('Product not found');
  };

  const handleCheckoutComplete = (sale: Sale, lowItems: string[]) => {
    setCart([]); setDiscountValue(0); setShowCheckout(false); setShowMobileCart(false);
    setLastCompletedSale(sale);
    setShowSuccessModal(true);
    if (lowItems.length > 0) console.warn(`Low stock: ${lowItems.join(', ')}`);
  };

  // ==================== PRINT ACTIONS ====================
  const handleBTPrint = async () => {
    if (!lastCompletedSale || !settings) return;
    
    setBtPrintStatus('connecting');
    try {
      await BluetoothPrintService.printReceipt(lastCompletedSale, settings as any);
      setBtPrintStatus('printing');
      setTimeout(() => setBtPrintStatus('idle'), 2000);
    } catch (err) {
      console.error(err);
      alert('Printer not found. Please ensure Bluetooth is ON and the printer is paired.');
      setBtPrintStatus('idle');
    }
  };

  const handleWhatsAppShare = () => {
    if (!lastCompletedSale || !settings) return;
    const itemsText = lastCompletedSale.items.map(i => `${i.name} x${i.quantity} = N${(i.price * i.quantity).toLocaleString()}`).join('\n');
    const text = `--- ${settings.shop_name.toUpperCase()} ---\nID: ${lastCompletedSale.sale_id.substring(0,8)}\nDate: ${new Date(lastCompletedSale.timestamp).toLocaleString()}\n\nITEMS:\n${itemsText}\n\nTOTAL: N${lastCompletedSale.total_amount.toLocaleString()}\n\n${settings.receipt_footer || 'Thanks for your patronage!'}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden relative">
      {/* TOP BAR */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
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
            {parkedOrders.length > 0 && <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-600 text-white text-[11px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">{parkedOrders.length}</span>}
          </button>
          <button onClick={() => setShowScanner(true)} className="h-14 w-14 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95"><Camera size={24} /></button>
          <div className="hidden sm:flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-slate-400'}`}><Grid3x3 size={18} /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-slate-400'}`}><List size={18} /></button>
          </div>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((cat: string) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{cat}</button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20"><Package size={64} className="text-slate-200 mb-4" /><p className="text-slate-400 font-bold">No products found</p></div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3' : 'space-y-2'}>
              {filteredProducts.map(product => (
                <button key={product.id} onClick={() => addToCart(product, 1)} className={`group bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:shadow-lg transition-all active:scale-95 ${viewMode === 'grid' ? 'p-4 text-left' : 'p-3 flex items-center gap-3'}`}>
                  {viewMode === 'grid' ? (
                    <>
                      <div className="flex items-start justify-between mb-3"><span className="text-[10px] font-black px-2 py-1 bg-slate-100 rounded-lg text-slate-500 uppercase">{product.category}</span><div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={16} /></div></div>
                      <h4 className="font-bold text-sm text-slate-800 line-clamp-2 mb-2 min-h-[2.5rem]">{product.name}</h4>
                      <div className="flex items-center justify-between"><span className="text-lg font-black text-emerald-600">₦{product.price.toLocaleString()}</span><span className="text-xs text-slate-400 font-bold">{product.stock_qty} units</span></div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 text-left"><h4 className="font-bold text-sm text-slate-800">{product.name}</h4><p className="text-xs text-slate-400 font-medium">{product.category} • {product.stock_qty} units</p></div>
                      <span className="text-lg font-black text-emerald-600 shrink-0">₦{product.price.toLocaleString()}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`lg:w-[400px] bg-white border-l border-slate-200 flex flex-col h-full lg:h-auto ${showMobileCart ? 'fixed inset-0 z-[150] w-full animate-in slide-in-from-bottom duration-300' : 'hidden lg:flex'}`}>
          <div className="p-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><ShoppingCart size={20} className="text-slate-600" /><h3 className="font-black text-lg">Current Sale</h3></div><div className="flex gap-2 items-center"><button onClick={() => setShowParkedOrders(true)} className="relative p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><ParkingCircle size={20} />{parkedOrders.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">{parkedOrders.length}</span>}</button><button onClick={clearCart} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={20} /></button><button onClick={() => setShowMobileCart(false)} className="lg:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all ml-2"><X size={28} /></button></div></div>
            <div className="flex items-center gap-2"><span className="text-sm text-slate-500 font-medium">{cartSummary.itemCount} items</span>{discountValue > 0 && <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-full font-bold">{discountType === 'percent' ? `${discountValue}%` : `₦${discountValue}`} OFF</span>}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
            {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-center py-12"><ShoppingCart size={48} className="text-slate-200 mb-3" /><p className="text-slate-400 font-bold text-sm">Cart is empty</p></div> : cart.map((item) => (
              <div key={item.productId} className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3 group hover:bg-slate-100 transition-all"><div className="flex-1 min-w-0"><h4 className="font-bold text-sm text-slate-800 truncate">{item.name}</h4><p className="text-xs text-slate-500 font-medium">₦{item.price.toLocaleString()} × {item.quantity}</p></div><div className="flex items-center gap-2 shrink-0"><button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center"><Minus size={14} /></button><span className="w-8 text-center font-bold text-sm">{item.quantity}</span><button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center"><Plus size={14} /></button></div><button onClick={() => removeFromCart(item.productId)} className="p-2 text-slate-400 hover:text-rose-600 lg:opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button></div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="p-4 border-t border-slate-100 space-y-3 shrink-0 bg-white">
              <button onClick={() => setShowDiscount(!showDiscount)} className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl"><div className="flex items-center gap-2"><TrendingDown size={16} className="text-amber-600" /><span className="text-sm font-bold">Apply Discount</span></div><ChevronRight size={16} className={showDiscount ? 'rotate-90' : ''} /></button>
              {showDiscount && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2"><div className="flex gap-2"><button onClick={() => setDiscountType('percent')} className={`flex-1 py-2 rounded-xl font-bold text-xs ${discountType === 'percent' ? 'bg-amber-600 text-white' : 'bg-white text-amber-600'}`}>% Percent</button><button onClick={() => setDiscountType('fixed')} className={`flex-1 py-2 rounded-xl font-bold text-xs ${discountType === 'fixed' ? 'bg-amber-600 text-white' : 'bg-white text-amber-600'}`}>₦ Fixed</button></div><input type="number" value={discountValue || ''} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} className="w-full px-4 py-3 text-center text-2xl font-black bg-white border rounded-xl" placeholder="0" /></div>
              )}
              <div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-bold">₦{cartSummary.subtotal.toLocaleString()}</span></div>{cartSummary.discount > 0 && <div className="flex justify-between text-rose-600"><span>Discount</span><span>-₦{cartSummary.discount.toLocaleString()}</span></div>}<div className="flex justify-between items-center pt-2 border-t border-slate-200"><span className="text-slate-700 font-bold text-lg">Total</span><span className="text-2xl font-black text-emerald-600">₦{cartSummary.total.toLocaleString()}</span></div></div>
              <div className="grid grid-cols-2 gap-3 pt-3"><button onClick={handleParkOrder} className="py-4 bg-amber-50 text-amber-700 rounded-2xl font-black text-sm active:scale-95 transition-all">Park</button><button onClick={() => setShowCheckout(true)} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/20 active:scale-95 transition-all">Checkout</button></div>
            </div>
          )}
        </div>
      </div>

      {/* SUCCESS MODAL */}
      {showSuccessModal && lastCompletedSale && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-8 text-center space-y-8 animate-in zoom-in">
             <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle2 size={40} /></div>
             <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Sale Success!</h3>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Reference: #{lastCompletedSale.sale_id.substring(0,8)}</p>
             </div>

             <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={handleBTPrint}
                  disabled={btPrintStatus !== 'idle'}
                  className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                    btPrintStatus === 'idle' ? 'bg-emerald-600 text-white shadow-xl' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {btPrintStatus === 'connecting' ? <><Loader2 size={18} className="animate-spin" /> 🔄 Connecting...</> :
                   btPrintStatus === 'printing' ? <><Printer size={18} className="animate-pulse" /> 🖨 Printing...</> :
                   <><Bluetooth size={18} /> Print Thermal Receipt</>}
                </button>
                <button onClick={handleWhatsAppShare} className="w-full py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3"><MessageSquare size={18} /> Share to WhatsApp</button>
                <button onClick={() => window.print()} className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3"><FileText size={18} /> Download PDF</button>
             </div>

             <button onClick={() => { setShowSuccessModal(false); setLastCompletedSale(null); }} className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600">New Sale <RotateCcw size={14} className="inline ml-1" /></button>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
      {showCheckout && <CheckoutModal isOpen={showCheckout} onClose={() => setShowCheckout(false)} cart={cart} total={cartSummary.total} currentUser={currentUser} onComplete={handleCheckoutComplete} />}
      {showParkModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in">
            <div className="text-center"><div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4"><ParkingCircle size={32} /></div><h3 className="text-2xl font-black">Park Order</h3></div>
            <input autoFocus type="text" placeholder="Customer Name" className="w-full px-4 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={parkingCustomerName} onChange={e => setParkingCustomerName(e.target.value)} />
            <button onClick={confirmParkOrder} className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black shadow-lg">Confirm Park</button>
            <button onClick={() => setShowParkModal(false)} className="w-full text-slate-400 font-bold uppercase text-xs">Cancel</button>
          </div>
        </div>
      )}
      {showParkedOrders && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-right">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between"><div><h3 className="text-2xl font-black">Parked Orders</h3></div><button onClick={() => setShowParkedOrders(false)}><X size={24} /></button></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {parkedOrders.length === 0 ? <p className="text-center text-slate-400 py-20">No parked orders</p> : parkedOrders.map(order => (
              <div key={order.id} className="bg-white border-2 border-slate-200 rounded-2xl p-4">
                <div className="flex justify-between items-start mb-3"><div><h4 className="font-black text-lg">{order.customerName}</h4><p className="text-xs text-slate-400">{new Date(order.timestamp).toLocaleString()}</p></div><span className="font-black text-amber-600">₦{order.total.toLocaleString()}</span></div>
                <div className="flex gap-2"><button onClick={() => loadParkedOrder(order)} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs">Load</button><button onClick={() => editParkedOrder(order)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs">Edit</button><button onClick={() => deleteParkedOrder(order.id!)} className="p-2 text-rose-600"><Trash2 size={18} /></button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingParkedOrder && (
        <div className="fixed inset-0 z-[250] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between"><div><h3 className="text-2xl font-black">Edit Saved Order</h3><p className="text-xs text-amber-600 font-bold uppercase">{editingParkedOrder.customerName}</p></div><button onClick={() => { setEditingParkedOrder(null); setEditingCart([]); }}><X size={24} /></button></div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {editingCart.map((item, idx) => (
                <div key={idx} className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4"><div className="flex-1 min-w-0"><h4 className="font-bold truncate">{item.name}</h4><p className="text-xs text-slate-500">₦{item.price.toLocaleString()}</p></div><div className="flex items-center gap-2"><button onClick={() => { const u = [...editingCart]; if(u[idx].quantity > 1) u[idx].quantity--; else u.splice(idx,1); setEditingCart(u); }} className="w-8 h-8 bg-white rounded-lg flex items-center justify-center"><Minus size={14}/></button><span className="w-8 text-center font-bold">{item.quantity}</span><button onClick={() => { const u = [...editingCart]; u[idx].quantity++; setEditingCart(u); }} className="w-8 h-8 bg-white rounded-lg flex items-center justify-center"><Plus size={14}/></button></div></div>
              ))}
              {editingCart.length === 0 && <p className="text-center text-slate-400 py-10">Order is empty</p>}
            </div>
            <div className="p-8 border-t"><button onClick={async () => { if(editingCart.length === 0) await db.parked_orders.delete(editingParkedOrder.id!); else await saveEditedParkedOrder(); setEditingParkedOrder(null); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black">Update Saved Order</button></div>
          </div>
        </div>
      )}

      {/* GLOBAL CHATBOT OVERLAY */}
      <SmartSupportChat currentUser={currentUser} cart={cart} onClearCart={clearCart} onParkOrder={handleParkOrder} onAddToCart={(product, quantity) => addToCart(product, quantity)} onNavigate={(view) => setView(view as any)} />
    </div>
  );
};

export default POS;