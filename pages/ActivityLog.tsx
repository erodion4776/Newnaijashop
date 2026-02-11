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
  AlertTriangle,
  MessageSquare,
  Bluetooth
} from 'lucide-react';
import { Sale, SaleItem, Product, Staff, Settings } from '../types';
import BluetoothPrintService from '../services/BluetoothPrintService';

interface ActivityLogProps {
  currentUser?: Staff | null;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ currentUser }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isBTPrinting, setIsBTPrinting] = useState(false);

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
  const isSales = currentUser?.role === 'Sales';

  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  }, [selectedDate]);

  const settings = useLiveQuery(() => db.settings.get('app_settings')) as Settings | undefined;
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
    // SECURITY: Sales staff cannot calculate interest
    if (isSales) return 0;
    return sale.items.reduce((acc, item) => {
      const product = productMap[item.productId];
      const cost = product?.cost_price || 0;
      return acc + ((item.price - cost) * item.quantity);
    }, 0);
  };

  const summaryStats = useMemo(() => {
    const stats = { cash: 0, transfer: 0, pos: 0, interest: 0 };
    if (!sales) return stats;
    sales.forEach(sale => {
      const method = sale.payment_method.toLowerCase();
      if (!isSales) stats.interest += calculateInterest(sale);
      
      if (method === 'cash') stats.cash += sale.total_amount;
      else if (method === 'transfer' || method === 'bank transfer') stats.transfer += sale.total_amount;
      else if (method === 'pos' || method === 'card') stats.pos += sale.total_amount;
      else if (method === 'split') {
        stats.cash += (sale.cash_amount || 0);
        stats.pos += (sale.total_amount - (sale.cash_amount || 0));
      }
    });
    return stats;
  }, [sales, productMap, isSales]);

  const formatCurrency = (val: number, isSensitive: boolean = false) => {
    if (isSensitive && (isSales || !showSensitiveData)) return "₦ ****";
    return `₦${Math.floor(val).toLocaleString()}`;
  };

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    if (!searchTerm) return sales;
    const term = searchTerm.toLowerCase();
    return sales.filter(s => s.sale_id?.toLowerCase().includes(term) || s.staff_name?.toLowerCase().includes(term));
  }, [sales, searchTerm]);

  const handleDeleteSale = async (e: React.MouseEvent, sale: Sale) => {
    e.stopPropagation();
    if (currentUser?.role !== 'Admin') return;
    if (!confirm(`Are you sure? This will delete the sale and return items to stock.`)) return;
    setIsProcessingAction(true);
    try {
      await db.audit_trail.add({
        action: 'Sale Record Deleted',
        details: `Deleted Sale #${sale.sale_id.substring(0,8)} | Total: ₦${sale.total_amount.toLocaleString()} | Items: ${sale.items.length}`,
        staff_name: currentUser?.name || 'Admin',
        timestamp: Date.now()
      });

      await (db as any).transaction('rw', [db.sales, db.products, db.inventory_logs], async () => {
        for (const item of sale.items) {
          const product = await db.products.get(item.productId);
          if (product) {
            const oldStock = Number(product.stock_qty);
            await db.products.update(item.productId, { stock_qty: oldStock + item.quantity });
            await db.inventory_logs.add({
              product_id: item.productId,
              product_name: product.name,
              quantity_changed: item.quantity,
              old_stock: oldStock,
              new_stock: oldStock + item.quantity,
              type: 'Return',
              timestamp: Date.now(),
              performed_by: `Sale #${sale.sale_id.substring(0,8)} Deleted`
            });
          }
        }
        await db.sales.delete(sale.id!);
      });
    } finally { setIsProcessingAction(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4 bg-white p-2 pl-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <Calendar className="text-slate-400" size={18} />
          <input type="date" className="py-3 pr-6 bg-transparent outline-none font-bold text-slate-800" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
        {isAdmin && (
          <button onClick={() => setShowSensitiveData(!showSensitiveData)} className="px-6 py-3 rounded-2xl border bg-white font-black text-xs uppercase tracking-widest">{showSensitiveData ? 'Hide Profit' : 'Show Profit'}</button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Cash', val: summaryStats.cash, icon: <Wallet size={20}/>, bg: 'bg-emerald-50', text: 'text-emerald-600' },
          { label: 'Total Transfer', val: summaryStats.transfer, icon: <Landmark size={20}/>, bg: 'bg-blue-50', text: 'text-blue-600' },
          { label: 'Total POS', val: summaryStats.pos, icon: <CreditCard size={20}/>, bg: 'bg-purple-50', text: 'text-purple-600' },
          { label: 'Total Interest', val: summaryStats.interest, icon: <Coins size={20}/>, bg: 'bg-amber-50', text: 'text-amber-600', sensitive: true, hide: isSales }
        ].filter(s => !s.hide).map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 ${stat.bg} ${stat.text} rounded-xl flex items-center justify-center shrink-0`}>{stat.icon}</div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-sm font-black text-slate-900">{formatCurrency(stat.val, stat.sensitive)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input type="text" placeholder="Search by Staff or ID..." className="w-full h-16 pl-14 pr-6 bg-white border border-slate-200 rounded-[2rem] outline-none font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="space-y-3">
        {filteredSales.map((sale) => (
          <div key={sale.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between hover:border-emerald-200 cursor-pointer active:scale-[0.98]" onClick={() => setSelectedSale(sale)}>
            <div className="w-1/3 truncate">
              <span className="text-xs font-black text-slate-500">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <p className="text-[9px] font-mono text-slate-400 truncate">ID: {sale.sale_id.substring(0, 12)}...</p>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200`}>{sale.payment_method}</span>
            </div>
            <div className="w-1/3 flex flex-col items-end gap-2">
              <p className="text-xl font-black text-slate-900">₦{sale.total_amount.toLocaleString()}</p>
              {currentUser?.role === 'Admin' && <button onClick={(e) => handleDeleteSale(e, sale)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>}
            </div>
          </div>
        ))}
      </div>

      {selectedSale && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">Sale Details</h3>
              <button onClick={() => setSelectedSale(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
               <div className="text-center pb-6 border-b-2 border-dashed border-slate-100">
                  <h4 className="text-2xl font-black text-slate-900">{settings?.shop_name}</h4>
                  <p className="text-[9px] font-mono text-slate-300 mt-4 break-all">TX: {selectedSale.sale_id}</p>
               </div>
               <div className="space-y-4">
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-sm">
                      <div className="flex-1 pr-4">
                        <span className="text-slate-800 font-bold block">{item.name}</span>
                        <span className="text-[10px] text-slate-400">Qty: {item.quantity} x ₦{item.price.toLocaleString()}</span>
                      </div>
                      <span className="font-black">₦{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
               </div>
               <div className="pt-6 border-t-2 border-dashed border-slate-100 space-y-3">
                  <div className="flex justify-between items-center"><span className="text-xs font-black uppercase">Total</span><span className="text-3xl font-black text-emerald-600">₦{selectedSale.total_amount.toLocaleString()}</span></div>
               </div>
               <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => window.print()} className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><Printer size={16} /> Print</button>
                  <button onClick={() => {
                    const itemsText = selectedSale.items.map(i => `${i.name} x${i.quantity} = ₦${(i.price * i.quantity).toLocaleString()}`).join('\n');
                    const text = `RECEIPT: ${selectedSale.sale_id}\nTOTAL: ₦${selectedSale.total_amount.toLocaleString()}\nITEMS:\n${itemsText}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }} className="py-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><MessageSquare size={16} /> Share via WhatsApp</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;