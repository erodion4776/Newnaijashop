import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  ShoppingCart, Search, Trash2, Plus, Minus, CheckCircle, Package, X, Camera, Loader2, Pause, FolderOpen, History, ChevronRight, Printer, Bluetooth, Edit3, MessageSquare
} from 'lucide-react';
import { Product, SaleItem, View, Staff, Sale, Settings } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import BluetoothPrintService from '../services/BluetoothPrintService';
import CheckoutModal from '../components/CheckoutModal';
import VoiceAssistant from '../components/VoiceAssistant';

interface POSProps {
  setView: (view: View) => void;
  currentUser?: Staff | null;
  cart: SaleItem[];
  setCart: React.Dispatch<React.SetStateAction<SaleItem[]>>;
  parkTrigger?: number;
}

const POS: React.FC<POSProps> = ({ setView, currentUser, cart, setCart, parkTrigger }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isBTPrinting, setIsBTPrinting] = useState(false);

  // Parked Orders States
  const [showParkModal, setShowParkModal] = useState(false);
  const [tempName, setTempName] = useState('');

  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const parkedOrders = useLiveQuery(() => db.parked_orders.toArray(), []) || [];
  const settings = useLiveQuery(() => db.settings.get('app_settings')) as Settings | undefined;

  // Sync with AI Trigger
  useEffect(() => {
    if (parkTrigger && parkTrigger > 0 && cart.length > 0) {
      setShowParkModal(true);
    }
  }, [parkTrigger]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode?.includes(searchTerm));
  }, [products, searchTerm]);

  const addToCart = (product: Product) => {
    const inCart = cart.find(item => item.productId === product.id)?.quantity || 0;
    if (inCart + 1 > product.stock_qty) { alert(`Only ${product.stock_qty} left!`); return; }
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
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
    if (!cart.length || isProcessing) return;
    setIsProcessing(true);
    try {
      await db.parked_orders.add({
        customerName: tempName || 'Quick Order',
        items: cart, total, staffId: currentUser?.id?.toString() || '0', timestamp: Date.now()
      });
      setCart([]);
      setShowParkModal(false);
      setTempName('');
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4">
      <div className="flex-1 overflow-y-auto space-y-4">
        <div className="sticky top-0 z-30 bg-slate-50 py-2 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search product..." className="w-full h-14 pl-12 pr-4 bg-white border rounded-2xl outline-none shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => setShowScanner(true)} className="h-14 w-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center"><Camera /></button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProducts.map(p => (
            <button key={p.id} disabled={p.stock_qty <= 0} onClick={() => addToCart(p)} className="bg-white p-5 rounded-[2rem] border text-left h-44 flex flex-col justify-between hover:border-emerald-500 transition-all shadow-sm">
              <h4 className="font-bold text-slate-800 text-sm">{p.name}</h4>
              <div className="flex justify-between items-end">
                <p className="font-black text-emerald-600">₦{p.price.toLocaleString()}</p>
                <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Plus size={16} /></div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full lg:w-[350px] bg-white rounded-[2.5rem] flex flex-col p-6 shadow-xl">
        <h3 className="font-black text-slate-800 flex items-center gap-2 mb-4"><ShoppingCart size={20} /> Cart</h3>
        <div className="flex-1 overflow-y-auto space-y-4">
          {cart.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
              <div className="flex-1"><p className="font-bold text-sm truncate">{item.name}</p><p className="text-[10px] font-black text-emerald-600">₦{item.price.toLocaleString()}</p></div>
              <div className="flex items-center gap-3">
                <button onClick={() => updateQuantity(item.productId, -1)} className="p-1.5 bg-white rounded-lg text-rose-500"><Minus size={12} /></button>
                <span className="font-black text-sm">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.productId, 1)} className="p-1.5 bg-white rounded-lg text-emerald-500"><Plus size={12} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-6 border-t space-y-4">
          <div className="flex justify-between items-center"><span className="text-xs font-black uppercase text-slate-400">Total</span><span className="text-3xl font-black text-emerald-600">₦{total.toLocaleString()}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowParkModal(true)} disabled={!cart.length} className="py-5 bg-slate-100 rounded-2xl font-black text-[10px] uppercase">Park</button>
            <button onClick={() => setShowCheckoutModal(true)} disabled={!cart.length} className="py-5 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase">Checkout</button>
          </div>
        </div>
      </div>

      {showParkModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm space-y-6">
            <h3 className="text-2xl font-black text-center">Park Order</h3>
            <form onSubmit={handleParkSale} className="space-y-4">
              <input autoFocus required type="text" placeholder="Customer Name" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={tempName} onChange={e => setTempName(e.target.value)} />
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black">Confirm Park</button>
              <button type="button" onClick={() => setShowParkModal(false)} className="w-full text-slate-400 font-bold uppercase text-xs">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {showCheckoutModal && <CheckoutModal isOpen={showCheckoutModal} onClose={() => setShowCheckoutModal(false)} cart={cart} total={total} currentUser={currentUser} onComplete={() => { setCart([]); setShowCheckoutModal(false); setShowSuccessModal(true); }} />}
      {showSuccessModal && <div className="fixed inset-0 z-[1300] bg-emerald-950/90 flex items-center justify-center p-4"><div className="bg-white p-10 rounded-[3rem] text-center space-y-6"><CheckCircle size={64} className="mx-auto text-emerald-500"/><h3 className="text-2xl font-black">Sale Completed!</h3><button onClick={() => setShowSuccessModal(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black">Next Customer</button></div></div>}
    </div>
  );
};

export default POS;
