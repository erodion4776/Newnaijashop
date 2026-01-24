
import React, { useState } from 'react';
import { 
  X, 
  CheckCircle, 
  Calendar, 
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
  const [saleDate, setSaleDate] = useState<string>(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });

  if (!isOpen) return null;

  const payableTotal = total;
  const changeAmount = (paymentType === 'cash' && Number(cashAmount) > payableTotal) ? (Number(cashAmount) - payableTotal) : 0;

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
        payment_method: paymentType,
        cash_amount: paymentType === 'split' ? cashAmount : (paymentType === 'cash' ? payableTotal : 0),
        staff_id: currentUser?.id?.toString() || '0',
        staff_name: currentUser?.name || 'Staff',
        timestamp: saleTimestamp,
        sync_status: 'pending'
      };

      let lowItems: string[] = [];

      // CORE TRANSACTION (Sales & Stock Guard)
      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        await db.sales.add(saleData);
        for (const item of cart) {
          if (!item.isStockAlreadyDeducted) {
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
                type: 'Sale',
                timestamp: Date.now(),
                performed_by: currentUser?.name || 'Staff'
              });
              if (newStock <= (product.low_stock_threshold || 5)) lowItems.push(product.name);
            }
          }
        }
      });

      // Close modal and finalize
      setIsProcessing(false);
      onComplete(saleData, lowItems);
      onClose();
    } catch (error) {
      console.error("Critical Sale Error:", error);
      alert('Error: Could not save sale. The database might be busy.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center lg:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-white lg:rounded-[3rem] w-full h-full lg:h-auto lg:max-w-md animate-in slide-in-from-bottom-full lg:zoom-in duration-300 flex flex-col relative shadow-2xl">
        <div className="p-8 border-b flex items-center justify-between">
          <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Payable</p><h3 className="text-4xl font-black text-slate-900">₦{payableTotal.toLocaleString()}</h3></div>
          <button onClick={onClose} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 transition-colors"><X size={24} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2 ml-1"><Calendar size={12} /> Sale Date & Time</label>
            <input type="datetime-local" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold focus:ring-2 focus:ring-emerald-500" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              {['cash', 'transfer', 'pos', 'split'].map(m => (
                <button key={m} onClick={() => setPaymentType(m as any)} className={`py-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${paymentType === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`}>
                  <span className="font-black uppercase text-[10px] tracking-widest">{m}</span>
                </button>
              ))}
            </div>
          </div>

          {paymentType === 'cash' && (
            <div className="animate-in slide-in-from-top-4 space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Cash Received (₦)</label>
              <input autoFocus type="number" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none font-black text-3xl text-center focus:ring-2 focus:ring-emerald-500" value={cashAmount || ''} onChange={e => setCashAmount(Number(e.target.value))} />
              {Number(changeAmount) > 0 && (
                <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase">Change Due</p>
                  <p className="text-2xl font-black text-amber-700">₦{Number(changeAmount).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-8 border-t bg-white">
          <button disabled={isProcessing || !paymentType} onClick={handleCompleteSale} className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-xl hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4 transition-all">
            {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={28} />} {isProcessing ? 'Saving Sale...' : 'Complete Sale'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
