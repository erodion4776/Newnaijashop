
import React, { useState, useMemo, useEffect } from 'react';
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
  History,
  Tag,
  X,
  User,
  Phone,
  ArrowRight,
  Camera,
  AlertTriangle,
  PackagePlus,
  Loader2,
  ChevronUp
} from 'lucide-react';
import { Product, SaleItem, ParkedSale, View, Staff, Sale } from '../types';
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
  const [showParkedModal, setShowParkedModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const { broadcastSale } = useSync();
  
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'pos' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });

  const products = useLiveQuery(() => db.products.toArray());
  const parkedSales = useLiveQuery(() => db.parked_sales.toArray()) || [];

  const categories = useMemo(() => {
    if (!products) return ['All'];
    const cats = Array.from(new Set(products.map(p => p.category)));
    return ['All', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode?.includes(searchTerm);
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategory]);

  const addToCart = (product: Product) => {
    if (product.stock_qty <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id!, name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === id) return { ...item, quantity: Math.max(0, item.quantity + delta) };
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const cartItemCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const debtAmount = paymentType === 'split' ? Math.max(0, total - cashAmount) : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentType === 'split' && (!customerInfo.name || !customerInfo.phone)) {
      alert("Please enter customer details for the remaining debt.");
      return;
    }

    try {
      const saleData: Sale = {
        items: cart,
        total_amount: total,
        payment_method: paymentType,
        cash_amount: paymentType === 'split' ? cashAmount : total,
        debt_amount: debtAmount,
        staff_id: currentUser?.name || 'Terminal', 
        timestamp: Date.now(),
        sync_status: 'pending'
      };

      await db.sales.add(saleData);
      
      // LIVE BROADCAST: Send to Admin immediately
      broadcastSale(saleData);

      if (debtAmount > 0) {
        await db.debts.add({ customer_name: customerInfo.name, phone: customerInfo.phone, amount: debtAmount, status: 'pending', timestamp: Date.now() });
      }

      for (const item of cart) {
        const product = await db.products.get(item.productId);
        if (product) {
          await db.products.update(item.productId, { stock_qty: Math.max(0, product.stock_qty - item.quantity) });
        }
      }

      setShowCheckoutModal(false);
      setIsMobileCartOpen(false);
      setShowSuccessModal(true);
    } catch (err) {
      alert("Error: " + err);
    }
  };

  const finalizeSale = () => {
    setCart([]);
    setCashAmount(0);
    setCustomerInfo({ name: '', phone: '' });
    setShowSuccessModal(false);
  };

  const CartContent = ({ isMobile = false }) => (
    <div className={`flex flex-col h-full ${isMobile ? 'bg-white' : ''}`}>
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg">
            <ShoppingCart size={20} />
          </div>
          <h3 className="font-black text-slate-800 text-lg">Current Cart</h3>
        </div>
        <button onClick={() => setCart([])} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {cart.map((item) => (
          <div key={item.productId} className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
              <p className="text-xs text-slate-500 font-black">₦{(item.price * item.quantity).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-1.5 border border-slate-100">
              <button onClick={() => updateQuantity(item.productId, -1)} className="w-9 h-9 flex items-center justify-center bg-white rounded-xl shadow-sm"><Minus size={14} /></button>
              <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.productId, 1)} className="w-9 h-9 flex items-center justify-center bg-white rounded-xl shadow-sm text-emerald-600"><Plus size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="p-8 bg-slate-900 text-white space-y-5 lg:rounded-t-[3rem]">
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold">Total Pay</span>
          <span className="text-4xl font-black text-emerald-400 tracking-tighter">₦{total.toLocaleString()}</span>
        </div>
        <button disabled={cart.length === 0} onClick={() => { setCashAmount(total); setShowCheckoutModal(true); }} className="w-full h-14 bg-emerald-600 rounded-2xl font-black text-xl shadow-2xl transition-all active:scale-95 disabled:opacity-50">Checkout</button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 relative">
      {showScanner && <BarcodeScanner onScan={(barcode) => { const p = products?.find(i => i.barcode === barcode); if(p) addToCart(p); setShowScanner(false); }} onClose={() => setShowScanner(false)} />}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 pb-24 lg:pb-0">
        <div className="sticky top-0 z-30 bg-slate-50 pt-2 pb-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input type="text" placeholder="Search product..." className="w-full h-14 pl-12 pr-16 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <button onClick={() => setShowScanner(true)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl"><Camera size={24} /></button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-6 h-10 rounded-full whitespace-nowrap text-sm font-bold transition-all border ${activeCategory === cat ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filteredProducts.map((product) => (
            <button key={product.id} onClick={() => addToCart(product)} disabled={product.stock_qty <= 0} className={`bg-white p-5 rounded-3xl border text-left flex flex-col h-44 relative overflow-hidden active:scale-95 ${product.stock_qty <= 0 ? 'opacity-60 grayscale' : 'border-slate-200 hover:border-emerald-500'}`}>
              <div className="flex-1">
                <h4 className="font-bold text-slate-800 line-clamp-2 text-sm">{product.name}</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase mt-1">{product.category}</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="font-black text-lg text-emerald-600">₦{product.price.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400">Stock: {product.stock_qty}</p>
                </div>
                <Plus size={20} className="text-emerald-500" />
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="hidden lg:flex w-[400px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 flex-col overflow-hidden"><CartContent /></div>
      
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 space-y-6 animate-in zoom-in">
            <h3 className="text-2xl font-black text-slate-900">Authorize Sale</h3>
            <div className="grid grid-cols-4 gap-3">
              {['cash', 'transfer', 'pos', 'split'].map(m => (
                <button key={m} onClick={() => setPaymentType(m as any)} className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center font-black uppercase text-[10px] ${paymentType === m ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-100'}`}>{m}</button>
              ))}
            </div>
            <button onClick={handleCheckout} className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl active:scale-95">Complete Transaction</button>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-emerald-950/95 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] p-10 text-center space-y-8 animate-in zoom-in">
              <CheckCircle size={80} className="text-emerald-500 mx-auto" />
              <h3 className="text-3xl font-black text-slate-900">Confirmed!</h3>
              <button onClick={finalizeSale} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black">Return to POS</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default POS;
