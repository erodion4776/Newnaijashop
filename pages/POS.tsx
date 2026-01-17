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
  ArrowRight,
  Camera,
  AlertTriangle,
  PackagePlus,
  Loader2,
  ChevronUp,
  SplitSquareVertical,
  Receipt,
  Clock
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
  const [isProcessing, setIsProcessing] = useState(false);
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

  // Get product stock considering what's already in cart
  const getAvailableStock = (productId: number) => {
    const product = products?.find(p => p.id === productId);
    const inCart = cart.find(item => item.productId === productId)?.quantity || 0;
    return (product?.stock_qty || 0) - inCart;
  };

  const addToCart = (product: Product) => {
    const availableStock = getAvailableStock(product.id!);
    if (availableStock <= 0) {
      // Already at max stock
      return;
    }
    
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
    
    setCart(prev => prev.map(item => {
      if (item.productId === id) {
        const newQuantity = item.quantity + delta;
        // Check stock limit when increasing
        if (delta > 0 && product && newQuantity > product.stock_qty) {
          return item; // Don't exceed stock
        }
        return { ...item, quantity: Math.max(0, newQuantity) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const cartItemCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);
  const debtAmount = paymentType === 'split' ? Math.max(0, total - cashAmount) : 0;
  const changeAmount = paymentType === 'cash' && cashAmount > total ? cashAmount - total : 0;

  // Park current sale
  const handleParkSale = async () => {
    if (cart.length === 0) return;
    
    try {
      const parkedSale: ParkedSale = {
        items: cart,
        total_amount: total,
        customer_name: customerInfo.name || 'Walk-in',
        timestamp: Date.now()
      };
      
      await db.parked_sales.add(parkedSale);
      setCart([]);
      setCustomerInfo({ name: '', phone: '' });
      alert('Sale parked successfully!');
    } catch (err) {
      alert('Failed to park sale: ' + err);
    }
  };

  // Retrieve parked sale
  const handleRetrieveParkedSale = async (parkedSale: ParkedSale) => {
    if (cart.length > 0) {
      const confirm = window.confirm('This will replace your current cart. Continue?');
      if (!confirm) return;
    }
    
    setCart(parkedSale.items);
    if (parkedSale.id) {
      await db.parked_sales.delete(parkedSale.id);
    }
    setShowParkedModal(false);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (paymentType === 'split') {
      if (!customerInfo.name.trim() || !customerInfo.phone.trim()) {
        alert("Please enter customer name and phone for the remaining debt.");
        return;
      }
      if (cashAmount <= 0) {
        alert("Please enter the cash amount being paid.");
        return;
      }
      if (cashAmount >= total) {
        alert("Cash amount covers full total. Use 'Cash' payment instead.");
        return;
      }
    }

    try {
      setIsProcessing(true);
      
      const saleData: Sale = {
        items: cart,
        total_amount: total,
        payment_method: paymentType,
        cash_amount: paymentType === 'split' ? cashAmount : (paymentType === 'cash' ? cashAmount : total),
        debt_amount: debtAmount,
        staff_id: currentUser?.name || 'Terminal', 
        timestamp: Date.now(),
        sync_status: 'pending'
      };

      await db.sales.add(saleData);
      
      // LIVE BROADCAST: Send to Admin immediately
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
        const product = await db.products.get(item.productId);
        if (product) {
          await db.products.update(item.productId, { 
            stock_qty: Math.max(0, product.stock_qty - item.quantity) 
          });
        }
      }

      setShowCheckoutModal(false);
      setIsMobileCartOpen(false);
      setShowSuccessModal(true);
    } catch (err) {
      alert("Error: " + err);
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

  const openCheckout = () => {
    setCashAmount(total);
    setPaymentType('cash');
    setShowCheckoutModal(true);
  };

  // Payment method config with icons
  const paymentMethods = [
    { key: 'cash', label: 'Cash', icon: Banknote, color: 'emerald' },
    { key: 'transfer', label: 'Transfer', icon: Landmark, color: 'blue' },
    { key: 'pos', label: 'POS', icon: CreditCard, color: 'purple' },
    { key: 'split', label: 'Split', icon: SplitSquareVertical, color: 'amber' },
  ];

  const CartContent = ({ isMobile = false }) => (
    <div className={`flex flex-col h-full ${isMobile ? 'bg-white' : ''}`}>
      {/* Cart Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-lg">Current Cart</h3>
            <p className="text-xs text-slate-400">{cartItemCount} items</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {parkedSales.length > 0 && (
            <button 
              onClick={() => setShowParkedModal(true)}
              className="relative p-2 text-amber-500 hover:bg-amber-50 rounded-xl"
            >
              <Clock size={20} />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {parkedSales.length}
              </span>
            </button>
          )}
          <button 
            onClick={() => setCart([])} 
            disabled={cart.length === 0}
            className="text-slate-300 hover:text-rose-500 p-2 disabled:opacity-30"
          >
            <Trash2 size={20} />
          </button>
          {isMobile && (
            <button onClick={() => setIsMobileCartOpen(false)} className="p-2 text-slate-400">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-400 font-medium">Cart is empty</p>
            <p className="text-slate-300 text-sm mt-1">Tap products to add them</p>
          </div>
        ) : (
          cart.map((item) => {
            const product = products?.find(p => p.id === item.productId);
            const isAtMaxStock = product && item.quantity >= product.stock_qty;
            
            return (
              <div key={item.productId} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">₦{item.price.toLocaleString()} × {item.quantity}</p>
                  <p className="text-sm text-emerald-600 font-black">₦{(item.price * item.quantity).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-2xl p-1.5 border border-slate-100">
                  <button 
                    onClick={() => updateQuantity(item.productId, -1)} 
                    className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-xl hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.productId, 1)} 
                    disabled={isAtMaxStock}
                    className="w-9 h-9 flex items-center justify-center bg-emerald-50 rounded-xl text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart Actions */}
      {cart.length > 0 && (
        <div className="px-6 pb-2">
          <button 
            onClick={handleParkSale}
            className="w-full py-3 bg-amber-50 text-amber-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-amber-100"
          >
            <Clock size={16} /> Park Sale for Later
          </button>
        </div>
      )}

      {/* Cart Footer */}
      <div className="p-6 lg:p-8 bg-slate-900 text-white space-y-5 lg:rounded-t-[3rem]">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-slate-400">Total</span>
          <span className="text-3xl lg:text-4xl font-black text-emerald-400 tracking-tighter">
            ₦{total.toLocaleString()}
          </span>
        </div>
        <button 
          disabled={cart.length === 0} 
          onClick={openCheckout} 
          className="w-full h-14 bg-emerald-600 rounded-2xl font-black text-xl shadow-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Receipt size={22} /> Checkout
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 relative">
      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner 
          onScan={(barcode) => { 
            const p = products?.find(i => i.barcode === barcode); 
            if(p) addToCart(p); 
            setShowScanner(false); 
          }} 
          onClose={() => setShowScanner(false)} 
        />
      )}

      {/* Products Grid */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 pb-24 lg:pb-0">
        {/* Search & Categories */}
        <div className="sticky top-0 z-30 bg-slate-50 pt-2 pb-4 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Search product or scan barcode..." 
                className="w-full h-14 pl-12 pr-16 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none font-medium focus:border-emerald-500 transition-colors" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
              <button 
                onClick={() => setShowScanner(true)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
              >
                <Camera size={24} />
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button 
                key={cat} 
                onClick={() => setActiveCategory(cat)} 
                className={`px-6 h-10 rounded-full whitespace-nowrap text-sm font-bold transition-all border ${
                  activeCategory === cat 
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' 
                    : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
            <Package size={64} className="text-slate-200 mb-4" />
            <p className="text-slate-400 font-medium">No products found</p>
            <p className="text-slate-300 text-sm">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {filteredProducts.map((product) => {
              const inCart = cart.find(item => item.productId === product.id)?.quantity || 0;
              const isOutOfStock = product.stock_qty <= 0;
              const isMaxedOut = inCart >= product.stock_qty;
              
              return (
                <button 
                  key={product.id} 
                  onClick={() => addToCart(product)} 
                  disabled={isOutOfStock || isMaxedOut}
                  className={`bg-white p-5 rounded-3xl border text-left flex flex-col h-44 relative overflow-hidden transition-all ${
                    isOutOfStock || isMaxedOut
                      ? 'opacity-60 grayscale border-slate-100' 
                      : 'border-slate-200 hover:border-emerald-500 hover:shadow-lg active:scale-95'
                  }`}
                >
                  {/* In Cart Badge */}
                  {inCart > 0 && (
                    <div className="absolute top-3 right-3 w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg">
                      {inCart}
                    </div>
                  )}
                  
                  {/* Out of Stock Overlay */}
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-xs font-bold">
                        Out of Stock
                      </span>
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 line-clamp-2 text-sm">{product.name}</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase mt-1">{product.category}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="font-black text-lg text-emerald-600">₦{product.price.toLocaleString()}</p>
                      <p className={`text-[10px] font-bold ${product.stock_qty <= 5 ? 'text-amber-500' : 'text-slate-400'}`}>
                        Stock: {product.stock_qty}
                      </p>
                    </div>
                    {!isOutOfStock && !isMaxedOut && (
                      <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center">
                        <Plus size={18} className="text-emerald-600" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Cart */}
      <div className="hidden lg:flex w-[400px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 flex-col overflow-hidden">
        <CartContent />
      </div>

      {/* Mobile Floating Cart Button */}
      <button 
        onClick={() => setIsMobileCartOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 w-16 h-16 bg-emerald-600 rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-95"
      >
        <ShoppingCart size={24} className="text-white" />
        {cartItemCount > 0 && (
          <span className="absolute -top-1 -right-1 w-7 h-7 bg-rose-500 text-white text-sm font-black rounded-full flex items-center justify-center">
            {cartItemCount}
          </span>
        )}
      </button>

      {/* Mobile Cart Total Bar */}
      {cart.length > 0 && !isMobileCartOpen && (
        <div className="lg:hidden fixed bottom-24 left-4 right-4 bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-2xl z-40">
          <div>
            <p className="text-xs text-slate-400">{cartItemCount} items</p>
            <p className="text-xl font-black text-emerald-400">₦{total.toLocaleString()}</p>
          </div>
          <button 
            onClick={() => setIsMobileCartOpen(true)}
            className="px-6 py-3 bg-emerald-600 rounded-xl font-bold flex items-center gap-2"
          >
            View Cart <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Mobile Cart Drawer */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm">
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[3rem] max-h-[90vh] flex flex-col animate-in slide-in-from-bottom">
            <CartContent isMobile />
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in">
            <div className="p-8 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-900">Complete Sale</h3>
                <button 
                  onClick={() => setShowCheckoutModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Total Display */}
              <div className="bg-slate-900 rounded-2xl p-6 text-center">
                <p className="text-slate-400 text-sm">Total Amount</p>
                <p className="text-4xl font-black text-emerald-400">₦{total.toLocaleString()}</p>
              </div>

              {/* Payment Methods */}
              <div>
                <p className="text-sm font-bold text-slate-500 mb-3">Payment Method</p>
                <div className="grid grid-cols-4 gap-3">
                  {paymentMethods.map(method => {
                    const Icon = method.icon;
                    const isSelected = paymentType === method.key;
                    return (
                      <button 
                        key={method.key} 
                        onClick={() => {
                          setPaymentType(method.key as any);
                          if (method.key !== 'split') {
                            setCashAmount(total);
                          } else {
                            setCashAmount(0);
                          }
                        }} 
                        className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                          isSelected 
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' 
                            : 'border-slate-100 hover:border-emerald-300'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="font-black uppercase text-[10px]">{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cash Payment Input */}
              {paymentType === 'cash' && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-500">Cash Received</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</span>
                    <input 
                      type="number"
                      value={cashAmount || ''}
                      onChange={(e) => setCashAmount(Number(e.target.value))}
                      className="w-full h-14 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xl font-bold outline-none focus:border-emerald-500"
                      placeholder="0"
                    />
                  </div>
                  {cashAmount > total && (
                    <div className="bg-emerald-50 rounded-xl p-4 flex items-center justify-between">
                      <span className="font-medium text-emerald-700">Change Due:</span>
                      <span className="text-2xl font-black text-emerald-600">₦{changeAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {/* Quick Cash Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000].map((amt, i) => (
                      <button 
                        key={i}
                        onClick={() => setCashAmount(amt)}
                        className={`py-2 rounded-lg text-sm font-bold border ${
                          cashAmount === amt 
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-700' 
                            : 'border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        ₦{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Split Payment Fields */}
              {paymentType === 'split' && (
                <div className="space-y-4 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle size={18} />
                    <span className="text-sm font-bold">Split Payment - Customer Info Required</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Cash Amount Paid Now</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</span>
                        <input 
                          type="number"
                          value={cashAmount || ''}
                          onChange={(e) => setCashAmount(Math.min(Number(e.target.value), total - 1))}
                          className="w-full h-12 pl-10 pr-4 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"
                          placeholder="0"
                          max={total - 1}
                        />
                      </div>
                    </div>
                    
                    <div className="bg-rose-50 rounded-xl p-3">
                      <p className="text-xs text-rose-600 font-medium">Remaining Debt:</p>
                      <p className="text-2xl font-black text-rose-600">₦{debtAmount.toLocaleString()}</p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Customer Name *</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text"
                          value={customerInfo.name}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"
                          placeholder="Enter customer name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Phone Number *</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="tel"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"
                          placeholder="08012345678"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Complete Button */}
              <button 
                onClick={handleCheckout} 
                disabled={isProcessing || (paymentType === 'cash' && cashAmount < total)}
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xl shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle size={24} />
                    Complete Sale
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parked Sales Modal */}
      {showParkedModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-lg max-h-[80vh] overflow-hidden animate-in zoom-in">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                  <Clock size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-800">Parked Sales</h3>
              </div>
              <button onClick={() => setShowParkedModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              {parkedSales.length === 0 ? (
                <div className="text-center py-12">
                  <Clock size={48} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400">No parked sales</p>
                </div>
              ) : (
                parkedSales.map((sale) => (
                  <button
                    key={sale.id}
                    onClick={() => handleRetrieveParkedSale(sale)}
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-emerald-500 transition-all text-left"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-800">{sale.customer_name}</span>
                      <span className="text-lg font-black text-emerald-600">₦{sale.total_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>{sale.items.length} items</span>
                      <span>{new Date(sale.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-emerald-950/95 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] p-10 text-center space-y-6 max-w-sm w-full animate-in zoom-in">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={56} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900">Sale Complete!</h3>
              <p className="text-slate-500 mt-2">Transaction recorded successfully</p>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm text-slate-400">Amount Paid</p>
              <p className="text-3xl font-black text-emerald-600">₦{total.toLocaleString()}</p>
              {changeAmount > 0 && (
                <p className="text-sm text-slate-500 mt-2">
                  Change: <span className="font-bold">₦{changeAmount.toLocaleString()}</span>
                </p>
              )}
            </div>

            <button 
              onClick={finalizeSale} 
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg active:scale-95"
            >
              New Sale
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
