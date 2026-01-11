
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
  History,
  Tag,
  X,
  User,
  Phone,
  ArrowRight
} from 'lucide-react';
import { Product, SaleItem, ParkedSale, View } from '../types';

interface POSProps {
  setView: (view: View) => void;
}

const POS: React.FC<POSProps> = ({ setView }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showParkedModal, setShowParkedModal] = useState(false);
  
  // Checkout State
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'pos' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });

  const products = useLiveQuery(() => db.products.toArray()) || [];
  const parkedSales = useLiveQuery(() => db.parked_sales.toArray()) || [];

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return ['All', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.barcode?.includes(searchTerm);
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, activeCategory]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { productId: product.id!, name: product.name, price: product.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === id) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const debtAmount = paymentType === 'split' ? Math.max(0, total - cashAmount) : 0;

  const parkOrder = async () => {
    if (cart.length === 0) return;
    await db.parked_sales.add({
      items: cart,
      total_amount: total,
      timestamp: Date.now()
    });
    setCart([]);
    alert("Order parked successfully!");
  };

  const restoreParked = (parked: ParkedSale) => {
    setCart(parked.items);
    db.parked_sales.delete(parked.id!);
    setShowParkedModal(false);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (paymentType === 'split' && (!customerInfo.name || !customerInfo.phone)) {
      alert("Please enter customer details for the remaining debt.");
      return;
    }

    try {
      await db.sales.add({
        items: cart,
        total_amount: total,
        payment_method: paymentType,
        cash_amount: paymentType === 'split' ? cashAmount : total,
        debt_amount: debtAmount,
        staff_id: 'Admin',
        timestamp: Date.now(),
        sync_status: 'pending'
      });

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
        const product = await db.products.get(item.productId);
        if (product) {
          await db.products.update(item.productId, {
            stock_qty: Math.max(0, product.stock_qty - item.quantity)
          });
        }
      }

      // Keep cart for summary then clear
      setShowCheckoutModal(false);
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

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4">
      {/* Left Side: Product Terminal */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Top Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Scan barcode or type name..." 
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-lg font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowParkedModal(true)}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 px-6 py-4 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
          >
            <History size={20} className="text-emerald-600" />
            <span className="hidden sm:inline">Parked</span>
            {parkedSales.length > 0 && (
              <span className="w-5 h-5 bg-emerald-600 text-white text-[10px] rounded-full flex items-center justify-center font-black animate-pulse">
                {parkedSales.length}
              </span>
            )}
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`
                px-5 py-2.5 rounded-full whitespace-nowrap text-sm font-bold transition-all border
                ${activeCategory === cat 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                  : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'}
              `}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 overflow-y-auto pr-1 pb-4">
          {filteredProducts.map((product) => (
            <button 
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white p-4 rounded-3xl border border-slate-200 hover:border-emerald-500 hover:shadow-xl transition-all text-left flex flex-col h-44 group relative overflow-hidden active:scale-95"
            >
              <div className="flex-1">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 mb-3 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shadow-sm">
                  <Tag size={18} />
                </div>
                <h4 className="font-bold text-slate-800 line-clamp-2 leading-tight text-sm mb-1">{product.name}</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{product.category}</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="font-black text-emerald-600 text-base">₦{product.price.toLocaleString()}</p>
                  <p className={`text-[10px] font-bold ${product.stock_qty <= 5 ? 'text-rose-500' : 'text-slate-400'}`}>
                    Stock: {product.stock_qty}
                  </p>
                </div>
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Plus size={16} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-full lg:w-[400px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/20">
              <ShoppingCart size={20} />
            </div>
            <h3 className="font-black text-slate-800 text-lg">Current Cart</h3>
          </div>
          <button 
            onClick={() => setCart([])}
            className="text-slate-300 hover:text-rose-500 transition-colors p-2"
          >
            <Trash2 size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.map((item) => (
            <div key={item.productId} className="flex items-center gap-4 group animate-in slide-in-from-right-2 duration-300">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                <p className="text-xs text-slate-500 font-black">₦{(item.price * item.quantity).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-1 border border-slate-100">
                <button 
                  onClick={() => updateQuantity(item.productId, -1)} 
                  className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
                >
                  <Minus size={14} />
                </button>
                <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                <button 
                  onClick={() => updateQuantity(item.productId, 1)} 
                  className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm text-emerald-600 hover:bg-emerald-50 transition-all"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-200">
                 <Package size={48} />
              </div>
              <p className="text-slate-500 font-black">No Items Added</p>
              <p className="text-xs text-slate-400 mt-1">Tap a product to start selling</p>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-900 text-white space-y-5 rounded-t-[3rem] shadow-[0_-15px_30px_-10px_rgba(0,0,0,0.2)]">
          <div className="space-y-3">
            <div className="flex justify-between text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <span>Order Summary</span>
              <span>{cart.length} Products</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold">Total Pay</span>
              <span className="text-4xl font-black text-emerald-400 tracking-tighter">₦{total.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              disabled={cart.length === 0}
              onClick={parkOrder}
              className="px-6 py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black transition-all flex items-center justify-center gap-2 border border-slate-700"
            >
              Park
            </button>
            <button 
              disabled={cart.length === 0}
              onClick={() => {
                setCashAmount(total);
                setShowCheckoutModal(true);
              }}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black text-xl shadow-2xl shadow-emerald-600/30 transition-all active:scale-95"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <h3 className="text-2xl font-black text-slate-900">Complete Payment</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'cash', icon: Banknote, label: 'Cash' },
                  { id: 'transfer', icon: Landmark, label: 'Bank' },
                  { id: 'pos', icon: CreditCard, label: 'POS' },
                  { id: 'split', icon: History, label: 'Split/Debt' },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => {
                      setPaymentType(method.id as any);
                      if (method.id !== 'split') setCashAmount(total);
                    }}
                    className={`
                      flex flex-col items-center gap-2 py-5 rounded-[2rem] border-2 transition-all
                      ${paymentType === method.id 
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-200' 
                        : 'bg-slate-50 border-transparent text-slate-500 hover:border-emerald-200 hover:bg-white'}
                    `}
                  >
                    <method.icon size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{method.label}</span>
                  </button>
                ))}
              </div>

              {paymentType === 'split' && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200 space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-amber-700 uppercase mb-2">Cash Received</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-black text-lg"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-amber-700 uppercase mb-2">Debt Balance</label>
                        <div className="px-4 py-3 bg-white/50 border border-amber-200 rounded-xl font-black text-xl text-rose-600 h-[52px] flex items-center">
                          ₦{debtAmount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Debtor Contact</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input 
                          placeholder="Name" 
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                          value={customerInfo.name}
                          onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                        />
                      </div>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input 
                          placeholder="Phone" 
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Grand Total</p>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">₦{total.toLocaleString()}</p>
                </div>
                <button 
                  onClick={handleCheckout}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <CheckCircle size={28} />
                  Authorize Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-emerald-950/90 backdrop-blur-md">
           <div className="bg-white rounded-[3rem] w-full max-w-md p-10 text-center space-y-8 animate-in zoom-in duration-300 shadow-2xl">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <CheckCircle size={56} />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900">Sale Confirmed!</h3>
                <p className="text-slate-500 font-medium">Inventory has been automatically updated.</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Received</p>
                <p className="text-3xl font-black text-emerald-600">₦{total.toLocaleString()}</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{paymentType} Payment</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {paymentType === 'transfer' && (
                  <button 
                    onClick={() => {
                      setView('transfer-station');
                      finalizeSale();
                    }}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-600/20"
                  >
                    Verify Transfer <ArrowRight size={18} />
                  </button>
                )}
                <button 
                  onClick={finalizeSale}
                  className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black transition-all"
                >
                  Return to POS
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Parked Modal */}
      {showParkedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden">
             <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <History className="text-emerald-600" />
                Parked Sales
              </h3>
              <button onClick={() => setShowParkedModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
              {parkedSales.map(p => (
                <div key={p.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-emerald-500 transition-all">
                  <div className="space-y-1">
                    <p className="font-black text-slate-800 text-lg">Order #{p.id}</p>
                    <p className="text-xs text-slate-500 font-bold">{new Date(p.timestamp).toLocaleString()}</p>
                    <p className="text-lg font-black text-emerald-600">₦{p.total_amount.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => db.parked_sales.delete(p.id!)}
                      className="p-3 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={22} />
                    </button>
                    <button 
                      onClick={() => restoreParked(p)}
                      className="px-8 py-3 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all active:scale-95"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
              {parkedSales.length === 0 && (
                <div className="text-center py-20 text-slate-400">
                  <History size={64} className="mx-auto mb-4 opacity-10" />
                  <p className="font-bold">No active parked orders</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
