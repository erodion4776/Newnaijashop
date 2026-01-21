
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
  PlayCircle
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
        // Strict stock validation
        if (delta > 0 && newQty > product.stock_qty) return item;
        return { ...item, quantity: Math.max(0, newQty) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const cartItemCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const debtAmount = paymentType === 'split' ? Math.max(0, total - cashAmount) : 0;
  const changeAmount = paymentType === 'cash' && cashAmount > total ? cashAmount - total : 0;

  const handleOpenParkModal = () => {
    if (cart.length === 0) {
      alert('Cannot park an empty cart!');
      return;
    }
    setParkCustomerName('');
    setShowParkNameModal(true);
  };

  const confirmParkSale = async () => {
    if (!parkCustomerName.trim()) {
      alert("Please enter a customer name or description.");
      return;
    }

    try {
      await db.parked_orders.add({
        customerName: parkCustomerName.trim(),
        items: cart,
        total: total,
        staffId: currentUser?.name || 'Staff',
        timestamp: Date.now()
      });
      setCart([]);
      setShowParkNameModal(false);
      setParkCustomerName('');
    } catch (err) {
      alert('Failed to park order: ' + err);
    }
  };

  const handleRetrieveParkedOrder = async (parkedOrder: ParkedOrder) => {
    // Clear current cart and load items
    setCart(parkedOrder.items);
    if (parkedOrder.id) await db.parked_orders.delete(parkedOrder.id);
    setShowParkedModal(false);
    setIsMobileCartOpen(true);
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    
    if (paymentType === 'split') {
      if (!customerInfo.name.trim() || !customerInfo.phone.trim()) {
        alert("Enter customer details for debt tracking.");
        return;
      }
    }

    try {
      setIsProcessing(true);
      
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
      broadcastSale(saleData);

      if (debtAmount > 0) {
        await db.debts.add({ 
          customer_name: customerInfo.name, 
          phone: customerInfo.phone, 
          amount: debtAmount, 
          status: 'pending', 
          timestamp: Date.now() 
        });
      }

      for (const item of cart) {
        const p = await db.products.get(item.productId);
        if (p) await db.products.update(item.productId, { stock_qty: Math.max(0, p.stock_qty - item.quantity) });
      }

      setShowCheckoutModal(false);
      setIsMobileCartOpen(false);
      setShowSuccessModal(true);
    } catch (err) {
      alert("Checkout failed: " + err);
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeSale = () => {
    setCart([]);
    setCashAmount(0);
    setPaymentType('cash');
    setCustomerInfo({ name: '', phone: '' });
    setShowSuccessModal(false);
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 60000);
    if (diff < 1) return 'just now';
    if (diff === 1) return '1 min ago';
    return `${diff} mins ago`;
  };

  const CartContent = ({ isMobile = false }) => (
    <div className={`flex flex-col h-full ${isMobile ? 'bg-white' : ''}`}>
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-lg">Current Cart</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{cartItemCount} items</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowParkedModal(true)} 
            className="relative p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
            title="Parked Orders"
          >
            <Clock size={20} />
            {parkedOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                {parkedOrders.length}
              </span>
            )}
          </button>
          <button onClick={() => setCart([])} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={20} /></button>
          {isMobile && <button onClick={() => setIsMobileCartOpen(false)} className="p-2 text-slate-400"><X size={20} /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <ShoppingCart size={48} className="text-slate-100 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cart is empty</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-800 truncate">{item.name}</p>
                <p className="text-xs text-slate-400 font-bold">₦{item.price.toLocaleString()} ea</p>
                <p className="text-sm font-black text-emerald-600 mt-1">₦{(item.price * item.quantity).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100">
                <button onClick={() => updateQuantity(item.productId, -1)} className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors"><Minus size={14} /></button>
                <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.productId, 1)} className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-colors"><Plus size={14} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="px-6 pb-2">
          <button onClick={handleOpenParkModal} className="w-full py-3 bg-amber-50 text-amber-600 rounded-xl font-black text-xs uppercase tracking-widest border border-amber-100 flex items-center justify-center gap-2 hover:bg-amber-100 transition-all">
            <Clock size={16} /> Park Sale
          </button>
        </div>
      )}

      <div className="p-8 bg-slate-900 text-white space-y-5 lg:rounded-t-[3rem] shadow-2xl">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-slate-400">Total Pay</span>
          <span className="text-4xl font-black text-emerald-400 tracking-tighter">₦{total.toLocaleString()}</span>
        </div>
        <button disabled={cart.length === 0} onClick={() => { setCashAmount(total); setShowCheckoutModal(true); }} className="w-full h-16 bg-emerald-600 rounded-2xl font-black text-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
          <Receipt size={24} /> Checkout
        </button>
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
              <input type="text" placeholder="Search product or scan..." className="w-full h-14 pl-12 pr-16 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none font-medium focus:ring-2 focus:ring-emerald-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <button onClick={() => setShowScanner(true)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all"><Camera size={24} /></button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-6 h-10 rounded-full whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all border ${activeCategory === cat ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'}`}>{cat}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filteredProducts.map((product) => {
            const inCart = cart.find(item => item.productId === product.id)?.quantity || 0;
            const isOutOfStock = product.stock_qty <= 0;
            return (
              <button key={product.id} onClick={() => addToCart(product)} disabled={isOutOfStock} className={`bg-white p-5 rounded-3xl border text-left flex flex-col h-44 relative overflow-hidden transition-all group ${isOutOfStock ? 'opacity-60 grayscale cursor-not-allowed' : 'border-slate-200 hover:border-emerald-500 hover:shadow-xl active:scale-95'}`}>
                {inCart > 0 && <div className="absolute top-2 right-2 w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg">{inCart}</div>}
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 line-clamp-2 text-sm">{product.name}</h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-widest">{product.category}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="font-black text-lg text-emerald-600">₦{product.price.toLocaleString()}</p>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${product.stock_qty <= 5 ? 'text-amber-500' : 'text-slate-400'}`}>Stock: {product.stock_qty}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOutOfStock ? 'bg-slate-100' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'}`}>
                    <Plus size={18} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden lg:flex w-[400px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 flex-col overflow-hidden"><CartContent /></div>

      <button onClick={() => setIsMobileCartOpen(true)} className="lg:hidden fixed bottom-6 right-6 w-16 h-16 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-90">
        <ShoppingCart size={28} />
        {cartItemCount > 0 && <span className="absolute -top-1 -right-1 w-7 h-7 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center shadow-lg border-2 border-white">{cartItemCount}</span>}
      </button>

      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[3rem] h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            <CartContent isMobile />
          </div>
        </div>
      )}

      {/* Park Name Modal */}
      {showParkNameModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 space-y-6 animate-in zoom-in duration-300">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Identify Parked Order</h3>
              <p className="text-xs text-slate-500">Add a name or description for this sale.</p>
            </div>
            <div className="space-y-4">
              <input 
                autoFocus
                type="text" 
                placeholder="e.g. Musa or Blue Shirt Guy" 
                className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                value={parkCustomerName}
                onChange={(e) => setParkCustomerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmParkSale()}
              />
              <div className="flex gap-3">
                <button onClick={() => setShowParkNameModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                <button onClick={confirmParkSale} className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all">Confirm Park</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parked Orders List Modal */}
      {showParkedModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Parked Orders</h3>
              </div>
              <button onClick={() => setShowParkedModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {parkedOrders.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto">
                    <Clock size={32} />
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No parked orders found</p>
                </div>
              ) : (
                parkedOrders.map((order) => (
                  <div key={order.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:border-amber-400 transition-all flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-slate-800 text-lg leading-tight">{order.customerName}</h4>
                      <div className="flex items-center gap-3 mt-1.5 text-xs font-bold text-slate-400">
                        <span className="flex items-center gap-1"><Package size={12} /> {order.items.reduce((a,c) => a+c.quantity, 0)} items</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {formatTimeAgo(order.timestamp)}</span>
                      </div>
                      <p className="text-emerald-600 font-black text-lg mt-2">₦{order.total.toLocaleString()}</p>
                    </div>
                    <button 
                      onClick={() => handleRetrieveParkedOrder(order)}
                      className="p-4 bg-white text-emerald-600 border border-emerald-100 rounded-2xl shadow-sm hover:bg-emerald-600 hover:text-white transition-all flex flex-col items-center gap-1 active:scale-95"
                    >
                      <PlayCircle size={28} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Resume</span>
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 shrink-0">
              <p className="text-center text-[10px] text-slate-400 font-black uppercase tracking-widest">Select an order to resume checkout</p>
            </div>
          </div>
        </div>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 space-y-6 animate-in zoom-in duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Authorize Sale</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
            </div>

            <div className="bg-slate-900 rounded-2xl p-6 text-center space-y-1">
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Total Pay</p>
              <p className="text-4xl font-black text-emerald-400 tracking-tighter">₦{total.toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {['cash', 'transfer', 'pos', 'split'].map(m => (
                <button key={m} onClick={() => setPaymentType(m as any)} className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${paymentType === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'border-slate-100'}`}>
                  {m === 'cash' ? <Banknote size={20} /> : m === 'transfer' ? <Landmark size={20} /> : m === 'pos' ? <CreditCard size={20} /> : <SplitSquareVertical size={20} />}
                  <span className="font-black uppercase text-[9px] tracking-widest">{m}</span>
                </button>
              ))}
            </div>

            {paymentType === 'split' && (
              <div className="space-y-4 p-5 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Debt Info Required</span>
                </div>
                <div className="space-y-3">
                  <input type="text" placeholder="Customer Name" className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold outline-none" value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} />
                  <input type="tel" placeholder="Phone (WhatsApp)" className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold outline-none" value={customerInfo.phone} onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} />
                </div>
              </div>
            )}

            <button onClick={handleCheckout} disabled={isProcessing} className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl active:scale-95 flex items-center justify-center gap-3">
              {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} />}
              Complete Transaction
            </button>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-emerald-950/95 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] p-12 text-center space-y-8 animate-in zoom-in duration-500 w-full max-w-sm">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle size={56} className="animate-bounce" /></div>
              <div className="space-y-2">
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Sale Confirmed!</h3>
                <p className="text-slate-500 font-medium">Transaction logged to terminal.</p>
              </div>
              <button onClick={finalizeSale} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-2xl active:scale-95">Next Sale</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default POS;
