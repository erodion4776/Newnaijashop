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
  RefreshCw
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
  const [showCheckout, setShowCheckout] = useState(false);
  const [showParkedOrders, setShowParkedOrders] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showSyncRequired, setShowSyncRequired] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [parkingCustomerName, setParkingCustomerName] = useState('');
  const [showParkModal, setShowParkModal] = useState(false);
  const [activeParkedId, setActiveParkedId] = useState<number | null>(null);
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
    // Updated: Remove the > 0 filter to allow "Out of Stock" visibility as requested
    return filtered;
  }, [products, selectedCategory, searchTerm]);

  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    return { subtotal, total: subtotal, itemCount: cart.reduce((sum, item) => sum + item.quantity, 0) };
  }, [cart]);

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

  const handleCheckoutComplete = async (sale: any, lowItems: string[]) => {
    setCart([]);
    setShowCheckout(false);
    setShowMobileCart(false);
    if (lowItems.length > 0) setShowSyncRequired(true);
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) { setCart(cart.filter(i => i.productId !== productId)); return; }
    const p = products.find(p => p.id === productId);
    if (p && newQuantity > p.stock_qty) { alert(`Only ${p.stock_qty} available`); return; }
    setCart(cart.map(i => i.productId === productId ? { ...i, quantity: newQuantity } : i));
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden relative">
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input ref={searchInputRef} type="text" placeholder="Search products..." className="w-full pl-10 pr-4 h-14 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
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
                    {/* Stock Display Indicator */}
                    <div className={`text-[10px] mb-1 font-bold ${isOutOfStock ? 'text-rose-600 font-black' : isLowStock ? 'text-amber-600 font-black' : 'text-slate-400'}`}>
                      {isOutOfStock ? (
                        'OUT OF STOCK'
                      ) : isLowStock ? (
                        `⚠️ Only ${product.stock_qty} Left`
                      ) : (
                        `${product.stock_qty} Units Available`
                      )}
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
      </div>

      {showScanner && <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
      {showCheckout && <CheckoutModal isOpen={showCheckout} onClose={() => setShowCheckout(false)} cart={cart} total={cartSummary.total} currentUser={currentUser} onComplete={handleCheckoutComplete} />}
    </div>
  );
};

export default POS;