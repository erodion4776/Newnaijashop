
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
  PlayCircle,
  Pause,
  FolderOpen,
  User,
  History,
  ChevronRight,
  Printer,
  Share2,
  MessageSquare
} from 'lucide-react';
import { Product, SaleItem, ParkedOrder, View, Staff, Sale, Settings } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import NotificationService from '../services/NotificationService';

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
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<string[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'pos' | 'split' | null>(null);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [animatingId, setAnimatingId] = useState<number | null>(null);

  // FIX: useLiveQuery ensures that changes made in Inventory reflect here immediately
  const products = useLiveQuery(() => db.products.toArray());
  const parkedOrders = useLiveQuery(() => db.parked_orders.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('app_settings')) as Settings | undefined;

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
    if (inCart + 1 > product.stock_qty) {
      alert(`Oga, only ${product.stock_qty} left in stock!`);
      return;
    }
    setAnimatingId(product.id!);
    setTimeout(() => setAnimatingId(null), 500);
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id!, name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    const product = products?.find(p => p.id === id);
    setCart(prev => prev.map(item => {
      if (item.productId === id) {
        const newQty = item.quantity + delta;
        if (product && newQty > product.stock_qty) {
          alert(`Oga, only ${product.stock_qty} available!`);
          return { ...item, quantity: product.stock_qty };
        }
        return { ...item, quantity: Math.max(0, newQty) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

  // FIX: Logic to handle checkout opening with stock validation
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;

    // Stock Validation: Check if items in cart exceed available stock
    const overstockItem = cart.find(item => {
      const p = products?.find(prod => prod.id === item.productId);
      return p ? item.quantity > p.stock_qty : false;
    });

    if (overstockItem) {
      alert(`Error: '${overstockItem.name}' quantity exceeds available stock. Please adjust.`);
      return;
    }

    setShowCheckoutModal(true);
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0 || isProcessing || !paymentType) return;
    setIsProcessing(true);
    try {
      for (const item of cart) {
        const product = await db.products.get(item.productId);
        if (product && !item.isStockAlreadyDeducted && item.quantity > product.stock_qty) {
          alert(`Oga, stock mismatch for ${product.name}. Only ${product.stock_qty} left.`);
          setIsProcessing(false);
          return;
        }
      }
      const saleId = crypto.randomUUID ? crypto.randomUUID() : `SAL-${Date.now()}`;
      const saleData: Sale = {
        sale_id: saleId,
        items: [...cart],
        total_amount: total,
        subtotal: total,
        payment_method: paymentType === 'split' ? 'split' : paymentType,
        cash_amount: paymentType === 'split' ? cashAmount : (paymentType === 'cash' ? total : 0),
        staff_id: currentUser?.id?.toString() || '0',
        staff_name: currentUser?.name || 'Staff',
        timestamp: Date.now(),
        sync_status: 'pending'
      };

      let lowItems: string[] = [];
      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        await db.sales.add(saleData);
        for (const item of cart) {
          if (!item.isStockAlreadyDeducted) {
            const product = await db.products.get(item.productId);
            if (product) {
              const oldStock = product.stock_qty;
              const newStock = Math.max(0, oldStock - item.quantity);
              await db.products.update(item.productId, { stock_qty: newStock });
              await db.inventory_logs.add({
                product_id: item.productId,
                product_name: product.name,
                quantity_changed: -item.quantity,
                old_stock: oldStock,
                new_stock: newStock,
                type: 'Sale',
                timestamp: Date.now(),
                performed_by: currentUser?.name || 'Staff'
              });
              if (newStock <= (product.low_stock_threshold || 5)) lowItems.push(product.name);
            }
          }
        }
      });

      setLastCompletedSale(saleData);
      setCart([]);
      setCashAmount(0);
      setPaymentType(null);
      setShowCheckoutModal(false);
      if (lowItems.length > 0) {
        setLowStockProducts(lowItems);
        setShowLowStockAlert(true);
      } else {
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      alert('Database Error: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (!lastCompletedSale || !settings) return;
    const itemsText = lastCompletedSale.items.map(i => `${i.name} x${i.quantity} @ ₦${i.price.toLocaleString()} = ₦${(i.price * i.quantity).toLocaleString()}`).join('\n');
    const text = `--- ${settings.shop_name.toUpperCase()} ---\n${settings.shop_address || ''}\n\nRECEIPT: ${lastCompletedSale.sale_id}\nDATE: ${new Date(lastCompletedSale.timestamp).toLocaleString()}\n\nITEMS:\n${itemsText}\n\nTOTAL: ₦${lastCompletedSale.total_amount.toLocaleString()}\nPAYMENT: ${lastCompletedSale.payment_method.toUpperCase()}\n\n${settings.receipt_footer || 'Thanks for your patronage!'}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const reset = () => {
    setLastCompletedSale(null);
    setShowSuccessModal(false);
    setShowLowStockAlert(false);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 relative">
       <div className={`fixed inset-0 z-[450] bg-black/60 backdrop-blur-sm lg:hidden transition-opacity ${showMobileCart ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowMobileCart(false)} />
       
       <div className="flex-1 overflow-y-auto space-y-4 pb-20 lg:pb-0">
          <div className="sticky top-0 z-30 bg-slate-50 py-2 flex gap-4">
             <div className="relative flex-1">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
               <input type="text" placeholder="Search product..." className="w-full h-14 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
             <button onClick={() => setShowScanner(true)} className="h-14 w-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Camera /></button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
             {filteredProducts.map(p => (
               <button key={p.id} disabled={p.stock_qty <= 0} onClick={() => addToCart(p)} className={`bg-white p-5 rounded-[2rem] border border-slate-100 text-left h-44 flex flex-col justify-between hover:border-emerald-500 transition-all shadow-sm relative group ${p.stock_qty <= 0 ? 'opacity-60 grayscale' : ''}`}>
                  {animatingId === p.id && <span className="absolute right-4 top-4 text-emerald-600 font-black text-xl animate-bounce-up z-20">+1</span>}
                  <div>
                    <h4 className="font-bold text-slate-800 line-clamp-2 text-sm">{p.name}</h4>
                    <span className={`inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full ${p.stock_qty <= p.low_stock_threshold ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>{p.stock_qty} Units Left</span>
                  </div>
                  <div className="flex justify-between items-end">
                     <p className="font-black text-emerald-600 text-base">₦{p.price.toLocaleString()}</p>
                     <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors"><Plus size={16} /></div>
                  </div>
               </button>
             ))}
          </div>
       </div>
       
       <div className={`fixed inset-y-0 right-0 w-[85%] max-w-[400px] bg-white z-[500] shadow-2xl transition-transform lg:static lg:w-[350px] rounded-l-[2.5rem] lg:rounded-[2.5rem] flex flex-col p-6 ${showMobileCart ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-800 flex items-center gap-2"><ShoppingCart size={20} className="text-emerald-600" /> Cart</h3>
            <button onClick={() => setCart([])} className="text-xs font-black text-rose-400 uppercase tracking-widest hover:text-rose-600">Clear</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
             {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center opacity-20 py-20"><ShoppingCart size={64} /><p className="mt-4 font-black text-xs uppercase">Empty</p></div> : cart.map((item, idx) => (
               <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-sm truncate text-slate-800">{item.name}</p>
                    <p className="text-[10px] font-black text-emerald-600">₦{item.price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQuantity(item.productId, -1)} className="p-1.5 bg-white rounded-lg text-rose-500 shadow-sm"><Minus size={12} /></button>
                    <span className="font-black text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, 1)} className="p-1.5 bg-white rounded-lg text-emerald-500 shadow-sm"><Plus size={12} /></button>
                  </div>
               </div>
             ))}
          </div>
          <div className="mt-6 pt-6 border-t space-y-4">
             <div className="flex justify-between items-center px-2">
                <span className="font-black text-[10px] text-slate-400 uppercase">Total Payable</span>
                <span className="text-3xl font-black text-emerald-600">₦{total.toLocaleString()}</span>
             </div>
             {/* FIX: Checkout button layout and click handler */}
             <button 
                disabled={cart.length === 0} 
                onClick={handleOpenCheckout} 
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 disabled:opacity-50"
             >
                Checkout <ChevronRight size={18} className="inline ml-1"/>
             </button>
          </div>
       </div>

       {/* Mobile Sticky Bottom Bar */}
       <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-[400] flex gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => setShowMobileCart(true)} 
            className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <ShoppingCart size={18} />
            Cart ({cart.reduce((a,b) => a + b.quantity, 0)})
          </button>
          <button 
            disabled={cart.length === 0} 
            onClick={handleOpenCheckout} 
            className="flex-[1.5] bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg disabled:opacity-50"
          >
            Checkout ₦{total.toLocaleString()}
          </button>
       </div>

       {/* FIX: Checkout Modal with high z-index and conditional rendering */}
       {showCheckoutModal && (
         <div className="fixed inset-0 z-[1000] flex items-center justify-center lg:p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white lg:rounded-[3rem] w-full h-full lg:h-auto lg:max-w-md animate-in slide-in-from-bottom-full lg:zoom-in duration-300 flex flex-col relative z-[1001]">
               <div className="p-8 border-b flex items-center justify-between">
                 <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Payable</p><h3 className="text-4xl font-black text-slate-900">₦{total.toLocaleString()}</h3></div>
                 <button onClick={() => setShowCheckoutModal(false)} className="p-3 bg-slate-50 rounded-full text-slate-400"><X size={24} /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-8 space-y-8">
                 <div className="grid grid-cols-2 gap-3">
                   {['cash', 'transfer', 'pos', 'split'].map(m => (
                     <button key={m} onClick={() => setPaymentType(m as any)} className={`py-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${paymentType === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                       <span className="font-black uppercase text-[10px] tracking-widest">{m}</span>
                     </button>
                   ))}
                 </div>
               </div>
               <div className="p-8 border-t">
                 <button disabled={isProcessing} onClick={handleCompleteSale} className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4">
                   {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={28} />} Complete Sale
                 </button>
               </div>
            </div>
         </div>
       )}

       {showSuccessModal && (
         <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-emerald-950/90 backdrop-blur-md">
            <div className="bg-white rounded-[4rem] p-10 text-center space-y-8 animate-in zoom-in duration-500 shadow-2xl max-w-sm w-full mx-4">
               <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner relative">
                 <CheckCircle size={64} className="animate-bounce" />
               </div>
               <div className="space-y-3">
                 <h3 className="text-3xl font-black text-slate-900">Done & Dusted!</h3>
                 <p className="text-slate-500 font-medium">₦{lastCompletedSale?.total_amount.toLocaleString()} logged.</p>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                  <button onClick={handlePrint} className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                    <Printer size={16} /> Print
                  </button>
                  <button onClick={handleShareWhatsApp} className="py-4 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors">
                    <MessageSquare size={16} /> Share
                  </button>
               </div>

               <button onClick={reset} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-2xl hover:scale-[1.02] transition-transform">Next Customer</button>
            </div>
         </div>
       )}

       {/* Hidden Print Content */}
       <div id="printable-receipt-area" className="hidden print:block text-slate-900 p-4 font-mono text-xs w-full max-w-[380px] mx-auto">
          <div className="text-center space-y-1 mb-6">
            <h1 className="text-lg font-black uppercase">{settings?.shop_name}</h1>
            <p className="whitespace-pre-line">{settings?.shop_address}</p>
            <p className="text-[10px] font-bold">POS Terminal: #{lastCompletedSale?.sale_id.substring(0,8)}</p>
          </div>
          <div className="border-y border-dashed border-slate-300 py-3 mb-4">
             <div className="flex justify-between font-black mb-2 uppercase text-[10px]">
                <span className="w-1/2">Item</span>
                <span className="w-1/4 text-center">Qty</span>
                <span className="w-1/4 text-right">Price</span>
             </div>
             {lastCompletedSale?.items.map((item, idx) => (
               <div key={idx} className="flex justify-between mb-1">
                  <span className="w-1/2 truncate pr-2 uppercase">{item.name}</span>
                  <span className="w-1/4 text-center">x{item.quantity}</span>
                  <span className="w-1/4 text-right">₦{(item.price * item.quantity).toLocaleString()}</span>
               </div>
             ))}
          </div>
          <div className="space-y-1 text-sm font-black mb-6">
             <div className="flex justify-between"><span>TOTAL</span><span>₦{lastCompletedSale?.total_amount.toLocaleString()}</span></div>
             <div className="flex justify-between text-[10px] font-bold"><span>PAYMENT</span><span className="uppercase">{lastCompletedSale?.payment_method}</span></div>
          </div>
          <div className="text-center border-t border-dashed border-slate-300 pt-4 space-y-2">
             <p className="text-[9px] font-bold uppercase">{new Date(lastCompletedSale?.timestamp || 0).toLocaleString()}</p>
             <p className="text-[9px] font-bold uppercase italic">{settings?.receipt_footer}</p>
             <p className="text-[8px] text-slate-400 mt-4 uppercase">Powered by NaijaShop POS</p>
          </div>
       </div>

       {showScanner && <BarcodeScanner onScan={(code) => {
         const p = products?.find(prod => prod.barcode === code);
         if (p) addToCart(p); else alert("Not found: " + code);
       }} onClose={() => setShowScanner(false)} />}
    </div>
  );
};

export default POS;
