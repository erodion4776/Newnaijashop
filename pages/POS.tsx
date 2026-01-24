
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
  Package,
  X,
  Camera,
  Loader2,
  Pause,
  FolderOpen,
  User,
  History,
  ChevronRight,
  Printer,
  Bluetooth,
  Edit3,
  MessageSquare
} from 'lucide-react';
import { Product, SaleItem, View, Staff, Sale, Settings } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import BluetoothPrintService from '../services/BluetoothPrintService';
import CheckoutModal from '../components/CheckoutModal';

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
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [animatingId, setAnimatingId] = useState<number | null>(null);
  const [isBTPrinting, setIsBTPrinting] = useState(false);

  // Editable Price State
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  // Parked Orders States
  const [showParkModal, setShowParkModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showParkedListModal, setShowParkedListModal] = useState(false);

  // Robust Live Queries
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const parkedOrders = useLiveQuery(() => db.parked_orders.toArray(), []) || [];
  const settings = useLiveQuery(() => db.settings.get('app_settings')) as Settings | undefined;

  const filteredProducts = useMemo(() => {
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
    const product = products.find(p => p.id === id);
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

  const handlePriceClick = (item: SaleItem) => {
    setEditingPriceId(item.productId);
    setTempPrice(item.price.toString());
  };

  const handlePriceSave = async (productId: number) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;
    const newPrice = Math.round(Number(tempPrice) / 50) * 50;
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, price: newPrice } : i));
    setEditingPriceId(null);
  };

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

  // EMERGENCY FIX: Simple, non-blocking checkout trigger
  const handleOpenCheckout = () => {
    console.log('Attempting to open Checkout Modal...');
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }
    // Instant open, removing pre-modal async checks
    setShowCheckoutModal(true);
  };

  const handleParkSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    const customerNameVal = tempName.trim() || 'Quick Order';
    try {
      await (db as any).transaction('rw', [db.products, db.parked_orders, db.inventory_logs], async () => {
        for (const item of cart) {
          const product = await db.products.get(item.productId);
          if (product) {
            const oldStock = Number(product.stock_qty || 0);
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
              performed_by: `Parked: ${customerNameVal}`
            });
          }
        }
        await db.parked_orders.add({
          customerName: customerNameVal,
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
      alert("Park Failed: Database Busy.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResumeOrder = async (orderId: number) => {
    try {
      const order = await db.parked_orders.get(orderId);
      if (!order) return;
      if (cart.length > 0 && !confirm("Overwrite current cart?")) return;
      setCart(order.items.map(item => ({ ...item, isStockAlreadyDeducted: true })));
      await db.parked_orders.delete(orderId);
      setShowParkedListModal(false);
      setShowMobileCart(true);
    } catch (e) {
      alert('Resume Failed');
    }
  };

  const handleCancelParkedOrder = async (orderId: number) => {
    if(!confirm("Delete & return stock?")) return;
    try {
      await (db as any).transaction('rw', [db.products, db.parked_orders, db.inventory_logs], async () => {
        const order = await db.parked_orders.get(orderId);
        if (order) {
          for (const item of order.items) {
            const product = await db.products.get(item.productId);
            if (product) {
              const oldStock = Number(product.stock_qty || 0);
              await db.products.update(item.productId, { stock_qty: oldStock + item.quantity });
              await db.inventory_logs.add({
                product_id: item.productId,
                product_name: product.name,
                quantity_changed: item.quantity,
                old_stock: oldStock,
                new_stock: oldStock + item.quantity,
                type: 'Return',
                timestamp: Date.now(),
                performed_by: `Park Cancelled`
              });
            }
          }
          await db.parked_orders.delete(orderId);
        }
      });
    } catch (e) { alert('Cancel Failed'); }
  };

  const onCompleteSale = (sale: Sale, lowItems: string[]) => {
    setLastCompletedSale(sale);
    setCart([]);
    setShowCheckoutModal(false);
    if (lowItems.length > 0) {
      setLowStockProducts(lowItems);
      setShowLowStockAlert(true);
    } else {
      setShowSuccessModal(true);
    }
  };

  const handlePrint = () => window.print();

  const handleBTPrint = async () => {
    if (!lastCompletedSale || !settings) return;
    setIsBTPrinting(true);
    try { await BluetoothPrintService.printReceipt(lastCompletedSale, settings); }
    catch (err) { alert("BT Print Failed."); }
    finally { setIsBTPrinting(false); }
  };

  const handleShareWhatsApp = () => {
    if (!lastCompletedSale || !settings) return;
    const itemsText = lastCompletedSale.items.map(i => `${i.name} x${i.quantity} @ ₦${i.price.toLocaleString()} = ₦${(i.price * i.quantity).toLocaleString()}`).join('\n');
    const text = `--- ${settings.shop_name} ---\n\nRECEIPT: ${lastCompletedSale.sale_id}\n\nITEMS:\n${itemsText}\n\nTOTAL: ₦${lastCompletedSale.total_amount.toLocaleString()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
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
            <button onClick={() => setShowParkedListModal(true)} className={`h-14 px-4 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase transition-all ${parkedOrders.length > 0 ? 'bg-amber-100 text-amber-700 border-2 border-amber-200' : 'bg-white border text-slate-400'}`}>
              <History size={18} /> Parked ({parkedOrders.length})
            </button>
            <button onClick={() => setShowScanner(true)} className="h-14 w-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Camera /></button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {products.length === 0 ? (
            <div className="col-span-full py-20 text-center opacity-40">
              <Package size={48} className="mx-auto mb-2" /><p className="font-bold">Loading terminal products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
             <div className="col-span-full py-20 text-center opacity-40">
               <Package size={48} className="mx-auto mb-2" /><p className="font-bold">No items match search</p>
             </div>
          ) : filteredProducts.map(p => (
            <button key={p.id} disabled={p.stock_qty <= 0} onClick={() => addToCart(p)} className={`bg-white p-5 rounded-[2rem] border border-slate-100 text-left h-44 flex flex-col justify-between hover:border-emerald-500 transition-all shadow-sm relative group ${p.stock_qty <= 0 ? 'opacity-60 grayscale' : ''}`}>
              {animatingId === p.id && <span className="absolute right-4 top-4 text-emerald-600 font-black text-xl animate-bounce-up z-20">+1</span>}
              <div>
                <h4 className="font-bold text-slate-800 line-clamp-2 text-sm">{p.name}</h4>
                <span className={`inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full ${p.stock_qty <= p.low_stock_threshold ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>{p.stock_qty} Units</span>
              </div>
              <div className="flex justify-between items-end">
                <p className="font-black text-emerald-600 text-base">₦{p.price.toLocaleString()}</p>
                <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors"><Plus size={16} /></div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* MOBILE FAB - View Cart */}
      {!showMobileCart && (
        <button 
          onClick={() => setShowMobileCart(true)}
          className="lg:hidden fixed bottom-24 right-6 z-[600] bg-emerald-600 text-white px-6 py-4 rounded-full shadow-[0_15px_30px_rgba(5,150,105,0.4)] flex items-center gap-2 font-black text-xs uppercase tracking-widest animate-in slide-in-from-bottom-10"
        >
          <ShoppingCart size={20} />
          View Cart ({cart.length})
        </button>
      )}
      
      {/* CART OVERLAY / SIDEBAR */}
      <div className={`fixed inset-y-0 right-0 w-full lg:w-[350px] max-w-full lg:max-w-[400px] bg-white z-[700] shadow-2xl transition-transform lg:static rounded-none lg:rounded-[2.5rem] flex flex-col p-6 ${showMobileCart ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-600"><X size={24} /></button>
            <h3 className="font-black text-slate-800 flex items-center gap-2"><ShoppingCart size={20} className="text-emerald-600" /> Cart</h3>
          </div>
          <button onClick={() => setCart([])} className="text-xs font-black text-rose-400 uppercase tracking-widest hover:text-rose-600">Clear</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 text-center">
              <ShoppingCart size={64} />
              <p className="mt-4 font-black text-xs uppercase">Your cart is empty</p>
            </div>
          ) : (
            cart.map((item, idx) => {
              try {
                const isEditing = editingPriceId === item.productId;
                return (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold text-sm truncate text-slate-800">{item.name}</p>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1 mt-1">
                            <input autoFocus type="number" className="w-24 px-2 py-1 text-[10px] font-black border rounded outline-none border-emerald-300" value={tempPrice} onChange={e => setTempPrice(e.target.value)} onBlur={() => handlePriceSave(item.productId)} onKeyDown={e => e.key === 'Enter' && handlePriceSave(item.productId)} />
                          </div>
                        ) : (
                          <button onClick={() => handlePriceClick(item)} className="flex items-center gap-1 text-emerald-600">
                            <p className="text-[10px] font-black">₦{item.price.toLocaleString()}</p><Edit3 size={10} className="opacity-40" />
                          </button>
                        )}
                        {item.isStockAlreadyDeducted && <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase">Resumed</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQuantity(item.productId, -1)} className="p-1.5 bg-white rounded-lg text-rose-500 shadow-sm"><Minus size={12} /></button>
                      <span className="font-black text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, 1)} className="p-1.5 bg-white rounded-lg text-emerald-500 shadow-sm"><Plus size={12} /></button>
                    </div>
                  </div>
                );
              } catch (e) {
                console.error("Cart item render error:", e);
                return null;
              }
            })
          )}
        </div>
        <div className="mt-6 pt-6 border-t space-y-4 bg-white z-[710]">
          <div className="flex justify-between items-center px-2">
            <span className="font-black text-[10px] text-slate-400 uppercase">Total Payable</span>
            <span className="text-3xl font-black text-emerald-600">₦{total.toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button 
              disabled={cart.length === 0 || isProcessing} 
              onClick={() => setShowParkModal(true)} 
              className="py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <Pause size={18} /> Park
            </button>
            <button 
              disabled={cart.length === 0 || isProcessing} 
              onClick={handleOpenCheckout} 
              className="py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-[0_10px_20px_rgba(5,150,105,0.3)] flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 z-[720]"
            >
              Checkout <ChevronRight size={18}/>
            </button>
          </div>
        </div>
      </div>

      {showParkModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm space-y-8 animate-in zoom-in">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto"><FolderOpen size={32} /></div>
              <h3 className="text-2xl font-black text-slate-900">Park Order</h3>
            </div>
            <form onSubmit={handleParkSale} className="space-y-6">
              <input autoFocus required type="text" placeholder="Customer Name" className="w-full px-5 py-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={tempName} onChange={e => setTempName(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowParkModal(false)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase">Cancel</button>
                <button type="submit" disabled={isProcessing} className="py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase shadow-xl">{isProcessing ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Confirm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showParkedListModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-8 border-b flex items-center justify-between">
              <h3 className="text-2xl font-black">Parked Orders</h3>
              <button onClick={() => setShowParkedListModal(false)} className="p-2"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {parkedOrders.length === 0 ? <p className="text-center opacity-40 py-20">No parked orders.</p> : parkedOrders.map(order => (
                <div key={order.id} className="bg-slate-50 p-6 rounded-[2rem] flex items-center justify-between">
                  <div><h4 className="font-black">{order.customerName}</h4><p className="text-[10px] text-slate-400">₦{order.total.toLocaleString()} • {order.items.length} items</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => handleCancelParkedOrder(order.id!)} className="p-2 text-rose-400"><Trash2 size={20} /></button>
                    <button onClick={() => handleResumeOrder(order.id!)} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase">Resume</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-emerald-950/90 backdrop-blur-md">
          <div className="bg-white rounded-[4rem] p-10 text-center space-y-8 animate-in zoom-in max-w-sm w-full mx-4 shadow-2xl">
            <CheckCircle size={64} className="text-emerald-500 mx-auto" />
            <div>
              <h3 className="text-3xl font-black">Sale Completed!</h3>
              <p className="text-slate-500">₦{lastCompletedSale?.total_amount.toLocaleString()} logged.</p>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handlePrint} className="py-4 bg-slate-100 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-200"><Printer size={16}/> Print</button>
                <button onClick={handleBTPrint} disabled={isBTPrinting} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50">{isBTPrinting ? <Loader2 className="animate-spin" size={16}/> : <Bluetooth size={16}/>} BT Print</button>
              </div>
              <button onClick={handleShareWhatsApp} className="py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-emerald-100"><MessageSquare size={16}/> WhatsApp</button>
            </div>
            <button onClick={() => setShowSuccessModal(false)} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl hover:scale-[1.02] transition-transform">Next Customer</button>
          </div>
        </div>
      )}

      {showScanner && <BarcodeScanner onScan={(code) => {
        const p = products.find(prod => prod.barcode === code);
        if (p) addToCart(p); else alert("Not found: " + code);
      }} onClose={() => setShowScanner(false)} />}
      
      {/* Checkout Modal rendered at the very end with highest priority */}
      <CheckoutModal 
        isOpen={showCheckoutModal} 
        onClose={() => setShowCheckoutModal(false)} 
        cart={cart} 
        total={total} 
        currentUser={currentUser} 
        onComplete={onCompleteSale} 
      />

      <style>{`
        @keyframes bounce-up { 0% { transform: translateY(0); opacity: 0; } 50% { transform: translateY(-20px); opacity: 1; } 100% { transform: translateY(-40px); opacity: 0; } }
        .animate-bounce-up { animation: bounce-up 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default POS;
