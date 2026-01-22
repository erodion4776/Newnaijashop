
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  History, 
  Calendar, 
  Search, 
  Receipt, 
  Share2, 
  Printer, 
  User, 
  Clock, 
  X,
  CreditCard,
  Banknote,
  Users,
  ChevronRight,
  TrendingUp,
  FileText,
  Loader2,
  Landmark,
  ShieldCheck,
  Wallet,
  Coins,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Plus,
  Minus,
  Save,
  AlertTriangle
} from 'lucide-react';
import { Sale, SaleItem, Product, Staff } from '../types';

interface ActivityLogProps {
  currentUser?: Staff | null;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ currentUser }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  }, [selectedDate]);

  const settings = useLiveQuery(() => db.settings.get('app_settings'));
  const products = useLiveQuery(() => db.products.toArray()) || [];

  const sales = useLiveQuery(
    () => db.sales.where('timestamp').between(dateRange.start, dateRange.end).reverse().toArray(),
    [dateRange]
  );

  const productMap = useMemo(() => {
    const map: Record<number, Product> = {};
    products.forEach(p => { if (p.id) map[p.id] = p; });
    return map;
  }, [products]);

  const calculateInterest = (sale: Sale) => {
    return sale.items.reduce((acc, item) => {
      const product = productMap[item.productId];
      const cost = product?.cost_price || 0;
      return acc + ((item.price - cost) * item.quantity);
    }, 0);
  };

  const summaryStats = useMemo(() => {
    const stats = {
      cash: 0,
      transfer: 0,
      pos: 0,
      interest: 0
    };

    if (!sales) return stats;

    sales.forEach(sale => {
      const method = sale.payment_method.toLowerCase();
      stats.interest += calculateInterest(sale);

      if (method === 'cash') {
        stats.cash += sale.total_amount;
      } else if (method === 'transfer' || method === 'bank transfer') {
        stats.transfer += sale.total_amount;
      } else if (method === 'pos' || method === 'card') {
        stats.pos += sale.total_amount;
      } else if (method === 'split') {
        stats.cash += (sale.cash_amount || 0);
        stats.pos += (sale.total_amount - (sale.cash_amount || 0));
      }
    });

    return stats;
  }, [sales, productMap]);

  const formatCurrency = (val: number, isSensitive: boolean = false) => {
    if (isSensitive && !showSensitiveData) return "₦ ****";
    return `₦${Math.floor(val).toLocaleString()}`;
  };

  const getPaymentBadgeStyle = (method: string) => {
    const m = method.toLowerCase();
    if (m === 'cash') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (m.includes('transfer') || m === 'pos') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    if (!searchTerm) return sales;
    const term = searchTerm.toLowerCase();
    return sales.filter(s => 
      s.sale_id?.toLowerCase().includes(term) || 
      s.staff_name?.toLowerCase().includes(term) ||
      s.payment_method.toLowerCase().includes(term)
    );
  }, [sales, searchTerm]);

  const handleDeleteSale = async (e: React.MouseEvent, sale: Sale) => {
    e.stopPropagation();
    if (currentUser?.role !== 'Admin') return;
    if (!confirm(`Are you sure? This will delete the sale and return all items to stock.`)) return;

    setIsProcessingAction(true);
    try {
      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        // 1. Restore items to stock
        for (const item of sale.items) {
          const product = await db.products.get(item.productId);
          if (product) {
            const oldStock = product.stock_qty;
            const newStock = oldStock + item.quantity;
            await db.products.update(item.productId, { stock_qty: newStock });
            
            // 2. Log restoration
            await db.inventory_logs.add({
              product_id: item.productId,
              product_name: product.name,
              quantity_changed: item.quantity,
              old_stock: oldStock,
              new_stock: newStock,
              type: 'Return',
              timestamp: Date.now(),
              performed_by: `Sale #${sale.sale_id.substring(0,8)} Deleted (Admin)`
            });
          }
        }
        
        // 3. Delete sale record
        await db.sales.delete(sale.id!);
      });
    } catch (err) {
      alert("Delete failed: " + err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleEditSale = (e: React.MouseEvent, sale: Sale) => {
    e.stopPropagation();
    if (currentUser?.role !== 'Admin') return;
    // Clone to avoid modifying the reference before save
    setEditingSale(JSON.parse(JSON.stringify(sale)));
  };

  const updateEditItemQty = (productId: number, delta: number) => {
    if (!editingSale) return;
    setEditingSale(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map(item => {
          if (item.productId === productId) {
            return { ...item, quantity: Math.max(1, item.quantity + delta) };
          }
          return item;
        })
      };
    });
  };

  const removeEditItem = (productId: number) => {
    if (!editingSale) return;
    if (editingSale.items.length <= 1) {
      alert("A sale must have at least one item. Consider deleting the entire sale instead.");
      return;
    }
    setEditingSale(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.filter(item => item.productId !== productId)
      };
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSale || !editingSale.id || currentUser?.role !== 'Admin') return;
    setIsProcessingAction(true);
    
    try {
      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        const originalSale = await db.sales.get(editingSale.id!);
        if (!originalSale) return;

        // 1. Revert original stock for all items in the original sale
        for (const item of originalSale.items) {
          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, { stock_qty: product.stock_qty + item.quantity });
          }
        }

        // 2. Deduct new stock for all items in the edited sale
        for (const item of editingSale.items) {
          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, { stock_qty: Math.max(0, product.stock_qty - item.quantity) });
          }
        }

        // 3. Recalculate totals
        const newTotal = editingSale.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        
        // 4. Update Sale Record
        await db.sales.update(editingSale.id!, {
          items: editingSale.items,
          total_amount: newTotal,
          subtotal: newTotal
        });

        // 5. Log action
        await db.inventory_logs.add({
          product_id: 0,
          product_name: "Adjusted Sale Items",
          quantity_changed: 0,
          old_stock: 0,
          new_stock: 0,
          type: 'Adjustment',
          timestamp: Date.now(),
          performed_by: `Sale #${editingSale.sale_id.substring(0,8)} Edited (Admin)`
        });
      });
      setEditingSale(null);
    } catch (err) {
      alert("Edit failed: " + err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="flex items-center gap-4 bg-white p-2 pl-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <Calendar className="text-slate-400" size={18} />
          <input type="date" className="py-3 pr-6 bg-transparent outline-none font-bold text-slate-800 cursor-pointer" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>

        <button 
          onClick={() => setShowSensitiveData(!showSensitiveData)} 
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all shadow-sm font-black text-xs uppercase tracking-widest ${showSensitiveData ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          {showSensitiveData ? <EyeOff size={18} /> : <Eye size={18} />}
          {showSensitiveData ? 'Hide Profit' : 'Show Profit'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Cash</p>
            <p className="text-sm font-black text-slate-900">{formatCurrency(summaryStats.cash)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Landmark size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Transfer</p>
            <p className="text-sm font-black text-slate-900">{formatCurrency(summaryStats.transfer)}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <CreditCard size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total POS/Card</p>
            <p className="text-sm font-black text-slate-900">{formatCurrency(summaryStats.pos)}</p>
          </div>
        </div>

        <div className="bg-amber-50 p-5 rounded-[2rem] border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0">
            <Coins size={20} />
          </div>
          <div>
            <p className="text-[9px] font-black text-amber-600/60 uppercase tracking-widest">Total Interest</p>
            <p className="text-sm font-black text-amber-700">{formatCurrency(summaryStats.interest, true)}</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input type="text" placeholder="Search by Staff or ID..." className="w-full h-16 pl-14 pr-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm outline-none font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="space-y-3">
        {filteredSales.length === 0 && !sales ? (
           <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-50">
             <Loader2 size={48} className="animate-spin text-emerald-600" />
             <p className="font-black text-xs uppercase tracking-widest">Loading Records...</p>
           </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-20 text-center bg-white border border-dashed border-slate-200 rounded-[3rem] space-y-4">
            <History size={64} className="mx-auto text-slate-100" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No sales found for this date</p>
          </div>
        ) : (
          filteredSales.map((sale) => {
            const interest = calculateInterest(sale);
            const timeStr = new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return (
              <div 
                key={sale.id} 
                className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between hover:border-emerald-200 transition-all cursor-pointer group active:scale-[0.98]"
                onClick={() => setSelectedSale(sale)}
              >
                <div className="w-1/3 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock size={12} className="text-slate-300" />
                    <span className="text-xs font-black text-slate-500 tabular-nums">{timeStr}</span>
                  </div>
                  <p className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter truncate">
                    ID: {sale.sale_id.substring(0, 12)}...
                  </p>
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1 flex items-center gap-1">
                    <User size={8} /> {sale.staff_name || 'System'}
                  </p>
                </div>

                <div className="flex-1 flex flex-col items-center">
                  <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border ${getPaymentBadgeStyle(sale.payment_method)}`}>
                    {sale.payment_method}
                  </span>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profit:</span>
                    <span className="text-[11px] font-black text-slate-700">
                      {showSensitiveData ? `₦${Math.floor(interest).toLocaleString()}` : "₦ ****"}
                    </span>
                  </div>
                </div>

                <div className="w-1/3 flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 tracking-tight leading-none">
                      ₦{sale.total_amount.toLocaleString()}
                    </p>
                    <div className="mt-2">
                      {sale.sync_status === 'synced' ? (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                          <ShieldCheck size={10} /> Audited
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black text-amber-500 uppercase tracking-widest">
                          <Clock size={10} /> Local
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {currentUser?.role === 'Admin' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => handleEditSale(e, sale)}
                        className="p-2 bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-xl transition-all border border-slate-100"
                        title="Edit Sale"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteSale(e, sale)}
                        className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all border border-slate-100"
                        title="Delete Sale"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedSale && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Digital Receipt</h3>
              <button onClick={() => setSelectedSale(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
               <div className="text-center pb-6 border-b-2 border-dashed border-slate-100">
                  <h4 className="text-2xl font-black text-slate-900">{settings?.shop_name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Terminal Audit Log</p>
                  <p className="text-[9px] font-mono text-slate-300 mt-4 break-all uppercase">TX: {selectedSale.sale_id}</p>
               </div>
               <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Items Purchased</p>
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-sm">
                      <div className="flex-1 pr-4">
                        <span className="text-slate-800 font-bold block">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Qty: {item.quantity} x ₦{item.price.toLocaleString()}</span>
                      </div>
                      <span className="font-black text-slate-900">₦{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
               </div>
               <div className="pt-6 border-t-2 border-dashed border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Payment Mode</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getPaymentBadgeStyle(selectedSale.payment_method)}`}>
                      {selectedSale.payment_method}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-800 uppercase text-xs">Total Amount</span>
                    <span className="text-3xl font-black text-emerald-600 tracking-tighter">₦{selectedSale.total_amount.toLocaleString()}</span>
                  </div>
               </div>
               <div className="bg-slate-50 p-5 rounded-[2rem] flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
                  <div className="space-y-1">
                    <span>Logged By</span>
                    <p className="text-slate-800">{selectedSale.staff_name || 'System Terminal'}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <span>Audit Status</span>
                    <p className={selectedSale.sync_status === 'synced' ? 'text-emerald-600' : 'text-amber-600'}>
                      {selectedSale.sync_status === 'synced' ? 'Verified' : 'Pending Audit'}
                    </p>
                  </div>
               </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
               <button onClick={() => setSelectedSale(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest active:scale-[0.98] transition-all">Close Receipt</button>
            </div>
          </div>
        </div>
      )}

      {editingSale && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Edit Sale Record</h3>
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Admin Authorization Active</p>
              </div>
              <button onClick={() => setEditingSale(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                <AlertTriangle className="text-amber-600 shrink-0" size={18} />
                <p className="text-[11px] font-medium text-amber-800 leading-relaxed">
                  Adjusting quantities will automatically return or deduct stock from inventory. Removing an item returns its full quantity to stock.
                </p>
              </div>

              <div className="space-y-4">
                {editingSale.items.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{item.name}</p>
                      <p className="text-[10px] font-black text-emerald-600 uppercase">₦{item.price.toLocaleString()} / Unit</p>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                      <button 
                        onClick={() => updateEditItemQty(item.productId, -1)}
                        className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-black text-sm w-6 text-center tabular-nums">{item.quantity}</span>
                      <button 
                        onClick={() => updateEditItemQty(item.productId, 1)}
                        className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <button 
                      onClick={() => removeEditItem(item.productId)}
                      className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 space-y-4">
               <div className="flex justify-between items-center px-2">
                  <span className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Adjusted Total</span>
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">
                    ₦{editingSale.items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toLocaleString()}
                  </span>
               </div>
               
               <div className="flex gap-3">
                 <button 
                  onClick={() => setEditingSale(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest"
                 >
                   Cancel
                 </button>
                 <button 
                  onClick={handleSaveEdit}
                  disabled={isProcessingAction}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                 >
                   {isProcessingAction ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                   Save & Sync Stock
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
