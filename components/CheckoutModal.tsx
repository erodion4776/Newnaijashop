
import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle, 
  Calendar, 
  Phone, 
  Wallet, 
  Loader2 
} from 'lucide-react';
import { db } from '../db/db';
import { SaleItem, Staff, Sale } from '../types';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: SaleItem[];
  total: number;
  currentUser: Staff | null;
  onComplete: (sale: Sale, lowItems: string[]) => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, cart, total, currentUser, onComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'pos' | 'split' | null>(null);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [activeWallet, setActiveWallet] = useState<any>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [saveChangeToWallet, setSaveChangeToWallet] = useState(false);
  const [saleDate, setSaleDate] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });

  // Safe Wallet Lookup
  useEffect(() => {
    const lookup = async () => {
      if (customerPhone.length >= 10) {
        try {
          const wallet = await db.wallets.where('phone').equals(customerPhone).first();
          setActiveWallet(wallet || null);
          if (wallet?.name) setCustomerName(wallet.name);
        } catch (e) {
          console.error("Wallet DB Error", e);
        }
      } else {
        setActiveWallet(null);
        setUseWallet(false);
      }
    };
    if (isOpen) lookup();
  }, [customerPhone, isOpen]);

  if (!isOpen) return null;

  const walletDiscount = (useWallet && activeWallet) ? Math.min(Number(activeWallet.balance || 0), total) : 0;
  const payableTotal = Math.max(0, total - walletDiscount);
  const changeAmount = (paymentType === 'cash' && Number(cashAmount) > payableTotal) ? (Number(cashAmount) - payableTotal) : 0;

  const handleCompleteSale = async () => {
    if (cart.length === 0 || isProcessing || !paymentType) return;
    setIsProcessing(true);

    try {
      const saleId = crypto.randomUUID ? crypto.randomUUID() : `SAL-${Date.now()}`;
      const saleTimestamp = new Date(saleDate).getTime();
      const currentChange = Number(changeAmount);

      const saleData: Sale = {
        sale_id: saleId,
        items: [...cart],
        total_amount: total,
        subtotal: total,
        payment_method: paymentType,
        cash_amount: paymentType === 'split' ? cashAmount : (paymentType === 'cash' ? (saveChangeToWallet ? payableTotal : cashAmount) : 0),
        wallet_amount_used: walletDiscount,
        wallet_amount_credited: saveChangeToWallet ? currentChange : 0,
        customer_phone: customerPhone || undefined,
        staff_id: currentUser?.id?.toString() || '0',
        staff_name: currentUser?.name || 'Staff',
        timestamp: saleTimestamp,
        sync_status: 'pending'
      };

      let lowItems: string[] = [];

      // PART 1: CORE TRANSACTION (Sales & Stock)
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

      // PART 2: WALLET UPDATE (Isolated with try-catch to prevent crashing sale)
      if (customerPhone && customerPhone.length >= 10 && (saveChangeToWallet || (useWallet && walletDiscount > 0))) {
        try {
          await (db as any).transaction('rw', [db.wallets, db.wallet_transactions], async () => {
            const existingWallet = await db.wallets.where('phone').equals(customerPhone).first();
            if (saveChangeToWallet && currentChange > 0) {
              if (existingWallet) {
                await db.wallets.update(existingWallet.id, { 
                  balance: Number(existingWallet.balance || 0) + currentChange,
                  lastUpdated: Date.now() 
                });
              } else {
                await db.wallets.add({ phone: customerPhone, name: customerName || 'Customer', balance: currentChange, lastUpdated: Date.now() });
              }
              await db.wallet_transactions.add({ phone: customerPhone, amount: currentChange, type: 'Credit', timestamp: Date.now(), details: `Change from Sale #${saleId.substring(0,8)}` });
            }
            if (useWallet && walletDiscount > 0 && existingWallet) {
              await db.wallets.update(existingWallet.id, { 
                balance: Math.max(0, Number(existingWallet.balance || 0) - walletDiscount),
                lastUpdated: Date.now() 
              });
              await db.wallet_transactions.add({ phone: customerPhone, amount: walletDiscount, type: 'Debit', timestamp: Date.now(), details: `Used for Sale #${saleId.substring(0,8)}` });
            }
          });
        } catch (walletError) {
          console.error("Wallet fail", walletError);
          alert("Sale saved, but Wallet update failed. Please check balance manually.");
        }
      }

      onComplete(saleData, lowItems);
    } catch (error) {
      console.error(error);
      alert('Critical Error: Could not save sale. Refresh terminal.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center lg:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-white lg:rounded-[3rem] w-full h-full lg:h-auto lg:max-w-md animate-in slide-in-from-bottom-full lg:zoom-in duration-300 flex flex-col relative">
        <div className="p-8 border-b flex items-center justify-between">
          <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Payable</p><h3 className="text-4xl font-black text-slate-900">₦{payableTotal.toLocaleString()}</h3></div>
          <button onClick={onClose} className="p-3 bg-slate-50 rounded-full text-slate-400"><X size={24} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2 ml-1"><Calendar size={12} /> Sale Date & Time</label>
            <input type="datetime-local" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
          </div>

          <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase ml-1"><Phone size={12} /> Customer Phone</label>
            <input type="tel" placeholder="080..." className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold" value={customerPhone} onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, ''))} />
            {customerPhone.length >= 10 && !activeWallet && (
              <input type="text" placeholder="Customer Name (Optional)" className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            )}
            {activeWallet && Number(activeWallet.balance) > 0 && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div><p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Wallet Credit</p><p className="text-lg font-black text-emerald-700">₦{Number(activeWallet.balance).toLocaleString()}</p></div>
                <button onClick={() => setUseWallet(!useWallet)} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${useWallet ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 border border-emerald-200'}`}>{useWallet ? 'Using' : 'Use Credit'}</button>
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
              <input type="number" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none font-black text-3xl text-center" value={cashAmount || ''} onChange={e => setCashAmount(Number(e.target.value))} />
              {Number(changeAmount) > 0 && customerPhone.length >= 10 && (
                <button onClick={() => setSaveChangeToWallet(!saveChangeToWallet)} className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${saveChangeToWallet ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                  <Wallet size={18} /> {saveChangeToWallet ? 'Saving Change to Wallet' : `Save ₦${Number(changeAmount)} to Wallet`}
                </button>
              )}
              {Number(changeAmount) > 0 && !saveChangeToWallet && (
                <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase">Change Due</p>
                  <p className="text-2xl font-black text-amber-700">₦{Number(changeAmount).toLocaleString()}</p>
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
  );
};

export default CheckoutModal;
