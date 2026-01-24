
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
  MessageSquare,
  Bluetooth,
  Edit3,
  Calendar,
  Wallet,
  Phone
} from 'lucide-react';
import { Product, SaleItem, ParkedOrder, View, Staff, Sale, Settings, CustomerWallet } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import NotificationService from '../services/NotificationService';
import BluetoothPrintService from '../services/BluetoothPrintService';

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
  const [isBTPrinting, setIsBTPrinting] = useState(false);

  // Customer Wallet State
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [activeWallet, setActiveWallet] = useState<CustomerWallet | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [saveChangeToWallet, setSaveChangeToWallet] = useState(false);

  // Backdating State
  const [saleDate, setSaleDate] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });

  // Editable Price State
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  // Parked Orders States
  const [showParkModal, setShowParkModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showParkedListModal, setShowParkedListModal] = useState(false);

  // useLiveQuery ensures that changes made in Inventory reflect here immediately
  const products = useLiveQuery(() => db.products.toArray());
  const parkedOrders = useLiveQuery(() => db.parked_orders.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.get('app_settings')) as Settings | undefined;

  // Lookup wallet when phone changes
  useEffect(() => {
    const lookup = async () => {
      if (customerPhone.length >= 10) {
        const wallet = await db.customer_wallets.where('phone').equals(customerPhone).first();
        setActiveWallet(wallet || null);
      } else {
        setActiveWallet(null);
        setUseWallet(false);
      }
    };
    lookup();
  }, [customerPhone]);

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
    // Stock Guard
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

  // Price Editing Logic
  const handlePriceClick = (item: SaleItem) => {
    setEditingPriceId(item.productId);
    setTempPrice(item.price.toString());
  };

  const handlePriceSave = async (productId: number) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;

    const oldPrice = item.price;
    const newPrice = Math.round(Number(tempPrice) / 50) * 50; // Naija Rounding

    if (oldPrice !== newPrice) {
      await db.audit_trail.add({
        action: 'Cart Price Changed',
        details: `Adjusted '${item.name}' from ₦${oldPrice.toLocaleString()} to ₦${newPrice.toLocaleString()}`,
        staff_name: currentUser?.name || 'Staff',
        timestamp: Date.now()
      });

      setCart(prev => prev.map(i => 
        i.productId === productId ? { ...i, price: newPrice } : i
      ));
    }
    
    setEditingPriceId(null);
  };

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const walletDiscount = useWallet && activeWallet ? Math.min(activeWallet.balance, total) : 0;
  const payableTotal = Math.max(0, total - walletDiscount);
  const changeAmount = (paymentType === 'cash' && cashAmount > payableTotal) ? (cashAmount - payableTotal) : 0;

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    const overstockItem = cart.find(item => {
      const p = products?.find(prod => prod.id === item.productId);
      return p ? item.quantity > p.stock_qty : false;
    });
    if (overstockItem) {
      alert(`Error: '${overstockItem.name}' quantity exceeds available stock. Please adjust.`);
      return;
    }
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    setSaleDate(new Date(now.getTime() - offset).toISOString().slice(0, 16));
    
    // Reset Checkout State
    setCustomerPhone('');
    setActiveWallet(null);
    setUseWallet(false);
    setSaveChangeToWallet(false);
    setCashAmount(0);
    setPaymentType(null);

    setShowCheckoutModal(true);
  };

  const handleParkSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
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
      console.error(err);
      alert("Database Busy. Please try again.");
    } finally {
      setIsProcessing(false);
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
    if (cart.length === 0 || isProcessing || !paymentType) return;
    setIsProcessing(true);
    
    try {
      const saleId = crypto.randomUUID ? crypto.randomUUID() : `SAL-${Date.now()}`;
      const saleTimestamp = new Date(saleDate).getTime();
      
      const saleData: Sale = {
        sale_id: saleId,
        items: [...cart],
        total_amount: total,
        subtotal: total,
        payment_method: paymentType === 'split' ? 'split' : paymentType,
        cash_amount: paymentType === 'split' ? cashAmount : (paymentType === 'cash' ? (saveChangeToWallet ? payableTotal : cashAmount) : 0),
        wallet_amount_used: walletDiscount,
        wallet_amount_credited: saveChangeToWallet ? changeAmount : 0,
        customer_phone: customerPhone || undefined,
        staff_id: currentUser?.id?.toString() || '0',
        staff_name: currentUser?.name || 'Staff',
        timestamp: saleTimestamp,
        sync_status: 'pending'
      };

      let lowItems: string[] = [];

      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs, db.customer_wallets], async () => {
        await db.sales.add(saleData);

        // Process Wallet
        if (customerPhone) {
          const wallet = await db.customer_wallets.where('phone').equals(customerPhone).first();
          let currentBalance = wallet?.balance || 0;
          
          if (useWallet) currentBalance -= walletDiscount;
          if (saveChangeToWallet) currentBalance += changeAmount;

          if (wallet) {
            await db.customer_wallets.update(wallet.id!, { balance: currentBalance, last_updated: Date.now() });
          } else {
            await db.customer_wallets.add({ phone: customerPhone, balance: currentBalance, last_updated: Date.now() });
          }
        }

        // Stock Deduction
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
      setCustomerPhone('');
      setActiveWallet(null);
      setUseWallet(false);
      setSaveChangeToWallet(false);
      setShowCheckoutModal(false);
      
      if (lowItems.length > 0) {
        setLowStockProducts(lowItems);
        setShowLowStockAlert(true);
      } else {
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error(error);
      alert('Database Busy. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBTPrint = async () => {
    if (!lastCompletedSale || !settings) return;
    setIsBTPrinting(true);
    try {
      await BluetoothPrintService.printReceipt(lastCompletedSale, settings);
    } catch (err) {
      alert("BT Printing failed. Check connection in Settings.");
    } finally {
      setIsBTPrinting(false);
    }
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
             <div className="flex gap-2">
                <button 
                  onClick={() => setShowParkedListModal(true)} 
                  className={`h-14 px-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all ${parkedOrders.length > 0 ? 'bg-amber-100 text-amber-700 border-2 border-amber-200' : 'bg-white border border-slate-200 text-slate-400'}`}
                >
                  <History size={18} /> <span className="hidden sm:inline">Parked ({parkedOrders.length})</span>
                  <span className="sm:hidden">{parkedOrders.length}</span>
                </button>
                <button onClick={() => setShowScanner(true)} className="h-14 w-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Camera /></button>
             </div>
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
             {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center opacity-20 py-20"><ShoppingCart size={64} /><p className="mt-4 font-black text-xs uppercase">Empty</p></div> : cart.map((item, idx) => {
               const product = products?.find(p => p.id === item.productId);
               const isBelowCost = product ? item.price < product.cost_price : false;
               const isEditing = editingPriceId === item.productId;

               return (
                 <div key={idx} className={`flex justify-between items-center bg-slate-50 p-3 rounded-2xl border transition-colors ${isBelowCost ? 'border-rose-200 bg-rose-50/50' : 'border-slate-100'}`}>
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold text-sm truncate text-slate-800">{item.name}</p>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1 mt-1">
                             <input 
                                autoFocus
                                type="number"
                                className={`w-24 px-2 py-1 text-[10px] font-black border rounded outline-none ${isBelowCost ? 'border-rose-400 bg-rose-50' : 'border-emerald-300'}`}
                                value={tempPrice}
                                onChange={e => setTempPrice(e.target.value)}
                                onBlur={() => handlePriceSave(item.productId)}
                                onKeyDown={e => e.key === 'Enter' && handlePriceSave(item.productId)}
                             />
                             <button onClick={() => handlePriceSave(item.productId)} className="p-1 bg-emerald-600 text-white rounded"><CheckCircle size={12} /></button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handlePriceClick(item)}
                            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-white/50 transition-all ${isBelowCost ? 'text-rose-600 bg-rose-100/50' : 'text-emerald-600'}`}
                          >
                            <p className="text-[10px] font-black">₦{item.price.toLocaleString()}</p>
                            <Edit3 size={10} className="opacity-40" />
                          </button>
                        )}
                        {item.isStockAlreadyDeducted && (
                          <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-widest">Resumed</span>
                        )}
                      </div>
                      {isBelowCost && <p className="text-[8px] font-black text-rose-500 uppercase mt-0.5 flex items-center gap-1"><AlertTriangle size={8} /> Selling below cost!</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="p-1.5 bg-white rounded-lg text-rose-500 shadow-sm"><Minus size={12} /></button>
                      <span className="font-black text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="p-1.5 bg-white rounded-lg text-emerald-500 shadow-sm"><Plus size={12} /></button>
                    </div>
                 </div>
               );
             })}
          </div>
          <div className="mt-6 pt-6 border-t space-y-4">
             <div className="flex justify-between items-center px-2">
                <span className="font-black text-[10px] text-slate-400 uppercase">Total Payable</span>
                <span className="text-3xl font-black text-emerald-600">₦{total.toLocaleString()}</span>
             </div>
             <div className="grid grid-cols-2 gap-2">
               <button 
                disabled={cart.length === 0 || isProcessing} 
                onClick={() => setShowParkModal(true)} 
                className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 <Pause size={18} /> {isProcessing ? 'Wait...' : 'Park'}
               </button>
               <button 
                disabled={cart.length === 0 || isProcessing} 
                onClick={handleOpenCheckout} 
                className="py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 disabled:opacity-50"
               >
                 {isProcessing ? 'Saving...' : 'Checkout'} <ChevronRight size={18} className="inline ml-1"/>
               </button>
             </div>
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
          <div className="flex-[1.5] flex gap-2">
            <button 
                disabled={cart.length === 0 || isProcessing} 
                onClick={() => setShowParkModal(true)} 
                className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg disabled:opacity-50 flex items-center justify-center"
              >
                <Pause size={18} />
            </button>
            <button 
                disabled={cart.length === 0 || isProcessing} 
                onClick={handleOpenCheckout} 
                className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg disabled:opacity-50"
              >
                {isProcessing ? '...' : `₦${total.toLocaleString()}`}
            </button>
          </div>
       </div>

       {/* Park Name Modal */}
       {showParkModal && (
         <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
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
                     <button type="button" disabled={isProcessing} onClick={() => setShowParkModal(false)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                     <button type="submit" disabled={isProcessing} className="py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
                       {isProcessing ? <Loader2 className="animate-spin" size={16} /> : 'Park Order'}
                     </button>
                  </div>
               </form>
            </div>
         </div>
       )}

       {/* Parked Orders List Modal */}
       {showParkedListModal && (
         <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
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
                               <PlayCircle size={16} /> Resume
                            </button>
                         </div>
                      </div>
                    ))
                  )}
               </div>
            </div>
         </div>
       )}

       {/* Checkout Modal with high z-index and conditional rendering */}
       {showCheckoutModal && (
         <div className="fixed inset-0 z-[1200] flex items-center justify-center lg:p-4 bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white lg:rounded-[3rem] w-full h-full lg:h-auto lg:max-w-md animate-in slide-in-from-bottom-full lg:zoom-in duration-300 flex flex-col relative">
               <div className="p-8 border-b flex items-center justify-between">
                 <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Payable</p><h3 className="text-4xl font-black text-slate-900">₦{payableTotal.toLocaleString()}</h3></div>
                 <button onClick={() => setShowCheckoutModal(false)} className="p-3 bg-slate-50 rounded-full text-slate-400"><X size={24} /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-8 space-y-6">
                 {/* Backdating Section */}
                 <div>
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                      <Calendar size={12} /> Sale Date & Time
                    </label>
                    <input 
                      type="datetime-local" 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      value={saleDate}
                      onChange={e => setSaleDate(e.target.value)}
                    />
                    {new Date(saleDate).getTime() < Date.now() - 60000 && (
                      <p className="text-[10px] font-black text-amber-600 uppercase mt-2 flex items-center gap-1 leading-tight">
                        <AlertTriangle size={10} /> Note: You are recording a historical sale.
                      </p>
                    )}
                 </div>

                 {/* Customer Wallet Section */}
                 <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase ml-1">
                      <Phone size={12} /> Customer Phone
                    </label>
                    <input 
                      type="tel" 
                      placeholder="080..."
                      className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                    />
                    {activeWallet && activeWallet.balance > 0 && (
                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div>
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Wallet Credit</p>
                          <p className="text-lg font-black text-emerald-700">₦{activeWallet.balance.toLocaleString()}</p>
                        </div>
                        <button 
                          onClick={() => setUseWallet(!useWallet)}
                          className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${useWallet ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 border border-emerald-200'}`}
                        >
                          {useWallet ? 'Using' : 'Use Credit'}
                        </button>
                      </div>
                    )}
                 </div>

                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['cash', 'transfer', 'pos', 'split'].map(m => (
                        <button key={m} onClick={() => setPaymentType(m as any)} className={`py-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${paymentType === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                          <span className="font-black uppercase text-[10px] tracking-widest">{m}</span>
                        </button>
                      ))}
                    </div>
                 </div>

                 {paymentType === 'cash' && (
                   <div className="animate-in slide-in-from-top-4 space-y-4">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Cash Received (₦)</label>
                      <input 
                        type="number" 
                        className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-emerald-500 font-black text-3xl text-center" 
                        value={cashAmount || ''}
                        onChange={e => setCashAmount(Number(e.target.value))}
                      />
                      {changeAmount > 0 && customerPhone.length >= 10 && (
                        <button 
                          onClick={() => setSaveChangeToWallet(!saveChangeToWallet)}
                          className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${saveChangeToWallet ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}
                        >
                          <Wallet size={18} /> {saveChangeToWallet ? 'Saving Change to Wallet' : `Save ₦${changeAmount} to Wallet`}
                        </button>
                      )}
                      {changeAmount > 0 && !saveChangeToWallet && (
                        <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                          <p className="text-[10px] font-black text-amber-600 uppercase">Change Due</p>
                          <p className="text-2xl font-black text-amber-700">₦{changeAmount.toLocaleString()}</p>
                        </div>
                      )}
                   </div>
                 )}
               </div>
               <div className="p-8 border-t">
                 <button disabled={isProcessing || !paymentType} onClick={handleCompleteSale} className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4">
                   {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={28} />} {isProcessing ? 'Saving Sale...' : 'Complete Sale'}
                 </button>
               </div>
            </div>
         </div>
       )}

       {showSuccessModal && (
         <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-emerald-950/90 backdrop-blur-md">
            <div className="bg-white rounded-[4rem] p-10 text-center space-y-8 animate-in zoom-in duration-500 shadow-2xl max-w-sm w-full mx-4">
               <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner relative">
                 <CheckCircle size={64} className="animate-bounce" />
               </div>
               <div className="space-y-3">
                 <h3 className="text-3xl font-black text-slate-900">Done & Dusted!</h3>
                 <p className="text-slate-500 font-medium">₦{lastCompletedSale?.total_amount.toLocaleString()} logged.</p>
                 {lastCompletedSale?.wallet_amount_credited && lastCompletedSale.wallet_amount_credited > 0 && (
                   <p className="text-indigo-600 font-black text-xs uppercase tracking-widest">₦{lastCompletedSale.wallet_amount_credited} saved to customer wallet</p>
                 )}
               </div>
               
               <div className="grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handlePrint} className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                      <Printer size={16} /> Print
                    </button>
                    {BluetoothPrintService.isConnected() && (
                      <button 
                        onClick={handleBTPrint} 
                        disabled={isBTPrinting}
                        className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg"
                      >
                        {isBTPrinting ? <Loader2 className="animate-spin" size={16} /> : <Bluetooth size={16} />} BT Print
                      </button>
                    )}
                  </div>
                  <button onClick={handleShareWhatsApp} className="py-4 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors">
                    <MessageSquare size={16} /> Share via WhatsApp
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
             <div className="flex justify-between"><span>SUBTOTAL</span><span>₦{lastCompletedSale?.total_amount.toLocaleString()}</span></div>
             {lastCompletedSale?.wallet_amount_used && lastCompletedSale.wallet_amount_used > 0 && (
               <div className="flex justify-between text-[10px]"><span>WALLET CREDIT USED</span><span>-₦{lastCompletedSale.wallet_amount_used.toLocaleString()}</span></div>
             )}
             <div className="flex justify-between"><span>TOTAL PAID</span><span>₦{(lastCompletedSale?.total_amount || 0) - (lastCompletedSale?.wallet_amount_used || 0)}.toLocaleString()</span></div>
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
