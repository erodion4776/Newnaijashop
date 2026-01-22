
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
  Camera,
  AlertTriangle,
  Loader2,
  SplitSquareVertical,
  Receipt,
  Clock,
  PlayCircle
} from 'lucide-react';
import { Product, SaleItem, ParkedOrder, View, Staff, Sale } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import { performAutoSnapshot } from '../utils/backup';

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
  const [showScanner, setShowScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'pos' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState<number>(0);

  const products = useLiveQuery(() => db.products.toArray());

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

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const saleId = crypto.randomUUID ? crypto.randomUUID() : `SAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const saleData: Sale = {
        sale_id: saleId,
        items: cart,
        total_amount: total,
        payment_method: paymentType,
        cash_amount: paymentType === 'split' ? cashAmount : total,
        staff_id: currentUser?.id?.toString() || '0',
        staff_name: currentUser?.name || 'Local Terminal',
        timestamp: Date.now()
      };

      await db.sales.add(saleData);

      let lowItems: string[] = [];
      for (const item of cart) {
        const p = await db.products.get(item.productId);
        if (p) {
          const newQty = Math.max(0, p.stock_qty - item.quantity);
          await db.products.update(item.productId, { stock_qty: newQty });
          if (newQty <= (p.low_stock_threshold || 5)) lowItems.push(p.name);
        }
      }

      // Point 2: Auto-Snapshot trigger
      const currentSalesCount = await db.sales.count();
      if (currentSalesCount % 10 === 0) {
        performAutoSnapshot();
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

  const reset = () => {
    setCart([]);
    setCashAmount(0);
    setPaymentType('cash');
    setShowSuccessModal(false);
    setShowLowStockAlert(false);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 relative">
       {/* ... original POS layout with updated checkout/snapshot logic ... */}
       <div className="flex-1 overflow-y-auto space-y-4">
          <div className="sticky top-0 z-30 bg-slate-50 py-2 flex gap-4">
             <div className="relative flex-1">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
               <input type="text" placeholder="Search product..." className="w-full h-14 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
             <button onClick={() => setShowScanner(true)} className="h-14 w-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center"><Camera /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
             {filteredProducts.map(p => (
               <button key={p.id} onClick={() => addToCart(p)} className="bg-white p-5 rounded-[2rem] border border-slate-100 text-left h-40 flex flex-col justify-between hover:border-emerald-500 transition-all">
                  <h4 className="font-bold text-slate-800 line-clamp-2 text-sm">{p.name}</h4>
                  <div className="flex justify-between items-end">
                     <p className="font-black text-emerald-600">₦{p.price.toLocaleString()}</p>
                     <span className="text-[10px] font-black text-slate-400">Stock: {p.stock_qty}</span>
                  </div>
               </button>
             ))}
          </div>
       </div>
       
       <div className="w-full lg:w-[350px] bg-white rounded-[2.5rem] border border-slate-200 p-6 flex flex-col shadow-xl">
          <h3 className="font-black text-slate-800 mb-4">Cart</h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
             {cart.map(item => (
               <div key={item.productId} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                  <div className="flex-1"><p className="font-bold text-sm truncate">{item.name}</p><p className="text-xs text-slate-400">₦{item.price}</p></div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 text-rose-500"><Minus size={14} /></button>
                    <span className="font-black">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 text-emerald-500"><Plus size={14} /></button>
                  </div>
               </div>
             ))}
          </div>
          <div className="mt-6 pt-6 border-t space-y-4">
             <div className="flex justify-between items-center">
                <span className="font-bold text-slate-400">Total</span>
                <span className="text-2xl font-black text-emerald-600">₦{total.toLocaleString()}</span>
             </div>
             <button disabled={cart.length === 0} onClick={() => setShowCheckoutModal(true)} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-lg active:scale-95 disabled:opacity-50">Checkout</button>
          </div>
       </div>

       {showCheckoutModal && (
         <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm space-y-6">
               <h3 className="text-2xl font-black text-slate-900 text-center">Complete Sale</h3>
               <div className="grid grid-cols-2 gap-3">
                  {['cash', 'transfer', 'pos'].map(m => (
                    <button key={m} onClick={() => setPaymentType(m as any)} className={`py-4 rounded-2xl border-2 font-black uppercase text-xs ${paymentType === m ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-100 text-slate-400'}`}>{m}</button>
                  ))}
               </div>
               <button onClick={handleCheckout} className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black shadow-xl">Confirm ₦{total.toLocaleString()}</button>
            </div>
         </div>
       )}

       {showSuccessModal && (
         <div className="fixed inset-0 z-[600] flex items-center justify-center bg-emerald-950/90 backdrop-blur-md">
            <div className="bg-white rounded-[3rem] p-10 text-center space-y-6">
               <CheckCircle className="mx-auto text-emerald-500" size={64} />
               <h3 className="text-3xl font-black text-slate-900">Sale Logged!</h3>
               <button onClick={reset} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black">Next Transaction</button>
            </div>
         </div>
       )}
    </div>
  );
};

export default POS;
