
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  ShoppingCart, 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle, 
  CreditCard, 
  Banknote, 
  Landmark, 
  Package,
  X,
  User,
  Phone,
  ArrowRight,
  Camera,
  AlertTriangle,
  Loader2,
  SplitSquareVertical,
  Receipt,
  Clock,
  PlayCircle,
  RefreshCw
} from 'lucide-react';
import { Product, SaleItem, ParkedOrder, View, Staff, Sale } from '../types';
import { useSync } from '../context/SyncProvider';
import BarcodeScanner from '../components/BarcodeScanner';

interface POSProps {
  setView: (view: View) => void;
  currentUser?: Staff | null;
}

const POS: React.FC<POSProps> = ({ setView, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<string[]>([]);
  const [showParkedModal, setShowParkedModal] = useState(false);
  const [showParkNameModal, setShowParkNameModal] = useState(false);
  const [parkCustomerName, setParkCustomerName] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { broadcastSale } = useSync();
  
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'pos' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });

  const products = useLiveQuery(() => db.products.toArray());
  const parkedOrders = useLiveQuery(() => db.parked_orders.toArray()) || [];

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode?.includes(searchTerm);
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategory]);

  const addToCart = (product: Product) => {
    const inCart = cart.find(item => item.productId === product.id)?.quantity || 0;
    if (inCart >= product.stock_qty) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { 
        productId: product.id!, 
        name: product.name, 
        price: product.price, 
        quantity: 1 
      }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    const product = products?.find(p => p.id === id);
    if (!product) return;

    setCart(prev => prev.map(item => {
      if (item.productId === id) {
        const newQty = item.quantity + delta;
        if (delta > 0 && newQty > product.stock_qty) return item;
        return { ...item, quantity: Math.max(0, newQty) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const cartItemCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Point 1: UUID Generation for Deduplication
      const saleId = crypto.randomUUID ? crypto.randomUUID() : `SAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const saleData: Sale = {
        sale_id: saleId,
        items: cart,
        total_amount: total,
        payment_method: paymentType,
        cash_amount: paymentType === 'split' ? cashAmount : total,
        debt_amount: paymentType === 'split' ? Math.max(0, total - cashAmount) : 0,
        staff_id: currentUser?.id?.toString() || '0',
        staff_name: currentUser?.name || 'Staff', // Point 2: Identity Tracking
        timestamp: Date.now(),
        sync_status: 'pending'
      };

      await db.sales.add(saleData);

      // Inventory Deductions & Low Stock Check
      let lowItems: string[] = [];
      for (const item of cart) {
        const p = await db.products.get(item.productId);
        if (p) {
          const newQty = Math.max(0, p.stock_qty - item.quantity);
          await db.products.update(item.productId, { stock_qty: newQty });
          
          // Point 3: Threshold Alerting
          if (newQty <= (p.low_stock_threshold || 5)) {
            lowItems.push(p.name);
          }
        }
      }

      setIsProcessing(false);
      setShowCheckoutModal(false);
      
      if (lowItems.length > 0) {
        setLowStockProducts(lowItems);
        setShowLowStockAlert(true);
      } else {
        setShowSuccessModal(true);
      }
    } catch (err) {
      alert("Checkout failed: " + err);
      setIsProcessing(false);
    }
  };

  const finalizeAndReset = () => {
    setCart([]);
    setCashAmount(0);
    setPaymentType('cash');
    setShowSuccessModal(false);
    setShowLowStockAlert(false);
    setIsMobileCartOpen(false);
  };

  const requestStockFromAdmin = () => {
    const msg = `🏪 NAIJASHOP REQUEST: ${currentUser?.name}\n\nBoss, my terminal stock is low. Please send me a 'Master Stock Update' link so I can see current business levels.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    finalizeAndReset();
  };

  const CartContent = ({ isMobile = false }) => (
    <div className={`flex flex-col h-full ${isMobile ? 'bg-white' : ''}`}>
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-lg">Basket</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{cartItemCount} items</p>
          </div>
        </div>
        <button onClick={() => setCart([])} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30">
            <Package size={48} />
            <p className="text-xs font-black uppercase mt-4">Basket Empty</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 truncate">{item.name}</p>
                <p className="text-xs text-slate-400 font-bold">₦{item.price.toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-2xl p-1 shadow-sm">
                <button onClick={() => updateQuantity(item.productId, -1)} className="p-2 text-slate-400 hover:text-rose-600"><Minus size={14} /></button>
                <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.productId, 1)} className="p-2 text-slate-400 hover:text-emerald-600"><Plus size={14} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-8 bg-slate-900 text-white space-y-5 lg:rounded-t-[3rem] shadow-2xl">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Amount</span>
          <span className="text-3xl font-black text-emerald-400">₦{total.toLocaleString()}</span>
        </div>
        <button 
          disabled={cart.length === 0} 
          onClick={() => { setCashAmount(total); setShowCheckoutModal(true); }} 
          className="w-full h-14 bg-emerald-600 rounded-2xl font-black text-lg shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          Check-out <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 relative">
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
        <div className="sticky top-0 z-30 bg-slate-50 pt-2 pb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search inventory..." className="w-full h-14 pl-12 pr-6 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none font-medium focus:ring-2 focus:ring-emerald-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProducts.map((product) => {
            const isLow = product.stock_qty <= (product.low_stock_threshold || 5);
            return (
              <button key={product.id} onClick={() => addToCart(product)} className={`bg-white p-5 rounded-[2rem] border text-left flex flex-col h-40 transition-all hover:border-emerald-500 hover:shadow-xl active:scale-95 ${isLow ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100'}`}>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 line-clamp-2 text-sm">{product.name}</h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase mt-1">{product.category}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="font-black text-emerald-600">₦{product.price.toLocaleString()}</p>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${isLow ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    Stock: {product.stock_qty}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden lg:flex w-[350px] bg-white rounded-[2.5rem] shadow-xl border border-slate-100 flex-col overflow-hidden"><CartContent /></div>

      <button onClick={() => setIsMobileCartOpen(true)} className="lg:hidden fixed bottom-6 right-6 w-16 h-16 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50">
        <ShoppingCart size={28} />
      </button>

      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[3rem] h-[85vh] flex flex-col animate-in slide-in-from-bottom">
            <CartContent isMobile />
          </div>
        </div>
      )}

      {/* Point 3: Low Stock Alert Pop-up */}
      {showLowStockAlert && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-amber-950/90 backdrop-blur-xl">
           <div className="bg-white rounded-[3rem] p-10 text-center space-y-6 animate-in zoom-in w-full max-w-sm border-t-8 border-amber-500 shadow-2xl">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><AlertTriangle size={48} className="animate-pulse" /></div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Low Stock!</h3>
                <p className="text-sm text-slate-500 font-medium">The following items hit their threshold:</p>
                <div className="bg-amber-50 p-4 rounded-2xl flex flex-wrap justify-center gap-2 max-h-32 overflow-y-auto">
                   {lowStockProducts.map((name, i) => (
                      <span key={i} className="px-3 py-1 bg-white border border-amber-200 rounded-full text-[10px] font-black uppercase text-amber-700">{name}</span>
                   ))}
                </div>
                <p className="text-[11px] text-slate-400 font-bold mt-2">Sync with Admin to check for main store stock.</p>
              </div>
              <div className="pt-4 flex flex-col gap-3">
                <button onClick={requestStockFromAdmin} className="w-full py-5 bg-amber-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95">
                  <RefreshCw size={20} /> Request Stock
                </button>
                <button onClick={finalizeAndReset} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest">Ignore and Finish</button>
              </div>
           </div>
        </div>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-8 space-y-8 animate-in zoom-in">
            <div className="text-center space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Total</p>
              <h3 className="text-5xl font-black text-slate-900 tracking-tighter">₦{total.toLocaleString()}</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {['cash', 'transfer', 'pos'].map(m => (
                <button key={m} onClick={() => setPaymentType(m as any)} className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${paymentType === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'border-slate-100 text-slate-400 font-bold'}`}>
                  {m === 'cash' ? <Banknote size={24} /> : m === 'transfer' ? <Landmark size={24} /> : <CreditCard size={24} />}
                  <span className="font-black uppercase text-[10px] tracking-widest mt-1">{m}</span>
                </button>
              ))}
              <button onClick={() => setPaymentType('split')} className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${paymentType === 'split' ? 'bg-rose-600 border-rose-600 text-white shadow-lg' : 'border-slate-100 text-slate-400 font-bold'}`}>
                <SplitSquareVertical size={24} />
                <span className="font-black uppercase text-[10px] tracking-widest mt-1">Split</span>
              </button>
            </div>

            <button onClick={handleCheckout} disabled={isProcessing} className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black text-xl shadow-2xl flex items-center justify-center gap-3">
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle />}
              Authorize Sale
            </button>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-emerald-950/95 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] p-12 text-center space-y-8 animate-in zoom-in w-full max-w-sm shadow-2xl">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle size={56} className="animate-bounce" /></div>
              <div className="space-y-2">
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Sale Success!</h3>
                <p className="text-slate-500 font-medium leading-relaxed px-4">The transaction has been logged and the inventory updated.</p>
              </div>
              <button onClick={finalizeAndReset} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-2xl active:scale-95">Proceed to Next</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default POS;
