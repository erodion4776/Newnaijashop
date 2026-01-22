
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
  ChevronRight
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
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'pos' | 'split' | null>(null);
  const [cashAmount, setCashAmount] = useState<number>(0);

  // Parked Orders States
  const [showParkModal, setShowParkModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showParkedListModal, setShowParkedListModal] = useState(false);

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
    if (inCart >= product.stock_qty) {
      alert("Out of stock!");
      return;
    }
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

  const handleParkSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("Nothing to park!");
      return;
    }
    
    // Logic: Default to 'Quick Order' if name is empty
    const customerName = tempName.trim() || 'Quick Order';

    try {
      // Logic: Ensure the customerName state is explicitly included in the object being saved
      await db.parked_orders.add({
        customerName: customerName,
        items: [...cart],
        total: total,
        staffId: currentUser?.id?.toString() || '0',
        timestamp: Date.now()
      });

      setCart([]);
      setTempName('');
      setShowParkModal(false);
      console.log('Order parked successfully');
    } catch (err) {
      alert("Failed to park order: " + err);
    }
  };

  const handleResumeOrder = async (orderId: number) => {
    try {
      // 1. Fetch the order from the database
      const order = await db.parked_orders.get(orderId);
      if (!order) {
        alert("Order not found!");
        return;
      }

      if (cart.length > 0) {
        if (!confirm("Your current cart is not empty. Resuming this order will overwrite your current cart. Continue?")) return;
      }

      // 2. Logic: Ensure items are loaded into POS cart state (handle potential string format)
      let itemsToLoad = order.items;
      if (typeof itemsToLoad === 'string') {
        try {
          itemsToLoad = JSON.parse(itemsToLoad);
        } catch (e) {
          console.error("Failed to parse items", e);
          itemsToLoad = [];
        }
      }
      
      if (!Array.isArray(itemsToLoad)) {
        alert("Invalid item data in parked order.");
        return;
      }

      setCart([...itemsToLoad]);

      // 3. Wait for the state to update (sequential execution), then delete from parked_orders
      await db.parked_orders.delete(orderId);
      
      // 4. UI Cleanup
      setShowParkedListModal(false);
      console.log('Order resumed successfully');
    } catch (error: any) {
      alert('Resume Failed: ' + error.message);
    }
  };

  const handleCompleteSale = async () => {
    // 1. Validation & State Lock
    if (cart.length === 0) return;
    if (isProcessing) return;
    if (!paymentType) {
      alert('Please select a payment method.');
      return;
    }

    setIsProcessing(true);
    
    try {
      const saleId = crypto.randomUUID ? crypto.randomUUID() : `SAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const subtotal = total;
      const tax = 0;

      const saleData: Sale = {
        sale_id: saleId,
        items: [...cart],
        total_amount: total,
        subtotal: subtotal,
        tax: tax,
        payment_method: paymentType === 'split' ? 'split' : paymentType,
        cash_amount: paymentType === 'split' ? cashAmount : (paymentType === 'cash' ? total : 0),
        staff_id: currentUser?.id?.toString() || '0',
        staff_name: currentUser?.name || 'Local Terminal',
        timestamp: Date.now(),
        sync_status: 'pending'
      };

      let lowItems: string[] = [];
      
      // 2. Atomic Transaction (Engine)
      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        // Step A: Record Sale
        await db.sales.add(saleData);

        // Step B: Loop products with existence guards
        for (const item of cart) {
          const product = await db.products.get(item.productId);
          
          if (product) {
            const oldStock = product.stock_qty || 0;
            const newStock = Math.max(0, oldStock - item.quantity);
            
            // Step C: Update Stock
            await db.products.update(item.productId, { 
              stock_qty: newStock 
            });
            
            // Step D: Log Movement
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

            if (newStock <= (product.low_stock_threshold || 5)) {
              lowItems.push(product.name);
            }
          }
        }
      });

      // 3. Success Flow
      console.log('Sale successful!');
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
      // 4. Detailed Error Reporting
      console.error("Sale Processing Error:", error);
      alert('Database Error: ' + error.message);
    } finally {
      // Always unlock the button
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setCart([]);
    setCashAmount(0);
    setPaymentType(null);
    setShowSuccessModal(false);
    setShowLowStockAlert(false);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 relative">
       <div className="flex-1 overflow-y-auto space-y-4">
          <div className="sticky top-0 z-30 bg-slate-50 py-2 flex gap-4">
             <div className="relative flex-1">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
               <input type="text" placeholder="Search product..." className="w-full h-14 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={() => setShowParkedListModal(true)} 
                  className={`h-14 px-5 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${parkedOrders.length > 0 ? 'bg-amber-100 text-amber-700 border-2 border-amber-200' : 'bg-white border border-slate-200 text-slate-400'}`}
                >
                  <History size={18} /> Parked ({parkedOrders.length})
                </button>
                <button onClick={() => setShowScanner(true)} className="h-14 w-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Camera /></button>
             </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
             {filteredProducts.map(p => (
               <button key={p.id} onClick={() => addToCart(p)} className="bg-white p-5 rounded-[2rem] border border-slate-100 text-left h-40 flex flex-col justify-between hover:border-emerald-500 transition-all shadow-sm">
                  <h4 className="font-bold text-slate-800 line-clamp-2 text-sm">{p.name}</h4>
                  <div className="flex justify-between items-end">
                     <p className="font-black text-emerald-600">₦{p.price.toLocaleString()}</p>
                     <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${p.stock_qty <= p.low_stock_threshold ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>Stock: {p.stock_qty}</span>
                  </div>
               </button>
             ))}
          </div>
       </div>
       
       <div className="w-full lg:w-[350px] bg-white rounded-[2.5rem] border border-slate-200 p-6 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-800">Current Cart</h3>
            <button onClick={() => setCart([])} className="text-xs font-black text-rose-400 uppercase tracking-widest hover:text-rose-600">Clear</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
             {cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                 <ShoppingCart size={64} />
                 <p className="mt-4 font-black text-xs uppercase tracking-widest">Cart is Empty</p>
               </div>
             ) : (
               cart.map(item => (
                 <div key={item.productId} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold text-sm truncate text-slate-800">{item.name}</p>
                      <p className="text-[10px] font-black text-emerald-600">₦{item.price.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="p-1.5 bg-white rounded-lg border border-slate-200 text-rose-500 shadow-sm"><Minus size={12} /></button>
                      <span className="font-black text-sm tabular-nums">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="p-1.5 bg-white rounded-lg border border-slate-200 text-emerald-500 shadow-sm"><Plus size={12} /></button>
                    </div>
                 </div>
               ))
             )}
          </div>
          <div className="mt-6 pt-6 border-t space-y-4">
             <div className="flex justify-between items-center px-2">
                <span className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Total Payable</span>
                <span className="text-3xl font-black text-emerald-600 tracking-tighter">₦{total.toLocaleString()}</span>
             </div>
             
             <div className="grid grid-cols-2 gap-2">
               <button 
                disabled={cart.length === 0} 
                onClick={() => setShowParkModal(true)} 
                className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 <Pause size={18} /> Park Sale
               </button>
               <button 
                disabled={cart.length === 0} 
                onClick={() => setShowCheckoutModal(true)} 
                className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 Checkout <ChevronRight size={18} />
               </button>
             </div>
          </div>
       </div>

       {/* Park Name Modal */}
       {showParkModal && (
         <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm space-y-8 animate-in zoom-in duration-300">
               <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-2"><FolderOpen size={32} /></div>
                  <h3 className="text-2xl font-black text-slate-900">Name this Order</h3>
                  <p className="text-slate-400 text-sm font-medium">Save this cart to finish it later.</p>
               </div>
               <form onSubmit={handleParkSale} className="space-y-6">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      autoFocus
                      required
                      type="text" 
                      placeholder="e.g. Musa or Red Cap Man" 
                      className="w-full pl-12 pr-4 py-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-amber-500" 
                      value={tempName}
                      onChange={e => setTempName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <button type="button" onClick={() => setShowParkModal(false)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                     <button type="submit" className="py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Park Order</button>
                  </div>
               </form>
            </div>
         </div>
       )}

       {/* Parked Orders List Modal */}
       {showParkedListModal && (
         <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[80vh]">
               <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Parked Orders</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Waiting to be completed</p>
                  </div>
                  <button onClick={() => setShowParkedListModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
                  {parkedOrders.length === 0 ? (
                    <div className="text-center py-20 space-y-4">
                       <History size={48} className="mx-auto text-slate-100" />
                       <p className="text-slate-400 font-black text-sm uppercase tracking-widest">No parked orders found</p>
                    </div>
                  ) : (
                    parkedOrders.map(order => (
                      <div key={order.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                         <div>
                            <div className="flex items-center gap-2 mb-1">
                               <User size={14} className="text-amber-500" />
                               <h4 className="font-black text-slate-800">{order.customerName}</h4>
                            </div>
                            <div className="flex gap-4">
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">₦{order.total.toLocaleString()} Total</p>
                               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{order.items.length} Items</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                            <button 
                              onClick={async () => { if(confirm("Delete this parked order?")) await db.parked_orders.delete(order.id!); }}
                              className="p-3 text-rose-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={20} />
                            </button>
                            <button 
                              onClick={() => handleResumeOrder(order.id!)}
                              className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2"
                            >
                               <PlayCircle size={16} /> Resume Order
                            </button>
                         </div>
                      </div>
                    ))
                  )}
               </div>
            </div>
         </div>
       )}

       {showCheckoutModal && (
         <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm space-y-6 animate-in zoom-in duration-300">
               <div className="flex items-center justify-between">
                 <h3 className="text-2xl font-black text-slate-900">Payment</h3>
                 <button onClick={() => setShowCheckoutModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
               </div>
               
               <div className="space-y-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Select Payment Method</p>
                 <div className="grid grid-cols-2 gap-3">
                    {['cash', 'transfer', 'pos', 'split'].map(m => (
                      <button 
                        key={m} 
                        onClick={() => setPaymentType(m as any)} 
                        className={`py-4 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest transition-all ${paymentType === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                      >
                        {m === 'pos' ? 'POS Terminal' : m}
                      </button>
                    ))}
                 </div>
               </div>

               {paymentType === 'split' && (
                 <div className="space-y-2 animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cash Amount (₦)</label>
                    <input 
                      type="number" 
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-center text-xl outline-none focus:ring-2 focus:ring-emerald-500" 
                      value={cashAmount || ''} 
                      onChange={e => setCashAmount(Number(e.target.value))} 
                      placeholder="Amount paid in cash"
                    />
                    <p className="text-[10px] text-center text-slate-400 font-bold">The remaining ₦{(total - cashAmount).toLocaleString()} will be Transfer/POS.</p>
                 </div>
               )}

               <div className="pt-4 space-y-3">
                 <button 
                  disabled={isProcessing}
                  onClick={handleCompleteSale} 
                  className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                 >
                   {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                   {isProcessing ? 'Processing...' : `Confirm ₦${total.toLocaleString()}`}
                 </button>
                 <button 
                   onClick={() => setShowCheckoutModal(false)}
                   className="w-full py-2 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
                 >
                   Cancel
                 </button>
               </div>
            </div>
         </div>
       )}

       {showSuccessModal && (
         <div className="fixed inset-0 z-[600] flex items-center justify-center bg-emerald-950/90 backdrop-blur-md">
            <div className="bg-white rounded-[3rem] p-10 text-center space-y-6 animate-in zoom-in duration-500 shadow-2xl">
               <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                 <CheckCircle size={64} className="animate-bounce" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-3xl font-black text-slate-900">Sale Logged!</h3>
                 <p className="text-slate-500 font-medium">Transaction has been recorded successfully.</p>
               </div>
               <button onClick={reset} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl hover:scale-105 transition-transform">Next Transaction</button>
            </div>
         </div>
       )}

       {showLowStockAlert && (
         <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
            <div className="bg-white rounded-[3rem] p-10 text-center space-y-8 max-w-sm animate-in zoom-in duration-500">
               <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                 <AlertTriangle size={48} className="animate-pulse" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-2xl font-black text-slate-900 leading-tight">Sale Success & Stock Alert!</h3>
                 <p className="text-slate-500 text-sm font-medium">The following items are now low in stock:</p>
                 <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {lowStockProducts.map(name => (
                      <span key={name} className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100">{name}</span>
                    ))}
                 </div>
               </div>
               <button onClick={reset} className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black shadow-xl">Got it, Continue</button>
            </div>
         </div>
       )}

       {showScanner && <BarcodeScanner onScan={(code) => {
         const p = products?.find(prod => prod.barcode === code);
         if (p) {
           addToCart(p);
         } else {
           alert("Product not found: " + code);
         }
       }} onClose={() => setShowScanner(false)} />}
    </div>
  );
};

export default POS;
