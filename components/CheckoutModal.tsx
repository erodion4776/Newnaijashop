import React, { useState } from 'react';
import { 
  X, 
  CheckCircle, 
  Calendar, 
  Loader2,
  Wallet,
  CreditCard,
  Building2,
  Calculator,
  ArrowRight,
  Phone,
  User as UserIcon,
  AlertCircle,
  Receipt,
  ArrowLeft,
  Plus,
  Zap,
  Tag
} from 'lucide-react';
import { db } from '../db/db';
import { SaleItem, Staff, Sale } from '../types';
import { useSync } from '../hooks/context/SyncProvider';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: SaleItem[];
  total: number;
  currentUser: Staff | null;
  onComplete: (sale: Sale, lowItems: string[]) => void;
}

type PaymentMethod = 'cash' | 'transfer' | 'pos' | 'split';
type CheckoutStep = 'payment' | 'details' | 'confirm';

const CheckoutModal: React.FC<CheckoutModalProps> = ({ 
  isOpen, 
  onClose, 
  cart, 
  total, 
  currentUser, 
  onComplete 
}) => {
  const [step, setStep] = useState<CheckoutStep>('payment');
  const [isProcessing, setIsProcessing] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  
  // Sync Hook for Instant Push
  const { status, broadcastSale } = useSync();
  
  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashAmount, setCashAmount] = useState<number>(total);
  const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
  
  // Customer Details State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Sale Date
  const [saleDate, setSaleDate] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });

  if (!isOpen) return null;

  const finalTotal = Math.max(0, total - discount);
  const changeAmount = paymentMethod === 'cash' && cashAmount > finalTotal ? cashAmount - finalTotal : 0;
  const splitPosAmount = paymentMethod === 'split' ? Math.max(0, finalTotal - splitCashAmount) : 0;

  const cashPresets = [
    Math.ceil(finalTotal / 1000) * 1000,
    Math.ceil(finalTotal / 5000) * 5000,
    Math.ceil(finalTotal / 10000) * 10000,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= finalTotal).slice(0, 3);

  const handleCompleteSale = async () => {
    if (!paymentMethod) {
      alert('Please select a payment method');
      return;
    }

    if (paymentMethod === 'cash' && cashAmount < finalTotal) {
      alert('Cash amount is insufficient');
      return;
    }

    setIsProcessing(true);

    try {
      const saleId = crypto.randomUUID ? crypto.randomUUID() : `SAL-${Date.now()}`;
      const saleTimestamp = new Date(saleDate).getTime();

      const saleData: Sale = {
        sale_id: saleId,
        items: [...cart],
        total_amount: finalTotal,
        subtotal: total,
        discount_amount: Number(discount),
        payment_method: (paymentMethod === 'transfer' ? 'Bank Transfer' : (paymentMethod === 'split' ? 'split' : paymentMethod)) as any,
        cash_amount: paymentMethod === 'split' ? splitCashAmount : (paymentMethod === 'cash' ? cashAmount : 0),
        customer_phone: customerPhone || undefined,
        staff_id: currentUser?.id?.toString() || '0',
        staff_name: currentUser?.name || 'Staff',
        timestamp: saleTimestamp,
        sync_status: 'pending'
      };

      let lowItems: string[] = [];

      // ATOMIC TRANSACTION: Save locally first
      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        await db.sales.add(saleData);
        for (const item of cart) {
          const product = await db.products.get(item.productId);
          if (!product) continue;
          if (item.isStockAlreadyDeducted) {
            if (product.stock_qty <= Number(product.low_stock_threshold || 5)) lowItems.push(product.name);
            continue;
          }
          const currentStock = Number(product.stock_qty || 0);
          const soldQty = Number(item.quantity || 0);
          const newStock = Math.max(0, currentStock - soldQty);
          await db.products.update(item.productId, { stock_qty: newStock });
          await db.inventory_logs.add({
            product_id: item.productId,
            product_name: product.name,
            quantity_changed: -soldQty,
            old_stock: currentStock,
            new_stock: newStock,
            type: 'Sale',
            timestamp: Date.now(),
            performed_by: currentUser?.name || 'Staff'
          });
          if (newStock <= Number(product.low_stock_threshold || 5)) lowItems.push(product.name);
        }
      });

      // INSTANT P2P PUSH: If connected via Live Bridge
      if (status === 'live') {
        broadcastSale(saleData);
      }

      setIsProcessing(false);
      onComplete(saleData, lowItems);
      
      setStep('payment');
      setPaymentMethod(null);
      setDiscount(0);
      setCashAmount(total);
      setCustomerName('');
      setCustomerPhone('');
      
    } catch (error) {
      console.error("Transaction Error:", error);
      alert('Error: Transaction failed.');
      setIsProcessing(false);
    }
  };

  const renderPaymentStep = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="text-center space-y-2">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Payable</h3>
        <div className="flex flex-col items-center">
          {discount > 0 && <p className="text-sm font-bold text-slate-400 line-through">₦{total.toLocaleString()}</p>}
          <p className="text-5xl font-black text-emerald-600">₦{finalTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white p-4 border border-slate-100 rounded-2xl flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><Tag size={20} /></div>
        <div className="flex-1">
          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Apply Discount / Jara (₦)</label>
          <input type="number" placeholder="0" className="w-full bg-transparent font-black text-lg outline-none text-emerald-600" value={discount || ''} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'cash', label: 'Cash', icon: Wallet },
          { id: 'transfer', label: 'Transfer', icon: Building2 },
          { id: 'pos', label: 'POS Card', icon: CreditCard },
          { id: 'split', label: 'Split Pay', icon: Calculator }
        ].map(method => (
          <button key={method.id} onClick={() => { setPaymentMethod(method.id as any); if (method.id === 'cash') setCashAmount(finalTotal); }} className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${paymentMethod === method.id ? `bg-emerald-600 border-emerald-600 text-white shadow-xl` : 'bg-white border-slate-100 text-slate-500'}`}>
            <method.icon size={32} />
            <span className="font-black text-[10px] uppercase tracking-wider">{method.label}</span>
          </button>
        ))}
      </div>

      {paymentMethod === 'cash' && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-6 space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-emerald-700 uppercase">Cash Given</label>
            <div className="flex gap-1.5">{cashPresets.map(preset => (<button key={preset} onClick={() => setCashAmount(preset)} className="px-3 py-1.5 bg-white border border-emerald-200 rounded-xl font-black text-[10px] text-emerald-600">{(preset / 1000).toFixed(0)}k</button>))}</div>
          </div>
          <input autoFocus type="number" inputMode="numeric" className="w-full px-6 py-5 text-4xl font-black text-center bg-white border-2 border-emerald-200 rounded-2xl outline-none" value={cashAmount || ''} onChange={(e) => setCashAmount(Number(e.target.value))} />
        </div>
      )}

      {paymentMethod && (
        <button onClick={() => setStep('details')} className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-lg shadow-xl flex items-center justify-center gap-3">
          Customer Details <ArrowRight size={24} />
        </button>
      )}
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="text-center"><h3 className="text-2xl font-black text-slate-900">Customer Details</h3><p className="text-xs text-slate-400">Optional</p></div>
      <div className="space-y-4">
        <div><label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2"><UserIcon size={12} /> Full Name</label><input type="text" placeholder="e.g. Chinedu" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
        <div><label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2"><Phone size={12} /> WhatsApp</label><input type="tel" placeholder="080..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setStep('payment')} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"><ArrowLeft size={16} /> Back</button>
        <button onClick={() => setStep('confirm')} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg flex items-center justify-center gap-2">Review Sale <ArrowRight size={16} /></button>
      </div>
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="text-center"><h3 className="text-2xl font-black text-slate-900">Final Verification</h3></div>
      <div className="bg-slate-50 rounded-[2.5rem] p-6 space-y-4 border border-slate-200 shadow-inner">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200"><span className="text-[10px] font-black text-slate-400 uppercase">Method</span><span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-black text-[10px] uppercase tracking-widest">{paymentMethod?.toUpperCase()}</span></div>
        <div className="space-y-3 max-h-40 overflow-y-auto scrollbar-hide">{cart.map((item, idx) => (<div key={idx} className="flex justify-between text-sm"><span className="text-slate-600 font-bold">{item.name} <span className="text-slate-400">x{item.quantity}</span></span><span className="font-black text-slate-900">₦{(item.price * item.quantity).toLocaleString()}</span></div>))}</div>
        <div className="pt-4 border-t border-slate-200"><div className="flex justify-between items-center font-black"><span className="text-slate-900 uppercase text-xs">Total Paid</span><span className="text-3xl text-emerald-600">₦{finalTotal.toLocaleString()}</span></div></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setStep('details')} disabled={isProcessing} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest">Back</button>
        <button onClick={handleCompleteSale} disabled={isProcessing} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">{isProcessing ? <><Loader2 className="animate-spin" size={20} /> Saving...</> : <><CheckCircle size={20} /> Finalize Sale</>}</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center lg:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white lg:rounded-[3.5rem] w-full h-full lg:h-auto lg:max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full duration-300">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Receipt size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Sale Checkout</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Step {step === 'payment' ? '1' : step === 'details' ? '2' : '3'} of 3</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="p-3 hover:bg-slate-50 rounded-full transition-all text-slate-400"><X size={28} /></button>
        </div>
        <div className="h-1.5 bg-slate-100 shrink-0"><div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: step === 'payment' ? '33%' : step === 'details' ? '66%' : '100%' }} /></div>
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">{step === 'payment' && renderPaymentStep()}{step === 'details' && renderDetailsStep()}{step === 'confirm' && renderConfirmStep()}</div>
      </div>
    </div>
  );
};

export default CheckoutModal;