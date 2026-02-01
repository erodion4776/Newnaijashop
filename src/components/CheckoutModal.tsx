import React, { useState } from 'react';
import { 
  X, 
  CheckCircle, 
  Calendar, 
  Loader2,
  Wallet,
  CreditCard,
  Building2,
  Banknote,
  Calculator,
  ArrowRight,
  Phone,
  User as UserIcon,
  AlertCircle
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

  const changeAmount = paymentMethod === 'cash' && cashAmount > total ? cashAmount - total : 0;
  const splitPosAmount = paymentMethod === 'split' ? total - splitCashAmount : 0;

  // Quick Cash Presets
  const cashPresets = [
    Math.ceil(total / 1000) * 1000, // Round up to nearest thousand
    Math.ceil(total / 5000) * 5000, // Round up to nearest 5k
    Math.ceil(total / 10000) * 10000, // Round up to nearest 10k
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 3);

  const handleCompleteSale = async () => {
    if (!paymentMethod) {
      alert('Please select a payment method');
      return;
    }

    if (paymentMethod === 'cash' && cashAmount < total) {
      alert('Cash amount is insufficient');
      return;
    }

    if (paymentMethod === 'split' && (splitCashAmount + splitPosAmount) !== total) {
      alert('Split payment amounts must equal total');
      return;
    }

    setIsProcessing(true);

    try {
      const saleId = crypto.randomUUID ? crypto.randomUUID() : `SAL-${Date.now()}`;
      const saleTimestamp = new Date(saleDate).getTime();

      const saleData: Sale = {
        sale_id: saleId,
        items: [...cart],
        total_amount: total,
        subtotal: total,
        payment_method: paymentMethod,
        cash_amount: paymentMethod === 'split' ? splitCashAmount : (paymentMethod === 'cash' ? cashAmount : 0),
        customer_phone: customerPhone || undefined,
        staff_id: currentUser?.id?.toString() || '0',
        staff_name: currentUser?.name || 'Staff',
        timestamp: saleTimestamp,
        sync_status: 'pending'
      };

      let lowItems: string[] = [];

      // CORE TRANSACTION
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

              if (newStock <= (product.low_stock_threshold || 5)) {
                lowItems.push(product.name);
              }
            }
          }
        }
      });

      setIsProcessing(false);
      onComplete(saleData, lowItems);
      
      // Reset state
      setStep('payment');
      setPaymentMethod(null);
      setCashAmount(total);
      setCustomerName('');
      setCustomerPhone('');
      
    } catch (error) {
      console.error("Sale Error:", error);
      alert('Error: Could not complete sale');
      setIsProcessing(false);
    }
  };

  const renderPaymentStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-3xl font-black text-slate-900 mb-2">Select Payment</h3>
        <p className="text-5xl font-black text-emerald-600">₦{total.toLocaleString()}</p>
      </div>

      {/* Payment Methods Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'cash' as PaymentMethod, label: 'Cash', icon: Wallet, color: 'emerald' },
          { id: 'transfer' as PaymentMethod, label: 'Transfer', icon: Building2, color: 'blue' },
          { id: 'pos' as PaymentMethod, label: 'POS Card', icon: CreditCard, color: 'purple' },
          { id: 'split' as PaymentMethod, label: 'Split Pay', icon: Calculator, color: 'amber' }
        ].map(method => (
          <button
            key={method.id}
            onClick={() => setPaymentMethod(method.id)}
            className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${
              paymentMethod === method.id
                ? `bg-emerald-600 border-emerald-600 text-white shadow-2xl scale-105`
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <method.icon size={32} />
            <span className="font-black text-sm uppercase tracking-wider">{method.label}</span>
          </button>
        ))}
      </div>

      {/* Cash Input */}
      {paymentMethod === 'cash' && (
        <div className="bg-emerald-50 border-2 border-emerald-100 rounded-3xl p-6 space-y-4 animate-in slide-in-from-top-4">
          <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">
            Cash Received
          </label>
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            className="w-full px-6 py-5 text-4xl font-black text-center bg-white border-2 border-emerald-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-300"
            value={cashAmount || ''}
            onChange={(e) => setCashAmount(Number(e.target.value))}
          />
          
          {/* Quick Presets */}
          <div className="grid grid-cols-3 gap-2">
            {cashPresets.map(preset => (
              <button
                key={preset}
                onClick={() => setCashAmount(preset)}
                className="py-3 bg-white border border-emerald-200 rounded-xl font-bold text-sm text-emerald-700 hover:bg-emerald-100 transition-all"
              >
                ₦{(preset / 1000).toFixed(0)}k
              </button>
            ))}
          </div>

          {/* Change Display */}
          {changeAmount > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-xs font-black text-amber-700 uppercase mb-1">Change Due</p>
              <p className="text-3xl font-black text-amber-800">₦{changeAmount.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      {/* Split Payment */}
      {paymentMethod === 'split' && (
        <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-6 space-y-4 animate-in slide-in-from-top-4">
          <div>
            <label className="block text-xs font-black text-amber-700 uppercase tracking-wider mb-2">
              Cash Amount
            </label>
            <input
              type="number"
              inputMode="numeric"
              className="w-full px-6 py-4 text-3xl font-black text-center bg-white border-2 border-amber-200 rounded-2xl outline-none focus:ring-4 focus:ring-amber-300"
              value={splitCashAmount || ''}
              onChange={(e) => setSplitCashAmount(Math.min(total, Number(e.target.value)))}
            />
          </div>
          <div className="text-center py-2">
            <ArrowRight className="mx-auto text-amber-400" size={24} />
          </div>
          <div>
            <label className="block text-xs font-black text-amber-700 uppercase tracking-wider mb-2">
              POS Amount (Auto)
            </label>
            <div className="px-6 py-4 text-3xl font-black text-center bg-white border-2 border-amber-200 rounded-2xl text-amber-700">
              ₦{splitPosAmount.toLocaleString()}
            </div>
          </div>

          {splitCashAmount + splitPosAmount !== total && (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-xl">
              <AlertCircle size={16} />
              <p className="text-xs font-bold">Total must equal ₦{total.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      {/* Transfer/POS Info */}
      {(paymentMethod === 'transfer' || paymentMethod === 'pos') && (
        <div className={`${paymentMethod === 'transfer' ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100'} border-2 rounded-3xl p-6 text-center space-y-3 animate-in slide-in-from-top-4`}>
          <div className={`w-16 h-16 ${paymentMethod === 'transfer' ? 'bg-blue-100' : 'bg-purple-100'} rounded-full flex items-center justify-center mx-auto`}>
            {paymentMethod === 'transfer' ? <Building2 size={32} className="text-blue-600" /> : <CreditCard size={32} className="text-purple-600" />}
          </div>
          <h4 className="font-black text-lg">
            {paymentMethod === 'transfer' ? 'Bank Transfer' : 'POS Card Payment'}
          </h4>
          <p className="text-sm text-slate-600 font-medium">
            {paymentMethod === 'transfer' 
              ? 'Please confirm you received the bank alert before completing this sale.'
              : 'Ensure the POS machine shows "Transaction Approved" before proceeding.'}
          </p>
        </div>
      )}

      {/* Continue Button */}
      {paymentMethod && (
        <button
          onClick={() => setStep('details')}
          disabled={
            (paymentMethod === 'cash' && cashAmount < total) ||
            (paymentMethod === 'split' && splitCashAmount + splitPosAmount !== total)
          }
          className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          Continue to Details
          <ArrowRight size={24} />
        </button>
      )}
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-black text-slate-900 mb-1">Customer Details</h3>
        <p className="text-sm text-slate-500">(Optional)</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase mb-2">
            <UserIcon size={14} />
            Customer Name
          </label>
          <input
            type="text"
            placeholder="Enter customer name (optional)"
            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase mb-2">
            <Phone size={14} />
            Phone Number
          </label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="Enter phone number (optional)"
            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase mb-2">
            <Calendar size={14} />
            Sale Date & Time
          </label>
          <input
            type="datetime-local"
            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setStep('payment')}
          className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
        >
          Back
        </button>
        <button
          onClick={() => setStep('confirm')}
          className="py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
        >
          Review Sale
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-black text-slate-900 mb-2">Confirm Sale</h3>
        <p className="text-sm text-slate-500">Review before completing</p>
      </div>

      {/* Sale Summary Card */}
      <div className="bg-slate-50 rounded-3xl p-6 space-y-4">
        
        {/* Payment Method Badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase">Payment Method</span>
          <span className={`px-4 py-2 rounded-full font-black text-xs uppercase ${
            paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' :
            paymentMethod === 'transfer' ? 'bg-blue-100 text-blue-700' :
            paymentMethod === 'pos' ? 'bg-purple-100 text-purple-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {paymentMethod === 'split' ? 'Cash + POS' : paymentMethod?.toUpperCase()}
          </span>
        </div>

        {/* Items Summary */}
        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs font-bold text-slate-500 uppercase mb-3">Items ({cart.length})</p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-slate-700">{item.name} <span className="text-slate-400">×{item.quantity}</span></span>
                <span className="font-bold">₦{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="border-t border-slate-200 pt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-600 font-medium">Total</span>
            <span className="text-2xl font-black text-slate-900">₦{total.toLocaleString()}</span>
          </div>
          
          {paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Cash Received</span>
                <span className="font-bold text-emerald-600">₦{cashAmount.toLocaleString()}</span>
              </div>
              {changeAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Change</span>
                  <span className="font-bold text-amber-600">₦{changeAmount.toLocaleString()}</span>
                </div>
              )}
            </>
          )}

          {paymentMethod === 'split' && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Cash</span>
                <span className="font-bold">₦{splitCashAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">POS</span>
                <span className="font-bold">₦{splitPosAmount.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>

        {/* Customer Info */}
        {(customerName || customerPhone) && (
          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Customer</p>
            {customerName && <p className="text-sm font-medium text-slate-700">{customerName}</p>}
            {customerPhone && <p className="text-sm text-slate-500">{customerPhone}</p>}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setStep('details')}
          disabled={isProcessing}
          className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleCompleteSale}
          disabled={isProcessing}
          className="py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle size={20} />
              Complete Sale
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center lg:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white lg:rounded-[3rem] w-full h-full lg:h-auto lg:max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full lg:zoom-in duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Checkout</h2>
              <p className="text-xs text-slate-500 font-medium">Step {step === 'payment' ? '1' : step === 'details' ? '2' : '3'} of 3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-3 hover:bg-slate-100 rounded-full transition-all disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-100 shrink-0">
          <div 
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: step === 'payment' ? '33%' : step === 'details' ? '66%' : '100%' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {step === 'payment' && renderPaymentStep()}
          {step === 'details' && renderDetailsStep()}
          {step === 'confirm' && renderConfirmStep()}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;