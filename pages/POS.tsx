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
  ArrowRight
} from 'lucide-react';
import { Product, SaleItem, ParkedOrder, View, Staff, Sale } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import { performAutoSnapshot } from '../utils/backup';
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
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<string[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'pos' | 'split' | null>(null);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [animatingId, setAnimatingId] = useState<number | null>(null);

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
    
    // 1. Implement the 'Stock Guard' (Logic)
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
        // 1. Manual Quantity Entry check
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

  const handleParkSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("Nothing to park!");
      return;
    }
    
    const customerName = tempName.trim() || 'Quick Order';

    try {
      await (db as any).transaction('rw', [db.products, db.parked_orders, db.inventory_logs], async () => {
        for (const item of cart) {
          const product = await db.products.get(item.productId);
          if (product) {
            const oldStock = product.stock_qty || 0;
            const newStock = Math.max(0, oldStock - item.quantity);
            
            await db.products.update(item.productId, { stock_qty: newStock });
            
            await db.inventory_logs.add({
              product_id: item.productId,
              product_name: product.name,
              quantity_changed: -item.quantity,
              old_stock: oldStock,
              new_stock: newStock,
              type: 'Adjustment',
              timestamp: Date.now(),
              performed_by: `Reserved for ${customerName}`
            });
          }
        }

        await db.parked_orders.add({
          customerName: customerName,
          items: cart.map(item => ({ ...item, isStockAlreadyDeducted: true })),
          total: total,
          staffId: currentUser?.id?.toString() || '0',
          timestamp: Date.now()
        });
      });

      setCart([]);
      setTempName('');
      setShowParkModal(false);
      setShowMobileCart(false);
    } catch (err) {
      alert("Failed to park order: " + err);
    }
  };

  const handleResumeOrder = async (orderId: number) => {
    try {
      const order = await db.parked_orders.get(orderId);
      if (!order) {
        alert("Order not found!");
        return;
      }

      if (cart.length > 0) {
        if (!confirm("Your current cart is not empty. Resuming this order will overwrite your current cart. Continue?")) return;
      }

      setCart(order.items.map(item => ({ ...item, isStockAlreadyDeducted: true })));
      await db.parked_orders.delete(orderId);
      setShowParkedListModal(false);
      setShowMobileCart(true);
    } catch (error: any) {
      alert('Resume Failed: ' + error.message);
    }
  };

  const handleCancelParkedOrder = async (orderId: number) => {
    if(!confirm("Delete this parked order? This will return the items to stock.")) return;

    try {
      await (db as any).transaction('rw', [db.products, db.parked_orders, db.inventory_logs], async () => {
        const order = await db.parked_orders.get(orderId);
        if (order) {
          for (const item of order.items) {
            const product = await db.products.get(item.productId);
            if (product) {
              const oldStock = product.stock_qty || 0;
              const newStock = oldStock + item.quantity;
              
              await db.products.update(item.productId, { stock_qty: newStock });
              
              await db.inventory_logs.add({
                product_id: item.productId,
                product_name: product.name,
                quantity_changed: item.quantity,
                old_stock: oldStock,
                new_stock: newStock,
                type: 'Adjustment',
                timestamp: Date.now(),
                performed_by: `Return (Cancelled ${order.customerName})`
              });
            }
          }
          await db.parked_orders.delete(orderId);
        }
      });
    } catch (error: any) {
      alert('Cancel Failed: ' + error.message);
    }
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    if (isProcessing) return;
    if (!paymentType) {
      alert('Please select a payment method.');
      return;
    }

    setIsProcessing(true);
    
    try {
      // 1. Final Checkout Check
      for (const item of cart) {
        const product = await db.products.get(item.productId);
        if (product && !item.isStockAlreadyDeducted && item.quantity > product.stock_qty) {
          alert(`Oga, stock mismatch for ${product.name}. Only ${product.stock_qty} left.`);
          setIsProcessing(false);
          return;
        }
      }

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
      
      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        await db.sales.add(saleData);

        for (const item of cart) {
          if (!item.isStockAlreadyDeducted) {
            const product = await db.products.get(item.productId);
            if (product) {
              const oldStock = product.stock_qty || 0;
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

              if (newStock <= (product.low_stock_threshold || 5)) {
                lowItems.push(product.name);
              }
            }
          }
        }
      });

      cart.forEach(async (item) => {
        const product = await db.products.get(item.productId);
        if (product && product.stock_qty <= 0) {
          NotificationService.sendLowStockAlert(product.name);
        }
      });

      setCart([]);
      setCashAmount(0);
      setPaymentType(null);
      setShowCheckoutModal(false);
      setShowMobileCart(false);

      if (lowItems.length > 0) {
        setLowStockProducts(lowItems);
        setShowLowStockAlert(true);
      } else {
        setShowSuccessModal(true);
      }

    } catch (error: any) {
      console.error("Sale Processing Error:", error);
      alert('Database Error: ' + error.message);
    } finally {
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
       {/* Sidebar / Cart logic for Mobile */}
       <div className={`fixed inset-0 z-[450] bg-black/60 backdrop-blur-sm lg:hidden transition-opacity ${showMobileCart ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowMobileCart(false)} />
       
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
             {filteredProducts.map(p => {
               const isSoldOut = p.stock_qty <= 0;
               return (
                 <button 
                  key={p.id} 
                  disabled={isSoldOut}
                  onClick={() => addToCart(p)} 
                  className={`bg-white p-5 rounded-[2rem] border border-slate-100 text-left h-44 flex flex-col justify-between hover:border-emerald-500 transition-all shadow-sm relative overflow-hidden group ${isSoldOut ? 'opacity-60 grayscale' : ''}`}
                 >
                    {/* Visual Cues: Sold Out Overlay */}
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-10 flex items-center justify-center">
                        <span className="bg-white px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-widest text-slate-900 shadow-xl">Sold Out</span>
                      </div>
                    )}

                    {/* Visual Cues: +1 Animation */}
                    {animatingId === p.id && (
                      <span className="absolute right-4 top-4 text-emerald-600 font-black text-xl animate-bounce-up z-20 pointer-events-none">+1</span>
                    )}

                    <div>
                      <h4 className="font-bold text-slate-800 line-clamp-2 text-sm">{p.name}</h4>
                      {/* 2. Product Grid: Stock Level badge */}
                      <span className={`inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full ${p.stock_qty <= p.low_stock_threshold ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                        {p.stock_qty} Units Left
                      </span>
                    </div>

                    <div className="flex justify-between items-end">
                       <p className="font-black text-emerald-600 text-base">₦{p.price.toLocaleString()}</p>
                       <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          <Plus size={16} />
                       </div>
                    </div>
                 </button>
               );
             })}
          </div>
       </div>
       
       {/* 2. Mobile View: Cart layout adjustment */}
       <div className={`fixed inset-y-0 right-0 w-[85%] max-w-[400px] bg-white z-[500] shadow-2xl transition-transform duration-300 lg:static lg:w-[350px] lg:shadow-xl lg:translate-x-0 rounded-l-[2.5rem] lg:rounded-[2.5rem] flex flex-col p-6 ${showMobileCart ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-800 flex items-center gap-2"><ShoppingCart size={20} className="text-emerald-600" /> Current Cart</h3>
            <div className="flex gap-4">
              <button onClick={() => setCart([])} className="text-xs font-black text-rose-400 uppercase tracking-widest hover:text-rose-600">Clear</button>
              <button onClick={() => setShowMobileCart(false)} className="lg:hidden text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
             {cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                 <ShoppingCart size={64} />
                 <p className="mt-4 font-black text-xs uppercase tracking-widest">Cart is Empty</p>
               </div>
             ) : (
               cart.map((item, idx) => (
                 <div key={`${item.productId}-${idx}`} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold text-sm truncate text-slate-800">{item.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black text-emerald-600">₦{item.price.toLocaleString()}</p>
                        {item.isStockAlreadyDeducted && (
                          <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-widest">Resumed</span>
                        )}
                      </div>
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

       {/* Mobile View: Floating Cart Button */}
       {!showMobileCart && cart.length > 0 && (
         <button 
           onClick={() => setShowMobileCart(true)}
           className="fixed bottom-6 right-6 lg:hidden z-[400] bg-slate-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10"
         >
           <ShoppingCart size={24} />
           <span className="font-black">View Cart (₦{total.toLocaleString()})</span>
           <span className="bg-emerald-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full ml-1">
             {cart.reduce((acc, i) => acc + i.quantity, 0)}
           </span>
         </button>
       )}

       {/* Park Name Modal */}
       {showParkModal && (
         <div className="fixed inset-0 z-[550] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm space-y-8 animate-in zoom-in duration-300">
               <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-2"><FolderOpen size={32} /></div>
                  <h3 className="text-2xl font-black text-slate-900">Name this Order</h3>
                  <p className="text-slate-400 text-sm font-medium">Items will be deducted from stock now and held for this customer.</p>
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
                     <button type="submit" className="py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Park & Reserve</button>
                  </div>
               </form>
            </div>
         </div>
       )}

       {/* Parked Orders List Modal */}
       {showParkedListModal && (
         <div className="fixed inset-0 z-[550] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[80vh]">
               <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Parked Orders</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reserved Stock List</p>
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
                              onClick={() => handleCancelParkedOrder(order.id!)}
                              className="p-3 text-rose-400 hover:text-rose-600 transition-colors"
                              title="Delete & Return to Stock"
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

       {/* 3. Checkout Modal Polish: Full Screen on Mobile */}
       {showCheckoutModal && (
         <div className="fixed inset-0 z-[600] flex items-center justify-center lg:p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white lg:rounded-[3rem] w-full h-full lg:h-auto lg:max-w-md animate-in slide-in-from-bottom-full lg:zoom-in duration-300 flex flex-col">
               {/* Modal Header with Total Amount (Always Visible) */}
               <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Amount Payable</p>
                   <h3 className="text-4xl font-black text-slate-900 tracking-tight">₦{total.toLocaleString()}</h3>
                 </div>
                 <button onClick={() => setShowCheckoutModal(false)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={24} /></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-8 space-y-8">
                 <div className="space-y-4">
                   <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Select Payment Mode</p>
                   <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'cash', label: 'CASH', icon: <Banknote size={20} /> },
                        { id: 'transfer', label: 'TRANSFER', icon: <Landmark size={20} /> },
                        { id: 'pos', label: 'POS Terminal', icon: <CreditCard size={20} /> },
                        { id: 'split', label: 'SPLIT PAY', icon: <SplitSquareVertical size={20} /> }
                      ].map(m => (
                        <button 
                          key={m.id} 
                          onClick={() => setPaymentType(m.id as any)} 
                          className={`py-6 px-4 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${paymentType === m.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 border-transparent text-slate-400 hover:border-slate-200'}`}
                        >
                          {m.icon}
                          <span className="font-black uppercase text-[10px] tracking-widest">{m.label}</span>
                        </button>
                      ))}
                   </div>
                 </div>

                 {paymentType === 'split' && (
                   <div className="space-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-100 animate-in slide-in-from-top-4">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Enter Cash Portion (₦)</label>
                      <input 
                        autoFocus
                        type="number" 
                        className="w-full px-6 py-5 bg-white border border-slate-200 rounded-[2rem] font-black text-center text-3xl outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" 
                        value={cashAmount || ''} 
                        onChange={e => setCashAmount(Number(e.target.value))} 
                        placeholder="0.00"
                      />
                      <div className="flex items-center justify-between text-[10px] font-black px-2">
                        <span className="text-slate-400">REST IN TRANSFER/POS:</span>
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">₦{(total - cashAmount).toLocaleString()}</span>
                      </div>
                   </div>
                 )}
               </div>

               <div className="p-8 bg-slate-50 lg:bg-white border-t border-slate-100 shrink-0">
                 <button 
                  disabled={isProcessing}
                  onClick={handleCompleteSale} 
                  className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-[0_20px_50px_rgba(5,150,105,0.3)] hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4"
                 >
                   {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={28} />}
                   {isProcessing ? 'Verifying Stock...' : `Complete Sale`}
                 </button>
                 <button 
                   onClick={() => setShowCheckoutModal(false)}
                   className="w-full py-4 mt-2 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600"
                 >
                   Back to Cart
                 </button>
               </div>
            </div>
         </div>
       )}

       {showSuccessModal && (
         <div className="fixed inset-0 z-[700] flex items-center justify-center bg-emerald-950/90 backdrop-blur-md">
            <div className="bg-white rounded-[4rem] p-12 text-center space-y-8 animate-in zoom-in duration-500 shadow-2xl max-w-sm w-full mx-4">
               <div className="w-28 h-28 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner relative">
                 <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping" />
                 <CheckCircle size={72} className="animate-bounce" />
               </div>
               <div className="space-y-3">
                 <h3 className="text-4xl font-black text-slate-900 leading-tight">Done & Dusted!</h3>
                 <p className="text-slate-500 font-medium text-lg">Inventory updated. ₦{total.toLocaleString()} logged.</p>
               </div>
               <button onClick={reset} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:scale-[1.02] transition-transform">Next Customer</button>
            </div>
         </div>
       )}

       {showLowStockAlert && (
         <div className="fixed inset-0 z-[700] flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
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
       
       <style>{`
         @keyframes bounce-up {
           0% { transform: translateY(0); opacity: 0; }
           50% { transform: translateY(-20px); opacity: 1; }
           100% { transform: translateY(-40px); opacity: 0; }
         }
         .animate-bounce-up {
           animation: bounce-up 0.5s ease-out forwards;
         }
       `}</style>
    </div>
  );
};

export default POS;
